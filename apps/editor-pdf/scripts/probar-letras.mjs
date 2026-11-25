// Herramienta de diagnóstico: corre la detección de letra sobre todos los PDF
// de una carpeta, imprime el ranking y (opcional) guarda un antes/después
// cambiando "Juan" por "Pedro".
// Uso: npm run build && node scripts/probar-letras.mjs <carpeta> [carpetaSalida] [palabra] [nueva]
import { createRequire } from 'node:module';
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const carpeta = resolve(process.argv[2] ?? join(raiz, 'samples'));
const salida = process.argv[3] ? resolve(process.argv[3]) : null;
const PALABRA = process.argv[4] ?? 'Juan';
const NUEVA = process.argv[5] ?? 'Pedro';
if (salida) mkdirSync(salida, { recursive: true });

const srv = await preview({ root: raiz, preview: { port: 4350 }, logLevel: 'warn' });
const url = `${srv.resolvedUrls.local[0]}?prueba=1`;
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('  error:', String(e)));

const recorte = (caja) =>
  p.evaluate((caja) => {
    const l = document.querySelector('canvas.visor-lienzo');
    const c = document.createElement('canvas');
    c.width = 1300; c.height = 150;
    const k = c.getContext('2d');
    k.fillStyle = '#fff'; k.fillRect(0, 0, 1300, 150);
    k.drawImage(l, caja.x, caja.y, 1300, 150, 0, 0, 1300, 150);
    return c.toDataURL('image/png');
  }, caja);

for (const f of readdirSync(carpeta).filter((n) => n.endsWith('.pdf')).sort()) {
  await p.goto(url);
  await p.setInputFiles('[data-testid=entrada-archivo]', join(carpeta, f));
  await p.locator('button.marca').first().waitFor({ timeout: 120000 });
  const marca = p.locator(`button.marca[aria-label="${PALABRA}"]`).first();
  if (!(await marca.count())) {
    console.log(`${f}: no se encontró "${PALABRA}"`);
    continue;
  }
  const caja = await p.evaluate((pal) => {
    const l = document.querySelector('canvas.visor-lienzo');
    const m = [...document.querySelectorAll('.marca')].find((x) => x.getAttribute('aria-label') === pal);
    const h = document.querySelector('.visor-hoja').getBoundingClientRect();
    const r = m.getBoundingClientRect();
    const k = l.width / h.width;
    return { x: Math.max(0, Math.round((r.left - h.left) * k - 200)), y: Math.max(0, Math.round((r.top - h.top) * k - 55)) };
  }, PALABRA);
  const antes = salida ? await recorte(caja) : null;
  const b = await marca.boundingBox();
  await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await p.locator('.panel-edicion').waitFor({ timeout: 20000 });
  const d = await p.evaluate(() => {
    const d = window.__retocaDeteccion;
    return d && {
      ms: d.ms,
      conf: d.confianza,
      grupo: d.grupo,
      bloque: `${window.__retocaBloques?.maxMs?.toFixed(1)} (${window.__retocaBloques?.donde})`,
      sigma: window.__retocaAnalisis?.desenfoque?.toFixed(2),
      trazo: window.__retocaAnalisis?.trazo,
      ranking: d.ranking.slice(0, 5).map((r) => ({ ...r })),
    };
  });
  if (d) {
    const det = !!process.env.DETALLE;
    d.top = d.ranking.map(
      (r) =>
        `${r.letra}${r.negrita ? '-b' : ''}${r.cursiva ? '-i' : ''}=${r.puntaje.toFixed(3)}` +
        (det ? `(f${r.forma.toFixed(3)} a${r.difAncho.toFixed(3)} t${r.difTrazo.toFixed(3)})` : ''),
    );
  }
  console.log(`${f}: ${d ? `${d.top[0]}  [${d.conf}${d.grupo ? `, grupo ${d.grupo}` : ''}, ${d.ms} ms, bloque máx ${d.bloque} ms, σ ${d.sigma}, trazo ${d.trazo}]  ${d.top.slice(1).join(' ')}` : 'sin detección'}`);
  if (salida) {
    await p.fill('#texto-nuevo', NUEVA);
    await p.getByRole('button', { name: 'Guardar cambio' }).click();
    await p.getByText('Listo, palabra cambiada').waitFor();
    const despues = await recorte(caja);
    const comp = await p.evaluate(async ([a, z]) => {
      const carga = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = s; });
      const [ia, iz] = await Promise.all([carga(a), carga(z)]);
      const c = document.createElement('canvas');
      c.width = 1300; c.height = 304;
      const k = c.getContext('2d');
      k.fillStyle = '#c62828'; k.fillRect(0, 0, 1300, 304);
      k.drawImage(ia, 0, 0); k.drawImage(iz, 0, 154);
      return c.toDataURL('image/png');
    }, [antes, despues]);
    writeFileSync(join(salida, `${basename(f, '.pdf')}-comparar.png`), Buffer.from(comp.split(',')[1], 'base64'));
  }
}
await nav.close();
srv.httpServer.close();
