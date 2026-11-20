// Inicio de sesión con PIN, sesiones y permisos por rol.

import { HttpError, ahoraIso, entero, json, leerCuerpo } from './http';
import type { Env, Rol, Usuario } from './tipos';

const DURACION_SESION_MS = 16 * 60 * 60 * 1000; // 16 horas
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 60 * 1000; // 1 minuto
const MAX_INTENTOS_IP = 20; // intentos fallidos por IP...
const VENTANA_IP_MS = 10 * 60 * 1000; // ...en 10 minutos
/** Hash con el que se compara cuando el usuario no existe (mismo trabajo que uno real). */
const HASH_FICTICIO = '0'.repeat(64);

const encoder = new TextEncoder();

function aHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += b.toString(16).padStart(2, '0');
  return s;
}

export async function sha256Hex(texto: string): Promise<string> {
  return aHex(await crypto.subtle.digest('SHA-256', encoder.encode(texto)));
}

/** Compara dos textos sin revelar por el tiempo de respuesta cuánto coinciden. */
function igualesTiempoConstante(a: string, b: string): boolean {
  const ba = encoder.encode(a);
  const bb = encoder.encode(b);
  if (ba.byteLength !== bb.byteLength) {
    // Igual se hace una comparación para no responder más rápido.
    crypto.subtle.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.subtle.timingSafeEqual(ba, bb);
}

function tokenNuevo(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return aHex(bytes);
}

// ---------------------------------------------------------------------------

export async function usuariosLogin(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id, nombre, rol FROM usuarios WHERE activo = 1 ORDER BY id`,
  ).all<Usuario>();
  return json(results);
}

interface FilaUsuarioLogin extends Usuario {
  pin_hash: string;
  pin_sal: string;
  intentos_fallidos: number;
  bloqueado_hasta: string | null;
}

const MSG_BLOQUEADO = 'Demasiados intentos con PIN incorrecto. Espera un minuto e intenta de nuevo.';
const MSG_FRENO_IP = 'Demasiados intentos, espera unos minutos.';

/** IP de quien hace la petición (Cloudflare la pone en CF-Connecting-IP; en local puede faltar). */
function ipDe(request: Request): string {
  const ip = (request.headers.get('CF-Connecting-IP') ?? '').trim();
  return ip !== '' && ip.length <= 64 ? ip : 'local';
}

/**
 * Freno por IP. En UNA sentencia atómica suma 1 al contador de la IP (o lo
 * reinicia si su ventana de 10 min ya venció) y devuelve el valor resultante.
 * Se "aparta" el intento ANTES de revisar el PIN; si el PIN resulta correcto
 * se devuelve (ver devolverIntentoIp), así solo cuentan los fallidos.
 */
async function apartarIntentoIp(env: Env, ip: string, ahora: Date): Promise<number> {
  const ahoraTxt = ahora.toISOString();
  const limite = new Date(ahora.getTime() - VENTANA_IP_MS).toISOString();
  const fila = await env.DB.prepare(
    `INSERT INTO freno_ip (ip, intentos, ventana_inicio) VALUES (?1, 1, ?2)
     ON CONFLICT (ip) DO UPDATE SET
       intentos       = CASE WHEN ventana_inicio <= ?3 THEN 1  ELSE intentos + 1 END,
       ventana_inicio = CASE WHEN ventana_inicio <= ?3 THEN ?2 ELSE ventana_inicio END
     RETURNING intentos`,
  )
    .bind(ip, ahoraTxt, limite)
    .first<{ intentos: number }>();
  // Limpieza de filas viejas de vez en cuando (no en cada petición).
  if (Math.random() < 0.05) {
    await env.DB.prepare(`DELETE FROM freno_ip WHERE ventana_inicio <= ?`).bind(limite).run();
  }
  return fila?.intentos ?? MAX_INTENTOS_IP + 1;
}

function devolverIntentoIp(env: Env, ip: string): D1PreparedStatement {
  return env.DB.prepare(`UPDATE freno_ip SET intentos = MAX(intentos - 1, 0) WHERE ip = ?`).bind(ip);
}

export async function login(request: Request, env: Env): Promise<Response> {
  const cuerpo = await leerCuerpo(request);
  const usuarioId = entero(cuerpo.usuario_id, 1, Number.MAX_SAFE_INTEGER, 'Elige tu nombre para entrar.');
  const pin = cuerpo.pin;
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
    throw new HttpError(400, 'El PIN debe tener 4 dígitos.');
  }

  const ahora = new Date();
  const ahoraTxt = ahora.toISOString();
  const ip = ipDe(request);

  // 1) Freno por IP (atómico).
  if ((await apartarIntentoIp(env, ip, ahora)) > MAX_INTENTOS_IP) {
    throw new HttpError(429, MSG_FRENO_IP);
  }

  // 2) Freno por usuario, también atómico y ANTES de comparar el PIN.
  //    En una sola sentencia: si el bloqueo ya venció se empieza a contar de
  //    nuevo; se suma 1 al contador; si con este intento se llega al límite se
  //    fija el bloqueo. RETURNING entrega el valor resultante, así que aunque
  //    lleguen cientos de peticiones a la vez, solo las primeras MAX_INTENTOS
  //    obtienen un número <= MAX_INTENTOS y llegan a comparar el PIN.
  //    (En SET todas las expresiones usan los valores ANTERIORES de la fila.)
  const hastaTxt = new Date(ahora.getTime() + BLOQUEO_MS).toISOString();
  const u = await env.DB.prepare(
    `UPDATE usuarios SET
       intentos_fallidos = CASE
         WHEN bloqueado_hasta IS NOT NULL AND bloqueado_hasta <= ?1 THEN 1
         ELSE intentos_fallidos + 1 END,
       bloqueado_hasta = CASE
         WHEN bloqueado_hasta IS NOT NULL AND bloqueado_hasta > ?1 THEN bloqueado_hasta
         WHEN (CASE WHEN bloqueado_hasta IS NOT NULL THEN 1 ELSE intentos_fallidos + 1 END) >= ?2 THEN ?3
         ELSE NULL END
     WHERE id = ?4 AND activo = 1
     RETURNING id, nombre, rol, pin_hash, pin_sal, intentos_fallidos, bloqueado_hasta`,
  )
    .bind(ahoraTxt, MAX_INTENTOS, hastaTxt, usuarioId)
    .first<FilaUsuarioLogin>();

  if (!u) {
    // Se calcula un hash de todos modos para que el tiempo de respuesta no
    // revele si el usuario existe.
    const h = await sha256Hex('0000000000000000' + pin);
    igualesTiempoConstante(h, HASH_FICTICIO);
    throw new HttpError(401, 'PIN incorrecto');
  }

  if (u.intentos_fallidos > MAX_INTENTOS) {
    // Ya estaba bloqueado (o se agotaron los intentos): ni se revisa el PIN.
    throw new HttpError(429, MSG_BLOQUEADO);
  }

  const hash = await sha256Hex(u.pin_sal + pin);
  if (!igualesTiempoConstante(hash, u.pin_hash)) {
    if (u.intentos_fallidos >= MAX_INTENTOS) {
      // Era el último intento permitido: la cuenta quedó bloqueada.
      throw new HttpError(429, 'PIN incorrecto. Por seguridad, espera un minuto e intenta de nuevo.');
    }
    throw new HttpError(401, 'PIN incorrecto');
  }

  const token = tokenNuevo();
  const tokenHash = await sha256Hex(token);
  const expira = new Date(ahora.getTime() + DURACION_SESION_MS).toISOString();

  await env.DB.batch([
    env.DB.prepare(`UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?`).bind(u.id),
    devolverIntentoIp(env, ip), // el PIN fue correcto: no cuenta como fallido
    env.DB.prepare(`DELETE FROM sesiones WHERE expira <= ?`).bind(ahoraTxt), // limpieza
    env.DB.prepare(`INSERT INTO sesiones (token_hash, usuario_id, creada, expira) VALUES (?, ?, ?, ?)`).bind(
      tokenHash,
      u.id,
      ahoraTxt,
      expira,
    ),
  ]);

  const usuario: Usuario = { id: u.id, nombre: u.nombre, rol: u.rol };
  return json({ token, usuario });
}

/** Devuelve el usuario de la sesión o lanza 401. */
export async function usuarioDeSesion(request: Request, env: Env): Promise<{ usuario: Usuario; tokenHash: string }> {
  const encabezado = request.headers.get('Authorization') ?? '';
  const m = /^Bearer ([0-9a-f]{64})$/i.exec(encabezado.trim());
  if (!m) throw new HttpError(401, 'Tu sesión no es válida. Vuelve a entrar con tu PIN.');
  const tokenHash = await sha256Hex(m[1].toLowerCase());
  const usuario = await env.DB.prepare(
    `SELECT u.id, u.nombre, u.rol
       FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = ? AND s.expira > ? AND u.activo = 1`,
  )
    .bind(tokenHash, ahoraIso())
    .first<Usuario>();
  if (!usuario) throw new HttpError(401, 'Tu sesión expiró. Vuelve a entrar con tu PIN.');
  return { usuario, tokenHash };
}

export function exigirRol(usuario: Usuario, roles: readonly Rol[]): void {
  if (usuario.rol === 'dueno') return; // el dueño puede todo
  if (!roles.includes(usuario.rol)) {
    throw new HttpError(403, 'No tienes permiso para hacer esto.');
  }
}

export async function logout(env: Env, tokenHash: string): Promise<Response> {
  await env.DB.prepare(`DELETE FROM sesiones WHERE token_hash = ?`).bind(tokenHash).run();
  return json({ ok: true });
}
