// Prueba de punta a punta (celular 390x844): carga la muestra escaneada,
// detecta palabras, cambia "Juan" por "Pedro" (más largo: las palabras
// siguientes se corren) y "García" por "Gil" (más corto: se cierra el hueco),
// descarga el PDF y vuelve a leerlo para comprobar los cambios. Luego repite
// con una muestra CCITT G4 (blanco y negro de escáner de oficina).
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
const muestraCcitt = join(raiz, 'samples', 'muestra-ccitt.pdf');
const PALABRA = 'Juan';
const NUEVA = 'Pedro';

if (!existsSync(join(raiz, 'dist', 'index.html'))) throw new Error('Falta dist/: corre "npm run build" primero.');
if (!existsSync(muestra) || !existsSync(muestraCcitt)) throw new Error('Falta la muestra: corre "node scripts/make-sample.mjs".');
mkdirSync(capturas, { recursive: true });

const servidor = await preview({ root: raiz, preview: { port: 4321, strictPort: false }, logLevel: 'warn' });
const url = servidor.resolvedUrls.local[0];
const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
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
      const y = Math.max(0, (r.top - h.top) * k - 55);
      const c = document.createElement('canvas');
      c.width = 1150;
      c.height = 150;
      c.getContext('2d').drawImage(lienzo, x, y, 1150, 150, 0, 0, 1150, 150);
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

  // Las palabras siguientes se corrieron: "García" se puede tocar en su nueva posición.
  await pagina.getByRole('button', { name: 'Entendido' }).click().catch(() => undefined);
  const garcia = await pagina.locator('button.marca[aria-label="García"]').first().boundingBox();
  if (!garcia) throw new Error('No se encontró "García"');
  await pagina.touchscreen.tap(garcia.x + garcia.width / 2, garcia.y + garcia.height / 2);
  await pagina.locator('.panel-edicion').waitFor({ timeout: 5000 });
  const leidaG = await pagina.locator('.texto-leido-valor').textContent();
  if (leidaG !== 'García') throw new Error(`Se esperaba "García" tras el corrimiento y se abrió "${leidaG}"`);
  await pagina.fill('#texto-nuevo', 'Gil');
  await pagina.getByRole('button', { name: 'Guardar cambio' }).click();
  await pagina.getByText('Listo, palabra cambiada').waitFor();
  paso('Palabra corrida ("García") se puede tocar y editar; "Gil" (más corto) cierra el hueco');

  const despues = await recortar(`${NUEVA}`);
  if (antes && despues) {
    const comparacion = await pagina.evaluate(
      async ([a, b]) => {
        const carga = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
        const [ia, ib] = await Promise.all([carga(a), carga(b)]);
        const c = document.createElement('canvas');
        c.width = 1150;
        c.height = 330;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 1150, 330);
        ctx.drawImage(ia, 0, 22);
        ctx.drawImage(ib, 0, 180);
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 1150, 20);
        ctx.fillRect(0, 172, 1150, 8);
        ctx.fillStyle = '#c62828';
        ctx.fillText('ANTES', 8, 16);
        ctx.fillStyle = '#1e8a4c';
        ctx.fillRect(1060, 182, 90, 22);
        ctx.fillStyle = '#fff';
        ctx.fillText('DESPUÉS', 1066, 199);
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
  const ok = releidos.join(' ').includes('Pedro Pérez Gil labora en nuestra empresa desde el') && releidos.join(' ').includes('20 de abril de 2019');
  paso(`Relectura del PDF descargado: ${ok ? 'se lee "Pedro Pérez Gil labora…" y "20 de abril de 2019"' : 'NO coincide'}`);
  console.log('  Lectura:', releidos.join(' '));
  if (!ok) throw new Error('La relectura no encontró el texto nuevo');

  // Muestra CCITT G4: debe verse (no en blanco), leerse y editarse.
  await pagina.getByRole('button', { name: 'Atrás' }).click();
  await pagina.getByRole('button', { name: 'Elegir PDF' }).waitFor();
  await pagina.setInputFiles('[data-testid=entrada-archivo]', muestraCcitt);
  await pagina.locator('button.marca').first().waitFor({ timeout: 180000 });
  const leidosCcitt = await pagina.locator('button.marca').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  console.log('  Lectura CCITT:', leidosCcitt.join(' '));
  if (!leidosCcitt.includes('1834')) throw new Error('La muestra CCITT no se leyó (¿sale en blanco?)');
  const tinta = await pagina.evaluate(() => {
    const c = document.querySelector('canvas.visor-lienzo');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let negros = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 128) negros++;
    return negros / (d.length / 4);
  });
  paso(`CCITT G4 se ve y se lee (${(tinta * 100).toFixed(2)} % de píxeles con tinta)`);
  const antesCcitt = await recortar('1834');
  const n1834 = await pagina.locator('button.marca[aria-label="1834"]').first().boundingBox();
  await pagina.touchscreen.tap(n1834.x + n1834.width / 2, n1834.y + n1834.height / 2);
  await pagina.locator('.panel-edicion').waitFor();
  await pagina.fill('#texto-nuevo', '27561');
  await pagina.getByRole('button', { name: 'Guardar cambio' }).click();
  await pagina.getByText('Listo, palabra cambiada').waitFor();
  await pagina.waitForTimeout(3200);
  await foto('10-ccitt-editado.png');
  const despuesCcitt = await recortar('27561');
  for (const [nombreRecorte, datos] of [['11-ccitt-antes.png', antesCcitt], ['11-ccitt-despues.png', despuesCcitt]]) {
    if (datos) writeFileSync(join(capturas, nombreRecorte), Buffer.from(datos.split(',')[1], 'base64'));
  }
  const [descargaCcitt] = await Promise.all([
    pagina.waitForEvent('download', { timeout: 60000 }),
    pagina.getByRole('button', { name: 'Descargar PDF' }).click(),
  ]);
  const destinoCcitt = join(raiz, 'samples', `descargado-${descargaCcitt.suggestedFilename()}`);
  await descargaCcitt.saveAs(destinoCcitt);
  paso(`CCITT editado y descargado: ${descargaCcitt.suggestedFilename()}`);

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
