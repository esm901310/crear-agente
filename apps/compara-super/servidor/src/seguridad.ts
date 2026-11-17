/** Contraseñas (PBKDF2-SHA256), sesiones (token aleatorio guardado como hash) y límites de intentos. */
import type { Usuario } from './tipos';

/** Cloudflare Workers no admite más de 100 000 iteraciones de PBKDF2. */
export const ITERACIONES_PBKDF2 = 100_000;
export const DURACION_SESION_MS = 30 * 24 * 60 * 60_000;
export const NOMBRE_COOKIE = 'sesion';
/**
 * Prefijo __Secure-: el navegador solo acepta esta cookie si llega por HTTPS con Secure, así nadie
 * puede colocarla desde una página HTTP (p. ej. en una red Wi-Fi ajena).
 */
export const NOMBRE_COOKIE_DISPOSITIVO = '__Secure-dispositivo';
export const DURACION_DISPOSITIVO_MS = 365 * 24 * 60 * 60_000;
/** Máximo de dispositivos de confianza por cuenta (se olvidan los usados hace más tiempo). */
export const MAX_DISPOSITIVOS = 20;
/**
 * Un navegador compartido guarda un token POR CUENTA en la misma cookie, separados por punto:
 * "tokenAna.tokenBeto". Como máximo 5 (el de la cuenta que acaba de entrar va primero).
 */
export const MAX_TOKENS_COOKIE = 5;
/** Tokens que se aceptan leer de una petición (sumando cookies repetidas); el resto se ignora. */
const MAX_TOKENS_LEIDOS = 20;
const TOKEN_VALIDO = /^[A-Za-z0-9_-]{20,100}$/;

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

/**
 * Cookie del dispositivo de confianza: solo viaja a /api/auth (donde se usa), 1 año.
 * `valor` = uno o varios tokens separados por punto (ver MAX_TOKENS_COOKIE).
 */
export function cookieDispositivo(valor: string): string {
  return `${NOMBRE_COOKIE_DISPOSITIVO}=${valor}; Path=/api/auth; HttpOnly; Secure; SameSite=Strict; Max-Age=${DURACION_DISPOSITIVO_MS / 1000}`;
}

/** Todos los valores de una cookie (si el navegador manda el mismo nombre varias veces, vienen todos). */
export function leerCookies(req: Request, nombre: string): string[] {
  const cabecera = req.headers.get('Cookie');
  if (!cabecera) return [];
  const valores: string[] = [];
  for (const parte of cabecera.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nombre && v.join('=')) valores.push(v.join('='));
  }
  return valores;
}

/** Primer valor de una cookie (para la de sesión). */
export function leerCookie(req: Request, nombre: string): string | undefined {
  return leerCookies(req, nombre)[0];
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

interface TokenDispositivo {
  token: string;
  hash: string;
}

/**
 * Todos los tokens de dispositivo que trae la petición: de todas las cookies con ese nombre
 * (repetidas incluidas) y de cada valor "token1.token2". Sin repetidos, con formato válido,
 * como máximo MAX_TOKENS_LEIDOS.
 */
async function tokensDispositivo(req: Request): Promise<TokenDispositivo[]> {
  const vistos = new Set<string>();
  for (const valor of leerCookies(req, NOMBRE_COOKIE_DISPOSITIVO)) {
    for (const t of valor.split('.')) {
      if (vistos.size >= MAX_TOKENS_LEIDOS) break;
      if (TOKEN_VALIDO.test(t)) vistos.add(t);
    }
  }
  return Promise.all([...vistos].map(async (token) => ({ token, hash: await hashToken(token) })));
}

/** Dueños (usuario_id) vigentes de cada hash de la lista. */
async function duenosDe(db: D1Database, hashes: string[], ahora: number): Promise<Map<string, Set<string>>> {
  const salida = new Map<string, Set<string>>();
  if (hashes.length === 0) return salida;
  const filas = await db
    .prepare(
      `SELECT token_hash, usuario_id FROM dispositivos
       WHERE vence_en > ? AND token_hash IN (${hashes.map(() => '?').join(',')})`,
    )
    .bind(ahora, ...hashes)
    .all<{ token_hash: string; usuario_id: string }>();
  for (const f of filas.results ?? []) {
    if (!salida.has(f.token_hash)) salida.set(f.token_hash, new Set());
    salida.get(f.token_hash)!.add(f.usuario_id);
  }
  return salida;
}

/**
 * Si la petición trae un token de dispositivo de confianza (vigente) que pertenece a ESA cuenta,
 * devuelve su hash; si no, null. Los tokens de otras cuentas no cuentan para nada.
 */
export async function dispositivoConfiable(db: D1Database, req: Request, usuarioId: string): Promise<string | null> {
  const tokens = await tokensDispositivo(req);
  if (tokens.length === 0) return null;
  const fila = await db
    .prepare(
      `SELECT token_hash FROM dispositivos WHERE usuario_id = ? AND vence_en > ?
       AND token_hash IN (${tokens.map(() => '?').join(',')}) LIMIT 1`,
    )
    .bind(usuarioId, Date.now(), ...tokens.map((t) => t.hash))
    .first<{ token_hash: string }>();
  return fila?.token_hash ?? null;
}

/**
 * Marca este navegador como de confianza para la cuenta (tras entrar o registrarse bien) y
 * devuelve el VALOR para la cookie. Solo se reutiliza un token que ya pertenece a ESTA cuenta;
 * si no hay, se crea uno nuevo (nunca se adopta el token de otra cuenta: así nadie puede
 * "plantar" su token en el navegador de otra persona y luego usarlo contra su cuenta).
 * Los tokens vigentes de otras cuentas que ya traía la cookie se conservan detrás (teléfono
 * compartido), hasta MAX_TOKENS_COOKIE en total. Renueva el año de vigencia y deja como máximo
 * MAX_DISPOSITIVOS por cuenta.
 */
export async function recordarDispositivo(db: D1Database, req: Request, usuarioId: string): Promise<string> {
  const ahora = Date.now();
  const tokens = await tokensDispositivo(req);
  const duenos = await duenosDe(db, tokens.map((t) => t.hash), ahora);
  const propio = tokens.find((t) => duenos.get(t.hash)?.has(usuarioId));
  const token = propio?.token ?? nuevoToken();
  const otros = tokens.filter((t) => t.token !== token && duenos.has(t.hash)).map((t) => t.token);
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
  return [token, ...otros].slice(0, MAX_TOKENS_COOKIE).join('.');
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

/** Un intento ya reservado: con `ventana` se puede devolver más tarde (ver devolverIntento). */
export interface Reserva {
  clave: string;
  /** ventana_inicio de la fila al reservar. */
  ventana: number;
}

/**
 * Sentencia ÚNICA (atómica) que reserva un intento: suma 1 al contador y, si con eso pasa del
 * máximo, deja la clave bloqueada (contador a 0, ventana nueva). Como es una sola sentencia, dos
 * peticiones simultáneas nunca reciben el mismo número: con ráfagas en paralelo pasan como máximo
 * `maximo` intentos por ventana.
 * No hace NADA (no devuelve fila) si alguna de `todas` las claves del intento ya está bloqueada:
 * así un intento frenado por un contador no sube los otros (una ráfaga desde una IP bloqueada no
 * puede llenar el contador global del correo).
 * En SQLite todas las expresiones de SET usan los valores ANTERIORES de la fila.
 */
function sentenciaReservar(
  db: D1Database,
  clave: string,
  regla: ReglaLimite,
  ahora: number,
  todas: string[],
): D1PreparedStatement {
  const lista = todas.map((_, i) => `?${i + 6}`).join(',');
  return db
    .prepare(
      `INSERT INTO limites (clave, contador, ventana_inicio, bloqueado_hasta)
         SELECT ?1, 1, ?2, CASE WHEN 1 > ?4 THEN ?2 + ?5 ELSE 0 END
         WHERE NOT EXISTS (SELECT 1 FROM limites WHERE clave IN (${lista}) AND bloqueado_hasta > ?2)
       ON CONFLICT(clave) DO UPDATE SET
         contador = CASE
           WHEN bloqueado_hasta > ?2 THEN contador
           WHEN ventana_inicio <= ?2 - ?3 THEN 1
           WHEN contador + 1 > ?4 THEN 0
           ELSE contador + 1 END,
         ventana_inicio = CASE
           WHEN bloqueado_hasta > ?2 THEN ventana_inicio
           WHEN ventana_inicio <= ?2 - ?3 THEN ?2
           WHEN contador + 1 > ?4 THEN ?2
           ELSE ventana_inicio END,
         bloqueado_hasta = CASE
           WHEN bloqueado_hasta > ?2 THEN bloqueado_hasta
           WHEN ventana_inicio <= ?2 - ?3 THEN 0
           WHEN contador + 1 > ?4 THEN ?2 + ?5
           ELSE bloqueado_hasta END
       RETURNING ventana_inicio, bloqueado_hasta`,
    )
    .bind(clave, ahora, regla.ventanaMs, regla.maximo, regla.bloqueoMs, ...todas);
}

/**
 * Reserva un intento en cada clave ANTES de hacer el trabajo caro, en un solo lote (D1 ejecuta el
 * lote como una transacción: nada se intercala). Responde los segundos de espera (el mayor de las
 * claves; 0 = puede seguir y el intento ya quedó contado en todas).
 * - Si alguna clave ya estaba bloqueada, no se cuenta nada.
 * - Si ESTE intento hace que una clave se bloquee, las claves anteriores del lote sí sumaron:
 *   se les devuelve el intento (pasa una sola vez por bloqueo, no en cada intento frenado).
 */
export async function reservarIntentos(
  db: D1Database,
  contadores: Array<{ clave: string; regla: ReglaLimite }>,
): Promise<{ bloqueo: number; reservas: Reserva[] }> {
  const ahora = Date.now();
  const claves = contadores.map((c) => c.clave);
  const resultados = await db.batch<{ ventana_inicio?: number; bloqueado_hasta?: number; hasta?: number | null }>([
    ...contadores.map((c) => sentenciaReservar(db, c.clave, c.regla, ahora, claves)),
    db
      .prepare(`SELECT MAX(bloqueado_hasta) AS hasta FROM limites WHERE clave IN (${claves.map(() => '?').join(',')})`)
      .bind(...claves),
  ]);
  const hasta = resultados[contadores.length]?.results?.[0]?.hasta ?? 0;
  const bloqueo = hasta > ahora ? Math.ceil((hasta - ahora) / 1000) : 0;
  // Reservas que sí contaron (devolvieron fila y no quedaron bloqueadas).
  const reservas: Reserva[] = [];
  contadores.forEach((c, i) => {
    const fila = resultados[i]?.results?.[0];
    if (fila && (fila.bloqueado_hasta ?? 0) <= ahora) {
      reservas.push({ clave: c.clave, ventana: fila.ventana_inicio ?? 0 });
    }
  });
  if (bloqueo) {
    await devolverIntentos(db, reservas);
    return { bloqueo, reservas: [] };
  }
  return { bloqueo, reservas };
}

/** Reserva un intento en una sola clave. Devuelve segundos de bloqueo (0 = ok). */
export async function contarIntento(db: D1Database, clave: string, regla: ReglaLimite): Promise<number> {
  return (await reservarIntentos(db, [{ clave, regla }])).bloqueo;
}

/**
 * Devuelve (resta 1) intentos reservados que al final no deben contar. Solo si la fila sigue en la
 * misma ventana y sin bloqueo (si la ventana cambió, ese intento ya no está en el contador).
 */
export async function devolverIntentos(db: D1Database, reservas: Reserva[]): Promise<void> {
  if (reservas.length === 0) return;
  const ahora = Date.now();
  await db.batch(
    reservas.map((r) =>
      db
        .prepare(
          `UPDATE limites SET contador = contador - 1
           WHERE clave = ? AND ventana_inicio = ? AND contador > 0 AND bloqueado_hasta <= ?`,
        )
        .bind(r.clave, r.ventana, ahora),
    ),
  );
}

export async function reiniciarLimite(db: D1Database, clave: string): Promise<void> {
  await db.prepare('DELETE FROM limites WHERE clave = ?').bind(clave).run();
}
