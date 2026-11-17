/** Contraseñas (PBKDF2-SHA256), sesiones (token aleatorio guardado como hash) y límites de intentos. */
import type { Usuario } from './tipos';

/** Cloudflare Workers no admite más de 100 000 iteraciones de PBKDF2. */
export const ITERACIONES_PBKDF2 = 100_000;
export const DURACION_SESION_MS = 30 * 24 * 60 * 60_000;
export const NOMBRE_COOKIE = 'sesion';
export const NOMBRE_COOKIE_DISPOSITIVO = 'dispositivo';
export const DURACION_DISPOSITIVO_MS = 365 * 24 * 60 * 60_000;
/** Máximo de dispositivos de confianza por cuenta (se olvidan los usados hace más tiempo). */
export const MAX_DISPOSITIVOS = 20;

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

/** Cookie del dispositivo de confianza: solo viaja a /api/auth (donde se usa), 1 año. */
export function cookieDispositivo(token: string): string {
  return `${NOMBRE_COOKIE_DISPOSITIVO}=${token}; Path=/api/auth; HttpOnly; Secure; SameSite=Strict; Max-Age=${DURACION_DISPOSITIVO_MS / 1000}`;
}
export function cookieDispositivoBorrar(): string {
  return `${NOMBRE_COOKIE_DISPOSITIVO}=; Path=/api/auth; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
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
// Dispositivos de confianza (tabla "dispositivos", migración 0003)
// ---------------------------------------------------------------------------

function tokenDeCookie(req: Request, nombre: string): string | undefined {
  const token = leerCookie(req, nombre);
  return token && token.length <= 100 && /^[A-Za-z0-9_-]+$/.test(token) ? token : undefined;
}

/**
 * Si la petición trae una cookie "dispositivo" de confianza (vigente) para esa cuenta,
 * devuelve el hash del token; si no, null.
 */
export async function dispositivoConfiable(db: D1Database, req: Request, usuarioId: string): Promise<string | null> {
  const token = tokenDeCookie(req, NOMBRE_COOKIE_DISPOSITIVO);
  if (!token) return null;
  const hash = await hashToken(token);
  const fila = await db
    .prepare('SELECT 1 AS ok FROM dispositivos WHERE token_hash = ? AND usuario_id = ? AND vence_en > ?')
    .bind(hash, usuarioId, Date.now())
    .first();
  return fila ? hash : null;
}

/**
 * Marca este navegador como de confianza para la cuenta (tras entrar o registrarse bien) y
 * devuelve el token para la cookie. Si el navegador ya tenía un token conocido (de esta u otra
 * cuenta: teléfono compartido) se reutiliza; si no, se crea uno nuevo. Renueva el año de vigencia
 * y deja como máximo MAX_DISPOSITIVOS por cuenta.
 */
export async function recordarDispositivo(db: D1Database, req: Request, usuarioId: string): Promise<string> {
  const ahora = Date.now();
  let token = tokenDeCookie(req, NOMBRE_COOKIE_DISPOSITIVO);
  if (token) {
    const conocido = await db
      .prepare('SELECT 1 AS ok FROM dispositivos WHERE token_hash = ? AND vence_en > ? LIMIT 1')
      .bind(await hashToken(token), ahora)
      .first();
    if (!conocido) token = undefined;
  }
  token ??= nuevoToken();
  await db.batch([
    db
      .prepare(
        `INSERT INTO dispositivos (token_hash, usuario_id, creado_en, usado_en, vence_en) VALUES (?1, ?2, ?3, ?3, ?4)
         ON CONFLICT(token_hash, usuario_id) DO UPDATE SET usado_en = ?3, vence_en = ?4`,
      )
      .bind(await hashToken(token), usuarioId, ahora, ahora + DURACION_DISPOSITIVO_MS),
    db
      .prepare(
        `DELETE FROM dispositivos WHERE usuario_id = ?1 AND (vence_en <= ?2 OR token_hash NOT IN (
           SELECT token_hash FROM dispositivos WHERE usuario_id = ?1 ORDER BY usado_en DESC LIMIT ?3))`,
      )
      .bind(usuarioId, ahora, MAX_DISPOSITIVOS),
  ]);
  return token;
}

// ---------------------------------------------------------------------------
// Límites simples guardados en D1
// ---------------------------------------------------------------------------

export interface ReglaLimite {
  maximo: number;
  ventanaMs: number;
  bloqueoMs: number;
}

const MIN = 60_000;

/**
 * Valores por defecto. Cada máximo se puede cambiar con una variable en
 * wrangler.toml ([vars]); las ventanas de tiempo son fijas.
 */
export const LIMITES_POR_DEFECTO = {
  /**
   * Contraseñas incorrectas para un correo desde una misma conexión (IP), SIN dispositivo de
   * confianza: 5 en 15 min → espera 15 min (solo ese correo en esa IP). Se reinicia al entrar bien.
   */
  entrarCorreoIp: { maximo: 5, ventanaMs: 15 * MIN, bloqueoMs: 15 * MIN },
  /**
   * Contraseñas incorrectas desde una misma IP sumando todos los correos, SIN dispositivo de
   * confianza: 100 en 15 min → espera 15 min. Alto a propósito: Tigo/Claro (CGNAT) ponen a
   * cientos de personas detrás de una misma IP.
   */
  entrarIp: { maximo: 100, ventanaMs: 15 * MIN, bloqueoMs: 15 * MIN },
  /**
   * Contraseñas incorrectas para un correo desde cualquier IP, SIN dispositivo de confianza:
   * 10 en 1 hora → durante 1 hora ese correo solo puede entrar desde sus dispositivos de
   * confianza. Es lo que hace impráctico adivinar desde miles de IP (≈10 intentos por hora).
   */
  entrarCorreo: { maximo: 10, ventanaMs: 60 * MIN, bloqueoMs: 60 * MIN },
  /**
   * Contraseñas incorrectas desde un dispositivo de confianza de esa cuenta: 10 en 15 min →
   * espera 15 min solo en ese dispositivo. Nadie más puede sumar a este contador.
   */
  entrarDispositivo: { maximo: 10, ventanaMs: 15 * MIN, bloqueoMs: 15 * MIN },
  /** Registros por IP: 30 por hora (en Honduras muchas personas comparten IP con Tigo/Claro). */
  registro: { maximo: 30, ventanaMs: 60 * MIN, bloqueoMs: 30 * MIN },
  /** Búsquedas por persona: 60 cada 10 min (protege las páginas de los súper; hay caché de 30 min). */
  buscar: { maximo: 60, ventanaMs: 10 * MIN, bloqueoMs: 5 * MIN },
  /** Comparaciones por persona: 30 cada 10 min. */
  comparar: { maximo: 30, ventanaMs: 10 * MIN, bloqueoMs: 5 * MIN },
} satisfies Record<string, ReglaLimite>;

export type NombreLimite = keyof typeof LIMITES_POR_DEFECTO;
export type Limites = Record<NombreLimite, ReglaLimite>;

/** Variable de wrangler.toml que cambia el máximo de cada límite. */
export const VARIABLE_LIMITE: Record<NombreLimite, string> = {
  entrarCorreoIp: 'LIMITE_ENTRAR_CORREO_IP',
  entrarIp: 'LIMITE_ENTRAR_IP',
  entrarCorreo: 'LIMITE_ENTRAR_CORREO',
  entrarDispositivo: 'LIMITE_ENTRAR_DISPOSITIVO',
  registro: 'LIMITE_REGISTROS_IP',
  buscar: 'LIMITE_BUSQUEDAS',
  comparar: 'LIMITE_COMPARACIONES',
};

/** Límites con los máximos de las variables de entorno (si son enteros de 1 a 100 000; si no, el valor por defecto). */
export function leerLimites(env: object): Limites {
  const vars = env as Record<string, unknown>;
  const salida = {} as Limites;
  for (const nombre of Object.keys(LIMITES_POR_DEFECTO) as NombreLimite[]) {
    const base = LIMITES_POR_DEFECTO[nombre];
    const crudo = vars[VARIABLE_LIMITE[nombre]];
    const n = typeof crudo === 'string' && /^\d{1,6}$/.test(crudo.trim()) ? Number(crudo.trim()) : NaN;
    salida[nombre] = { ...base, maximo: n >= 1 && n <= 100_000 ? n : base.maximo };
  }
  return salida;
}

/**
 * IP de quien hace la petición (cabecera CF-Connecting-IP que pone Cloudflare).
 * Las IPv6 se agrupan por su red /64 (una casa suele tener una /64 entera y
 * podría cambiar de dirección para saltarse el límite). Sin cabecera
 * (desarrollo local) devuelve "local".
 */
export function ipDe(req: Request): string {
  const crudo = (req.headers.get('CF-Connecting-IP') ?? '').trim().toLowerCase();
  if (!crudo) return 'local';
  if (crudo.length > 45 || !/^[0-9a-f:.]+$/.test(crudo)) return 'desconocida';
  if (!crudo.includes(':')) return crudo;
  const mapeada = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(crudo);
  if (mapeada) return mapeada[1];
  const [cabeza, cola] = crudo.split('::');
  const a = cabeza ? cabeza.split(':') : [];
  const b = cola ? cola.split(':') : [];
  const relleno = crudo.includes('::') ? Array(Math.max(0, 8 - a.length - b.length)).fill('0') : [];
  const partes = [...a, ...relleno, ...b].slice(0, 4).map((h) => (parseInt(h, 16) || 0).toString(16));
  return `${partes.join(':')}::/64`;
}

/**
 * Segundos que faltan si alguna de las claves está bloqueada (el mayor); 0 si
 * puede continuar. No cuenta el intento.
 */
export async function estaBloqueado(db: D1Database, ...claves: string[]): Promise<number> {
  if (claves.length === 0) return 0;
  const fila = await db
    .prepare(`SELECT MAX(bloqueado_hasta) AS hasta FROM limites WHERE clave IN (${claves.map(() => '?').join(',')})`)
    .bind(...claves)
    .first<{ hasta: number | null }>();
  const ahora = Date.now();
  const hasta = fila?.hasta ?? 0;
  return hasta > ahora ? Math.ceil((hasta - ahora) / 1000) : 0;
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
