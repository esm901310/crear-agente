/**
 * Cálculo de totales, faltantes y ganador (sin red ni base de datos).
 * Reglas: docs/api-contrato.md y docs/diseno.md §P7 "Regla para productos faltantes".
 */
import type { ItemLista, PrecioTienda, ResultadoComparacion, ResumenTienda, Tienda } from './tipos';

/** Precio efectivo = precioOferta ?? precio. */
export function precioEfectivo(p: PrecioTienda): number {
  return p.precioOferta ?? p.precio;
}

/**
 * Producto que se compraría en esa tienda: el original si lo tiene (y no está
 * marcado como no disponible); si no, el sustituto elegido por la persona.
 */
export function productoEnTienda(item: ItemLista, tienda: Tienda): PrecioTienda | undefined {
  const original = item.grupo.precios[tienda];
  if (original && original.disponible !== false) return original;
  const sustituto = item.sustitutos[tienda];
  if (sustituto && sustituto.disponible !== false) return sustituto;
  return undefined;
}

const aCentavos = (n: number) => Math.round(n * 100);
const aLempiras = (c: number) => Math.round(c) / 100;

export function calcularComparacion(
  items: ItemLista[],
  tiendas: Tienda[],
  errores: Partial<Record<Tienda, string>> = {},
): ResultadoComparacion {
  const centavos = new Map<Tienda, number>();
  const resumen: ResumenTienda[] = tiendas.map((tienda) => {
    let total = 0;
    const faltantes: string[] = [];
    for (const item of items) {
      const p = productoEnTienda(item, tienda);
      if (p) total += aCentavos(precioEfectivo(p)) * item.cantidad;
      else faltantes.push(item.id);
    }
    centavos.set(tienda, total);
    return {
      tienda,
      total: aLempiras(total),
      completa: faltantes.length === 0,
      faltantes,
      error: errores[tienda] ?? null,
    };
  });

  // Solo compiten las tiendas que respondieron (sin error) y tienen la lista completa.
  const sinError = resumen.filter((r) => r.error === null);
  const completas = items.length > 0 ? sinError.filter((r) => r.completa) : [];

  let ganador: Tienda | null = null;
  let ahorro: number | null = null;
  let empate = false;
  let comparacionParcial: ResultadoComparacion['comparacionParcial'] = null;

  if (completas.length > 0) {
    const ordenadas = [...completas].sort((a, b) => centavos.get(a.tienda)! - centavos.get(b.tienda)!);
    const minimo = centavos.get(ordenadas[0].tienda)!;
    const maximo = centavos.get(ordenadas[ordenadas.length - 1].tienda)!;
    ganador = ordenadas[0].tienda;
    empate = ordenadas.length > 1 && centavos.get(ordenadas[1].tienda) === minimo;
    // Ahorro contra la completa más cara; solo si hay otra completa con qué comparar y es mayor.
    ahorro = ordenadas.length > 1 && maximo > minimo ? aLempiras(maximo - minimo) : null;
  } else if (items.length > 0 && sinError.length > 0) {
    // Ninguna completa: comparar solo los productos que están en todas las tiendas que respondieron.
    const comunes = items.filter((item) => sinError.every((r) => productoEnTienda(item, r.tienda)));
    const totales: Partial<Record<Tienda, number>> = {};
    for (const r of sinError) {
      let c = 0;
      for (const item of comunes) c += aCentavos(precioEfectivo(productoEnTienda(item, r.tienda)!)) * item.cantidad;
      totales[r.tienda] = aLempiras(c);
    }
    comparacionParcial = { tiendas: totales, itemsComparados: comunes.length };
  }

  return { tiendas: resumen, ganador, ahorro, empate, comparacionParcial };
}
