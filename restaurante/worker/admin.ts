// Entrega 3: panel del dueño — mesas y usuarios.

import { sha256Hex } from './auth';
import { HttpError, ahoraIso, json, leerCuerpo, entero } from './http';
import { booleano, claveNombre, esNombreRepetido, nombreValido } from './texto';
import type { Env, MesaAdmin, Rol, Usuario, UsuarioAdmin } from './tipos';

const ROLES: readonly Rol[] = ['mesero', 'cocina', 'caja', 'dueno'];

function errorTexto(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ---------------------------------------------------------------------------
// Mesas

const SQL_MESAS = `SELECT m.id, m.nombre, m.activo, m.orden,
                          EXISTS (SELECT 1 FROM ordenes o WHERE o.mesa_id = m.id AND o.estado = 'abierta') AS tiene
                     FROM mesas m`;

interface FilaMesa {
  id: number;
  nombre: string;
  activo: number;
  orden: number;
  tiene: number;
}

function aMesa(f: FilaMesa): MesaAdmin {
  return { id: f.id, nombre: f.nombre, activa: f.activo === 1, orden: f.orden, tiene_cuenta_abierta: f.tiene === 1 };
}

async function mesaOError(env: Env, id: number): Promise<MesaAdmin> {
  const f = await env.DB.prepare(`${SQL_MESAS} WHERE m.id = ?`).bind(id).first<FilaMesa>();
  if (!f) throw new HttpError(404, 'No se encontró esa mesa.');
  return aMesa(f);
}

const MSG_MESA_REPETIDA = 'Ya existe una mesa activa con ese nombre.';
const MSG_MESA_CON_CUENTA = 'No se puede desactivar: la mesa tiene una cuenta abierta. Cóbrala o cancélala primero.';

/** GET /api/admin/mesas — todas (también inactivas), en su orden. */
export async function adminMesas(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(`${SQL_MESAS} ORDER BY m.orden, m.id`).all<FilaMesa>();
  return json(results.map(aMesa));
}

/** POST /api/admin/mesas — { nombre }. Queda activa, al final del orden. */
export async function crearMesa(request: Request, env: Env): Promise<Response> {
  const cuerpo = await leerCuerpo(request);
  const nombre = nombreValido(cuerpo.nombre, 'el nombre de la mesa');
  let fila: { id: number } | null;
  try {
    fila = await env.DB.prepare(
      `INSERT INTO mesas (nombre, nombre_clave, activo, orden)
       VALUES (?, ?, 1, (SELECT COALESCE(MAX(orden), 0) + 1 FROM mesas)) RETURNING id`,
    )
      .bind(nombre, claveNombre(nombre))
      .first<{ id: number }>();
  } catch (e) {
    if (esNombreRepetido(e)) throw new HttpError(409, MSG_MESA_REPETIDA);
    throw e;
  }
  if (!fila) throw new HttpError(500, 'No se pudo crear la mesa. Intenta de nuevo.');
  return json(await mesaOError(env, fila.id), 201);
}

/** PUT /api/admin/mesas/:id — { nombre?, activa? }. 409 si se desactiva con cuenta abierta. */
export async function editarMesa(request: Request, env: Env, id: number): Promise<Response> {
  const cuerpo = await leerCuerpo(request);
  const actual = await mesaOError(env, id);
  const nombre = cuerpo.nombre === undefined ? actual.nombre : nombreValido(cuerpo.nombre, 'el nombre de la mesa');
  const activa =
    cuerpo.activa === undefined ? actual.activa : booleano(cuerpo.activa, 'Indica si la mesa está activa (sí o no).');
  if (!activa && actual.activa && actual.tiene_cuenta_abierta) throw new HttpError(409, MSG_MESA_CON_CUENTA);
  try {
    // El trigger trg_mesas_no_desactivar_con_cuenta vuelve a revisar en el mismo
    // instante (por si un mesero abre la mesa justo ahora).
    await env.DB.prepare(`UPDATE mesas SET nombre = ?, nombre_clave = ?, activo = ? WHERE id = ?`)
      .bind(nombre, claveNombre(nombre), activa ? 1 : 0, id)
      .run();
  } catch (e) {
    if (esNombreRepetido(e)) throw new HttpError(409, MSG_MESA_REPETIDA);
    if (errorTexto(e).includes('MESA_CON_CUENTA')) throw new HttpError(409, MSG_MESA_CON_CUENTA);
    throw e;
  }
  return json(await mesaOError(env, id));
}

/** POST /api/admin/mesas/orden — { ids } (todas, en el nuevo orden). Extra, no está en el contrato. */
export async function ordenarMesas(request: Request, env: Env): Promise<Response> {
  const cuerpo = await leerCuerpo(request);
  const mensaje = 'Manda todas las mesas (también las inactivas), cada una una sola vez, en el nuevo orden.';
  const { results } = await env.DB.prepare(`SELECT id FROM mesas`).all<{ id: number }>();
  if (!Array.isArray(cuerpo.ids) || cuerpo.ids.length > 1000) throw new HttpError(400, mensaje);
  const ids = cuerpo.ids.map((v: unknown) => entero(v, 1, Number.MAX_SAFE_INTEGER, mensaje));
  const set = new Set(ids);
  if (set.size !== ids.length || set.size !== results.length || results.some((r) => !set.has(r.id))) {
    throw new HttpError(400, mensaje);
  }
  if (ids.length > 0) {
    await env.DB.batch(ids.map((mid, i) => env.DB.prepare(`UPDATE mesas SET orden = ? WHERE id = ?`).bind(i + 1, mid)));
  }
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// Usuarios

const SQL_USUARIOS = `SELECT u.id, u.nombre, u.rol, u.activo,
                             (SELECT COUNT(*) FROM sesiones s WHERE s.usuario_id = u.id AND s.expira > ?1) AS sesiones_abiertas
                        FROM usuarios u`;

interface FilaUsuario {
  id: number;
  nombre: string;
  rol: Rol;
  activo: number;
  sesiones_abiertas: number;
}

function aUsuario(f: FilaUsuario): UsuarioAdmin {
  return { id: f.id, nombre: f.nombre, rol: f.rol, activo: f.activo === 1, sesiones_abiertas: f.sesiones_abiertas };
}

async function usuarioOError(env: Env, id: number): Promise<UsuarioAdmin> {
  const f = await env.DB.prepare(`${SQL_USUARIOS} WHERE u.id = ?2`).bind(ahoraIso(), id).first<FilaUsuario>();
  if (!f) throw new HttpError(404, 'No se encontró ese usuario.');
  return aUsuario(f);
}

const MSG_USUARIO_REPETIDO = 'Ya existe un usuario activo con ese nombre.';
const MSG_ULTIMO_DUENO = 'Debe quedar al menos un dueño activo. No se le puede quitar el rol ni desactivar al último.';

function rolValido(valor: unknown): Rol {
  if (typeof valor !== 'string' || !ROLES.includes(valor as Rol)) {
    throw new HttpError(400, 'El rol debe ser mesero, cocina, caja o dueno.');
  }
  return valor as Rol;
}

function pinValido(valor: unknown): string {
  if (typeof valor !== 'string' || !/^\d{4}$/.test(valor)) throw new HttpError(400, 'El PIN debe tener 4 dígitos.');
  return valor;
}

/** Mismo formato que el seed y el login: SHA-256(sal + pin), sal de 16 bytes en hexadecimal. */
async function hashPin(pin: string): Promise<{ hash: string; sal: string }> {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const sal = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return { hash: await sha256Hex(sal + pin), sal };
}

/** GET /api/admin/usuarios — todos (también inactivos), por id. */
export async function adminUsuarios(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(`${SQL_USUARIOS} ORDER BY u.id`).bind(ahoraIso()).all<FilaUsuario>();
  return json(results.map(aUsuario));
}

/** POST /api/admin/usuarios — { nombre, rol, pin }. */
export async function crearUsuario(request: Request, env: Env): Promise<Response> {
  const cuerpo = await leerCuerpo(request);
  const nombre = nombreValido(cuerpo.nombre, 'el nombre de la persona');
  const rol = rolValido(cuerpo.rol);
  const pin = pinValido(cuerpo.pin);
  const { hash, sal } = await hashPin(pin);
  let fila: { id: number } | null;
  try {
    fila = await env.DB.prepare(
      `INSERT INTO usuarios (nombre, nombre_clave, rol, pin_hash, pin_sal, activo) VALUES (?, ?, ?, ?, ?, 1) RETURNING id`,
    )
      .bind(nombre, claveNombre(nombre), rol, hash, sal)
      .first<{ id: number }>();
  } catch (e) {
    if (esNombreRepetido(e)) throw new HttpError(409, MSG_USUARIO_REPETIDO);
    throw e;
  }
  if (!fila) throw new HttpError(500, 'No se pudo crear el usuario. Intenta de nuevo.');
  return json(await usuarioOError(env, fila.id), 201);
}

/**
 * PUT /api/admin/usuarios/:id — { nombre?, rol?, activo? }.
 * - Uno mismo: no puede cambiarse el rol ni desactivarse (409).
 * - Último dueño activo: no se le quita el rol ni se desactiva (409; también lo
 *   protege el trigger trg_usuarios_ultimo_dueno).
 * - Cambiar el rol o desactivar cierra sus sesiones (en la misma transacción).
 */
export async function editarUsuario(request: Request, env: Env, id: number, yo: Usuario): Promise<Response> {
  const cuerpo = await leerCuerpo(request);
  const actual = await usuarioOError(env, id);
  const nombre = cuerpo.nombre === undefined ? actual.nombre : nombreValido(cuerpo.nombre, 'el nombre de la persona');
  const rol = cuerpo.rol === undefined ? actual.rol : rolValido(cuerpo.rol);
  const activo =
    cuerpo.activo === undefined ? actual.activo : booleano(cuerpo.activo, 'Indica si el usuario está activo (sí o no).');

  const cambiaRol = rol !== actual.rol;
  const seDesactiva = actual.activo && !activo;
  if (id === yo.id && cambiaRol) throw new HttpError(409, 'No puedes cambiar tu propio rol.');
  if (id === yo.id && seDesactiva) throw new HttpError(409, 'No puedes desactivarte a ti mismo.');

  const sentencias: D1PreparedStatement[] = [
    env.DB.prepare(`UPDATE usuarios SET nombre = ?, nombre_clave = ?, rol = ?, activo = ? WHERE id = ?`).bind(
      nombre,
      claveNombre(nombre),
      rol,
      activo ? 1 : 0,
      id,
    ),
  ];
  if (cambiaRol || seDesactiva) {
    sentencias.push(env.DB.prepare(`DELETE FROM sesiones WHERE usuario_id = ?`).bind(id));
  }
  try {
    await env.DB.batch(sentencias);
  } catch (e) {
    if (esNombreRepetido(e)) throw new HttpError(409, MSG_USUARIO_REPETIDO);
    if (errorTexto(e).includes('ULTIMO_DUENO')) throw new HttpError(409, MSG_ULTIMO_DUENO);
    throw e;
  }
  return json(await usuarioOError(env, id));
}

/**
 * POST /api/admin/usuarios/:id/pin — { pin }. Cierra TODAS las sesiones de ese
 * usuario (también la del propio dueño si cambia su PIN: vuelve a entrar con el
 * nuevo) y le quita el bloqueo por PIN incorrecto.
 */
export async function cambiarPin(request: Request, env: Env, id: number): Promise<Response> {
  const cuerpo = await leerCuerpo(request);
  const pin = pinValido(cuerpo.pin);
  const { hash, sal } = await hashPin(pin);
  const [upd] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE usuarios SET pin_hash = ?, pin_sal = ?, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?`,
    ).bind(hash, sal, id),
    env.DB.prepare(`DELETE FROM sesiones WHERE usuario_id = ?`).bind(id),
  ]);
  if (upd.meta.changes === 0) throw new HttpError(404, 'No se encontró ese usuario.');
  return json({ ok: true });
}
