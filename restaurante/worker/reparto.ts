// Reparto de la propina de una cuenta entre sus formas de pago.
// Función pura (sin base de datos) para poder probarla sola:
//   npm run test:reparto
//
// Regla (contrato Entrega 2): cuando una cuenta se pagó con varias formas, la
// propina se reparte en proporción al monto cobrado con cada forma. Se redondea
// con el MÉTODO DEL RESIDUO MAYOR: a cada forma se le da la parte entera de su
// cuota y los centavos que sobran se asignan, uno por uno, a las formas con
// mayor residuo. Así la suma es exactamente la propina, al centavo.
// Desempate (mismo residuo): mayor monto primero; luego el orden
// efectivo → tarjeta → transferencia. El resultado siempre es el mismo para
// los mismos datos.
//
// Se calcula con BigInt para no perder precisión con montos grandes.

export type Metodo = 'efectivo' | 'tarjeta' | 'transferencia';
export const ORDEN_METODOS: readonly Metodo[] = ['efectivo', 'tarjeta', 'transferencia'];

export type PorMetodo = Record<Metodo, number>;

export function ceroPorMetodo(): PorMetodo {
  return { efectivo: 0, tarjeta: 0, transferencia: 0 };
}

/**
 * Reparte `propina` (centavos, entero ≥ 0) entre las formas de pago según los
 * pagos de la cuenta. Varios pagos con la misma forma se suman antes de repartir.
 * Devuelve cuánto de la propina corresponde a cada forma (suma = propina).
 * Si no hay pagos (no debería pasar en una cuenta cobrada), todo va a efectivo
 * para no perder centavos.
 */
export function repartirPropina(propina: number, pagos: readonly { metodo: Metodo; monto: number }[]): PorMetodo {
  const res = ceroPorMetodo();
  if (!Number.isSafeInteger(propina) || propina < 0) throw new Error('propina inválida');
  if (propina === 0) return res;

  const montos = ceroPorMetodo();
  for (const p of pagos) {
    if (!Number.isSafeInteger(p.monto) || p.monto < 0) throw new Error('monto inválido');
    montos[p.metodo] += p.monto;
  }
  const total = ORDEN_METODOS.reduce((s, m) => s + montos[m], 0);
  if (total <= 0) {
    res.efectivo = propina;
    return res;
  }

  const P = BigInt(propina);
  const T = BigInt(total);
  const partes = ORDEN_METODOS.filter((m) => montos[m] > 0).map((m, i) => {
    const prod = P * BigInt(montos[m]);
    return { metodo: m, base: prod / T, residuo: prod % T, monto: montos[m], i };
  });
  let asignado = 0n;
  for (const p of partes) asignado += p.base;
  let faltan = Number(P - asignado); // siempre < número de formas

  partes.sort((a, b) => {
    if (a.residuo !== b.residuo) return a.residuo > b.residuo ? -1 : 1;
    if (a.monto !== b.monto) return b.monto - a.monto;
    return a.i - b.i;
  });
  for (const p of partes) {
    res[p.metodo] = Number(p.base) + (faltan > 0 ? 1 : 0);
    if (faltan > 0) faltan--;
  }
  return res;
}
