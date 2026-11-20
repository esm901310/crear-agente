// Menú, mesas, cuentas (órdenes), comandas de cocina y cobro.

import { HttpError, ahoraIso, entero, json, leerCuerpo, pesos } from './http';
import {
  METODOS_PAGO,
  type Comanda,
  type Env,
  type ItemComanda,
  type MesaResumen,
  type MetodoPago,
  type Orden,
  type Pago,
  type Producto,
  type Usuario,
} from './tipos';

const MAX_ITEMS_POR_COMANDA = 50;
const MAX_CANTIDAD = 99;
const MAX_NOTA = 140;
const MAX_PAGOS = 10;
const MAX_MONTO = 100_000_000; // $1,000,000.00 por pago o propina: límite de cordura
const MINUTOS_LISTAS_EN_COCINA = 30;
const MAX_ENVIO_ID = 64;
// Identificador de envío que genera la tablet (UUID). Se aceptan letras, números,
// guion y guion bajo, de 8 a 64 caracteres.
const PATRON_ENVIO_ID = /^[A-Za-z0-9_-]{8,64}$/;
/**
 * Corte a ciegas: meseros y caja solo pueden leer cuentas abiertas o cobradas
 * hace a lo más estos minutos (para la pantalla de "Cuenta cobrada"). Así la
 * caja no puede sumar los cobros del día pidiendo las cuentas por id.
 */
const MINUTOS_VER_COBRADA = 10;

export const MSG_SIN_JORNADA = 'Primero abre el día capturando el fondo de caja.';

// Subconsulta reutilizada: subtotal de una orden (o.id) en centavos.
export const SQL_SUBTOTAL = `COALESCE((SELECT SUM(i.precio * i.cantidad)
                                  FROM items i JOIN comandas c ON c.id = i.comanda_id
                                 WHERE c.orden_id = o.id), 0)`;

// ---------------------------------------------------------------------------
// Lectura de comandas y órdenes completas

interface FilaComanda {
  id: number;
  orden_id: number;
  mesa_nombre: string;
  mesero_nombre: string;
  estado: 'pendiente' | 'listo';
  creada: string;
  listo_en: string | null;
}
interface FilaItem extends ItemComanda {
  comanda_id: number;
}

/** Comandas completas (con items), en el mismo orden que `ids`. */
async function comandasPorIds(env: Env, ids: number[]): Promise<Comanda[]> {
  if (ids.length === 0) return [];
  const lista = JSON.stringify(ids);
  const [rc, ri] = await env.DB.batch([
    env.DB.prepare(
      `SELECT c.id, c.orden_id, m.nombre AS mesa_nombre, u.nombre AS mesero_nombre,
              c.estado, c.creada, c.listo_en
         FROM comandas c
         JOIN ordenes o  ON o.id = c.orden_id
         JOIN mesas m    ON m.id = o.mesa_id
         JOIN usuarios u ON u.id = o.mesero_id
        WHERE c.id IN (SELECT value FROM json_each(?))`,
    ).bind(lista),
    env.DB.prepare(
      `SELECT id, comanda_id, producto_id, nombre, precio, cantidad, nota
         FROM items WHERE comanda_id IN (SELECT value FROM json_each(?))
        ORDER BY id`,
    ).bind(lista),
  ]);
  const itemsPorComanda = new Map<number, ItemComanda[]>();
  for (const f of ri.results as unknown as FilaItem[]) {
    const { comanda_id, ...item } = f;
    let arr = itemsPorComanda.get(comanda_id);
    if (!arr) itemsPorComanda.set(comanda_id, (arr = []));
    arr.push(item);
  }
  const porId = new Map<number, Comanda>();
  for (const f of rc.results as unknown as FilaComanda[]) {
    porId.set(f.id, { ...f, items: itemsPorComanda.get(f.id) ?? [] });
  }
  return ids.map((id) => porId.get(id)).filter((c): c is Comanda => c !== undefined);
}

interface FilaOrden {
  id: number;
  mesa_id: number;
  mesa_nombre: string;
  mesero_id: number;
  mesero_nombre: string;
  estado: 'abierta' | 'pagada';
  creada: string;
  pagada_en: string | null;
  subtotal: number;
  propina: number;
}

/** Órdenes completas, en el mismo orden que `ids`. */
async function ordenesPorIds(env: Env, ids: number[]): Promise<Orden[]> {
  if (ids.length === 0) return [];
  const lista = JSON.stringify(ids);
  const [ro, rc, rp] = await env.DB.batch([
    env.DB.prepare(
      `SELECT o.id, o.mesa_id, m.nombre AS mesa_nombre, o.mesero_id, u.nombre AS mesero_nombre,
              o.estado, o.creada, o.pagada_en, o.propina, ${SQL_SUBTOTAL} AS subtotal
         FROM ordenes o
         JOIN mesas m    ON m.id = o.mesa_id
         JOIN usuarios u ON u.id = o.mesero_id
        WHERE o.id IN (SELECT value FROM json_each(?))`,
    ).bind(lista),
    env.DB.prepare(
      `SELECT id, orden_id FROM comandas
        WHERE orden_id IN (SELECT value FROM json_each(?))
        ORDER BY creada, id`,
    ).bind(lista),
    env.DB.prepare(
      `SELECT id, orden_id, metodo, monto, creado FROM pagos
        WHERE orden_id IN (SELECT value FROM json_each(?))
        ORDER BY id`,
    ).bind(lista),
  ]);

  const comandas = await comandasPorIds(
    env,
    (rc.results as { id: number }[]).map((r) => r.id),
  );
  const comandasPorOrden = new Map<number, Comanda[]>();
  for (const c of comandas) {
    let arr = comandasPorOrden.get(c.orden_id);
    if (!arr) comandasPorOrden.set(c.orden_id, (arr = []));
    arr.push(c);
  }
  const pagosPorOrden = new Map<number, Pago[]>();
  for (const f of rp.results as unknown as (Pago & { orden_id: number })[]) {
    const { orden_id, ...pago } = f;
    let arr = pagosPorOrden.get(orden_id);
    if (!arr) pagosPorOrden.set(orden_id, (arr = []));
    arr.push(pago);
  }

  const porId = new Map<number, Orden>();
  for (const f of ro.results as unknown as FilaOrden[]) {
    porId.set(f.id, {
      id: f.id,
      mesa_id: f.mesa_id,
      mesa_nombre: f.mesa_nombre,
      mesero_id: f.mesero_id,
      mesero_nombre: f.mesero_nombre,
      estado: f.estado,
      creada: f.creada,
      pagada_en: f.pagada_en,
      comandas: comandasPorOrden.get(f.id) ?? [],
      subtotal: f.subtotal,
      propina: f.propina,
      total: f.subtotal + f.propina,
      pagos: pagosPorOrden.get(f.id) ?? [],
    });
  }
  return ids.map((id) => porId.get(id)).filter((o): o is Orden => o !== undefined);
}

/** ¿Puede este usuario ver la cuenta completa (con pagos y propina)? El dueño siempre. */
function puedeVerOrden(orden: Orden, usuario: Usuario): boolean {
  if (usuario.rol === 'dueno' || orden.estado === 'abierta') return true;
  if (orden.pagada_en === null) return false;
  const desde = new Date(Date.now() - MINUTOS_VER_COBRADA * 60 * 1000).toISOString();
  return orden.pagada_en >= desde;
}

async function ordenOError(env: Env, id: number): Promise<Orden> {
  const [orden] = await ordenesPorIds(env, [id]);
  if (!orden) throw new HttpError(404, 'No se encontró esa cuenta.');
  return orden;
}

/** Traduce los errores que lanzan las reglas (triggers) de la base de datos. */
function errorDeRegla(e: unknown): HttpError | null {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('ORDEN_NO_ABIERTA') || msg.includes('ORDEN_YA_PAGADA')) {
    return new HttpError(409, 'Esta cuenta ya fue cobrada.');
  }
  if (msg.includes('ORDEN_SIN_ITEMS')) return new HttpError(400, 'No se puede cobrar una cuenta sin platillos.');
  if (msg.includes('JORNADA_NO_ABIERTA')) return new HttpError(409, MSG_SIN_JORNADA);
  if (msg.includes('PAGOS_NO_CUADRAN')) {
    return new HttpError(409, 'La cuenta cambió mientras se cobraba. Revisa el total e intenta de nuevo.');
  }
  return null;
}

// ---------------------------------------------------------------------------
// Endpoints

export async function menu(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id, nombre, categoria, precio FROM productos
      WHERE activo = 1 ORDER BY categoria, nombre`,
  ).all<Producto>();
  return json(results);
}

export async function mesas(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.nombre,
            o.id AS orden_id,
            o.mesero_id,
            u.nombre AS mesero_nombre,
            CASE WHEN o.id IS NULL THEN 0 ELSE ${SQL_SUBTOTAL} END AS total,
            o.creada AS abierta_en
       FROM mesas m
       LEFT JOIN ordenes o  ON o.mesa_id = m.id AND o.estado = 'abierta'
       LEFT JOIN usuarios u ON u.id = o.mesero_id
      WHERE m.activo = 1
      ORDER BY m.id`,
  ).all<MesaResumen>();
  return json(results);
}

export async function abrirOrden(request: Request, env: Env, usuario: Usuario): Promise<Response> {
  const cuerpo = await leerCuerpo(request);
  const mesaId = entero(cuerpo.mesa_id, 1, Number.MAX_SAFE_INTEGER, 'Elige una mesa.');

  const mesa = await env.DB.prepare(`SELECT id FROM mesas WHERE id = ? AND activo = 1`).bind(mesaId).first();
  if (!mesa) throw new HttpError(404, 'No se encontró esa mesa.');

  // Si ya hay una cuenta abierta, el índice único hace que no se inserte otra
  // (aunque dos meseros toquen la mesa al mismo tiempo).
  const ins = await env.DB.prepare(
    // El id nunca repite el de una cuenta cancelada (ver migración 0004).
    `INSERT INTO ordenes (id, mesa_id, mesero_id, estado, creada)
     SELECT MAX(COALESCE((SELECT MAX(id) FROM ordenes), 0),
                COALESCE((SELECT MAX(id) FROM ordenes_canceladas), 0)) + 1,
            ?, ?, 'abierta', ?
     ON CONFLICT DO NOTHING`,
  )
    .bind(mesaId, usuario.id, ahoraIso())
    .run();
  const creada = ins.meta.changes > 0;

  const fila = await env.DB.prepare(`SELECT id FROM ordenes WHERE mesa_id = ? AND estado = 'abierta'`)
    .bind(mesaId)
    .first<{ id: number }>();
  if (!fila) throw new HttpError(500, 'No se pudo abrir la cuenta. Intenta de nuevo.');
  return json(await ordenOError(env, fila.id), creada ? 201 : 200);
}

export async function verOrden(env: Env, id: number, usuario: Usuario): Promise<Response> {
  const orden = await ordenOError(env, id);
  // Cobrada hace más de 10 min (mesero/caja): igual que si no existiera.
  if (!puedeVerOrden(orden, usuario)) throw new HttpError(404, 'No se encontró esa cuenta.');
  return json(orden);
}

interface ItemPedido {
  producto_id: number;
  cantidad: number;
  nota: string | null;
}

/**
 * Si ya existe una comanda con ese envio_id: misma orden → responde 200 con la
 * orden actual (reintento, no se crea nada); otra orden → 409. Si no existe → null.
 * Si la orden ya se cobró hace más de 10 min (y no es el dueño) → 409 "Esta
 * cuenta ya fue cobrada." en lugar de la orden (no revela pagos ni propina).
 */
async function respuestaEnvioRepetido(
  env: Env,
  envioId: string,
  ordenId: number,
  usuario: Usuario,
): Promise<Response | null> {
  const previa = await env.DB.prepare(`SELECT orden_id FROM comandas WHERE envio_id = ?`)
    .bind(envioId)
    .first<{ orden_id: number }>();
  if (!previa) return null;
  if (previa.orden_id !== ordenId) {
    throw new HttpError(409, 'Este envío ya se usó en otra cuenta. Vuelve a intentarlo.');
  }
  const orden = await ordenOError(env, ordenId);
  if (!puedeVerOrden(orden, usuario)) throw new HttpError(409, 'Esta cuenta ya fue cobrada.');
  return json(orden, 200);
}

export async function agregarComanda(
  request: Request,
  env: Env,
  ordenId: number,
  usuario: Usuario,
): Promise<Response> {
  const cuerpo = await leerCuerpo(request);
  let envioId: string | null = null;
  if (cuerpo.envio_id !== undefined && cuerpo.envio_id !== null) {
    if (
      typeof cuerpo.envio_id !== 'string' ||
      cuerpo.envio_id.length > MAX_ENVIO_ID ||
      !PATRON_ENVIO_ID.test(cuerpo.envio_id)
    ) {
      throw new HttpError(400, 'El identificador de envío no es válido.');
    }
    envioId = cuerpo.envio_id;
  }
  const crudos = cuerpo.items;
  if (!Array.isArray(crudos) || crudos.length === 0) {
    throw new HttpError(400, 'Agrega al menos un platillo.');
  }
  if (crudos.length > MAX_ITEMS_POR_COMANDA) {
    throw new HttpError(400, `Máximo ${MAX_ITEMS_POR_COMANDA} renglones por envío.`);
  }
  const items: ItemPedido[] = crudos.map((it: unknown) => {
    if (typeof it !== 'object' || it === null || Array.isArray(it)) {
      throw new HttpError(400, 'Hay un platillo con datos inválidos.');
    }
    const o = it as Record<string, unknown>;
    const producto_id = entero(o.producto_id, 1, Number.MAX_SAFE_INTEGER, 'Hay un platillo con datos inválidos.');
    const cantidad = entero(o.cantidad, 1, MAX_CANTIDAD, `La cantidad debe ser un número entero de 1 a ${MAX_CANTIDAD}.`);
    let nota: string | null = null;
    if (o.nota !== undefined && o.nota !== null) {
      if (typeof o.nota !== 'string') throw new HttpError(400, 'La nota debe ser texto.');
      const limpia = o.nota.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
      if ([...limpia].length > MAX_NOTA) {
        throw new HttpError(400, `La nota no puede tener más de ${MAX_NOTA} caracteres.`);
      }
      nota = limpia === '' ? null : limpia;
    }
    return { producto_id, cantidad, nota };
  });

  // Reintento de un envío que ya llegó: se responde antes de revisar el estado
  // de la cuenta o del menú (pudo cobrarse o cambiar el menú entre intentos).
  if (envioId !== null) {
    const repetido = await respuestaEnvioRepetido(env, envioId, ordenId, usuario);
    if (repetido) return repetido;
  }

  const orden = await env.DB.prepare(`SELECT estado FROM ordenes WHERE id = ?`)
    .bind(ordenId)
    .first<{ estado: string }>();
  if (!orden) throw new HttpError(404, 'No se encontró esa cuenta.');
  if (orden.estado !== 'abierta') throw new HttpError(409, 'Esta cuenta ya fue cobrada.');

  // Todos los productos deben existir y estar activos.
  const ids = [...new Set(items.map((i) => i.producto_id))];
  const { results: activos } = await env.DB.prepare(
    `SELECT id FROM productos WHERE activo = 1 AND id IN (SELECT value FROM json_each(?))`,
  )
    .bind(JSON.stringify(ids))
    .all<{ id: number }>();
  if (activos.length !== ids.length) {
    throw new HttpError(400, 'Uno de los platillos ya no está disponible. Actualiza el menú.');
  }

  // Todo en una transacción: la comanda y sus platillos (nombre y precio se
  // copian del menú en este momento). D1 ejecuta el batch completo sin
  // intercalar otras escrituras, así que MAX(id) es la comanda recién creada.
  const ahora = ahoraIso();
  const sentencias: D1PreparedStatement[] = [
    env.DB.prepare(`INSERT INTO comandas (orden_id, estado, creada, envio_id) VALUES (?, 'pendiente', ?, ?)`).bind(
      ordenId,
      ahora,
      envioId,
    ),
  ];
  for (const it of items) {
    sentencias.push(
      env.DB.prepare(
        `INSERT INTO items (comanda_id, producto_id, nombre, precio, cantidad, nota)
         SELECT (SELECT MAX(id) FROM comandas WHERE orden_id = ?), p.id, p.nombre, p.precio, ?, ?
           FROM productos p WHERE p.id = ?`,
      ).bind(ordenId, it.cantidad, it.nota, it.producto_id),
    );
  }
  try {
    await env.DB.batch(sentencias);
  } catch (e) {
    // Carrera: otra petición con el mismo envio_id ganó entre la revisión y el
    // INSERT. El índice único rechaza esta (y el batch se deshace completo).
    if (envioId !== null && String(e instanceof Error ? e.message : e).includes('comandas.envio_id')) {
      const repetido = await respuestaEnvioRepetido(env, envioId, ordenId, usuario);
      if (repetido) return repetido;
    }
    throw errorDeRegla(e) ?? e;
  }
  return json(await ordenOError(env, ordenId), 201);
}

export async function cocina(env: Env): Promise<Response> {
  const desde = new Date(Date.now() - MINUTOS_LISTAS_EN_COCINA * 60 * 1000).toISOString();
  const [pend, listas] = await env.DB.batch([
    env.DB.prepare(`SELECT id FROM comandas WHERE estado = 'pendiente' ORDER BY creada, id`),
    env.DB.prepare(
      `SELECT id FROM comandas WHERE estado = 'listo' AND listo_en >= ? ORDER BY listo_en DESC, id DESC`,
    ).bind(desde),
  ]);
  const ids = [...(pend.results as { id: number }[]), ...(listas.results as { id: number }[])].map((r) => r.id);
  return json(await comandasPorIds(env, ids));
}

export async function cambiarEstadoComanda(env: Env, id: number, estado: 'listo' | 'pendiente'): Promise<Response> {
  const res =
    estado === 'listo'
      ? await env.DB.prepare(
          `UPDATE comandas SET estado = 'listo', listo_en = ? WHERE id = ? AND estado = 'pendiente'`,
        )
          .bind(ahoraIso(), id)
          .run()
      : await env.DB.prepare(`UPDATE comandas SET estado = 'pendiente', listo_en = NULL WHERE id = ? AND estado = 'listo'`)
          .bind(id)
          .run();
  void res; // si ya estaba en ese estado, no pasa nada (operación repetible)
  const [comanda] = await comandasPorIds(env, [id]);
  if (!comanda) throw new HttpError(404, 'No se encontró esa comanda.');
  return json(comanda);
}

export async function cajaOrdenes(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id FROM ordenes WHERE estado = 'abierta' ORDER BY creada, id`,
  ).all<{ id: number }>();
  return json(await ordenesPorIds(env, results.map((r) => r.id)));
}

export async function pagar(request: Request, env: Env, ordenId: number, usuario: Usuario): Promise<Response> {
  const cuerpo = await leerCuerpo(request);
  const msgGrande = `El monto es demasiado grande. El máximo es ${pesos(MAX_MONTO)}.`;
  const muyGrande = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > MAX_MONTO;
  if (muyGrande(cuerpo.propina)) throw new HttpError(400, msgGrande);
  const propina = entero(cuerpo.propina ?? 0, 0, MAX_MONTO, 'La propina debe ser una cantidad válida (0 o más).');
  const crudos = cuerpo.pagos;
  if (!Array.isArray(crudos) || crudos.length === 0) {
    throw new HttpError(400, 'Agrega al menos una forma de pago.');
  }
  if (crudos.length > MAX_PAGOS) throw new HttpError(400, `Máximo ${MAX_PAGOS} formas de pago por cuenta.`);
  const pagos = crudos.map((p: unknown) => {
    if (typeof p !== 'object' || p === null || Array.isArray(p)) {
      throw new HttpError(400, 'Hay una forma de pago con datos inválidos.');
    }
    const o = p as Record<string, unknown>;
    if (typeof o.metodo !== 'string' || !METODOS_PAGO.includes(o.metodo as MetodoPago)) {
      throw new HttpError(400, 'La forma de pago debe ser efectivo, tarjeta o transferencia.');
    }
    if (muyGrande(o.monto)) throw new HttpError(400, msgGrande);
    const monto = entero(o.monto, 1, MAX_MONTO, 'Cada pago debe ser una cantidad mayor a cero.');
    return { metodo: o.metodo as MetodoPago, monto };
  });

  const orden = await ordenOError(env, ordenId);
  if (orden.estado !== 'abierta') throw new HttpError(409, 'Esta cuenta ya fue cobrada.');
  // Entrega 2: no se cobra sin jornada abierta.
  const jornada = await env.DB.prepare(`SELECT id FROM jornadas WHERE estado = 'abierta'`).first<{ id: number }>();
  if (!jornada) throw new HttpError(409, MSG_SIN_JORNADA);
  if (orden.subtotal <= 0 || orden.comandas.every((c) => c.items.length === 0)) {
    throw new HttpError(400, 'No se puede cobrar una cuenta sin platillos.');
  }
  const total = orden.subtotal + propina;
  const suma = pagos.reduce((s, p) => s + p.monto, 0);
  if (suma !== total) {
    throw new HttpError(
      400,
      `Los pagos suman ${pesos(suma)} pero el total con propina es ${pesos(total)}. Deben ser iguales.`,
    );
  }

  // Transacción: se registran los pagos y se cierra la cuenta. La base de
  // datos vuelve a revisar (triggers) que la cuenta siga abierta, que los
  // pagos cuadren y que haya una jornada abierta; si algo falla no se guarda
  // nada. La jornada se toma DENTRO del mismo UPDATE (no la leída arriba): si
  // el día se cerró en este instante, la subconsulta da NULL y el trigger
  // trg_ordenes_pago_requiere_jornada rechaza el cobro completo (409).
  const ahora = ahoraIso();
  const sentencias: D1PreparedStatement[] = pagos.map((p) =>
    env.DB.prepare(`INSERT INTO pagos (orden_id, metodo, monto, creado) VALUES (?, ?, ?, ?)`).bind(
      ordenId,
      p.metodo,
      p.monto,
      ahora,
    ),
  );
  sentencias.push(
    env.DB.prepare(
      `UPDATE ordenes SET estado = 'pagada', propina = ?, pagada_en = ?, cobrado_por = ?,
              jornada_id = (SELECT id FROM jornadas WHERE estado = 'abierta')
        WHERE id = ? AND estado = 'abierta'`,
    ).bind(propina, ahora, usuario.id, ordenId),
  );
  try {
    await env.DB.batch(sentencias);
  } catch (e) {
    throw errorDeRegla(e) ?? e;
  }
  return json(await ordenOError(env, ordenId));
}

/**
 * Cancela (borra) una cuenta abierta que todavía no tiene platillos, p. ej. si
 * el mesero abrió la mesa equivocada. A prueba de carreras: en una sola
 * transacción se copia la cuenta a ordenes_canceladas y se borra, ambas
 * sentencias con la misma condición (sigue abierta, sin comandas ni pagos).
 * Si alguien envía una comanda al mismo tiempo, o no se borra nada (409), o la
 * comanda falla porque la cuenta ya no existe (trigger
 * trg_comandas_solo_orden_abierta).
 */
export async function cancelarOrden(env: Env, ordenId: number, usuario: Usuario): Promise<Response> {
  const condicion = `id = ?1 AND estado = 'abierta'
        AND NOT EXISTS (SELECT 1 FROM comandas WHERE orden_id = ?1)
        AND NOT EXISTS (SELECT 1 FROM pagos    WHERE orden_id = ?1)`;
  const [, borrado] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO ordenes_canceladas (id, mesa_id, mesero_id, creada, cancelada, cancelada_por)
       SELECT id, mesa_id, mesero_id, creada, ?2, ?3 FROM ordenes WHERE ${condicion}`,
    ).bind(ordenId, ahoraIso(), usuario.id),
    env.DB.prepare(`DELETE FROM ordenes WHERE ${condicion}`).bind(ordenId),
  ]);
  if (borrado.meta.changes > 0) return json({ ok: true });

  // No se borró: averiguar por qué para dar un mensaje claro.
  const fila = await env.DB.prepare(
    `SELECT o.estado, EXISTS (SELECT 1 FROM comandas WHERE orden_id = o.id) AS tiene_comandas
       FROM ordenes o WHERE o.id = ?`,
  )
    .bind(ordenId)
    .first<{ estado: string; tiene_comandas: number }>();
  if (!fila) throw new HttpError(404, 'No se encontró esa cuenta.');
  if (fila.estado !== 'abierta') throw new HttpError(409, 'No se puede cancelar: la cuenta ya fue cobrada.');
  throw new HttpError(409, 'No se puede cancelar: la cuenta ya tiene platillos.');
}
