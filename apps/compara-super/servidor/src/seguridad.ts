/** Contraseñas (PBKDF2-SHA256), sesiones (token aleatorio guardado como hash) y límites de intentos. */
import type { Usuario } from './tipos';

/** Cloudflare Workers no admite más de 100 000 iteraciones de PBKDF2. */
export const ITERACIONES_PBKDF2 = 100_000;
export const DURACION_SESION_MS = 30 * 24 * 60 * 60_000;
export const NOMBRE_COOKIE = 'sesion';

const codificador = new TextEncoder();

function aBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s);
}
function deBase64(texto: string): Uint8Array {
  return Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
}
function aHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparación en tiempo constante. */
function igualesSeguro(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a[i] ^ b[i];
  return dif === 0;
}

async function derivar(contrasena: string, sal: Uint8Array, iteraciones: number): Promise<Uint8Array> {
  const llave = await crypto.subtle.importKey('raw', codificador.encode(contrasena), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones },
    llave,
    256,
  );
  return new Uint8Array(bits);
}

export async function cifrarContrasena(contrasena: string): Promise<{ hash: string; sal: string; iteraciones: number }> {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivar(contrasena, sal, ITERACIONES_PBKDF2);
  return { hash: aBase64(hash), sal: aBase64(sal), iteraciones: ITERACIONES_PBKDF2 };
}

export async function verificarContrasena(
  contrasena: string,
  guardado: { hash: string; sal: string; iteraciones: number },
): Promise<boolean> {
  const calculado = await derivar(contrasena, deBase64(guardado.sal), guardado.iteraciones);
  return igualesSeguro(calculado, deBase64(guardado.hash));
}

/** Gasta el mismo tiempo que una verificación real (para no revelar si el correo existe por la demora). */
export async function verificacionFicticia(contrasena: string): Promise<void> {
  await derivar(contrasena, new Uint8Array(16), ITERACIONES_PBKDF2);
}

export function nuevoToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return aBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function hashToken(token: string): Promise<string> {
  return aHex(await crypto.subtle.digest('SHA-256', codificador.encode(token)));
}

export function cookieSesion(token: string): string {
  return `${NOMBRE_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DURACION_SESION_MS / 1000}`;
}
export function cookieBorrar(): string {
  return `${NOMBRE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function leerCookie(req: Request, nombre: string): string | undefined {
  const cabecera = req.headers.get('Cookie');
  if (!cabecera) return undefined;
  for (const parte of cabecera.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nombre) return v.join('=') || undefined;
  }
  return undefined;
}

export async function crearSesion(db: D1Database, usuarioId: string): Promise<string> {
  const token = nuevoToken();
  const ahora = Date.now();
  await db.batch([
    db.prepare('DELETE FROM sesiones WHERE usuario_id = ? AND vence_en < ?').bind(usuarioId, ahora),
    db
      .prepare('INSERT INTO sesiones (token_hash, usuario_id, creado_en, vence_en) VALUES (?, ?, ?, ?)')
      .bind(await hashToken(token), usuarioId, ahora, ahora + DURACION_SESION_MS),
  ]);
  return token;
}

export async function usuarioDeSesion(db: D1Database, req: Request): Promise<Usuario | null> {
  const token = leerCookie(req, NOMBRE_COOKIE);
  if (!token || token.length > 100 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  const fila = await db
    .prepare(
      `SELECT u.id, u.correo FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token_hash = ? AND s.vence_en > ?`,
    )
    .bind(await hashToken(token), Date.now())
    .first<Usuario>();
  return fila ?? null;
}

export async function borrarSesion(db: D1Database, req: Request): Promise<void> {
  const token = leerCookie(req, NOMBRE_COOKIE);
  if (!token || token.length > 100) return;
  await db.prepare('DELETE FROM sesiones WHERE token_hash = ?').bind(await hashToken(token)).run();
}

// ---------------------------------------------------------------------------
// Límites simples guardados en D1
// ---------------------------------------------------------------------------

export interface ReglaLimite {
  maximo: number;
  ventanaMs: number;
  bloqueoMs: number;
}

export const LIMITES = {
  /** Intentos fallidos de entrar por correo: 5 en 15 min → bloqueo 15 min. */
  entrar: { maximo: 5, ventanaMs: 15 * 60_000, bloqueoMs: 15 * 60_000 },
  /** Registros por IP: 10 por hora. */
  registro: { maximo: 10, ventanaMs: 60 * 60_000, bloqueoMs: 60 * 60_000 },
  /** Búsquedas por usuario: 40 cada 10 min (protege las páginas de los súper). */
  buscar: { maximo: 40, ventanaMs: 10 * 60_000, bloqueoMs: 5 * 60_000 },
  /** Comparaciones por usuario: 10 cada 10 min. */
  comparar: { maximo: 10, ventanaMs: 10 * 60_000, bloqueoMs: 5 * 60_000 },
} satisfies Record<string, ReglaLimite>;

/** Segundos que faltan si la clave está bloqueada; 0 si puede continuar. No cuenta el intento. */
export async function estaBloqueado(db: D1Database, clave: string): Promise<number> {
  const fila = await db
    .prepare('SELECT bloqueado_hasta FROM limites WHERE clave = ?')
    .bind(clave)
    .first<{ bloqueado_hasta: number }>();
  const ahora = Date.now();
  return fila && fila.bloqueado_hasta > ahora ? Math.ceil((fila.bloqueado_hasta - ahora) / 1000) : 0;
}

/** Suma un intento. Si supera el máximo dentro de la ventana, bloquea. Devuelve segundos de bloqueo (0 = ok). */
export async function contarIntento(db: D1Database, clave: string, regla: ReglaLimite): Promise<number> {
  const ahora = Date.now();
  const fila = await db
    .prepare(
      `INSERT INTO limites (clave, contador, ventana_inicio, bloqueado_hasta) VALUES (?1, 1, ?2, 0)
       ON CONFLICT(clave) DO UPDATE SET
         contador = CASE WHEN ventana_inicio < ?2 - ?3 THEN 1 ELSE contador + 1 END,
         ventana_inicio = CASE WHEN ventana_inicio < ?2 - ?3 THEN ?2 ELSE ventana_inicio END
       RETURNING contador, bloqueado_hasta`,
    )
    .bind(clave, ahora, regla.ventanaMs)
    .first<{ contador: number; bloqueado_hasta: number }>();
  if (fila && fila.bloqueado_hasta > ahora) return Math.ceil((fila.bloqueado_hasta - ahora) / 1000);
  if (fila && fila.contador > regla.maximo) {
    await db
      .prepare('UPDATE limites SET bloqueado_hasta = ?, contador = 0, ventana_inicio = ? WHERE clave = ?')
      .bind(ahora + regla.bloqueoMs, ahora, clave)
      .run();
    return Math.ceil(regla.bloqueoMs / 1000);
  }
  return 0;
}

export async function reiniciarLimite(db: D1Database, clave: string): Promise<void> {
  await db.prepare('DELETE FROM limites WHERE clave = ?').bind(clave).run();
}
