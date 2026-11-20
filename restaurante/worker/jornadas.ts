// Entrega 2: jornada (el "día" de la caja), salidas de efectivo, corte de caja
// y reporte de propinas.
//
// CORTE A CIEGAS: mientras la jornada está abierta, ninguna respuesta a la
// caja incluye totales (ventas, cobrado, esperado...). La caja solo ve
// `JornadaActual` (fondo, salidas, cuántas cuentas faltan) y, después de
// cerrar, el `Corte` de la ÚLTIMA jornada cerrada. El dueño ve todo.

import { HttpError, ahoraIso, entero, json, leerCuerpo } from './http';
import { ORDEN_METODOS, ceroPorMetodo, repartirPropina, type PorMetodo } from './reparto';
import { SQL_SUBTOTAL } from './restaurante';
import type {
  Conteo,
  Corte,
  CuentaCorte,
  Env,
  JornadaActual,
  JornadaResumen,
  MetodoPago,
  PropinaMesa,
  PropinaMesero,
  Salida,
  Usuario,
} from './tipos';

const MAX_MONTO = 100_000_000; // $1,000,000.00: límite de cordura (igual que en cobros)
const MAX_MOTIVO = 80;
const MAX_CANTIDAD_CONTEO = 10_000;
const MAX_JORNADAS_LISTA = 90;
const MAX_DIAS_REPORTE = 93;
/**
 * Hora de México (America/Mexico_City). Desde octubre de 2022 México ya no
 * tiene horario de verano: es UTC−6 todo el año, así que basta un desfase fijo.
 */
const DESFASE_MEXICO_MS = 6 * 60 * 60 * 1000;

/** Denominaciones permitidas en el conteo, en centavos (de mayor a menor). */
export const DENOMINACIONES: readonly number[] = [
  100000, 50000, 20000, 10000, 5000, 2000, // billetes
  1000, 500, 200, 100, 50, // monedas
];

const MSG_SIN_JORNADA_ABIERTA = 'No hay un día abierto. Abre el día capturando el fondo de caja.';

// ---------------------------------------------------------------------------
// Lecturas comunes

interface FilaSalida {
  id: number;
  monto: number;
  motivo: string;
  usuario_nombre: string;
  creada: string;
  anulada: number;
  anulada_por_nombre: string | null;
}

const SQL_SALIDAS = `SELECT s.id, s.monto, s.motivo, u.nombre AS usuario_nombre, s.creada,
                            (s.anulada_en IS NOT NULL) AS anulada, ua.nombre AS anulada_por_nombre
                       FROM salidas s
                       JOIN usuarios u       ON u.id = s.usuario_id
                       LEFT JOIN usuarios ua ON ua.id = s.anulada_por`;

function aSalida(f: FilaSalida): Salida {
  return {
    id: f.id,
    monto: f.monto,
    motivo: f.motivo,
    usuario_nombre: f.usuario_nombre,
    creada: f.creada,
    anulada: f.anulada === 1,
    anulada_por_nombre: f.anulada_por_nombre,
  };
}

/** Jornada abierta tal como la ve la caja (sin totales), o null. */
async function leerJornadaActual(env: Env): Promise<JornadaActual | null> {
  // Las tres lecturas en un batch: misma foto de la base de datos.
  const [rj, rs, rc] = await env.DB.batch([
    env.DB.prepare(
      `SELECT j.id, j.abierta_en, u.nombre AS abierta_por_nombre, j.fondo
         FROM jornadas j JOIN usuarios u ON u.id = j.abierta_por
        WHERE j.estado = 'abierta'`,
    ),
    env.DB.prepare(
      `${SQL_SALIDAS} WHERE s.jornada_id = (SELECT id FROM jornadas WHERE estado = 'abierta')
        ORDER BY s.creada, s.id`,
    ),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM ordenes WHERE estado = 'abierta'`),
  ]);
  const j = rj.results[0] as { id: number; abierta_en: string; abierta_por_nombre: string; fondo: number } | undefined;
  if (!j) return null;
  return {
    id: j.id,
    abierta_en: j.abierta_en,
    abierta_por_nombre: j.abierta_por_nombre,
    fondo: j.fondo,
    salidas: (rs.results as unknown as FilaSalida[]).map(aSalida),
    cuentas_abiertas: (rc.results[0] as { n: number }).n,
  };
}

async function jornadaActualOError(env: Env): Promise<JornadaActual> {
  const j = await leerJornadaActual(env);
  if (!j) throw new HttpError(409, MSG_SIN_JORNADA_ABIERTA);
  return j;
}

interface CuentaInterna extends CuentaCorte {
  mesa_id: number;
  mesero_id: number;
}

/** Cuentas cobradas en las jornadas dadas, con sus pagos (más reciente primero). */
async function cuentasDeJornadas(env: Env, jornadaIds: number[]): Promise<CuentaInterna[]> {
  if (jornadaIds.length === 0) return [];
  const lista = JSON.stringify(jornadaIds);
  const [ro, rp] = await env.DB.batch([
    env.DB.prepare(
      `SELECT o.id AS orden_id, o.mesa_id, m.nombre AS mesa_nombre, o.mesero_id, u.nombre AS mesero_nombre,
              o.pagada_en, COALESCE(c.nombre, '') AS cobrado_por_nombre, o.propina, ${SQL_SUBTOTAL} AS subtotal
         FROM ordenes o
         JOIN mesas m         ON m.id = o.mesa_id
         JOIN usuarios u      ON u.id = o.mesero_id
         LEFT JOIN usuarios c ON c.id = o.cobrado_por
        WHERE o.estado = 'pagada' AND o.jornada_id IN (SELECT value FROM json_each(?))
        ORDER BY o.pagada_en DESC, o.id DESC`,
    ).bind(lista),
    env.DB.prepare(
      `SELECT p.orden_id, p.metodo, p.monto
         FROM pagos p JOIN ordenes o ON o.id = p.orden_id
        WHERE o.estado = 'pagada' AND o.jornada_id IN (SELECT value FROM json_each(?))
        ORDER BY p.id`,
    ).bind(lista),
  ]);
  const pagosPorOrden = new Map<number, { metodo: MetodoPago; monto: number }[]>();
  for (const p of rp.results as unknown as { orden_id: number; metodo: MetodoPago; monto: number }[]) {
    let arr = pagosPorOrden.get(p.orden_id);
    if (!arr) pagosPorOrden.set(p.orden_id, (arr = []));
    arr.push({ metodo: p.metodo, monto: p.monto });
  }
  type Fila = Omit<CuentaInterna, 'total' | 'pagos'>;
  return (ro.results as unknown as Fila[]).map((f) => ({
    orden_id: f.orden_id,
    mesa_id: f.mesa_id,
    mesa_nombre: f.mesa_nombre,
    mesero_id: f.mesero_id,
    mesero_nombre: f.mesero_nombre,
    pagada_en: f.pagada_en,
    cobrado_por_nombre: f.cobrado_por_nombre,
    subtotal: f.subtotal,
    propina: f.propina,
    total: f.subtotal + f.propina,
    pagos: pagosPorOrden.get(f.orden_id) ?? [],
  }));
}

/**
 * Propinas por mesero (quien abrió la cuenta) y por mesa. La propina de cada
 * cuenta se reparte entre sus formas de pago con repartirPropina (residuo
 * mayor). Se incluye a todo mesero / mesa con al menos una cuenta cobrada;
 * `cuentas` cuenta solo las cuentas con propina > 0. Mayor total primero.
 */
function agruparPropinas(cuentas: CuentaInterna[]): { por_mesero: PropinaMesero[]; por_mesa: PropinaMesa[] } {
  const meseros = new Map<number, PropinaMesero>();
  const mesas = new Map<number, PropinaMesa>();
  for (const c of cuentas) {
    let pm = meseros.get(c.mesero_id);
    if (!pm) {
      pm = { mesero_id: c.mesero_id, nombre: c.mesero_nombre, cuentas: 0, total: 0, efectivo: 0, tarjeta: 0, transferencia: 0 };
      meseros.set(c.mesero_id, pm);
    }
    let pz = mesas.get(c.mesa_id);
    if (!pz) {
      pz = { mesa_id: c.mesa_id, nombre: c.mesa_nombre, cuentas: 0, total: 0 };
      mesas.set(c.mesa_id, pz);
    }
    if (c.propina <= 0) continue;
    const reparto = repartirPropina(c.propina, c.pagos);
    pm.cuentas++;
    pm.total += c.propina;
    for (const m of ORDEN_METODOS) pm[m] += reparto[m];
    pz.cuentas++;
    pz.total += c.propina;
  }
  const por_mesero = [...meseros.values()].sort(
    (a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es') || a.mesero_id - b.mesero_id,
  );
  const por_mesa = [...mesas.values()].sort((a, b) => b.total - a.total || a.mesa_id - b.mesa_id);
  return { por_mesero, por_mesa };
}

interface FilaJornada {
  id: number;
  estado: 'abierta' | 'cerrada';
  abierta_en: string;
  abierta_por_nombre: string;
  cerrada_en: string | null;
  cerrada_por_nombre: string | null;
  fondo: number;
  conteo: string | null;
  contado: number | null;
}

/** Corte completo de una jornada (abierta = parcial). null si no existe. */
async function calcularCorte(env: Env, jornadaId: number): Promise<Corte | null> {
  const [rj, rs] = await env.DB.batch([
    env.DB.prepare(
      `SELECT j.id, j.estado, j.abierta_en, ua.nombre AS abierta_por_nombre,
              j.cerrada_en, uc.nombre AS cerrada_por_nombre, j.fondo, j.conteo, j.contado
         FROM jornadas j
         JOIN usuarios ua      ON ua.id = j.abierta_por
         LEFT JOIN usuarios uc ON uc.id = j.cerrada_por
        WHERE j.id = ?`,
    ).bind(jornadaId),
    env.DB.prepare(`${SQL_SALIDAS} WHERE s.jornada_id = ? ORDER BY s.creada, s.id`).bind(jornadaId),
  ]);
  const j = rj.results[0] as unknown as FilaJornada | undefined;
  if (!j) return null;
  const salidas = (rs.results as unknown as FilaSalida[]).map(aSalida);
  const cuentas = await cuentasDeJornadas(env, [jornadaId]);

  const porMetodo: PorMetodo = ceroPorMetodo();
  let subtotal = 0;
  let propinas = 0;
  for (const c of cuentas) {
    subtotal += c.subtotal;
    propinas += c.propina;
    for (const p of c.pagos) porMetodo[p.metodo] += p.monto;
  }
  const totalSalidas = salidas.filter((s) => !s.anulada).reduce((s, x) => s + x.monto, 0);
  const esperado = j.fondo + porMetodo.efectivo - totalSalidas;
  const cerrada = j.estado === 'cerrada';
  const contado = cerrada ? j.contado : null;
  const { por_mesero, por_mesa } = agruparPropinas(cuentas);

  return {
    jornada: {
      id: j.id,
      estado: j.estado,
      abierta_en: j.abierta_en,
      abierta_por_nombre: j.abierta_por_nombre,
      cerrada_en: j.cerrada_en,
      cerrada_por_nombre: j.cerrada_por_nombre,
      fondo: j.fondo,
    },
    ventas: {
      cuentas: cuentas.length,
      subtotal,
      propinas,
      total: subtotal + propinas,
      ticket_promedio: cuentas.length > 0 ? Math.round(subtotal / cuentas.length) : 0,
    },
    por_metodo: porMetodo,
    salidas,
    total_salidas: totalSalidas,
    efectivo: {
      fondo: j.fondo,
      cobrado: porMetodo.efectivo,
      salidas: totalSalidas,
      esperado,
      contado,
      diferencia: contado === null ? null : contado - esperado,
      conteo: cerrada && j.conteo ? (JSON.parse(j.conteo) as Conteo) : null,
    },
    propinas_por_mesero: por_mesero,
    propinas_por_mesa: por_mesa,
    cuentas: cuentas.map(({ mesa_id: _a, mesero_id: _b, ...c }) => c),
  };
}

/** Traduce los errores de las reglas (triggers) de jornadas y salidas. */
function errorDeReglaJornada(e: unknown): HttpError | null {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('JORNADA_NO_ABIERTA')) return new HttpError(409, MSG_SIN_JORNADA_ABIERTA);
  if (msg.includes('JORNADA_CERRADA')) return new HttpError(409, 'Ese día ya se cerró; ya no se puede modificar.');
  return null;
}

// ---------------------------------------------------------------------------
// Endpoints

/** GET /api/jornada/actual — caja, dueno. */
export async function jornadaActual(env: Env): Promise<Response> {
  return json({ jornada: await leerJornadaActual(env) });
}

/** POST /api/jornada/abrir — caja, dueno. { fondo } */
export async function abrirJornada(request: Request, env: Env, usuario: Usuario): Promise<Response> {
  const cuerpo = await leerCuerpo(request);
  const fondo = entero(cuerpo.fondo, 0, MAX_MONTO, 'El fondo de caja debe ser una cantidad válida (0 o más).');
  // El índice único parcial impide una segunda jornada abierta, aunque dos
  // personas abran el día al mismo tiempo.
  const ins = await env.DB.prepare(
    `INSERT INTO jornadas (estado, fondo, abierta_por, abierta_en) VALUES ('abierta', ?, ?, ?)
     ON CONFLICT DO NOTHING`,
  )
    .bind(fondo, usuario.id, ahoraIso())
    .run();
  if (ins.meta.changes === 0) throw new HttpError(409, 'El día ya está abierto.');
  return json(await jornadaActualOError(env), 201);
}

/** POST /api/jornada/salidas — caja, dueno. { monto, motivo } */
export async function registrarSalida(request: Request, env: Env, usuario: Usuario): Promise<Response> {
  const cuerpo = await leerCuerpo(request);
  const monto = entero(cuerpo.monto, 1, MAX_MONTO, 'El monto de la salida debe ser mayor a cero.');
  if (typeof cuerpo.motivo !== 'string') throw new HttpError(400, 'Escribe el motivo de la salida.');
  const motivo = cuerpo.motivo.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (motivo === '') throw new HttpError(400, 'Escribe el motivo de la salida.');
  if ([...motivo].length > MAX_MOTIVO) {
    throw new HttpError(400, `El motivo no puede tener más de ${MAX_MOTIVO} caracteres.`);
  }
  let ins: D1Result;
  try {
    // Se liga a la jornada abierta en ese mismo instante (si no hay, no se inserta).
    ins = await env.DB.prepare(
      `INSERT INTO salidas (jornada_id, monto, motivo, usuario_id, creada)
       SELECT id, ?, ?, ?, ? FROM jornadas WHERE estado = 'abierta'`,
    )
      .bind(monto, motivo, usuario.id, ahoraIso())
      .run();
  } catch (e) {
    throw errorDeReglaJornada(e) ?? e;
  }
  if (ins.meta.changes === 0) throw new HttpError(409, MSG_SIN_JORNADA_ABIERTA);
  return json(await jornadaActualOError(env), 201);
}

/** POST /api/jornada/salidas/:id/anular — caja, dueno. Repetirla no hace daño. */
export async function anularSalida(env: Env, salidaId: number, usuario: Usuario): Promise<Response> {
  let res: D1Result;
  try {
    res = await env.DB.prepare(
      `UPDATE salidas SET anulada_por = ?, anulada_en = ? WHERE id = ? AND anulada_en IS NULL`,
    )
      .bind(usuario.id, ahoraIso(), salidaId)
      .run();
  } catch (e) {
    // trg_salidas_solo_anular: la jornada de la salida ya se cerró.
    const err = errorDeReglaJornada(e);
    if (err) throw new HttpError(409, 'No se puede anular: ese día ya se cerró.');
    throw e;
  }
  if (res.meta.changes === 0) {
    const fila = await env.DB.prepare(
      `SELECT j.estado FROM salidas s JOIN jornadas j ON j.id = s.jornada_id WHERE s.id = ?`,
    )
      .bind(salidaId)
      .first<{ estado: string }>();
    if (!fila) throw new HttpError(404, 'No se encontró esa salida.');
    if (fila.estado !== 'abierta') throw new HttpError(409, 'No se puede anular: ese día ya se cerró.');
    // Ya estaba anulada y el día sigue abierto: se responde igual (repetible).
  }
  return json(await jornadaActualOError(env));
}

/** Valida el conteo y lo devuelve normalizado (todas las denominaciones) con el total. */
export function validarConteo(valor: unknown): { conteo: Conteo; contado: number } {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw new HttpError(400, 'Captura el conteo del efectivo.');
  }
  const permitidas = new Set(DENOMINACIONES.map(String));
  const crudo = valor as Record<string, unknown>;
  for (const k of Object.keys(crudo)) {
    if (!permitidas.has(k)) throw new HttpError(400, `La denominación "${k.slice(0, 20)}" no es válida.`);
  }
  const conteo: Conteo = {};
  let contado = 0;
  for (const d of DENOMINACIONES) {
    const v = crudo[String(d)];
    const cant =
      v === undefined || v === null
        ? 0
        : entero(v, 0, MAX_CANTIDAD_CONTEO, `La cantidad de cada denominación debe ser un número entero de 0 a ${MAX_CANTIDAD_CONTEO}.`);
    conteo[String(d)] = cant;
    contado += d * cant;
  }
  return { conteo, contado };
}

interface CuentaAbierta {
  orden_id: number;
  mesa_nombre: string;
  total: number;
}

async function cuentasAbiertas(env: Env): Promise<CuentaAbierta[]> {
  const { results } = await env.DB.prepare(
    `SELECT o.id AS orden_id, m.nombre AS mesa_nombre, ${SQL_SUBTOTAL} AS total
       FROM ordenes o JOIN mesas m ON m.id = o.mesa_id
      WHERE o.estado = 'abierta'
      ORDER BY o.creada, o.id`,
  ).all<CuentaAbierta>();
  return results;
}

function errorCuentasAbiertas(lista: CuentaAbierta[]): HttpError {
  const n = lista.length;
  return new HttpError(
    409,
    n === 1
      ? 'No se puede cerrar el día: hay 1 cuenta abierta. Cóbrala o cancélala primero.'
      : `No se puede cerrar el día: hay ${n} cuentas abiertas. Cóbralas o cancélalas primero.`,
    { cuentas_abiertas: lista },
  );
}

/** POST /api/jornada/cerrar — caja, dueno. { conteo } */
export async function cerrarJornada(request: Request, env: Env, usuario: Usuario): Promise<Response> {
  const cuerpo = await leerCuerpo(request);
  const { conteo, contado } = validarConteo(cuerpo.conteo);

  const abierta = await env.DB.prepare(`SELECT id FROM jornadas WHERE estado = 'abierta'`).first<{ id: number }>();
  if (!abierta) throw new HttpError(409, 'No hay un día abierto para cerrar.');

  const pendientes = await cuentasAbiertas(env);
  if (pendientes.length > 0) throw errorCuentasAbiertas(pendientes);

  // Cierre atómico en UNA sentencia: solo pasa si la jornada sigue abierta
  // (dos cierres simultáneos → solo uno cambia la fila) y el trigger
  // trg_jornadas_cierre_sin_cuentas_abiertas revisa en ese mismo instante que
  // no haya cuentas abiertas. Desde aquí la jornada es inmutable y ningún
  // cobro nuevo puede ligarse a ella (trg_ordenes_pago_requiere_jornada).
  let res: D1Result;
  try {
    res = await env.DB.prepare(
      `UPDATE jornadas SET estado = 'cerrada', cerrada_por = ?, cerrada_en = ?, conteo = ?, contado = ?
        WHERE id = ? AND estado = 'abierta'`,
    )
      .bind(usuario.id, ahoraIso(), JSON.stringify(conteo), contado, abierta.id)
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('CUENTAS_ABIERTAS')) {
      // Alguien abrió una mesa justo en ese instante.
      const lista = await cuentasAbiertas(env);
      throw errorCuentasAbiertas(lista);
    }
    throw errorDeReglaJornada(e) ?? e;
  }
  if (res.meta.changes === 0) throw new HttpError(409, 'Este día ya fue cerrado por otra persona.');

  const corte = await calcularCorte(env, abierta.id);
  if (!corte) throw new HttpError(500, 'No se pudo leer el corte. Intenta de nuevo.');
  return json(corte);
}

/** GET /api/jornadas — dueno. Historial (más reciente primero, máx. 90). */
export async function listarJornadas(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT j.id, j.estado, j.abierta_en, j.cerrada_en, uc.nombre AS cerrada_por_nombre, j.fondo, j.contado,
            (SELECT COUNT(*) FROM ordenes o WHERE o.jornada_id = j.id AND o.estado = 'pagada') AS cuentas,
            (SELECT COALESCE(SUM(p.monto), 0) FROM pagos p JOIN ordenes o ON o.id = p.orden_id
              WHERE o.jornada_id = j.id AND o.estado = 'pagada') AS total,
            (SELECT COALESCE(SUM(o.propina), 0) FROM ordenes o
              WHERE o.jornada_id = j.id AND o.estado = 'pagada') AS propinas,
            (SELECT COALESCE(SUM(p.monto), 0) FROM pagos p JOIN ordenes o ON o.id = p.orden_id
              WHERE o.jornada_id = j.id AND o.estado = 'pagada' AND p.metodo = 'efectivo') AS efectivo,
            (SELECT COALESCE(SUM(s.monto), 0) FROM salidas s
              WHERE s.jornada_id = j.id AND s.anulada_en IS NULL) AS salidas
       FROM jornadas j LEFT JOIN usuarios uc ON uc.id = j.cerrada_por
      ORDER BY j.abierta_en DESC, j.id DESC
      LIMIT ?`,
  )
    .bind(MAX_JORNADAS_LISTA)
    .all<{
      id: number;
      estado: string;
      abierta_en: string;
      cerrada_en: string | null;
      cerrada_por_nombre: string | null;
      fondo: number;
      contado: number | null;
      cuentas: number;
      total: number;
      propinas: number;
      efectivo: number;
      salidas: number;
    }>();
  const lista: JornadaResumen[] = results.map((f) => ({
    id: f.id,
    abierta_en: f.abierta_en,
    cerrada_en: f.cerrada_en,
    cerrada_por_nombre: f.cerrada_por_nombre,
    cuentas: f.cuentas,
    total: f.total, // = subtotal + propinas (los pagos siempre cuadran con eso)
    propinas: f.propinas,
    diferencia: f.estado === 'cerrada' && f.contado !== null ? f.contado - (f.fondo + f.efectivo - f.salidas) : null,
  }));
  return json(lista);
}

/**
 * GET /api/jornadas/:id/corte — dueno: cualquiera (la abierta = corte parcial).
 * caja: solo la última jornada cerrada; cualquier otra (incluida la abierta) → 403.
 */
export async function verCorte(env: Env, jornadaId: number, usuario: Usuario): Promise<Response> {
  if (usuario.rol !== 'dueno') {
    const ultima = await env.DB.prepare(
      `SELECT id FROM jornadas WHERE estado = 'cerrada' ORDER BY cerrada_en DESC, id DESC LIMIT 1`,
    ).first<{ id: number }>();
    if (!ultima || ultima.id !== jornadaId) {
      throw new HttpError(403, 'Solo puedes ver el corte del último día cerrado.');
    }
  }
  const corte = await calcularCorte(env, jornadaId);
  if (!corte) throw new HttpError(404, 'No se encontró ese día.');
  return json(corte);
}

/**
 * GET /api/jornadas/ultima-cerrada — caja, dueno. Corte de la jornada cerrada
 * más reciente (p. ej. si se cerró desde otra computadora). 404 si no hay.
 */
export async function ultimaCerrada(env: Env): Promise<Response> {
  const ultima = await env.DB.prepare(
    `SELECT id FROM jornadas WHERE estado = 'cerrada' ORDER BY cerrada_en DESC, id DESC LIMIT 1`,
  ).first<{ id: number }>();
  const corte = ultima ? await calcularCorte(env, ultima.id) : null;
  if (!corte) throw new HttpError(404, 'Todavía no hay cortes.');
  return json(corte);
}

/** 'AAAA-MM-DD' → milisegundos UTC de la medianoche de ese día (como fecha civil), o null. */
function fechaCivil(texto: string | null): number | null {
  if (texto === null || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const [a, m, d] = texto.split('-').map(Number);
  const ms = Date.UTC(a, m - 1, d);
  const f = new Date(ms);
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return null;
  return ms;
}

/** GET /api/reportes/propinas?desde=AAAA-MM-DD&hasta=AAAA-MM-DD — dueno. */
export async function reportePropinas(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const desdeTxt = url.searchParams.get('desde');
  const hastaTxt = url.searchParams.get('hasta');
  const desde = fechaCivil(desdeTxt);
  const hasta = fechaCivil(hastaTxt);
  if (desde === null || hasta === null) {
    throw new HttpError(400, 'Indica las fechas "desde" y "hasta" con el formato AAAA-MM-DD.');
  }
  if (desde > hasta) throw new HttpError(400, 'La fecha "desde" no puede ser posterior a "hasta".');
  const dias = Math.round((hasta - desde) / 86_400_000) + 1;
  if (dias > MAX_DIAS_REPORTE) throw new HttpError(400, `El rango máximo es de ${MAX_DIAS_REPORTE} días.`);

  // Medianoche en México (UTC−6) = 06:00 UTC del mismo día.
  const inicio = new Date(desde + DESFASE_MEXICO_MS).toISOString();
  const fin = new Date(hasta + 86_400_000 + DESFASE_MEXICO_MS).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT id FROM jornadas WHERE abierta_en >= ? AND abierta_en < ? ORDER BY abierta_en`,
  )
    .bind(inicio, fin)
    .all<{ id: number }>();
  const ids = results.map((r) => r.id);
  const { por_mesero, por_mesa } = agruparPropinas(await cuentasDeJornadas(env, ids));
  return json({ desde: desdeTxt, hasta: hastaTxt, por_mesero, por_mesa, jornadas: ids.length });
}
