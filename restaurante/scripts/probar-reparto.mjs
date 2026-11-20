// Pruebas de la función pura repartirPropina (worker/reparto.ts).
// Uso: npm run test:reparto   (Node 22.18+ ejecuta TypeScript directamente)
import assert from 'node:assert/strict';
import { repartirPropina } from '../worker/reparto.ts';

let n = 0;
function caso(nombre, propina, pagos, esperado) {
  const r = repartirPropina(propina, pagos);
  assert.deepEqual(r, esperado, nombre);
  assert.equal(r.efectivo + r.tarjeta + r.transferencia, propina, `${nombre}: suma exacta`);
  n++;
}

caso('propina 0', 0, [{ metodo: 'efectivo', monto: 1000 }, { metodo: 'tarjeta', monto: 500 }], {
  efectivo: 0, tarjeta: 0, transferencia: 0,
});
caso('un solo método', 5000, [{ metodo: 'tarjeta', monto: 37050 }], { efectivo: 0, tarjeta: 5000, transferencia: 0 });
// 1 centavo entre 3 formas iguales: residuos iguales y montos iguales → efectivo (primero en el orden).
caso('1¢ entre 3 iguales', 1, [
  { metodo: 'transferencia', monto: 1000 },
  { metodo: 'tarjeta', monto: 1000 },
  { metodo: 'efectivo', monto: 1000 },
], { efectivo: 1, tarjeta: 0, transferencia: 0 });
// 1 centavo entre 3 distintas: gana la de mayor monto (mayor residuo).
caso('1¢ entre 3 distintas', 1, [
  { metodo: 'efectivo', monto: 100 },
  { metodo: 'tarjeta', monto: 300 },
  { metodo: 'transferencia', monto: 200 },
], { efectivo: 0, tarjeta: 1, transferencia: 0 });
// 2 centavos entre 3 iguales: efectivo y tarjeta.
caso('2¢ entre 3 iguales', 2, [
  { metodo: 'efectivo', monto: 500 },
  { metodo: 'tarjeta', monto: 500 },
  { metodo: 'transferencia', monto: 500 },
], { efectivo: 1, tarjeta: 1, transferencia: 0 });
// Ejemplo del contrato: 20000 efectivo + 17050 tarjeta, propina 5000.
// cuotas: 5000*20000/37050 = 2699.06…, 5000*17050/37050 = 2300.94… → 2699 + 2301.
caso('ejemplo contrato', 5000, [
  { metodo: 'efectivo', monto: 20000 },
  { metodo: 'tarjeta', monto: 17050 },
], { efectivo: 2699, tarjeta: 2301, transferencia: 0 });
// Varios pagos con la misma forma se suman: efectivo 300+300 vs tarjeta 400 → 60% / 40%.
caso('misma forma repetida', 1000, [
  { metodo: 'efectivo', monto: 300 },
  { metodo: 'tarjeta', monto: 400 },
  { metodo: 'efectivo', monto: 300 },
], { efectivo: 600, tarjeta: 400, transferencia: 0 });
// Exacta, sin residuos.
caso('mitad y mitad', 1000, [
  { metodo: 'efectivo', monto: 5000 },
  { metodo: 'transferencia', monto: 5000 },
], { efectivo: 500, tarjeta: 0, transferencia: 500 });
// Montos enormes (BigInt): no pierde precisión.
caso('montos grandes', 99_999_999, [
  { metodo: 'efectivo', monto: 100_000_000 },
  { metodo: 'tarjeta', monto: 100_000_000 },
  { metodo: 'transferencia', monto: 100_000_000 },
], { efectivo: 33_333_333, tarjeta: 33_333_333, transferencia: 33_333_333 });
caso('montos grandes +1', 100_000_000, [
  { metodo: 'efectivo', monto: 100_000_000 },
  { metodo: 'tarjeta', monto: 100_000_000 },
  { metodo: 'transferencia', monto: 100_000_001 },
], { efectivo: 33_333_333, tarjeta: 33_333_333, transferencia: 33_333_334 });

// Prueba aleatoria: la suma siempre es exacta y ninguna parte se aleja más de 1¢ de su cuota.
const metodos = ['efectivo', 'tarjeta', 'transferencia'];
for (let k = 0; k < 20000; k++) {
  const pagos = Array.from({ length: 1 + Math.floor(Math.random() * 4) }, () => ({
    metodo: metodos[Math.floor(Math.random() * 3)],
    monto: 1 + Math.floor(Math.random() * 100000),
  }));
  const propina = Math.floor(Math.random() * 20000);
  const r = repartirPropina(propina, pagos);
  assert.equal(r.efectivo + r.tarjeta + r.transferencia, propina);
  const total = pagos.reduce((s, p) => s + p.monto, 0);
  for (const m of metodos) {
    const montoM = pagos.filter((p) => p.metodo === m).reduce((s, p) => s + p.monto, 0);
    const cuota = (propina * montoM) / total;
    assert.ok(Math.abs(r[m] - cuota) < 1 + 1e-9, `cuota ${m}`);
    if (montoM === 0) assert.equal(r[m], 0);
  }
}
n++;

console.log(`repartirPropina: ${n} pruebas OK`);
