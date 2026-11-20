// Inicio de sesión con PIN, sesiones y permisos por rol.

import { HttpError, ahoraIso, entero, json, leerCuerpo } from './http';
import type { Env, Rol, Usuario } from './tipos';

const DURACION_SESION_MS = 16 * 60 * 60 * 1000; // 16 horas
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 60 * 1000; // 1 minuto

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

export async function login(request: Request, env: Env): Promise<Response> {
  const cuerpo = await leerCuerpo(request);
  const usuarioId = entero(cuerpo.usuario_id, 1, Number.MAX_SAFE_INTEGER, 'Elige tu nombre para entrar.');
  const pin = cuerpo.pin;
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
    throw new HttpError(400, 'El PIN debe tener 4 dígitos.');
  }

  const u = await env.DB.prepare(
    `SELECT id, nombre, rol, pin_hash, pin_sal, intentos_fallidos, bloqueado_hasta
       FROM usuarios WHERE id = ? AND activo = 1`,
  )
    .bind(usuarioId)
    .first<FilaUsuarioLogin>();

  const ahora = new Date();
  const ahoraTxt = ahora.toISOString();

  if (!u) {
    // Se calcula un hash de todos modos para que el tiempo de respuesta no
    // revele si el usuario existe.
    await sha256Hex('0000000000000000' + pin);
    throw new HttpError(401, 'PIN incorrecto');
  }

  if (u.bloqueado_hasta && u.bloqueado_hasta > ahoraTxt) {
    throw new HttpError(429, 'Demasiados intentos con PIN incorrecto. Espera un minuto e intenta de nuevo.');
  }

  const hash = await sha256Hex(u.pin_sal + pin);
  if (!igualesTiempoConstante(hash, u.pin_hash)) {
    // Si el bloqueo anterior ya venció, se empieza a contar de nuevo.
    const intentosPrevios = u.bloqueado_hasta ? 0 : u.intentos_fallidos;
    const intentos = intentosPrevios + 1;
    if (intentos >= MAX_INTENTOS) {
      const hasta = new Date(ahora.getTime() + BLOQUEO_MS).toISOString();
      await env.DB.prepare(`UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = ? WHERE id = ?`)
        .bind(hasta, u.id)
        .run();
      throw new HttpError(429, 'Demasiados intentos con PIN incorrecto. Espera un minuto e intenta de nuevo.');
    }
    await env.DB.prepare(`UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = NULL WHERE id = ?`)
      .bind(intentos, u.id)
      .run();
    throw new HttpError(401, 'PIN incorrecto');
  }

  const token = tokenNuevo();
  const tokenHash = await sha256Hex(token);
  const expira = new Date(ahora.getTime() + DURACION_SESION_MS).toISOString();

  await env.DB.batch([
    env.DB.prepare(`UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?`).bind(u.id),
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
