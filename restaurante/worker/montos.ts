// Montos de una cuenta (Entrega 3: pasadía = consumo mínimo). ÚNICO lugar del
// Worker donde se define cómo se calcula el subtotal. La base de datos aplica
// la misma regla al cerrar una cuenta (trigger trg_ordenes_cierre_cuadra,
// migración 0007).
//
//   consumo  = suma de precio × cantidad de los items que NO son pasadía
//   pasadia  = suma de precio × cantidad de los items de pasadía
//   subtotal = max(consumo, pasadia)      ← sobre esto se calcula la propina
//
// Los fragmentos SQL esperan la orden con el alias `o`.

function sqlSuma(esPasadia: 0 | 1): string {
  return `COALESCE((SELECT SUM(i.precio * i.cantidad)
                      FROM items i JOIN comandas c ON c.id = i.comanda_id
                     WHERE c.orden_id = o.id AND i.es_pasadia = ${esPasadia}), 0)`;
}

/** Consumo de la orden `o` (centavos). */
export const SQL_CONSUMO = sqlSuma(0);
/** Pasadía de la orden `o` (centavos). */
export const SQL_PASADIA = sqlSuma(1);
/** Subtotal de la orden `o` = max(consumo, pasadía) (centavos). */
export const SQL_SUBTOTAL = `MAX(${SQL_CONSUMO}, ${SQL_PASADIA})`;

/** Subtotal a partir de consumo y pasadía (misma regla que SQL_SUBTOTAL). */
export function subtotalDe(consumo: number, pasadia: number): number {
  return Math.max(consumo, pasadia);
}
