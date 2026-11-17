/**
 * Búsqueda en las tiendas con caché en D1 (30 min) y, solo en desarrollo
 * local, modo "fixtures" (respuestas guardadas en precios/test/fixtures/).
 */
import { buscarEnTodas, type CacheResultados, type ResultadoTienda } from '../../precios/src/index';
import { normalizarTexto } from '../../precios/src/normalizar';
import type { Producto } from '../../precios/src/tipos';
import lacoloniaFixture from '../../precios/test/fixtures/lacolonia-busqueda.json';
import colonialFixture from '../../precios/test/fixtures/colonial-suggest.json';
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
    const todos: Array<{ brand?: string; productName: string }> = [...lacoloniaFixture.products, ...emparejables.lacolonia.products];
    return json({ products: todos.filter((p) => coincide(`${p.brand ?? ''} ${p.productName}`, ps)) });
  }
  if (url.hostname === 'supercolonial.com') {
    const ps = palabras(url.searchParams.get('q'));
    const productos = colonialFixture.resources.results.products.filter((p) => coincide(p.title, ps));
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
  /** Para pruebas: reemplaza el fetch. */
  fetch?: typeof fetch;
}

export interface ResultadoBusqueda {
  resultados: ResultadoTienda[];
  /** Cuántas tiendas se consultaron de verdad (no venían de la caché). */
  consultasReales: number;
}

/** Busca `texto` en las tiendas indicadas usando la caché de D1. Nunca lanza por fallas de tienda. */
export async function buscar(db: D1Database, texto: string, opciones: OpcionesBuscar): Promise<ResultadoBusqueda> {
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
