// Prueba de punta a punta (celular 390x844): carga la muestra escaneada,
// detecta palabras, cambia "Juan" por "Pedro", descarga el PDF y vuelve a
// leerlo para comprobar que el cambio se lee.
// Uso: npm run build && node scripts/e2e.mjs
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { PDFDocument } from 'pdf-lib';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const capturas = join(raiz, 'capturas');
const muestra = join(raiz, 'samples', 'muestra-escaneada.pdf');
const PALABRA = 'Juan';
const NUEVA = 'Pedro';

if (!existsSync(join(raiz, 'dist', 'index.html'))) throw new Error('Falta dist/: corre "npm run build" primero.');
if (!existsSync(muestra)) throw new Error('Falta la muestra: corre "node scripts/make-sample.mjs".');
mkdirSync(capturas, { recursive: true });

const servidor = await preview({ root: raiz, preview: { port: 4321, strictPort: false }, logLevel: 'warn' });
const url = servidor.resolvedUrls.local[0];
const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  acceptDownloads: true,
  locale: 'es-MX',
});
const pagina = await contexto.newPage();
const errores = [];
pagina.on('pageerror', (e) => errores.push(String(e)));
pagina.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
const peticionesExternas = [];
pagina.on('request', (r) => {
  if (!r.url().startsWith(url) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) peticionesExternas.push(r.url());
});

const foto = (nombre) => pagina.screenshot({ path: join(capturas, nombre) });
const paso = (t) => console.log(`- ${t}`);
const inicio = Date.now();

try {
  await pagina.goto(url);
  await pagina.getByRole('button', { name: 'Elegir PDF' }).waitFor();
  await foto('01-inicio.png');
  paso('Pantalla de inicio OK');

  // Archivo que no es PDF -> mensaje de error del diseño.
  await pagina.setInputFiles('[data-testid=entrada-archivo]', {
    name: 'nota.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hola'),
  });
  await pagina.getByText('Ese archivo no es un PDF').waitFor();
  await foto('08-error-no-es-pdf.png');
  paso('Error "Ese archivo no es un PDF" OK');

  // Desde el error se elige otro archivo (la muestra).
  await pagina.setInputFiles('input[type=file]', muestra);
  await pagina.getByText(/Leyendo el texto…|Preparando tus páginas…/).first().waitFor({ timeout: 15000 });
  await pagina.waitForTimeout(800);
  await foto('02-leyendo.png');
  paso('Pantalla "Leyendo el texto…" OK');

  await pagina.locator('button.marca').first().waitFor({ timeout: 180000 });
  const total = await pagina.locator('button.marca').count();
  paso(`Palabras detectadas: ${total} (${((Date.now() - inicio) / 1000).toFixed(1)} s)`);
  const textos = await pagina.locator('button.marca').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  console.log('  Lectura:', textos.join(' '));
  await foto('03-palabras-marcadas.png');

  await pagina.getByRole('button', { name: 'Entendido' }).click();

  // Recorte "antes" a resolución real.
  const recortar = (palabra) =>
    pagina.evaluate((palabra) => {
      const lienzo = document.querySelector('canvas.visor-lienzo');
      const marca = [...document.querySelectorAll('.marca')].find((m) => m.getAttribute('aria-label')?.startsWith(palabra));
      const hoja = document.querySelector('.visor-hoja');
      if (!lienzo || !marca || !hoja) return null;
      const r = marca.getBoundingClientRect();
      const h = hoja.getBoundingClientRect();
      const k = lienzo.width / h.width;
      const x = Math.max(0, (r.left - h.left) * k - 30);
      const y = Math.max(0, (r.top - h.top) * k - 40);
      const c = document.createElement('canvas');
      c.width = 900;
      c.height = 150;
      c.getContext('2d').drawImage(lienzo, x, y, 900, 150, 0, 0, 900, 150);
      return c.toDataURL('image/png');
    }, palabra);

  const antes = await recortar(PALABRA);

  const marca = pagina.locator(`button.marca[aria-label="${PALABRA}"]`).first();
  const caja = await marca.boundingBox();
  if (!caja) throw new Error(`No se encontró la palabra "${PALABRA}"`);
  await pagina.touchscreen.tap(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await pagina.locator('.panel-edicion').waitFor({ timeout: 5000 });
  paso('Panel de edición abierto al tocar la palabra');
  const valor = await pagina.inputValue('#texto-nuevo');
  if (valor !== PALABRA) throw new Error(`El campo debía venir con "${PALABRA}" y vino con "${valor}"`);
  await pagina.fill('#texto-nuevo', NUEVA);
  await pagina.getByRole('button', { name: /Ajustar estilo/ }).click();
  await pagina.waitForTimeout(400);
  await foto('04-panel-edicion.png');
  await pagina.getByRole('button', { name: /Ajustar estilo/ }).click();

  await pagina.getByRole('button', { name: 'Guardar cambio' }).click();
  await pagina.getByText('Listo, palabra cambiada').waitFor();
  paso('Cambio guardado ("Listo, palabra cambiada")');
  await pagina.waitForTimeout(500);
  await foto('05-resultado-editado.png');

  const despues = await recortar(`${NUEVA}`);
  if (antes && despues) {
    const comparacion = await pagina.evaluate(
      async ([a, b]) => {
        const carga = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
        const [ia, ib] = await Promise.all([carga(a), carga(b)]);
        const c = document.createElement('canvas');
        c.width = 900;
        c.height = 330;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 900, 330);
        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = '#c62828';
        ctx.fillText('ANTES', 8, 20);
        ctx.drawImage(ia, 0, 25);
        ctx.fillStyle = '#1e8a4c';
        ctx.fillText('DESPUÉS', 8, 195);
        ctx.drawImage(ib, 0, 180 - 0);
        return c.toDataURL('image/png');
      },
      [antes, despues],
    );
    writeFileSync(join(capturas, '07-detalle-antes-despues.png'), Buffer.from(comparacion.split(',')[1], 'base64'));
  }

  // Selección de varias palabras: mantener presionado y deslizar.
  const centro = async (texto) => {
    const b = await pagina.locator(`button.marca[aria-label="${texto}"]`).first().boundingBox();
    if (!b) throw new Error(`No se encontró "${texto}"`);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const a = await centro('15');
  const b = await centro('marzo');
  await pagina.mouse.move(a.x, a.y);
  await pagina.mouse.down();
  await pagina.waitForTimeout(600);
  await pagina.mouse.move(b.x, b.y + 25, { steps: 6 }); // el dedo baja un poco: debe quedarse en la línea
  await pagina.mouse.up();
  await pagina.locator('.panel-edicion').waitFor({ timeout: 5000 });
  const leida = await pagina.locator('.texto-leido-valor').textContent();
  if (leida !== '15 de marzo') throw new Error(`Selección inesperada: "${leida}"`);
  paso(`Selección de varias palabras OK ("${leida}")`);
  await pagina.fill('#texto-nuevo', '20 de abril');
  await pagina.getByRole('button', { name: 'Guardar cambio' }).click();
  await pagina.getByText('Listo, palabra cambiada').waitFor();

  // Deshacer / rehacer.
  await pagina.getByRole('button', { name: 'Deshacer', exact: true }).first().click();
  await pagina.locator('button.marca[aria-label="15"]').waitFor();
  await pagina.getByRole('button', { name: 'Rehacer' }).click();
  await pagina.locator('button.marca[aria-label="15"]').waitFor({ state: 'detached' });
  paso('Deshacer / rehacer OK');

  // Campo vacío: pide confirmar antes de borrar; luego lo deshacemos.
  const t = await centro('Atentamente,');
  await pagina.touchscreen.tap(t.x, t.y);
  await pagina.locator('.panel-edicion').waitFor();
  await pagina.fill('#texto-nuevo', '');
  await pagina.getByRole('button', { name: 'Guardar cambio' }).click();
  await pagina.getByText('¿Borrar este texto de la página?').waitFor();
  await pagina.getByRole('button', { name: 'Sí, borrar' }).click();
  await pagina.getByText('Listo, texto borrado').waitFor();
  await pagina.getByRole('button', { name: 'Deshacer', exact: true }).first().click();
  await pagina.locator('button.marca[aria-label="Atentamente,"]').waitFor();
  paso('Borrar con confirmación + deshacer OK');
  await pagina.waitForTimeout(3200); // que se vaya el aviso breve
  await foto('05b-resultado-varios-cambios.png');

  const [descarga] = await Promise.all([
    pagina.waitForEvent('download', { timeout: 60000 }),
    pagina.getByRole('button', { name: 'Descargar PDF' }).click(),
  ]);
  const nombre = descarga.suggestedFilename();
  const destino = join(raiz, 'samples', `descargado-${nombre}`);
  await descarga.saveAs(destino);
  await pagina.getByText('¡Tu PDF está listo!').waitFor();
  await foto('06-descarga-lista.png');
  const pdf = await PDFDocument.load(readFileSync(destino));
  const { width, height } = pdf.getPage(0).getSize();
  paso(`PDF descargado: ${nombre} (${pdf.getPageCount()} página, ${width}x${height} pt)`);
  if (!nombre.endsWith('-retocado.pdf')) throw new Error('Nombre de archivo inesperado');
  if (Math.round(width) !== 612 || Math.round(height) !== 792) throw new Error('El tamaño de página cambió');

  // Volvemos a leer el PDF descargado para ver si el texto nuevo se lee.
  await pagina.getByRole('button', { name: 'Seguir editando' }).click();
  await pagina.getByRole('button', { name: 'Atrás' }).click();
  await pagina.getByRole('button', { name: 'Elegir PDF' }).waitFor();
  await pagina.setInputFiles('[data-testid=entrada-archivo]', destino);
  await pagina.locator('button.marca').first().waitFor({ timeout: 180000 });
  const releidos = await pagina.locator('button.marca').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  const ok = releidos.includes(NUEVA) && !releidos.includes(PALABRA) && releidos.join(' ').includes('20 de abril');
  paso(`Relectura del PDF descargado: ${ok ? `se lee "${NUEVA}" y ya no "${PALABRA}"` : 'NO coincide'}`);
  console.log('  Lectura:', releidos.join(' '));
  if (!ok) throw new Error('La relectura no encontró el texto nuevo');

  if (peticionesExternas.length) console.log('  Peticiones a internet:', peticionesExternas);
  else paso('Sin peticiones a internet (todo local)');
  if (errores.length) console.log('  Errores en consola:', errores);
  console.log(`\nPRUEBA OK en ${((Date.now() - inicio) / 1000).toFixed(1)} s`);
} catch (e) {
  await foto('error.png').catch(() => undefined);
  console.error('\nPRUEBA FALLÓ:', e);
  if (errores.length) console.error('Errores en consola:', errores);
  process.exitCode = 1;
} finally {
  await navegador.close();
  await new Promise((ok) => servidor.httpServer.close(ok));
}
