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
// ?prueba=1 activa los datos de diagnóstico (solo para pruebas).
const base = servidor.resolvedUrls.local[0];
const url = `${base}?prueba=1`;
const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  acceptDownloads: true,
  locale: 'es-MX',
  // Sin animaciones: capturas iguales en cada corrida.
  reducedMotion: 'reduce',
});
const pagina = await contexto.newPage();
const errores = [];
pagina.on('pageerror', (e) => errores.push(String(e)));
pagina.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
const peticionesExternas = [];
pagina.on('request', (r) => {
  if (!r.url().startsWith(base) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) peticionesExternas.push(r.url());
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

  // Recortes a resolución real, siempre con la MISMA caja antes y después.
  const cajaRecorte = (palabra) =>
    pagina.evaluate((palabra) => {
      const lienzo = document.querySelector('canvas.visor-lienzo');
      const marca = [...document.querySelectorAll('.marca')].find((m) => m.getAttribute('aria-label')?.startsWith(palabra));
      const hoja = document.querySelector('.visor-hoja');
      if (!lienzo || !marca || !hoja) return null;
      const r = marca.getBoundingClientRect();
      const h = hoja.getBoundingClientRect();
      const k = lienzo.width / h.width;
      return { x: Math.max(0, Math.round((r.left - h.left) * k - 200)), y: Math.max(0, Math.round((r.top - h.top) * k - 55)) };
    }, palabra);
  const recortarEn = (caja) =>
    caja &&
    pagina.evaluate((caja) => {
      const lienzo = document.querySelector('canvas.visor-lienzo');
      const c = document.createElement('canvas');
      c.width = 1300;
      c.height = 150;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 1300, 150);
      ctx.drawImage(lienzo, caja.x, caja.y, 1300, 150, 0, 0, 1300, 150);
      return c.toDataURL('image/png');
    }, caja);
  const guardarAntesDespues = async (antes, despues, nombre) => {
    if (!antes || !despues) return;
    const comparacion = await pagina.evaluate(
      async ([a, b]) => {
        const carga = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
        const [ia, ib] = await Promise.all([carga(a), carga(b)]);
        const c = document.createElement('canvas');
        c.width = 1300;
        c.height = 330;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 1300, 330);
        ctx.drawImage(ia, 0, 22);
        ctx.drawImage(ib, 0, 180);
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 1300, 20);
        ctx.fillRect(0, 172, 1300, 8);
        ctx.fillStyle = '#c62828';
        ctx.fillText('ANTES', 8, 16);
        ctx.fillStyle = '#1e8a4c';
        ctx.fillRect(1210, 182, 90, 22);
        ctx.fillStyle = '#fff';
        ctx.fillText("DESPUÉS", 1216, 199);
        return c.toDataURL('image/png');
      },
      [antes, despues],
    );
    writeFileSync(join(capturas, nombre), Buffer.from(comparacion.split(',')[1], 'base64'));
  };
  const leerDeteccion = () =>
    pagina.evaluate(() => {
      const d = window.__retocaDeteccion;
      return d && {
        ms: d.ms,
        confianza: d.confianza,
        muestras: d.muestras,
        mejor: d.mejor.letra,
        grupo: d.grupo,
        cursiva: d.mejor.cursiva,
        ranking: d.ranking.slice(0, 6).map((r) => `${r.letra}${r.negrita ? ' negrita' : ''}${r.cursiva ? ' cursiva' : ''}=${r.puntaje.toFixed(3)}`),
      };
    });

  const cajaJuan = await cajaRecorte(PALABRA);
  const antes = await recortarEn(cajaJuan);

  const marca = pagina.locator(`button.marca[aria-label="${PALABRA}"]`).first();
  const caja = await marca.boundingBox();
  if (!caja) throw new Error(`No se encontró la palabra "${PALABRA}"`);
  await pagina.touchscreen.tap(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await pagina.locator('.panel-edicion').waitFor({ timeout: 5000 });
  paso('Panel de edición abierto al tocar la palabra');
  const detPrincipal = await leerDeteccion();
  console.log('  Letra detectada (Liberation Sans):', JSON.stringify(detPrincipal));
  if (detPrincipal?.mejor !== 'arimo') throw new Error('En la muestra principal (Liberation Sans) se esperaba Arimo');
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

  const despues = await recortarEn(cajaJuan);
  await guardarAntesDespues(antes, despues, '07-detalle-antes-despues.png');

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
  const cajaCcitt = await cajaRecorte('1834');
  const antesCcitt = await recortarEn(cajaCcitt);
  const n1834 = await pagina.locator('button.marca[aria-label="1834"]').first().boundingBox();
  await pagina.touchscreen.tap(n1834.x + n1834.width / 2, n1834.y + n1834.height / 2);
  await pagina.locator('.panel-edicion').waitFor();
  await pagina.fill('#texto-nuevo', '27561');
  await pagina.getByRole('button', { name: 'Guardar cambio' }).click();
  await pagina.getByText('Listo, palabra cambiada').waitFor();
  await pagina.waitForTimeout(3200);
  await foto('10-ccitt-editado.png');
  const despuesCcitt = await recortarEn(cajaCcitt);
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

  // ---- Detección automática de la letra en muestras con letras distintas ----
  const irAInicio = async () => {
    await pagina.getByRole('button', { name: 'Atrás' }).click();
    const salir = pagina.getByRole('button', { name: 'Salir igual' });
    if (await salir.isVisible().catch(() => false)) await salir.click();
    await pagina.getByRole('button', { name: 'Elegir PDF' }).waitFor();
  };
  const CASOS_LETRA = [
    { archivo: 'muestra-serif.pdf', palabra: 'Roberto', nueva: 'Guillermo', esperadas: ['tinos'], captura: '12-serif-antes-despues.png' },
    { archivo: 'muestra-mono.pdf', palabra: 'Laura', nueva: 'Mariana', esperadas: ['cousine'], captura: '13-mono-antes-despues.png' },
    { archivo: 'muestra-sans.pdf', palabra: 'Ana', nueva: 'Beatriz', esperadas: ['carlito'], captura: '14-sans-antes-despues.png' },
  ];
  // Letra fuera del catálogo (DejaVu Serif, borrosa): debe elegir una con remates y con el mismo grosor.
  if (existsSync(join(raiz, 'samples', 'muestra-fuera-catalogo.pdf'))) {
    CASOS_LETRA.push({
      archivo: 'muestra-fuera-catalogo.pdf',
      palabra: 'Juan',
      nueva: 'Pedro',
      grupo: 'serif',
      grosor: true,
      captura: '16-fuera-catalogo-antes-despues.png',
    });
  }

  /** Oscuridad media del trazo dentro de la caja de una marca (0..1 respecto al fondo). */
  const oscuridadTrazo = (prefijo) =>
    pagina.evaluate((prefijo) => {
      const lienzo = document.querySelector('canvas.visor-lienzo');
      const marca = [...document.querySelectorAll('.marca')].find((m) => m.getAttribute('aria-label')?.startsWith(prefijo));
      const h = document.querySelector('.visor-hoja').getBoundingClientRect();
      if (!marca) return null;
      const r = marca.getBoundingClientRect();
      const k = lienzo.width / h.width;
      const x = Math.round((r.left - h.left) * k);
      const y = Math.round((r.top - h.top) * k);
      const w = Math.round(r.width * k);
      const alto = Math.round(r.height * k);
      const d = lienzo.getContext('2d', { willReadFrequently: true }).getImageData(x, y, w, alto).data;
      const lum = [];
      for (let i = 0; i < d.length; i += 4) lum.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      const orden = [...lum].sort((a, b) => a - b);
      const fondo = orden[Math.floor(orden.length * 0.9)];
      // Escala fija (fondo → negro) para comparar dos palabras distintas con la misma vara.
      const tinta = lum.filter((v) => fondo - v > fondo * 0.25);
      if (!tinta.length) return 0;
      return tinta.reduce((s, v) => s + (fondo - v) / fondo, 0) / tinta.length;
    }, prefijo);
  for (const caso of CASOS_LETRA) {
    await irAInicio();
    await pagina.setInputFiles('[data-testid=entrada-archivo]', join(raiz, 'samples', caso.archivo));
    await pagina.locator('button.marca').first().waitFor({ timeout: 180000 });
    await pagina.waitForTimeout(1500); // deja que la detección en segundo plano avance
    const cajaCaso = await cajaRecorte(caso.palabra);
    const antesCaso = await recortarEn(cajaCaso);
    const oscAntes = caso.grosor ? await oscuridadTrazo(caso.palabra) : null;
    const m = await pagina.locator(`button.marca[aria-label="${caso.palabra}"]`).first().boundingBox();
    if (!m) throw new Error(`${caso.archivo}: no se encontró "${caso.palabra}"`);
    const t0 = Date.now();
    await pagina.touchscreen.tap(m.x + m.width / 2, m.y + m.height / 2);
    await pagina.locator('.panel-edicion').waitFor({ timeout: 10000 });
    const tPanel = Date.now() - t0;
    const det = await leerDeteccion();
    const letraPanel = await pagina.locator('.panel-edicion form').getAttribute('data-letra');
    console.log(`  ${caso.archivo}: detectada=${det?.mejor} (confianza ${det?.confianza}, ${det?.muestras} muestras, ${det?.ms} ms de cálculo, ${tPanel} ms del toque al panel)`);
    console.log(`    ranking: ${det?.ranking.join(' | ')}`);
    if (caso.esperadas && (!det || !caso.esperadas.includes(det.mejor))) throw new Error(`${caso.archivo}: se esperaba ${caso.esperadas.join('/')}`);
    if (caso.grupo && det?.grupo !== caso.grupo) throw new Error(`${caso.archivo}: se esperaba una letra del grupo ${caso.grupo}`);
    if (letraPanel !== det.mejor) throw new Error(`${caso.archivo}: la edición usa "${letraPanel}" y no la detectada`);
    await pagina.fill('#texto-nuevo', caso.nueva);
    if (caso.archivo === 'muestra-serif.pdf') {
      await pagina.getByRole('button', { name: /Ajustar estilo/ }).click();
      await pagina.locator('.opcion-letra').first().waitFor();
      await pagina.locator('.lista-letras').first().scrollIntoViewIfNeeded();
      await pagina.waitForTimeout(400);
      await foto('15-selector-letra.png');
      const primera = await pagina.locator('.opcion-letra').first().getAttribute('data-letra');
      const etiqueta = await pagina.locator('.opcion-letra-etiqueta').first().textContent();
      if (primera !== det.mejor || etiqueta !== 'La más parecida') throw new Error('El selector no marca la más parecida primero');
    }
    await pagina.getByRole('button', { name: 'Guardar cambio' }).click();
    await pagina.getByText('Listo, palabra cambiada').waitFor();
    await pagina.waitForTimeout(300);
    await guardarAntesDespues(antesCaso, await recortarEn(cajaCaso), caso.captura);
    paso(`${caso.archivo}: letra correcta (${det.mejor}, grupo ${det.grupo}) y la edición la usa`);
    if (caso.grosor) {
      await pagina.waitForTimeout(3200); // que se vaya el aviso breve
      const oscDespues = await oscuridadTrazo(caso.nueva);
      const dif = Math.abs(oscDespues - oscAntes) / oscAntes;
      paso(`Grosor/oscuridad del trazo: original ${oscAntes.toFixed(3)}, nuevo ${oscDespues.toFixed(3)} (diferencia ${(dif * 100).toFixed(1)} %)`);
      if (!(dif < 0.15)) throw new Error('El trazo nuevo no tiene la misma oscuridad que el original (diferencia ≥ 15 %)');
    }
  }

  const bloques = await pagina.evaluate(() => window.__retocaBloques);
  paso(`Detección repartida en bloques: el más largo duró ${bloques?.maxMs.toFixed(1)} ms (${bloques?.bloques} pausas)`);

  // Tira de miniaturas con páginas todavía leyéndose.
  await irAInicio();
  await pagina.setInputFiles('[data-testid=entrada-archivo]', join(raiz, 'samples', 'muestra-3-paginas.pdf'));
  await pagina.locator('button.marca').first().waitFor({ timeout: 180000 });
  await pagina.locator('.barra-paginas-centro').click();
  await pagina.locator('.tira-miniaturas').waitFor();
  await pagina.waitForTimeout(300);
  await foto('09-tira-miniaturas.png');
  paso('Tira de miniaturas OK');

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
