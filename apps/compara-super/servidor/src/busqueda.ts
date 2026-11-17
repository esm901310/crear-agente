/**
 * Búsqueda en las tiendas con caché en D1 (30 min) y, solo en desarrollo
 * local, modo "fixtures" (respuestas guardadas en precios/test/fixtures/).
 */
import { ADAPTADORES, buscarEnTodas, type CacheResultados, type ResultadoTienda } from '../../precios/src/index';
import { normalizarTexto } from '../../precios/src/normalizar';
import type { Producto } from '../../precios/src/tipos';
import { normalizarEan13 } from './ean';
import { agrupar } from './grupos';
import lacoloniaFixture from '../../precios/test/fixtures/lacolonia-busqueda.json';
import colonialFixture from '../../precios/test/fixtures/colonial-suggest.json';
// Carnes por libra (respuestas reales recortadas, una por consulta): para ver grupos 'corte' en local.
import lacoloniaCarnes from '../../precios/test/fixtures/lacolonia-carnes.json';
import colonialCarnes from '../../precios/test/fixtures/colonial-carnes.json';
// Registro hecho a mano (precio inventado) para que en modo prueba haya un producto en las dos tiendas.
import emparejables from '../datos-prueba/emparejables.json';
import type { Env, Tienda } from './tipos';

export const CACHE_MS = 30 * 60_000;
export type ModoPrecios = 'vivo' | 'fixtures';

/** Únicos dominios a los que el servidor puede consultar. */
const DOMINIOS_PERMITIDOS = new Set(['www.lacolonia.com', 'supercolonial.com']);

/** Mensajes para la persona (sin detalles técnicos). */
const MENSAJES_ERROR: Record<string, string> = {
  timeout: 'No respondió a tiempo',
  red: 'No se pudo conectar',
  http: 'Respondió con un error',
  formato: 'Cambió su página y no pudimos leer los precios',
  entrada: 'Búsqueda no válida',
  limite: 'No se consultó para no saturar la tienda; intenta de nuevo en unos minutos',
  desconocido: 'Error inesperado',
};

export function mensajeError(tipo: string | undefined): string {
  return MENSAJES_ERROR[tipo ?? 'desconocido'] ?? MENSAJES_ERROR.desconocido;
}

/**
 * Modo de precios. "fixtures" solo se acepta si la petición llega a localhost
 * (wrangler dev); en Cloudflare real siempre se usan las tiendas en vivo.
 */
export function modoPrecios(env: Env, url: URL): ModoPrecios {
  if (env.PRECIOS_MODO !== 'fixtures') return 'vivo';
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('PRECIOS_MODO=fixtures solo está permitido en desarrollo local');
  }
  return 'fixtures';
}

/** fetch que solo deja salir a los dominios de las tiendas. */
const fetchSeguro = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof entrada === 'string' || entrada instanceof URL ? entrada : entrada.url);
  if (url.protocol !== 'https:' || !DOMINIOS_PERMITIDOS.has(url.hostname)) {
    throw new Error(`Dominio no permitido: ${url.hostname}`);
  }
  return fetch(entrada, init);
}) as typeof fetch;

/**
 * fetch falso para desarrollo sin internet: responde con los JSON guardados,
 * filtrando los productos cuyo nombre contiene todas las palabras buscadas.
 * Son respuestas reales guardadas en una fecha pasada (NO son precios de hoy), más
 * un registro de La Colonia hecho a mano (datos-prueba/emparejables.json) con el
 * mismo código de barras que el Arroz Progreso de Colonial y precio inventado.
 */
/** Productos de las fixtures de carnes (todas las consultas juntas, sin repetir). */
function productosCarnes<T>(fixture: Record<string, unknown>, lista: (r: never) => T[], id: (p: T) => string): T[] {
  const vistos = new Set<string>();
  return Object.entries(fixture)
    .filter(([k]) => k !== '_nota')
    .flatMap(([, r]) => lista(r as never))
    .filter((p) => !vistos.has(id(p)) && !!vistos.add(id(p)));
}
type ProductoLcFixture = { productId: string; brand?: string | null; productName: string };
type ProductoClFixture = { id: number | string; title: string; image?: string | null };
const carnesLc = productosCarnes<ProductoLcFixture>(lacoloniaCarnes, (r: { products: ProductoLcFixture[] }) => r.products, (p) => p.productId);
const carnesCl = productosCarnes<ProductoClFixture>(
  colonialCarnes,
  (r: { resources: { results: { products: ProductoClFixture[] } } }) => r.resources.results.products,
  (p) => String(p.id),
);

export const fetchFixtures = (async (entrada: RequestInfo | URL) => {
  const url = new URL(String(entrada));
  const palabras = (q: string | null) => normalizarTexto(q ?? '').split(' ').filter((p) => p.length >= 2);
  const coincide = (nombre: string, ps: string[]) => {
    const n = normalizarTexto(nombre);
    return ps.length > 0 && ps.every((p) => n.includes(p));
  };
  const json = (cuerpo: unknown) =>
    new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } });

  if (url.hostname === 'www.lacolonia.com') {
    const ps = palabras(url.searchParams.get('query'));
    const todos: Array<{ brand?: string | null; productName: string }> = [...lacoloniaFixture.products, ...emparejables.lacolonia.products, ...carnesLc];
    return json({ products: todos.filter((p) => coincide(`${p.brand ?? ''} ${p.productName}`, ps)) });
  }
  if (url.hostname === 'supercolonial.com') {
    const q = url.searchParams.get('q') ?? '';
    const ps = palabras(q);
    // Búsqueda por código de barras: en los datos guardados solo se conoce por el nombre de la imagen.
    const productos = /^\d{8,14}$/.test(q)
      ? colonialFixture.resources.results.products.filter((p) => p.image?.includes(`Items_2f${q}`))
      : [...colonialFixture.resources.results.products, ...carnesCl].filter((p) => coincide(p.title, ps));
    return json({ resources: { results: { products: productos } } });
  }
  return new Response('sin datos de prueba', { status: 404 });
}) as unknown as typeof fetch;

/** Cuántas consultas reales (sin caché) a tiendas puede hacer todavía esta petición. */
export interface Presupuesto {
  restante: number;
}

export interface OpcionesBuscar {
  tiendas: Tienda[];
  modo: ModoPrecios;
  presupuesto?: Presupuesto;
  /**
   * Buscar por código de barras, en las tiendas que lo permiten (Colonial), los
   * productos de otra tienda que quedaron sin pareja. Por defecto true; la
   * comparación de la lista lo apaga (ya sabe qué producto busca en cada tienda).
   */
  completarPorCodigo?: boolean;
  /** Pausa entre consultas reales por código, en ms (por defecto PAUSA_CODIGO_MS). */
  pausaMs?: number;
  /** Al buscar un código: producto de otra tienda con ese código (ver OpcionesBusqueda.referencia). */
  referencia?: { nombre: string; marca?: string };
  /** Para pruebas: reemplaza el fetch. */
  fetch?: typeof fetch;
}

/** Máximo de consultas extra por código de barras en cada búsqueda (cada una es 1 petición). */
export const MAX_CONSULTAS_POR_CODIGO = 6;
/** De a cuántas a la vez y con qué pausa (ms) entre una y otra. */
export const CONCURRENCIA_CODIGO = 2;
export const PAUSA_CODIGO_MS = 250;

export interface ResultadoBusqueda {
  resultados: ResultadoTienda[];
  /** Cuántas tiendas se consultaron de verdad (no venían de la caché). */
  consultasReales: number;
}

/**
 * Busca `texto` en las tiendas indicadas usando la caché de D1 y, si
 * `completarPorCodigo`, completa con búsquedas por código de barras.
 * Nunca lanza por fallas de tienda.
 */
export async function buscar(db: D1Database, texto: string, opciones: OpcionesBuscar): Promise<ResultadoBusqueda> {
  const r = await buscarTexto(db, texto, opciones);
  if (opciones.completarPorCodigo === false) return r;
  return completarPorCodigo(db, r, opciones);
}

/**
 * Código para escribir en el buscador de la tienda: las tiendas guardan el UPC de
 * 12 dígitos (sin el 0 que le agrega EAN-13) y el EAN-8 sin ceros a la izquierda.
 */
export function codigoParaBuscar(ean13: string): string {
  if (ean13.startsWith('00000')) return ean13.slice(5);
  return ean13.startsWith('0') ? ean13.slice(1) : ean13;
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Para cada tienda que busca por código (Colonial) y respondió bien: toma los
 * productos de las OTRAS tiendas que no tienen pareja en ella (en orden de
 * relevancia, con código de barras válido) y busca cada código ahí, hasta
 * MAX_CONSULTAS_POR_CODIGO en total. Lo que encuentra se agrega a los resultados
 * de esa tienda con el código puesto, así `emparejar` los une por código.
 * Las consultas usan la misma caché de D1 (30 min) que las búsquedas de texto.
 */
async function completarPorCodigo(db: D1Database, base: ResultadoBusqueda, opciones: OpcionesBuscar): Promise<ResultadoBusqueda> {
  const okPorTienda = new Map(base.resultados.filter((r) => r.ok).map((r) => [r.tienda, r]));
  const destinos = [...okPorTienda.keys()].filter((t) => ADAPTADORES[t].buscaPorCodigo);
  if (destinos.length === 0 || okPorTienda.size < 2) return base;

  const grupos = agrupar([...okPorTienda.values()].map((r) => ({ tienda: r.tienda, productos: r.productos })));
  const pendientes: Array<{ destino: Tienda; producto: Producto; ean13: string; posicion: number }> = [];
  for (const destino of destinos) {
    for (const g of grupos) {
      if (g.productos[destino]) continue;
      for (const p of Object.values(g.productos)) {
        const ean13 = normalizarEan13(p!.codigoBarras);
        const posicion = okPorTienda.get(p!.tienda)!.productos.indexOf(p!);
        if (ean13) pendientes.push({ destino, producto: p!, ean13, posicion });
      }
    }
  }
  pendientes.sort((a, b) => a.posicion - b.posicion);
  const vistos = new Set<string>();
  const elegidos = pendientes.filter((x) => {
    const k = `${x.destino}:${x.ean13}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  }).slice(0, MAX_CONSULTAS_POR_CODIGO);
  if (elegidos.length === 0) return base;

  const pausaMs = opciones.pausaMs ?? PAUSA_CODIGO_MS;
  let consultasReales = base.consultasReales;
  let siguiente = 0;
  const encontrados: Array<{ destino: Tienda; producto: Producto }> = [];
  const trabajador = async () => {
    while (siguiente < elegidos.length) {
      const e = elegidos[siguiente++];
      // La tienda solo devuelve el producto si su imagen trae el código o si coincide con la referencia.
      const referencia = { nombre: e.producto.nombre, marca: e.producto.marca };
      const r = await buscarTexto(db, codigoParaBuscar(e.ean13), { ...opciones, tiendas: [e.destino], referencia });
      consultasReales += r.consultasReales;
      const hallado = r.resultados[0]?.ok ? r.resultados[0].productos[0] : undefined;
      if (hallado && normalizarEan13(hallado.codigoBarras) === e.ean13) {
        encontrados.push({ destino: e.destino, producto: hallado });
      }
      if (r.consultasReales > 0 && pausaMs > 0) await dormir(pausaMs);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCIA_CODIGO, elegidos.length) }, trabajador));

  // Agregar lo encontrado (sin modificar los resultados originales, que pueden venir de la caché).
  const resultados = base.resultados.map((r) => ({ ...r, productos: [...r.productos] }));
  for (const { destino, producto } of encontrados) {
    const r = resultados.find((x) => x.tienda === destino)!;
    const i = r.productos.findIndex((p) => p.id === producto.id);
    if (i >= 0) r.productos[i] = { ...r.productos[i], codigoBarras: producto.codigoBarras };
    else r.productos.push(producto);
  }
  return { resultados, consultasReales };
}

/** Busca `texto` en las tiendas indicadas usando la caché de D1 (sin completar por código). */
async function buscarTexto(db: D1Database, texto: string, opciones: OpcionesBuscar): Promise<ResultadoBusqueda> {
  const norm = normalizarTexto(texto);
  const claveD1 = (tienda: Tienda) => `${opciones.modo}:${tienda}:${norm}`;
  const ahora = Date.now();

  // 1) Leer de D1 lo que ya está en caché (vigente).
  const enCache = new Map<string, Producto[]>();
  if (opciones.tiendas.length > 0) {
    const marcas = opciones.tiendas.map(() => '?').join(',');
    const filas = await db
      .prepare(`SELECT clave, resultado_json FROM cache_busquedas WHERE guardado_en > ? AND clave IN (${marcas})`)
      .bind(ahora - CACHE_MS, ...opciones.tiendas.map(claveD1))
      .all<{ clave: string; resultado_json: string }>();
    for (const f of filas.results ?? []) {
      try {
        enCache.set(f.clave, JSON.parse(f.resultado_json) as Producto[]);
      } catch {
        /* fila dañada: se ignora y se vuelve a consultar */
      }
    }
  }

  // 2) Respetar el presupuesto de consultas reales.
  const aConsultar: Tienda[] = [];
  const omitidas: Tienda[] = [];
  for (const t of opciones.tiendas) {
    if (enCache.has(claveD1(t))) aConsultar.push(t);
    else if (!opciones.presupuesto || opciones.presupuesto.restante > 0) {
      if (opciones.presupuesto) opciones.presupuesto.restante--;
      aConsultar.push(t);
    } else omitidas.push(t);
  }

  // 3) Caché en memoria que alimenta a buscarEnTodas (su interfaz es síncrona).
  const nuevos: Array<{ clave: string; productos: Producto[] }> = [];
  const cache: CacheResultados = {
    obtener: (clave) => enCache.get(`${opciones.modo}:${clave}`),
    guardar: (clave, productos) => nuevos.push({ clave: `${opciones.modo}:${clave}`, productos }),
  };
  const resultados =
    aConsultar.length > 0
      ? await buscarEnTodas(texto, {
          tiendas: aConsultar,
          cache,
          fetch: opciones.fetch ?? (opciones.modo === 'fixtures' ? fetchFixtures : fetchSeguro),
          timeoutMs: 8000,
          limite: 20,
          referencia: opciones.referencia,
        })
      : [];
  for (const t of omitidas) {
    resultados.push({
      tienda: t,
      nombreTienda: t,
      ok: false,
      productos: [],
      error: { tipo: 'limite', mensaje: 'Límite de consultas por petición' },
      ms: 0,
    });
  }

  // 4) Guardar en D1 los resultados nuevos (solo los exitosos, así los errores no se quedan en caché).
  if (nuevos.length > 0) {
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO cache_busquedas (clave, resultado_json, guardado_en) VALUES (?, ?, ?)',
    );
    const lote = nuevos.map((n) => stmt.bind(n.clave, JSON.stringify(n.productos), ahora));
    // Limpieza ocasional de entradas vencidas.
    if (Math.random() < 0.1) {
      lote.push(db.prepare('DELETE FROM cache_busquedas WHERE guardado_en < ?').bind(ahora - CACHE_MS));
    }
    await db.batch(lote);
  }

  const consultasReales = aConsultar.filter((t) => !enCache.has(claveD1(t))).length;
  return { resultados, consultasReales };
}
