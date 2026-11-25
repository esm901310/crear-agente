// Genera muestras "escaneadas" (solo imagen, sin texto seleccionable):
// - samples/muestra-escaneada.pdf: constancia en JPEG, papel con grano y sombra.
// - samples/muestra-3-paginas.pdf: la misma, 3 veces.
// - samples/muestra-ccitt.pdf: oficio en blanco y negro, compresión CCITT G4
//   (como los escáneres de oficina / fax). Requiere ImageMagick (`convert`).
// - samples/muestra-serif.pdf (Tinos), muestra-mono.pdf (Cousine) y
//   muestra-sans.pdf (Carlito): para probar la detección automática de letra.
// Las fechas del PDF son fijas: correr el script dos veces da los mismos archivos.
// Uso: node scripts/make-sample.mjs
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
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

// Muestras con letras distintas (para la detección automática).
const fuenteB64 = (paquete, peso) =>
  readFileSync(join(raiz, 'node_modules', '@fontsource', paquete, 'files', `${paquete}-latin-${peso}-normal.woff2`)).toString('base64');

const MUESTRAS_LETRA = [
  {
    archivo: 'muestra-serif.pdf',
    paquete: 'tinos',
    tamano: 40,
    rotacion: -0.3,
    lineas: [
      { t: 'CONTRATO DE ARRENDAMIENTO', b: true, gap: 100 },
      { t: 'En la ciudad de Guadalajara, el arrendador' },
      { t: 'Roberto Sánchez Medina entrega en renta el' },
      { t: 'inmueble ubicado en la calle Hidalgo número' },
      { t: 'trescientos doce, por un plazo de doce meses,' },
      { t: 'con una renta mensual de ocho mil pesos.', gap: 100 },
      { t: 'Ambas partes firman de común acuerdo.' },
    ],
  },
  {
    archivo: 'muestra-mono.pdf',
    paquete: 'cousine',
    tamano: 36,
    rotacion: 0.35,
    lineas: [
      { t: 'MEMORANDUM INTERNO', b: true, gap: 100 },
      { t: 'Para: Departamento de Compras' },
      { t: 'De: Laura Mendoza, Gerencia General' },
      { t: 'Asunto: pedido de papeleria', gap: 100 },
      { t: 'Favor de autorizar la compra de cuarenta' },
      { t: 'cajas de hojas blancas para el archivo.' },
    ],
  },
  {
    archivo: 'muestra-sans.pdf',
    paquete: 'carlito',
    tamano: 42,
    rotacion: 0.25,
    lineas: [
      { t: 'RECIBO DE PAGO', b: true, gap: 100 },
      { t: 'Recibimos de Ana Torres Villalobos la cantidad' },
      { t: 'de quince mil pesos por concepto de colegiatura' },
      { t: 'del semestre de otoño, correspondiente al grupo' },
      { t: 'tercero de la carrera de enfermería.', gap: 100 },
      { t: 'Monterrey, Nuevo León, a 5 de junio de 2024.' },
    ],
  },
];

const escaneosLetra = [];
// Letra FUERA del catálogo (DejaVu Serif del sistema), borrosa como un escaneo
// malo: para probar que se elige una letra con remates y que el grosor coincide.
// Solo se genera si la letra está instalada (no todas las máquinas la tienen).
const DEJAVU_SERIF = ['/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'];
if (DEJAVU_SERIF.every((r) => existsSync(r))) {
  MUESTRAS_LETRA.push({
    archivo: 'muestra-fuera-catalogo.pdf',
    rutas: DEJAVU_SERIF,
    tamano: 40,
    rotacion: 0.4,
    desenfoque: 0.9,
    lineas: [
      { t: 'CONSTANCIA', b: true, gap: 100 },
      { t: 'Por medio de la presente se hace constar que el señor' },
      { t: 'Juan Pérez García labora en nuestra empresa desde el' },
      { t: '15 de marzo de 2019, desempeñando el cargo de' },
      { t: 'auxiliar contable con un sueldo mensual de nueve' },
      { t: 'mil pesos, a petición del interesado.' },
    ],
  });
} else {
  console.warn('DejaVu Serif no está instalada: se omite muestra-fuera-catalogo.pdf');
}

for (const m of MUESTRAS_LETRA) {
  const jpg = await pagina.evaluate(
    async ({ m, regular, negrita }) => {
      const carga = async (b64, peso) => {
        const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const f = new FontFace('Muestra', bin.buffer, { weight: String(peso) });
        await f.load();
        document.fonts.add(f);
      };
      await carga(regular, 400);
      await carga(negrita, 700);
      const W = 1700, H = 2200;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f4f2ec';
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate((m.rotacion * Math.PI) / 180);
      ctx.translate(-W / 2, -H / 2);
      ctx.fillStyle = '#222';
      let y = 280;
      for (const l of m.lineas) {
        ctx.font = `${l.b ? 700 : 400} ${m.tamano}px Muestra`;
        ctx.fillText(l.t, 190, y);
        y += l.gap ?? Math.round(m.tamano * 1.6);
      }
      ctx.restore();
      const c2 = document.createElement('canvas');
      c2.width = W; c2.height = H;
      const k = c2.getContext('2d');
      k.filter = `blur(${m.desenfoque ?? 0.6}px)`;
      k.drawImage(c, 0, 0);
      const img = k.getImageData(0, 0, W, H);
      let s = 777;
      const azar = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (azar() + azar() + azar() - 1.5) * 12;
        img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
      }
      k.putImageData(img, 0, 0);
      return c2.toDataURL('image/jpeg', 0.85);
    },
    m.rutas
      ? { m, regular: readFileSync(m.rutas[0]).toString('base64'), negrita: readFileSync(m.rutas[1]).toString('base64') }
      : { m, regular: fuenteB64(m.paquete, 400), negrita: fuenteB64(m.paquete, 700) },
  );
  escaneosLetra.push({ archivo: m.archivo, jpg });
}
await navegador.close();

/** Fechas fijas para que los PDF no cambien en cada corrida. */
function fechasFijas(doc) {
  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));
  doc.setProducer('Retoca (muestra)');
  doc.setCreator('Retoca (muestra)');
}

async function pdfDeJpeg(jpg, archivo, paginas = 1) {
  const doc = await PDFDocument.create();
  fechasFijas(doc);
  const img = await doc.embedJpg(Buffer.from(jpg.split(',')[1], 'base64'));
  for (let i = 0; i < paginas; i++) doc.addPage([612, 792]).drawImage(img, { x: 0, y: 0, width: 612, height: 792 });
  const ruta = join(raiz, 'samples', archivo);
  writeFileSync(ruta, await doc.save());
  console.log('Muestra creada:', ruta);
}

mkdirSync(join(raiz, 'samples'), { recursive: true });
for (const e of escaneosLetra) await pdfDeJpeg(e.jpg, e.archivo);

const pdf = await PDFDocument.create();
fechasFijas(pdf);
const imagen = await pdf.embedJpg(Buffer.from(jpeg.split(',')[1], 'base64'));
const hoja = pdf.addPage([612, 792]);
hoja.drawImage(imagen, { x: 0, y: 0, width: 612, height: 792 });
mkdirSync(join(raiz, 'samples'), { recursive: true });
const salida = join(raiz, 'samples', 'muestra-escaneada.pdf');
writeFileSync(salida, await pdf.save());
console.log('Muestra creada:', salida);

// Versión de 3 páginas (para probar que la página 1 aparece antes de terminar).
const pdf3 = await PDFDocument.create();
fechasFijas(pdf3);
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
  const tmpPdf = join(temporal, 'oficio.pdf');
  execFileSync('convert', [pngRuta, '-monochrome', '-density', '200', '-units', 'PixelsPerInch', '-compress', 'Group4', tmpPdf]);
  // ImageMagick pone la fecha actual: la reemplazamos por una fija.
  const ccitt = await PDFDocument.load(readFileSync(tmpPdf), { updateMetadata: false });
  fechasFijas(ccitt);
  writeFileSync(salidaCcitt, await ccitt.save());
  console.log('Muestra creada:', salidaCcitt);
} catch (e) {
  console.warn('No se pudo crear la muestra CCITT (¿falta ImageMagick?):', e.message);
} finally {
  rmSync(temporal, { recursive: true, force: true });
}
