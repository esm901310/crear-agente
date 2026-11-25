// Genera muestras "escaneadas" (solo imagen, sin texto seleccionable):
// - samples/muestra-escaneada.pdf: constancia en JPEG, papel con grano y sombra.
// - samples/muestra-3-paginas.pdf: la misma, 3 veces.
// - samples/muestra-ccitt.pdf: oficio en blanco y negro, compresión CCITT G4
//   (como los escáneres de oficina / fax). Requiere ImageMagick (`convert`).
// Uso: node scripts/make-sample.mjs
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

const LINEAS = [
  { t: 'CONSTANCIA DE TRABAJO', b: true, s: 46, c: true, gap: 110 },
  { t: 'Por medio de la presente se hace constar que el señor' },
  { t: 'Juan Pérez García labora en nuestra empresa desde el' },
  { t: '15 de marzo de 2019, desempeñando el cargo de' },
  { t: 'Asistente Administrativo con un sueldo mensual de' },
  { t: '$12,500.00 pesos.', gap: 90 },
  { t: 'Se extiende la presente a petición del interesado para' },
  { t: 'los fines que a él convengan.', gap: 90 },
  { t: 'Ciudad de México, 3 de octubre de 2024.', gap: 140 },
  { t: 'Atentamente,', gap: 160 },
  { t: 'Lic. María López Hernández', b: true },
  { t: 'Directora de Recursos Humanos' },
];

const navegador = await chromium.launch();
const pagina = await navegador.newPage();
const jpeg = await pagina.evaluate((lineas) => {
  const W = 1700, H = 2200; // carta a 200 ppp
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f3efe6';
  ctx.fillRect(0, 0, W, H);
  // Leve inclinación, como un escaneo real.
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate((0.25 * Math.PI) / 180);
  ctx.translate(-W / 2, -H / 2);
  ctx.fillStyle = '#262626';
  let y = 260;
  for (const l of lineas) {
    const s = l.s ?? 38;
    ctx.font = `${l.b ? 'bold ' : ''}${s}px "Liberation Sans", Arial, sans-serif`;
    const x = l.c ? (W - ctx.measureText(l.t).width) / 2 : 200;
    ctx.fillText(l.t, x, y);
    y += l.gap ?? 62;
  }
  ctx.restore();
  // Desenfoque y grano del papel.
  const c2 = document.createElement('canvas');
  c2.width = W; c2.height = H;
  const k = c2.getContext('2d');
  k.filter = 'blur(0.7px)';
  k.drawImage(c, 0, 0);
  const img = k.getImageData(0, 0, W, H);
  let s = 12345;
  const azar = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (azar() + azar() + azar() - 1.5) * 10;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  // Sombra suave en el borde izquierdo (fondo no uniforme).
  k.putImageData(img, 0, 0);
  const g = k.createLinearGradient(0, 0, 260, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.10)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  k.fillStyle = g;
  k.fillRect(0, 0, 260, H);
  return c2.toDataURL('image/jpeg', 0.85);
}, LINEAS);

// Oficio en blanco y negro (letra con remates) para la muestra CCITT.
const LINEAS_CCITT = [
  { t: 'OFICIO No. 245/2024', b: true, gap: 100 },
  { t: 'Estimado proveedor:' },
  { t: 'Le informamos que su factura número 1834 fue' },
  { t: 'recibida el día 12 de agosto y será pagada en' },
  { t: 'un plazo de treinta días naturales.', gap: 100 },
  { t: 'Sin otro particular, reciba un cordial saludo.' },
];
const png = await pagina.evaluate((lineas) => {
  const W = 1700, H = 2200;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000';
  let y = 300;
  for (const l of lineas) {
    ctx.font = `${l.b ? 'bold ' : ''}40px "Liberation Serif", "Times New Roman", serif`;
    ctx.fillText(l.t, 200, y);
    y += l.gap ?? 66;
  }
  return c.toDataURL('image/png');
}, LINEAS_CCITT);
await navegador.close();

const pdf = await PDFDocument.create();
const imagen = await pdf.embedJpg(Buffer.from(jpeg.split(',')[1], 'base64'));
const hoja = pdf.addPage([612, 792]);
hoja.drawImage(imagen, { x: 0, y: 0, width: 612, height: 792 });
mkdirSync(join(raiz, 'samples'), { recursive: true });
const salida = join(raiz, 'samples', 'muestra-escaneada.pdf');
writeFileSync(salida, await pdf.save());
console.log('Muestra creada:', salida);

// Versión de 3 páginas (para probar que la página 1 aparece antes de terminar).
const pdf3 = await PDFDocument.create();
const imagen3 = await pdf3.embedJpg(Buffer.from(jpeg.split(',')[1], 'base64'));
for (let i = 0; i < 3; i++) {
  pdf3.addPage([612, 792]).drawImage(imagen3, { x: 0, y: 0, width: 612, height: 792 });
}
const salida3 = join(raiz, 'samples', 'muestra-3-paginas.pdf');
writeFileSync(salida3, await pdf3.save());
console.log('Muestra creada:', salida3);

// Muestra CCITT Group 4 (1 bit) con ImageMagick, a 200 ppp = tamaño carta.
const temporal = mkdtempSync(join(tmpdir(), 'retoca-'));
try {
  const pngRuta = join(temporal, 'oficio.png');
  writeFileSync(pngRuta, Buffer.from(png.split(',')[1], 'base64'));
  const salidaCcitt = join(raiz, 'samples', 'muestra-ccitt.pdf');
  execFileSync('convert', [pngRuta, '-monochrome', '-density', '200', '-units', 'PixelsPerInch', '-compress', 'Group4', salidaCcitt]);
  console.log('Muestra creada:', salidaCcitt);
} catch (e) {
  console.warn('No se pudo crear la muestra CCITT (¿falta ImageMagick?):', e.message);
} finally {
  rmSync(temporal, { recursive: true, force: true });
}
