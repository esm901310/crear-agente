/**
 * Prueba en vivo:  npx tsx probar.ts "arroz" ["aceite" ...] [--tiendas lacolonia,colonial] [--n 5]
 * Hace UNA petición por tienda y por palabra, con una pausa de 1.5 s entre palabras.
 */
import { buscarEnTodas, type TiendaId } from './src/index';

const args = process.argv.slice(2);
const palabras: string[] = [];
let tiendas: TiendaId[] | undefined;
let n = 5;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--tiendas') tiendas = args[++i].split(',') as TiendaId[];
  else if (args[i] === '--n') n = Number(args[++i]);
  else palabras.push(args[i]);
}
if (palabras.length === 0) palabras.push('arroz');

const lempiras = (x: number) => `L ${x.toFixed(2)}`;

for (const [i, palabra] of palabras.entries()) {
  if (i > 0) await new Promise((r) => setTimeout(r, 1500));
  console.log(`\n=== "${palabra}" ===`);
  const resultados = await buscarEnTodas(palabra, { tiendas });
  for (const r of resultados) {
    if (!r.ok) {
      console.log(`\n${r.nombreTienda}: ERROR (${r.error?.tipo}) ${r.error?.mensaje}`);
      continue;
    }
    console.log(`\n${r.nombreTienda}: ${r.productos.length} productos (${r.ms} ms)`);
    for (const p of r.productos.slice(0, n)) {
      const oferta = p.precioOferta !== undefined ? ` -> oferta ${lempiras(p.precioOferta)}` : '';
      const extra = [p.marca, p.presentacion, p.codigoBarras && `EAN ${p.codigoBarras}`].filter(Boolean).join(' | ');
      console.log(`  - ${p.nombre}: ${lempiras(p.precio)}${oferta}${extra ? `  [${extra}]` : ''}`);
    }
  }
}
