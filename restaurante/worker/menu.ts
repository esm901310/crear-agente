// Entrega 3: menú (lectura para todos), panel del dueño para categorías y
// productos, y "agotado / disponible" (dueño, cocina y caja).
//
// Cambiar nombres o precios NO altera cuentas ni cortes existentes: cada item
// guarda su propio nombre, precio, va_a_cocina y es_pasadia al enviarse.
// "Eliminar" un producto o una categoría = desactivarlo (nunca se borra).

import { HttpError, entero, json, leerCuerpo, montoPositivo } from './http';
import {
  booleano,
  claveNombre,
  descripcionValida,
  esNombreRepetido,
  limpiarTexto,
  MAX_NOMBRE,
  nombreValido,
} from './texto';
import type { CategoriaAdmin, CategoriaMenu, Env, Producto, ProductoAdmin, Variante } from './tipos';

const MAX_VARIANTES = 12;
const MAX_OPCIONES = 12;

// ---------------------------------------------------------------------------
// Lectura

interface FilaProducto {
  id: number;
  categoria_id: number;
  categoria: string;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  precio_abierto: number;
  agotado: number;
  activo: number;
  orden: number;
  es_pasadia: number;
  opciones: string;
}

interface FilaCategoria {
  id: number;
  nombre: string;
  orden: number;
  va_a_cocina: number;
  activa: number;
}

const SQL_PRODUCTOS = `SELECT p.id, p.categoria_id, c.nombre AS categoria, p.nombre, p.descripcion, p.precio,
                              p.precio_abierto, p.agotado, p.activo, p.orden, p.es_pasadia, p.opciones
                         FROM productos p JOIN categorias c ON c.id = p.categoria_id`;

/**
 * Productos (forma del panel, con `activo` y `orden`) con sus variantes activas.
 * `ids` = solo esos productos; sin `ids` = todos. Ordenados por categoría y orden.
 */
export async function leerProductos(env: Env, ids?: number[]): Promise<ProductoAdmin[]> {
  const filtro = ids ? `WHERE p.id IN (SELECT value FROM json_each(?1))` : '';
  const filtroV = ids ? `AND producto_id IN (SELECT value FROM json_each(?1))` : '';
  const lista = JSON.stringify(ids ?? []);
  const [rp, rv] = await env.DB.batch([
    env.DB.prepare(`${SQL_PRODUCTOS} ${filtro} ORDER BY c.orden, c.id, p.orden, p.id`).bind(...(ids ? [lista] : [])),
    env.DB.prepare(
      `SELECT id, producto_id, nombre, precio FROM variantes WHERE activa = 1 ${filtroV} ORDER BY orden, id`,
    ).bind(...(ids ? [lista] : [])),
  ]);
  const variantes = new Map<number, Variante[]>();
  for (const v of rv.results as unknown as (Variante & { producto_id: number })[]) {
    let arr = variantes.get(v.producto_id);
    if (!arr) variantes.set(v.producto_id, (arr = []));
    arr.push({ id: v.id, nombre: v.nombre, precio: v.precio });
  }
  return (rp.results as unknown as FilaProducto[]).map((f) => ({
    id: f.id,
    categoria_id: f.categoria_id,
    categoria: f.categoria,
    nombre: f.nombre,
    descripcion: f.descripcion,
    precio: f.precio,
    precio_abierto: f.precio_abierto === 1,
    variantes: variantes.get(f.id) ?? [],
    opciones: JSON.parse(f.opciones) as string[],
    agotado: f.agotado === 1,
    es_pasadia: f.es_pasadia === 1,
    activo: f.activo === 1,
    orden: f.orden,
  }));
}

/** Forma pública (GET /api/menu): sin `activo` ni `orden`. */
export function aPublico(p: ProductoAdmin): Producto {
  const { activo: _a, orden: _o, ...pub } = p;
  return pub;
}

async function productoOError(env: Env, id: number): Promise<ProductoAdmin> {
  const [p] = await leerProductos(env, [id]);
  if (!p) throw new HttpError(404, 'No se encontró ese producto.');
  return p;
}

async function leerCategorias(env: Env, id?: number): Promise<FilaCategoria[]> {
  const stmt = id
    ? env.DB.prepare(`SELECT id, nombre, orden, va_a_cocina, activa FROM categorias WHERE id = ?`).bind(id)
    : env.DB.prepare(`SELECT id, nombre, orden, va_a_cocina, activa FROM categorias ORDER BY orden, id`);
  return (await stmt.all<FilaCategoria>()).results;
}

function aCategoriaAdmin(c: FilaCategoria, productos: ProductoAdmin[]): CategoriaAdmin {
  return {
    id: c.id,
    nombre: c.nombre,
    orden: c.orden,
    va_a_cocina: c.va_a_cocina === 1,
    activa: c.activa === 1,
    productos: productos.filter((p) => p.categoria_id === c.id),
  };
}

async function categoriaAdminOError(env: Env, id: number): Promise<CategoriaAdmin> {
  const [c] = await leerCategorias(env, id);
  if (!c) throw new HttpError(404, 'No se encontró esa categoría.');
  const { results } = await env.DB.prepare(`SELECT id FROM productos WHERE categoria_id = ?`)
    .bind(id)
    .all<{ id: number }>();
  return aCategoriaAdmin(c, await leerProductos(env, results.map((r) => r.id)));
}

// ---------------------------------------------------------------------------
// GET /api/menu — todos

export async function menu(env: Env): Promise<Response> {
  const [categorias, productos] = await Promise.all([leerCategorias(env), leerProductos(env)]);
  const lista: CategoriaMenu[] = categorias
    .filter((c) => c.activa === 1)
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      orden: c.orden,
      va_a_cocina: c.va_a_cocina === 1,
      productos: productos.filter((p) => p.categoria_id === c.id && p.activo).map(aPublico),
    }));
  return json({ categorias: lista });
}

// GET /api/admin/menu — dueno (incluye inactivos)
export async function adminMenu(env: Env): Promise<Response> {
  const [categorias, productos] = await Promise.all([leerCategorias(env), leerProductos(env)]);
  return json({ categorias: categorias.map((c) => aCategoriaAdmin(c, productos)) });
}

// ---------------------------------------------------------------------------
// Categorías

const MSG_CATEGORIA_REPETIDA = 'Ya existe una categoría con ese nombre.';

export async function crearCategoria(request: Request, env: Env): Promise<Response> {
  const cuerpo = await leerCuerpo(request);
  const nombre = nombreValido(cuerpo.nombre, 'el nombre de la categoría');
  const vaACocina =
    cuerpo.va_a_cocina === undefined ? true : booleano(cuerpo.va_a_cocina, 'Indica si la categoría va a cocina (sí o no).');
  let fila: { id: number } | null;
  try {
    fila = await env.DB.prepare(
      `INSERT INTO categorias (nombre, nombre_clave, orden, va_a_cocina, activa)
       VALUES (?, ?, (SELECT COALESCE(MAX(orden), 0) + 1 FROM categorias), ?, 1)
       RETURNING id`,
    )
      .bind(nombre, claveNombre(nombre), vaACocina ? 1 : 0)
      .first<{ id: number }>();
  } catch (e) {
    if (esNombreRepetido(e)) throw new HttpError(409, MSG_CATEGORIA_REPETIDA);
    throw e;
  }
  if (!fila) throw new HttpError(500, 'No se pudo crear la categoría. Intenta de nuevo.');
  return json(await categoriaAdminOError(env, fila.id), 201);
}

export async function editarCategoria(request: Request, env: Env, id: number): Promise<Response> {
  const cuerpo = await leerCuerpo(request);
  const [actual] = await leerCategorias(env, id);
  if (!actual) throw new HttpError(404, 'No se encontró esa categoría.');
  const nombre = cuerpo.nombre === undefined ? actual.nombre : nombreValido(cuerpo.nombre, 'el nombre de la categoría');
  const vaACocina =
    cuerpo.va_a_cocina === undefined
      ? actual.va_a_cocina === 1
      : booleano(cuerpo.va_a_cocina, 'Indica si la categoría va a cocina (sí o no).');
  const activa =
    cuerpo.activa === undefined ? actual.activa === 1 : booleano(cuerpo.activa, 'Indica si la categoría está activa (sí o no).');
  try {
    await env.DB.prepare(
      `UPDATE categorias SET nombre = ?, nombre_clave = ?, va_a_cocina = ?, activa = ? WHERE id = ?`,
    )
      .bind(nombre, claveNombre(nombre), vaACocina ? 1 : 0, activa ? 1 : 0, id)
      .run();
  } catch (e) {
    if (esNombreRepetido(e)) throw new HttpError(409, MSG_CATEGORIA_REPETIDA);
    throw e;
  }
  return json(await categoriaAdminOError(env, id));
}

/** Lista de ids: enteros, sin repetir, exactamente los de `todos`. */
function idsCompletos(valor: unknown, todos: number[], mensaje: string): number[] {
  if (!Array.isArray(valor) || valor.length > 1000) throw new HttpError(400, mensaje);
  const ids = valor.map((v) => entero(v, 1, Number.MAX_SAFE_INTEGER, mensaje));
  const set = new Set(ids);
  if (set.size !== ids.length || set.size !== todos.length || todos.some((t) => !set.has(t))) {
    throw new HttpError(400, mensaje);
  }
  return ids;
}

export async function ordenarCategorias(request: Request, env: Env): Promise<Response> {
  const cuerpo = await leerCuerpo(request);
  const { results } = await env.DB.prepare(`SELECT id FROM categorias`).all<{ id: number }>();
  const ids = idsCompletos(
    cuerpo.ids,
    results.map((r) => r.id),
    'Manda todas las categorías (también las inactivas), cada una una sola vez, en el nuevo orden.',
  );
  if (ids.length > 0) {
    await env.DB.batch(ids.map((cid, i) => env.DB.prepare(`UPDATE categorias SET orden = ? WHERE id = ?`).bind(i + 1, cid)));
  }
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// Productos

interface VarianteEntrada {
  id: number | null;
  nombre: string;
  precio: number;
}

interface ProductoValidado {
  categoria_id: number;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  precio_abierto: boolean;
  /** null = no se mandó (en PUT se conservan las actuales). */
  variantes: VarianteEntrada[] | null;
  opciones: string[];
  es_pasadia: boolean;
  activo: boolean;
}

function validarVariantes(valor: unknown, idsPermitidos: Set<number>): VarianteEntrada[] {
  if (!Array.isArray(valor)) throw new HttpError(400, 'Las porciones (variantes) deben ser una lista.');
  if (valor.length > MAX_VARIANTES) {
    throw new HttpError(400, `Un producto puede tener máximo ${MAX_VARIANTES} porciones (variantes).`);
  }
  const claves = new Set<string>();
  const ids = new Set<number>();
  return valor.map((v: unknown) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
      throw new HttpError(400, 'Hay una porción (variante) con datos inválidos.');
    }
    const o = v as Record<string, unknown>;
    const nombre = nombreValido(o.nombre, 'el nombre de cada porción');
    const clave = claveNombre(nombre);
    if (claves.has(clave)) throw new HttpError(400, `Hay dos porciones con el mismo nombre: ${nombre}.`);
    claves.add(clave);
    const precio = montoPositivo(o.precio, `El precio de la porción "${nombre}" debe ser una cantidad mayor a cero.`);
    let id: number | null = null;
    if (o.id !== undefined && o.id !== null) {
      id = entero(o.id, 1, Number.MAX_SAFE_INTEGER, 'Hay una porción (variante) con datos inválidos.');
      if (!idsPermitidos.has(id) || ids.has(id)) {
        throw new HttpError(400, `La porción "${nombre}" no corresponde a este producto. Recarga el menú.`);
      }
      ids.add(id);
    }
    return { id, nombre, precio };
  });
}

function validarOpciones(valor: unknown): string[] {
  if (valor === null) return [];
  if (!Array.isArray(valor)) throw new HttpError(400, 'Las opciones deben ser una lista de textos.');
  if (valor.length > MAX_OPCIONES) throw new HttpError(400, `Un producto puede tener máximo ${MAX_OPCIONES} opciones.`);
  const claves = new Set<string>();
  return valor.map((v: unknown) => {
    if (typeof v !== 'string' || limpiarTexto(v) === '') throw new HttpError(400, 'Escribe el texto de cada opción.');
    const t = limpiarTexto(v);
    if ([...t].length > MAX_NOMBRE) throw new HttpError(400, `Cada opción puede tener máximo ${MAX_NOMBRE} caracteres.`);
    const clave = claveNombre(t);
    if (claves.has(clave)) throw new HttpError(400, `Hay dos opciones iguales: ${t}.`);
    claves.add(clave);
    return t;
  });
}

/**
 * Valida el cuerpo de POST/PUT de producto. En PUT (`actual` presente) los
 * campos que no vienen conservan su valor; la regla de "una sola forma de
 * precio" se revisa sobre el resultado final.
 */
async function validarProducto(
  env: Env,
  cuerpo: Record<string, unknown>,
  actual: ProductoAdmin | null,
  idsVariantes: Set<number>,
): Promise<ProductoValidado> {
  const tiene = (k: string) => cuerpo[k] !== undefined;

  let categoria_id: number;
  if (tiene('categoria_id') || !actual) {
    categoria_id = entero(cuerpo.categoria_id, 1, Number.MAX_SAFE_INTEGER, 'Elige la categoría del producto.');
    const existe = await env.DB.prepare(`SELECT 1 FROM categorias WHERE id = ?`).bind(categoria_id).first();
    if (!existe) throw new HttpError(400, 'Esa categoría no existe. Recarga el menú.');
  } else {
    categoria_id = actual.categoria_id;
  }
  const nombre = tiene('nombre') || !actual ? nombreValido(cuerpo.nombre, 'el nombre del producto') : actual.nombre;
  const descripcion = tiene('descripcion') ? descripcionValida(cuerpo.descripcion) : actual ? actual.descripcion : null;

  let precio: number | null = actual ? actual.precio : null;
  if (tiene('precio')) {
    precio =
      cuerpo.precio === null
        ? null
        : montoPositivo(cuerpo.precio, 'El precio debe ser un número entero de centavos mayor a cero.');
  }
  const precio_abierto = tiene('precio_abierto')
    ? booleano(cuerpo.precio_abierto, 'Indica si el producto tiene precio abierto (sí o no).')
    : actual
      ? actual.precio_abierto
      : false;
  const variantes = tiene('variantes')
    ? cuerpo.variantes === null
      ? []
      : validarVariantes(cuerpo.variantes, idsVariantes)
    : null;
  const nVariantes = variantes !== null ? variantes.length : actual ? actual.variantes.length : 0;
  const opciones = tiene('opciones') ? validarOpciones(cuerpo.opciones) : actual ? actual.opciones : [];
  const es_pasadia = tiene('es_pasadia')
    ? booleano(cuerpo.es_pasadia, 'Indica si el producto es pasadía (sí o no).')
    : actual
      ? actual.es_pasadia
      : false;
  const activo =
    actual && tiene('activo') ? booleano(cuerpo.activo, 'Indica si el producto está activo (sí o no).') : actual ? actual.activo : true;

  const formas = (precio !== null ? 1 : 0) + (nVariantes > 0 ? 1 : 0) + (precio_abierto ? 1 : 0);
  if (formas === 0) {
    throw new HttpError(400, 'Indica el precio del producto, sus porciones (variantes) o márcalo como precio abierto.');
  }
  if (formas > 1) {
    throw new HttpError(
      400,
      'Un producto lleva una sola forma de precio: precio fijo, porciones (variantes) o precio abierto. Quita las otras.',
    );
  }
  return { categoria_id, nombre, descripcion, precio, precio_abierto, variantes, opciones, es_pasadia, activo };
}

const MSG_PRODUCTO_REPETIDO = 'Ya existe un producto activo con ese nombre en esa categoría.';

/** Sentencias para guardar la lista completa de variantes de un producto. */
function sentenciasVariantes(env: Env, productoSql: string, productoBind: number[], variantes: VarianteEntrada[]) {
  // Primero se desactivan todas (así renombrar o intercambiar nombres nunca choca
  // con el índice único) y luego se activan/crean las de la lista, en su orden.
  const s: D1PreparedStatement[] = [
    env.DB.prepare(`UPDATE variantes SET activa = 0 WHERE producto_id = ${productoSql}`).bind(...productoBind),
  ];
  variantes.forEach((v, i) => {
    if (v.id !== null) {
      s.push(
        env.DB.prepare(
          `UPDATE variantes SET nombre = ?, nombre_clave = ?, precio = ?, orden = ?, activa = 1
            WHERE id = ? AND producto_id = ${productoSql}`,
        ).bind(v.nombre, claveNombre(v.nombre), v.precio, i + 1, v.id, ...productoBind),
      );
    } else {
      s.push(
        env.DB.prepare(
          `INSERT INTO variantes (producto_id, nombre, nombre_clave, precio, orden, activa)
           VALUES (${productoSql}, ?, ?, ?, ?, 1)`,
        ).bind(...productoBind, v.nombre, claveNombre(v.nombre), v.precio, i + 1),
      );
    }
  });
  return s;
}

export async function crearProducto(request: Request, env: Env): Promise<Response> {
  const cuerpo = await leerCuerpo(request);
  const p = await validarProducto(env, cuerpo, null, new Set());
  // En un batch (transacción, sin otras escrituras intercaladas) el producto
  // recién creado es MAX(id).
  const sentencias: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO productos (categoria_id, nombre, nombre_clave, descripcion, precio, precio_abierto,
                              agotado, activo, orden, es_pasadia, opciones)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, 1,
               (SELECT COALESCE(MAX(orden), 0) + 1 FROM productos WHERE categoria_id = ?1), ?7, ?8)`,
    ).bind(
      p.categoria_id,
      p.nombre,
      claveNombre(p.nombre),
      p.descripcion,
      p.precio,
      p.precio_abierto ? 1 : 0,
      p.es_pasadia ? 1 : 0,
      JSON.stringify(p.opciones),
    ),
  ];
  if (p.variantes && p.variantes.length > 0) {
    sentencias.push(...sentenciasVariantes(env, '(SELECT MAX(id) FROM productos)', [], p.variantes));
  }
  try {
    await env.DB.batch(sentencias);
  } catch (e) {
    if (esNombreRepetido(e)) throw new HttpError(409, MSG_PRODUCTO_REPETIDO);
    throw e;
  }
  const fila = await env.DB.prepare(`SELECT MAX(id) AS id FROM productos WHERE nombre_clave = ? AND categoria_id = ?`)
    .bind(claveNombre(p.nombre), p.categoria_id)
    .first<{ id: number }>();
  return json(await productoOError(env, fila?.id ?? 0), 201);
}

export async function editarProducto(request: Request, env: Env, id: number): Promise<Response> {
  const cuerpo = await leerCuerpo(request);
  const actual = await productoOError(env, id);
  const { results: vs } = await env.DB.prepare(`SELECT id FROM variantes WHERE producto_id = ?`)
    .bind(id)
    .all<{ id: number }>();
  const p = await validarProducto(env, cuerpo, actual, new Set(vs.map((v) => v.id)));

  const sentencias: D1PreparedStatement[] = [
    env.DB.prepare(
      `UPDATE productos SET
         orden = CASE WHEN categoria_id = ?1 THEN orden
                      ELSE (SELECT COALESCE(MAX(orden), 0) + 1 FROM productos WHERE categoria_id = ?1) END,
         categoria_id = ?1, nombre = ?2, nombre_clave = ?3, descripcion = ?4, precio = ?5,
         precio_abierto = ?6, es_pasadia = ?7, opciones = ?8, activo = ?9
       WHERE id = ?10`,
    ).bind(
      p.categoria_id,
      p.nombre,
      claveNombre(p.nombre),
      p.descripcion,
      p.precio,
      p.precio_abierto ? 1 : 0,
      p.es_pasadia ? 1 : 0,
      JSON.stringify(p.opciones),
      p.activo ? 1 : 0,
      id,
    ),
  ];
  if (p.variantes !== null) sentencias.push(...sentenciasVariantes(env, '?', [id], p.variantes));
  try {
    await env.DB.batch(sentencias);
  } catch (e) {
    if (esNombreRepetido(e)) throw new HttpError(409, MSG_PRODUCTO_REPETIDO);
    throw e;
  }
  return json(await productoOError(env, id));
}

export async function ordenarProductos(request: Request, env: Env): Promise<Response> {
  const cuerpo = await leerCuerpo(request);
  const categoriaId = entero(cuerpo.categoria_id, 1, Number.MAX_SAFE_INTEGER, 'Elige la categoría.');
  const cat = await env.DB.prepare(`SELECT 1 FROM categorias WHERE id = ?`).bind(categoriaId).first();
  if (!cat) throw new HttpError(404, 'No se encontró esa categoría.');
  const { results } = await env.DB.prepare(`SELECT id FROM productos WHERE categoria_id = ?`)
    .bind(categoriaId)
    .all<{ id: number }>();
  const ids = idsCompletos(
    cuerpo.ids,
    results.map((r) => r.id),
    'Manda todos los productos de la categoría (también los inactivos), cada uno una sola vez, en el nuevo orden.',
  );
  if (ids.length > 0) {
    await env.DB.batch(
      ids.map((pid, i) =>
        env.DB.prepare(`UPDATE productos SET orden = ? WHERE id = ? AND categoria_id = ?`).bind(i + 1, pid, categoriaId),
      ),
    );
  }
  return json({ ok: true });
}

// POST /api/productos/:id/agotado — dueno, cocina, caja
export async function cambiarAgotado(request: Request, env: Env, id: number): Promise<Response> {
  const cuerpo = await leerCuerpo(request);
  const agotado = booleano(cuerpo.agotado, 'Indica si el producto está agotado (sí o no).');
  const res = await env.DB.prepare(`UPDATE productos SET agotado = ? WHERE id = ?`).bind(agotado ? 1 : 0, id).run();
  if (res.meta.changes === 0) throw new HttpError(404, 'No se encontró ese producto.');
  return json(aPublico(await productoOError(env, id)));
}
