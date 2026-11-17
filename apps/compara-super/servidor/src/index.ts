/**
 * Comparar Súper — servidor (Cloudflare Worker + D1).
 * Implementa docs/api-contrato.md. Documentación: docs/datos-y-api.md.
 */
import { servirEstatico } from './estaticos';
import { buscar, mensajeError, modoPrecios, type ModoPrecios } from './busqueda';
import { calcularComparacion } from './comparar';
import { emparejar } from './grupos';
import { refrescarItems } from './refrescar';
import {
  borrarSesion,
  cifrarContrasena,
  contarIntento,
  cookieBorrar,
  cookieDispositivo,
  cookieSesion,
  crearSesion,
  devolverIntentos,
  dispositivoConfiable,
  ipDe,
  leerLimites,
  recordarDispositivo,
  reiniciarLimite,
  reservarIntentos,
  usuarioDeSesion,
  verificacionFicticia,
  verificarContrasena,
} from './seguridad';
import type { Env, Grupo, ItemLista, PreciosPorTienda, Tienda, Usuario } from './tipos';
import { TODAS_LAS_TIENDAS } from './tipos';
import {
  ErrorValidacion,
  MAX_ITEMS_LISTA,
  esObjeto,
  validarBusqueda,
  validarCambiosSustitutos,
  validarCantidad,
  validarConsultadoEn,
  validarContrasena,
  validarCorreo,
  validarGrupo,
} from './validar';

const MAX_CUERPO = 32 * 1024;

// ---------------------------------------------------------------------------
// Respuestas
// ---------------------------------------------------------------------------

class ErrorApi extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensaje: string,
    public cabeceras: Record<string, string> = {},
  ) {
    super(mensaje);
  }
}

const CABECERAS_BASE: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

/** Cabeceras extra: objeto, o lista de pares cuando se repite una cabecera (varias Set-Cookie). */
type Extra = Record<string, string> | Array<[string, string]>;

function cabeceras(base: Record<string, string>, extra: Extra): Headers {
  const h = new Headers(base);
  for (const [k, v] of Array.isArray(extra) ? extra : Object.entries(extra)) h.append(k, v);
  return h;
}
function json(datos: unknown, status = 200, extra: Extra = {}): Response {
  return new Response(JSON.stringify(datos), { status, headers: cabeceras(CABECERAS_BASE, extra) });
}
function vacio(status = 204, extra: Extra = {}): Response {
  return new Response(null, { status, headers: cabeceras({ 'Cache-Control': 'no-store' }, extra) });
}
function errorJson(status: number, codigo: string, mensaje: string, extra: Record<string, string> = {}): Response {
  return json({ error: { codigo, mensaje } }, status, extra);
}
const demasiados = (segundos: number, mensaje: string) =>
  new ErrorApi(429, 'demasiados_intentos', mensaje, { 'Retry-After': String(segundos) });

async function leerJson(req: Request): Promise<Record<string, unknown>> {
  const tipo = req.headers.get('Content-Type') ?? '';
  if (!tipo.toLowerCase().startsWith('application/json')) {
    throw new ErrorApi(400, 'tipo_no_soportado', 'Envía los datos como JSON (Content-Type: application/json)');
  }
  const largo = Number(req.headers.get('Content-Length') ?? 0);
  if (largo > MAX_CUERPO) throw new ErrorApi(400, 'muy_grande', 'Los datos enviados son demasiado grandes');
  const texto = await req.text();
  if (texto.length > MAX_CUERPO) throw new ErrorApi(400, 'muy_grande', 'Los datos enviados son demasiado grandes');
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new ErrorApi(400, 'json_invalido', 'Los datos enviados no son JSON válido');
  }
  if (!esObjeto(datos)) throw new ErrorApi(400, 'json_invalido', 'Se esperaba un objeto JSON');
  return datos;
}

function tiendasActivas(env: Env): Tienda[] {
  const lista = (env.TIENDAS_ACTIVAS ?? 'lacolonia,colonial')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t): t is Tienda => (TODAS_LAS_TIENDAS as readonly string[]).includes(t));
  return [...new Set(lista)];
}

async function requerirUsuario(env: Env, req: Request): Promise<Usuario> {
  const u = await usuarioDeSesion(env.DB, req);
  if (!u) throw new ErrorApi(401, 'sin_sesion', 'Inicia sesión para continuar');
  return u;
}

// ---------------------------------------------------------------------------
// Cuenta
// ---------------------------------------------------------------------------

async function registro(env: Env, req: Request): Promise<Response> {
  const bloqueo = await contarIntento(env.DB, `registro:${ipDe(req)}`, leerLimites(env).registro);
  if (bloqueo) throw demasiados(bloqueo, 'Demasiados registros desde esta conexión. Intenta más tarde.');

  const datos = await leerJson(req);
  const correo = validarCorreo(datos.correo);
  const contrasena = validarContrasena(datos.contrasena, true);

  const existe = await env.DB.prepare('SELECT 1 FROM usuarios WHERE correo = ?').bind(correo).first();
  if (existe) throw new ErrorApi(409, 'correo_registrado', 'Ya existe una cuenta con ese correo');

  const { hash, sal, iteraciones } = await cifrarContrasena(contrasena);
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare('INSERT INTO usuarios (id, correo, hash, sal, iteraciones, creado_en) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, correo, hash, sal, iteraciones, Date.now())
      .run();
  } catch (e) {
    if (String(e).includes('UNIQUE')) throw new ErrorApi(409, 'correo_registrado', 'Ya existe una cuenta con ese correo');
    throw e;
  }
  const token = await crearSesion(env.DB, id);
  const dispositivo = await recordarDispositivo(env.DB, req, id);
  return json({ usuario: { id, correo } }, 201, [
    ['Set-Cookie', cookieSesion(token)],
    ['Set-Cookie', cookieDispositivo(dispositivo)],
  ]);
}

async function entrar(env: Env, req: Request): Promise<Response> {
  const datos = await leerJson(req);
  const correo = validarCorreo(datos.correo);
  const contrasena = validarContrasena(datos.contrasena, false);
  const ip = ipDe(req);
  const limites = leerLimites(env);
  const fila = await env.DB.prepare('SELECT id, correo, hash, sal, iteraciones FROM usuarios WHERE correo = ?')
    .bind(correo)
    .first<{ id: string; correo: string; hash: string; sal: string; iteraciones: number }>();

  // Límites de contraseñas incorrectas (ver docs/datos-y-api.md, "Entrar: límites"):
  // - Con dispositivo de confianza de esta cuenta (token de ESTA cuenta en la cookie
  //   "__Secure-dispositivo", de un inicio de sesión correcto anterior): solo cuenta el contador
  //   de ESE dispositivo, que nadie más puede subir.
  //   Así la dueña entra aunque haya un ataque repartido o comparta IP (CGNAT) con un atacante.
  // - Sin dispositivo de confianza: correo + IP (5/15 min), IP (100/15 min, tolera CGNAT) y
  //   correo desde cualquier IP (10/hora: hace impráctico adivinar con muchas IP).
  const dispositivo = fila ? await dispositivoConfiable(env.DB, req, fila.id) : null;
  const contadores = dispositivo
    ? [{ clave: `entrar-disp:${fila!.id}|${dispositivo}`, regla: limites.entrarDispositivo }]
    : [
        { clave: `entrar-ci:${correo}|${ip}`, regla: limites.entrarCorreoIp },
        { clave: `entrar-ip:${ip}`, regla: limites.entrarIp },
        { clave: `entrar-correo:${correo}`, regla: limites.entrarCorreo },
      ];

  // El intento se RESERVA (cuenta) de forma atómica ANTES de revisar la contraseña, así una ráfaga
  // de peticiones simultáneas no puede revisar más contraseñas que el máximo. Si hay bloqueo se
  // responde 429 SIN revisar la contraseña: un 429 nunca dice si era correcta.
  const { bloqueo, reservas } = await reservarIntentos(env.DB, contadores);
  if (bloqueo) throw demasiados(bloqueo, 'Demasiados intentos. Espera unos minutos e intenta de nuevo.');

  let valida = false;
  if (fila) valida = await verificarContrasena(contrasena, fila);
  else await verificacionFicticia(contrasena);

  // Contraseña incorrecta: el intento ya quedó contado.
  if (!fila || !valida) throw new ErrorApi(401, 'credenciales_invalidas', 'Correo o contraseña incorrectos');

  // Entró bien: se reinicia el contador propio (correo + IP, o el del dispositivo) y a los de IP y
  // de correo solo se les devuelve ESTE intento (no se borran: si no, alguien con una cuenta
  // propia podría "limpiar" su IP entrando a ella).
  const propio = contadores[0].clave;
  await reiniciarLimite(env.DB, propio);
  await devolverIntentos(env.DB, reservas.filter((r) => r.clave !== propio));
  const token = await crearSesion(env.DB, fila.id);
  const nuevoDispositivo = await recordarDispositivo(env.DB, req, fila.id);
  return json({ usuario: { id: fila.id, correo: fila.correo } }, 200, [
    ['Set-Cookie', cookieSesion(token)],
    ['Set-Cookie', cookieDispositivo(nuevoDispositivo)],
  ]);
}

async function salir(env: Env, req: Request): Promise<Response> {
  await borrarSesion(env.DB, req);
  return vacio(204, { 'Set-Cookie': cookieBorrar() });
}

const escaparLike = (texto: string) => texto.replace(/[\\%_]/g, (c) => `\\${c}`);

async function borrarCuenta(env: Env, req: Request): Promise<Response> {
  const u = await requerirUsuario(env, req);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM items_lista WHERE usuario_id = ?').bind(u.id),
    env.DB.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(u.id),
    env.DB.prepare('DELETE FROM dispositivos WHERE usuario_id = ?').bind(u.id),
    env.DB.prepare(
      "DELETE FROM limites WHERE clave IN (?, ?, ?) OR clave LIKE ? ESCAPE '\\' OR clave LIKE ? ESCAPE '\\'",
    ).bind(
      `entrar-correo:${u.correo}`,
      `buscar:${u.id}`,
      `comparar:${u.id}`,
      `entrar-ci:${escaparLike(u.correo)}|%`,
      `entrar-disp:${escaparLike(u.id)}|%`,
    ),
    env.DB.prepare('DELETE FROM usuarios WHERE id = ?').bind(u.id),
  ]);
  // La cookie de dispositivo NO se borra: en un teléfono compartido guarda también los tokens de
  // otras cuentas. El token de esta cuenta ya no vale (se borró de "dispositivos") y se descarta
  // la próxima vez que alguien entre desde ese navegador.
  return vacio(204, { 'Set-Cookie': cookieBorrar() });
}

// ---------------------------------------------------------------------------
// Búsqueda
// ---------------------------------------------------------------------------

async function buscarProductos(env: Env, req: Request, url: URL, modo: ModoPrecios): Promise<Response> {
  const u = await requerirUsuario(env, req);
  const q = validarBusqueda(url.searchParams.get('q'));
  const bloqueo = await contarIntento(env.DB, `buscar:${u.id}`, leerLimites(env).buscar);
  if (bloqueo) throw demasiados(bloqueo, 'Hiciste muchas búsquedas seguidas. Espera unos minutos.');

  const tiendas = tiendasActivas(env);
  const { resultados } = await buscar(env.DB, q, { tiendas, modo });
  const errores: Partial<Record<Tienda, string>> = {};
  for (const r of resultados) if (!r.ok) errores[r.tienda] = mensajeError(r.error?.tipo);
  const grupos = emparejar(
    resultados.filter((r) => r.ok).map((r) => ({ tienda: r.tienda, productos: r.productos })),
    20,
  );
  return json({ consultadoEn: new Date().toISOString(), grupos, errores, ...extraModo(modo) });
}

/** EXTENSIÓN al contrato: avisa cuando los precios son datos de prueba (solo desarrollo local). */
function extraModo(modo: ModoPrecios): Record<string, unknown> {
  return modo === 'fixtures'
    ? { modoPrueba: true, avisoPrueba: 'Datos de prueba guardados (no son precios de hoy). Solo desarrollo local.' }
    : {};
}

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

interface FilaItem {
  id: string;
  cantidad: number;
  grupo_json: string;
  sustitutos_json: string;
  actualizado_en: number;
  precios_consultados_en: number | null;
}

function aItem(f: FilaItem): ItemLista {
  return {
    id: f.id,
    cantidad: f.cantidad,
    grupo: JSON.parse(f.grupo_json) as Grupo,
    sustitutos: JSON.parse(f.sustitutos_json) as PreciosPorTienda,
  };
}

async function leerItems(env: Env, usuarioId: string): Promise<FilaItem[]> {
  const r = await env.DB.prepare(
    `SELECT id, cantidad, grupo_json, sustitutos_json, actualizado_en, precios_consultados_en FROM items_lista
     WHERE usuario_id = ? ORDER BY creado_en, id`,
  )
    .bind(usuarioId)
    .all<FilaItem>();
  return r.results ?? [];
}

async function leerItem(env: Env, usuarioId: string, id: string): Promise<FilaItem> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ErrorApi(404, 'no_encontrado', 'Ese producto no está en tu lista');
  const f = await env.DB.prepare(
    'SELECT id, cantidad, grupo_json, sustitutos_json, actualizado_en, precios_consultados_en FROM items_lista WHERE id = ? AND usuario_id = ?',
  )
    .bind(id.toLowerCase(), usuarioId)
    .first<FilaItem>();
  if (!f) throw new ErrorApi(404, 'no_encontrado', 'Ese producto no está en tu lista');
  return f;
}

async function verLista(env: Env, req: Request): Promise<Response> {
  const u = await requerirUsuario(env, req);
  const filas = await leerItems(env, u.id);
  const ultimo = filas.reduce((m, f) => Math.max(m, f.actualizado_en), 0);
  return json({
    items: filas.map(aItem),
    actualizadoEn: ultimo ? new Date(ultimo).toISOString() : null,
    preciosConsultadosEn: preciosMasAntiguos(filas),
  });
}

/**
 * Fecha de consulta de precios MÁS ANTIGUA entre los productos (ISO).
 * null si no hay productos o si alguno no tiene fecha (nunca consultado / desconocida).
 */
function preciosMasAntiguos(filas: Array<Pick<FilaItem, 'precios_consultados_en'>>): string | null {
  if (filas.length === 0) return null;
  let min = Infinity;
  for (const f of filas) {
    if (f.precios_consultados_en === null || f.precios_consultados_en === undefined) return null;
    min = Math.min(min, f.precios_consultados_en);
  }
  return new Date(min).toISOString();
}

async function agregarItem(env: Env, req: Request): Promise<Response> {
  const u = await requerirUsuario(env, req);
  const datos = await leerJson(req);
  const grupo = validarGrupo(datos.grupo, tiendasActivas(env));
  const cantidad = datos.cantidad === undefined ? 1 : validarCantidad(datos.cantidad);
  const ahora = Date.now();
  // Los precios del grupo vienen de una búsqueda: se guarda su fecha (null si la app no la manda).
  const consultadoEn = validarConsultadoEn(datos.consultadoEn, ahora);

  const existente = await env.DB.prepare('SELECT id FROM items_lista WHERE usuario_id = ? AND clave = ?')
    .bind(u.id, grupo.clave)
    .first<{ id: string }>();
  if (existente) {
    // Ya estaba: se suma la cantidad (máximo 99) y se guardan los precios más recientes.
    await env.DB.prepare(
      `UPDATE items_lista SET cantidad = MIN(99, cantidad + ?), grupo_json = ?, actualizado_en = ?,
         precios_consultados_en = ?
       WHERE id = ? AND usuario_id = ?`,
    )
      .bind(cantidad, JSON.stringify(grupo), ahora, consultadoEn, existente.id, u.id)
      .run();
    return json({ item: aItem(await leerItem(env, u.id, existente.id)) }, 201);
  }

  const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM items_lista WHERE usuario_id = ?')
    .bind(u.id)
    .first<{ n: number }>();
  if ((total?.n ?? 0) >= MAX_ITEMS_LISTA) {
    throw new ErrorApi(400, 'lista_llena', `Tu lista puede tener hasta ${MAX_ITEMS_LISTA} productos`);
  }
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO items_lista
       (id, usuario_id, clave, cantidad, grupo_json, sustitutos_json, creado_en, actualizado_en, precios_consultados_en)
     VALUES (?, ?, ?, ?, ?, '{}', ?, ?, ?)
     ON CONFLICT(usuario_id, clave) DO UPDATE SET cantidad = MIN(99, cantidad + excluded.cantidad)`,
  )
    .bind(id, u.id, grupo.clave, cantidad, JSON.stringify(grupo), ahora, ahora, consultadoEn)
    .run();
  const fila = await env.DB.prepare('SELECT id FROM items_lista WHERE usuario_id = ? AND clave = ?')
    .bind(u.id, grupo.clave)
    .first<{ id: string }>();
  return json({ item: aItem(await leerItem(env, u.id, fila!.id)) }, 201);
}

async function cambiarItem(env: Env, req: Request, id: string): Promise<Response> {
  const u = await requerirUsuario(env, req);
  const fila = await leerItem(env, u.id, id);
  const datos = await leerJson(req);
  if (datos.cantidad === undefined && datos.sustitutos === undefined) {
    throw new ErrorApi(400, 'validacion', 'Envía "cantidad" o "sustitutos"');
  }
  const item = aItem(fila);
  if (datos.cantidad !== undefined) item.cantidad = validarCantidad(datos.cantidad);
  if (datos.sustitutos !== undefined) {
    const cambios = validarCambiosSustitutos(datos.sustitutos, tiendasActivas(env));
    for (const [t, p] of Object.entries(cambios) as Array<[Tienda, (typeof cambios)[Tienda]]>) {
      if (p === null || p === undefined) delete item.sustitutos[t];
      else item.sustitutos[t] = p;
    }
  }
  await env.DB.prepare(
    'UPDATE items_lista SET cantidad = ?, sustitutos_json = ?, actualizado_en = ? WHERE id = ? AND usuario_id = ?',
  )
    .bind(item.cantidad, JSON.stringify(item.sustitutos), Date.now(), item.id, u.id)
    .run();
  return json({ item });
}

async function quitarItem(env: Env, req: Request, id: string): Promise<Response> {
  const u = await requerirUsuario(env, req);
  await leerItem(env, u.id, id);
  await env.DB.prepare('DELETE FROM items_lista WHERE id = ? AND usuario_id = ?').bind(id.toLowerCase(), u.id).run();
  return vacio(204);
}

async function compararLista(env: Env, req: Request, modo: ModoPrecios): Promise<Response> {
  const u = await requerirUsuario(env, req);
  const bloqueo = await contarIntento(env.DB, `comparar:${u.id}`, leerLimites(env).comparar);
  if (bloqueo) throw demasiados(bloqueo, 'Comparaste muchas veces seguidas. Espera unos minutos.');

  const tiendas = tiendasActivas(env);
  const filas = await leerItems(env, u.id);
  const originales = filas.map(aItem);
  const { items, errores } = await refrescarItems(originales, tiendas, (texto, op) =>
    buscar(env.DB, texto, { ...op, modo }),
  );

  // Guardar precios actualizados. Los sustitutos solo se escriben si nadie los cambió mientras tanto.
  const ahora = Date.now();
  if (items.length > 0) {
    await env.DB.batch(
      items.flatMap((item, i) => [
        env.DB.prepare(
          `UPDATE items_lista SET grupo_json = ?, actualizado_en = ?, precios_consultados_en = ?
           WHERE id = ? AND usuario_id = ?`,
        ).bind(JSON.stringify(item.grupo), ahora, ahora, item.id, u.id),
        env.DB.prepare(
          'UPDATE items_lista SET sustitutos_json = ? WHERE id = ? AND usuario_id = ? AND sustitutos_json = ?',
        ).bind(JSON.stringify(item.sustitutos), item.id, u.id, filas[i].sustitutos_json),
      ]),
    );
  }

  // Igual que en GET /api/lista, leído de la base después de guardar (si alguien agregó un
  // producto mientras se comparaba, ese producto cuenta con su propia fecha).
  const fechas = await env.DB.prepare('SELECT precios_consultados_en FROM items_lista WHERE usuario_id = ?')
    .bind(u.id)
    .all<Pick<FilaItem, 'precios_consultados_en'>>();
  const resultado = calcularComparacion(items, tiendas, errores);
  return json({
    consultadoEn: new Date(ahora).toISOString(),
    preciosConsultadosEn: preciosMasAntiguos(fechas.results ?? []),
    items,
    ...resultado,
    ...extraModo(modo),
  });
}

// ---------------------------------------------------------------------------
// Enrutador
// ---------------------------------------------------------------------------

async function enrutar(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/\/+$/, '') || '/';
  const m = req.method;

  if (ruta !== '/api' && !ruta.startsWith('/api/')) {
    const estatico = servirEstatico(req, url.pathname);
    if (estatico) return estatico;
  }

  if (ruta === '/api/auth/registro' && m === 'POST') return registro(env, req);
  if (ruta === '/api/auth/entrar' && m === 'POST') return entrar(env, req);
  if (ruta === '/api/auth/salir' && m === 'POST') return salir(env, req);
  if (ruta === '/api/auth/yo' && m === 'GET') return json({ usuario: await requerirUsuario(env, req) });
  if (ruta === '/api/cuenta' && m === 'DELETE') return borrarCuenta(env, req);
  if (ruta === '/api/buscar' && m === 'GET') return buscarProductos(env, req, url, modoPrecios(env, url));
  if (ruta === '/api/lista' && m === 'GET') return verLista(env, req);
  if (ruta === '/api/lista/items' && m === 'POST') return agregarItem(env, req);
  if (ruta === '/api/lista/comparar' && m === 'POST') return compararLista(env, req, modoPrecios(env, url));
  const item = /^\/api\/lista\/items\/([^/]+)$/.exec(ruta);
  if (item && m === 'PATCH') return cambiarItem(env, req, decodeURIComponent(item[1]));
  if (item && m === 'DELETE') return quitarItem(env, req, decodeURIComponent(item[1]));

  const conocida = [
    '/api/auth/registro',
    '/api/auth/entrar',
    '/api/auth/salir',
    '/api/auth/yo',
    '/api/cuenta',
    '/api/buscar',
    '/api/lista',
    '/api/lista/items',
    '/api/lista/comparar',
  ].includes(ruta) || !!item;
  if (conocida) throw new ErrorApi(405, 'metodo_no_permitido', 'Método no permitido en esta dirección');
  throw new ErrorApi(404, 'no_encontrado', 'Dirección no encontrada');
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      return await enrutar(req, env);
    } catch (e) {
      if (e instanceof ErrorApi) return errorJson(e.status, e.codigo, e.message, e.cabeceras);
      if (e instanceof ErrorValidacion) return errorJson(400, 'validacion', e.message);
      console.error('Error inesperado:', e instanceof Error ? e.stack : e);
      return errorJson(500, 'error_interno', 'Algo salió mal. Intenta de nuevo.');
    }
  },
} satisfies ExportedHandler<Env>;
