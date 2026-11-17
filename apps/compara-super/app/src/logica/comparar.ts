// Cálculo de totales por tienda. Lo usa el modo simulado y la app para
// recalcular al instante cuando la persona cambia cantidades o sustitutos
// (con los mismos precios que mandó el servidor la última vez).
import type {
  ComparacionParcial,
  Grupo,
  ItemLista,
  PrecioTienda,
  RespuestaComparar,
  Tienda,
  TotalTienda,
} from '../api/cliente';
import { esCorte } from './corte';
import { ordenarTiendas } from './tiendas';

export const precioEfectivo = (p: PrecioTienda): number => p.precioOferta ?? p.precio;

export function estaDisponible(p: PrecioTienda | undefined | null): p is PrecioTienda {
  return !!p && p.disponible !== false && Number.isFinite(p.precio);
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Subtotal de una línea (precio × cantidad) redondeado al centavo, igual que el servidor:
 * en centavos enteros (55.99 × 1.5 = 83.985 → 83.99).
 */
export function subtotal(p: PrecioTienda, cantidad: number): number {
  return Math.round(Math.round(precioEfectivo(p) * 100) * cantidad) / 100;
}

export interface PrecioDeItem {
  precio: PrecioTienda;
  esSustituto: boolean;
}

/**
 * Precio con el que cuenta un producto de la lista en una tienda (original o sustituto).
 * En cortes por libra la persona puede elegir otro corte aunque el emparejado esté
 * disponible ("Elegir otro corte"): ahí manda su elección.
 */
export function precioDeItemEn(item: ItemLista, t: Tienda): PrecioDeItem | null {
  const original = item.grupo.precios[t];
  const sustituto = item.sustitutos?.[t];
  if (esCorte(item.grupo) && estaDisponible(sustituto)) return { precio: sustituto, esSustituto: true };
  if (estaDisponible(original)) return { precio: original, esSustituto: false };
  if (estaDisponible(sustituto)) return { precio: sustituto, esSustituto: true };
  return null;
}

/** Precio más bajo de un producto entre las tiendas indicadas (o todas). */
export function precioMinimo(grupo: Grupo, tiendas?: Tienda[]): { tienda: Tienda; valor: number } | null {
  let mejor: { tienda: Tienda; valor: number } | null = null;
  for (const t of ordenarTiendas(Object.keys(grupo.precios) as Tienda[])) {
    if (tiendas && !tiendas.includes(t)) continue;
    const p = grupo.precios[t];
    if (!estaDisponible(p)) continue;
    const v = precioEfectivo(p);
    if (!mejor || v < mejor.valor) mejor = { tienda: t, valor: v };
  }
  return mejor;
}

/** Tiendas donde el producto original no está (sin contar sustitutos). */
export function tiendasSinProducto(item: ItemLista, tiendas: Tienda[]): Tienda[] {
  return tiendas.filter((t) => !precioDeItemEn(item, t));
}

export function calcularComparacion(
  items: ItemLista[],
  tiendasEntrada: Tienda[],
  errores: Partial<Record<Tienda, string | null>>,
  consultadoEn: string,
): RespuestaComparar {
  const tiendas = ordenarTiendas(tiendasEntrada);
  const totales: TotalTienda[] = tiendas.map((t) => {
    const error = errores[t] ?? null;
    if (error) return { tienda: t, total: 0, completa: false, faltantes: [], error };
    let total = 0;
    const faltantes: string[] = [];
    for (const item of items) {
      const p = precioDeItemEn(item, t);
      if (p) total += subtotal(p.precio, item.cantidad);
      else faltantes.push(item.id);
    }
    return { tienda: t, total: redondear(total), completa: faltantes.length === 0, faltantes, error: null };
  });

  const completas = totales.filter((t) => !t.error && t.completa && items.length > 0);
  let ganador: Tienda | null = null;
  let ahorro: number | null = null;
  let empate = false;
  let comparacionParcial: ComparacionParcial | null = null;

  if (completas.length > 0) {
    const min = Math.min(...completas.map((t) => t.total));
    const max = Math.max(...completas.map((t) => t.total));
    const ganadoras = completas.filter((t) => Math.abs(t.total - min) < 0.005);
    ganador = ganadoras[0].tienda;
    empate = ganadoras.length > 1;
    // Igual que el servidor: en empate, ahorro = null y ganador = la primera.
    ahorro = !empate && completas.length > 1 ? redondear(max - min) : null;
  } else if (items.length > 0) {
    const sinError = totales.filter((t) => !t.error).map((t) => t.tienda);
    const comunes = items.filter((i) => sinError.every((t) => precioDeItemEn(i, t)));
    const parcial: Partial<Record<Tienda, number>> = {};
    for (const t of sinError) {
      parcial[t] = redondear(
        comunes.reduce((s, i) => s + subtotal(precioDeItemEn(i, t)!.precio, i.cantidad), 0),
      );
    }
    comparacionParcial = { tiendas: parcial, itemsComparados: comunes.length };
  }

  return { consultadoEn, items, tiendas: totales, ganador, ahorro, empate, comparacionParcial };
}

/** Recalcula con los mismos precios y errores de la última comparación. */
export function recalcular(previa: RespuestaComparar, items: ItemLista[]): RespuestaComparar {
  const errores: Partial<Record<Tienda, string | null>> = {};
  for (const t of previa.tiendas) errores[t.tienda] = t.error;
  const nueva = calcularComparacion(
    items,
    previa.tiendas.map((t) => t.tienda),
    errores,
    previa.consultadoEn,
  );
  // Conserva los datos extra del servidor (p. ej. modoPrueba / avisoPrueba).
  return { ...previa, ...nueva };
}

/** Quita tildes y pasa a minúsculas, para comparar textos. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Qué tanto se parecen dos nombres (0 a 1), por palabras en común. */
export function parecido(a: string, b: string): number {
  const pa = new Set(normalizar(a).split(' ').filter((w) => w.length > 1));
  const pb = new Set(normalizar(b).split(' ').filter((w) => w.length > 1));
  if (pa.size === 0 || pb.size === 0) return 0;
  let comunes = 0;
  for (const w of pa) if (pb.has(w)) comunes++;
  return comunes / Math.max(pa.size, pb.size);
}
