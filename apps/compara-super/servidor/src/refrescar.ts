/**
 * Vuelve a consultar los precios de los productos de la lista, con caché,
 * concurrencia limitada, pausa breve entre consultas y tope de consultas por petición.
 */
import { normalizarTexto } from '../../precios/src/normalizar';
import { ADAPTADORES, type ResultadoTienda } from '../../precios/src/index';
import type { OpcionesBuscar, Presupuesto, ResultadoBusqueda } from './busqueda';
import { codigoParaBuscar, mensajeError } from './busqueda';
import { aPrecioTienda, eanDeClave, reidentificar } from './grupos';
import type { ItemLista, PrecioTienda, Tienda } from './tipos';

export const CONCURRENCIA = 3;
export const PAUSA_MS = 300;
/** Máximo de consultas reales a tiendas por comparación (Cloudflare gratis permite 50 subpeticiones). */
export const MAX_CONSULTAS_POR_COMPARACION = 40;

export type FuncionBuscar = (
  texto: string,
  opciones: Pick<OpcionesBuscar, 'tiendas' | 'presupuesto' | 'completarPorCodigo' | 'referencia'>,
) => Promise<ResultadoBusqueda>;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ejecuta tareas con un máximo de `limite` a la vez. */
export async function enParalelo<T, R>(entradas: T[], limite: number, tarea: (e: T) => Promise<R>): Promise<R[]> {
  const salida = new Array<R>(entradas.length);
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < entradas.length) {
      const i = siguiente++;
      salida[i] = await tarea(entradas[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, entradas.length) }, trabajador));
  return salida;
}

export interface ResultadoRefresco {
  items: ItemLista[];
  /** Tiendas en las que fallaron TODAS las consultas (mensaje para la persona). */
  errores: Partial<Record<Tienda, string>>;
}

function marcarDesactualizado(p: PrecioTienda | undefined): PrecioTienda | undefined {
  return p ? { ...p, desactualizado: true } : undefined;
}

export async function refrescarItems(
  itemsOriginales: ItemLista[],
  tiendas: Tienda[],
  buscar: FuncionBuscar,
  opciones: { pausaMs?: number; maxConsultas?: number } = {},
): Promise<ResultadoRefresco> {
  const pausaMs = opciones.pausaMs ?? PAUSA_MS;
  const presupuesto: Presupuesto = { restante: opciones.maxConsultas ?? MAX_CONSULTAS_POR_COMPARACION };
  const items: ItemLista[] = structuredClone(itemsOriginales);

  const ejecutar = async (texto: string, ts: Tienda[], referencia?: OpcionesBuscar['referencia']) => {
    // Aquí ya se sabe qué producto se busca en cada tienda: sin consultas extra por código.
    const r = await buscar(texto, { tiendas: ts, presupuesto, completarPorCodigo: false, ...(referencia ? { referencia } : {}) });
    if (r.consultasReales > 0 && pausaMs > 0) await dormir(pausaMs);
    return r.resultados;
  };

  // Seguimiento de fallas por tienda.
  const intentos: Record<string, number> = {};
  const fallas: Record<string, { n: number; tipo?: string }> = {};
  const anotar = (rs: ResultadoTienda[]) => {
    for (const r of rs) {
      intentos[r.tienda] = (intentos[r.tienda] ?? 0) + 1;
      if (!r.ok) {
        const f = (fallas[r.tienda] ??= { n: 0 });
        f.n++;
        f.tipo ??= r.error?.tipo;
      }
    }
  };

  // 1) Productos originales. En cada tienda se busca con el nombre ORIGINAL que esa
  //    tienda le da al producto (el nombre limpio del grupo puede no coincidir con su
  //    buscador, p. ej. Colonial "BlancoGranoLar1.75Kg"); si el producto aún no está en
  //    esa tienda, con el nombre del grupo. Las tiendas con el mismo texto van en una sola
  //    búsqueda y los textos repetidos se buscan una sola vez. Si el producto aún no está en
  //    una tienda que busca por código de barras (Colonial) y el grupo tiene código, se busca
  //    el código: encuentra justo ese producto aunque su nombre sea muy distinto.
  //    Los grupos 'probable' (sin código en una de las tiendas) se re-identifican igual que
  //    los demás: por el productoId guardado en cada tienda.
  const textoPara = (item: ItemLista, tienda: Tienda) => {
    const guardado = item.grupo.precios[tienda]?.nombre;
    if (guardado) return guardado;
    const ean = eanDeClave(item.grupo.clave);
    return ean && ADAPTADORES[tienda].buscaPorCodigo ? codigoParaBuscar(ean) : item.grupo.nombre;
  };
  // Al buscar por código, la tienda confirma el resultado contra el producto de otra tienda del grupo.
  const referenciaDe = (item: ItemLista): OpcionesBuscar['referencia'] => {
    const otro = Object.values(item.grupo.precios)[0];
    return otro ? { nombre: otro.nombre, ...(item.grupo.marca ? { marca: item.grupo.marca } : {}) } : undefined;
  };
  const busquedas = new Map<string, { texto: string; tiendas: Set<Tienda>; referencia?: OpcionesBuscar['referencia'] }>();
  for (const item of items) {
    for (const tienda of tiendas) {
      const texto = textoPara(item, tienda);
      const clave = normalizarTexto(texto);
      const esCodigo = !item.grupo.precios[tienda] && /^\d+$/.test(texto);
      const b = busquedas.get(clave) ?? { texto, tiendas: new Set<Tienda>(), ...(esCodigo ? { referencia: referenciaDe(item) } : {}) };
      b.tiendas.add(tienda);
      busquedas.set(clave, b);
    }
  }
  const porTexto = new Map<string, ResultadoTienda[]>();
  await enParalelo([...busquedas.entries()], CONCURRENCIA, async ([clave, b]) => {
    const rs = await ejecutar(b.texto, tiendas.filter((t) => b.tiendas.has(t)), b.referencia);
    anotar(rs);
    porTexto.set(clave, rs);
  });

  for (const item of items) {
    const ean = eanDeClave(item.grupo.clave);
    for (const tienda of tiendas) {
      const guardado = item.grupo.precios[tienda];
      const r = porTexto.get(normalizarTexto(textoPara(item, tienda)))?.find((x) => x.tienda === tienda);
      const encontrado = r?.ok ? reidentificar(r.productos, guardado?.productoId, ean) : undefined;
      if (encontrado) item.grupo.precios[tienda] = aPrecioTienda(encontrado);
      else if (guardado) item.grupo.precios[tienda] = marcarDesactualizado(guardado);
    }
  }

  // 2) Sustitutos que de verdad se usan (el original falta en esa tienda): búsqueda solo en esa tienda.
  const pendientes: Array<{ item: ItemLista; tienda: Tienda }> = [];
  for (const item of items) {
    for (const tienda of tiendas) {
      const original = item.grupo.precios[tienda];
      const originalSirve = !!original && original.disponible !== false;
      if (item.sustitutos[tienda] && !originalSirve) pendientes.push({ item, tienda });
    }
  }
  await enParalelo(pendientes, CONCURRENCIA, async ({ item, tienda }) => {
    const s = item.sustitutos[tienda]!;
    const rs = await ejecutar(s.nombre, [tienda]);
    anotar(rs);
    const r = rs[0];
    const encontrado = r?.ok ? reidentificar(r.productos, s.productoId, undefined) : undefined;
    item.sustitutos[tienda] = encontrado ? aPrecioTienda(encontrado) : marcarDesactualizado(s);
  });

  const errores: Partial<Record<Tienda, string>> = {};
  for (const tienda of tiendas) {
    const f = fallas[tienda];
    if (f && f.n === intentos[tienda]) errores[tienda] = `No pudimos consultar la tienda: ${mensajeError(f.tipo)}`;
  }
  return { items, errores };
}
