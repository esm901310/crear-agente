// Copia a public/ los archivos que la app necesita para funcionar sin internet:
// - tesseract (lectura de texto): public/tesseract/
// - pdf.js (decodificadores wasm para imágenes CCITT/JBIG2/JPEG2000, cmaps,
//   fuentes estándar y perfiles de color): public/pdfjs/
import { cpSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const out = join(root, 'public', 'tesseract');

if (!existsSync(join(nm, 'tesseract.js'))) {
  console.log('[copy-ocr] tesseract.js no instalado aún; se omite.');
  process.exit(0);
}

mkdirSync(join(out, 'core'), { recursive: true });
mkdirSync(join(out, 'lang'), { recursive: true });

cpSync(join(nm, 'tesseract.js', 'dist', 'worker.min.js'), join(out, 'worker.min.js'));

const coreDir = join(nm, 'tesseract.js-core');
for (const f of readdirSync(coreDir)) {
  // Solo los núcleos LSTM (OEM 1): con y sin SIMD.
  if (/^tesseract-core(-simd)?-lstm\.wasm\.js$/.test(f)) cpSync(join(coreDir, f), join(out, 'core', f));
}

cpSync(
  join(nm, '@tesseract.js-data', 'spa', '4.0.0_best_int', 'spa.traineddata.gz'),
  join(out, 'lang', 'spa.traineddata.gz'),
);
console.log('[copy-ocr] Archivos de lectura copiados a public/tesseract');

const pdfjs = join(nm, 'pdfjs-dist');
const outPdf = join(root, 'public', 'pdfjs');
for (const dir of ['wasm', 'cmaps', 'standard_fonts', 'iccs']) {
  if (existsSync(join(pdfjs, dir))) cpSync(join(pdfjs, dir), join(outPdf, dir), { recursive: true });
}
console.log('[copy-ocr] Archivos de pdf.js copiados a public/pdfjs');

// Letras del catálogo (woff2, solo latin y latin-ext, 400/700, normal/cursiva).
const LETRAS = ['arimo', 'tinos', 'cousine', 'carlito', 'caladea', 'dejavu-sans', 'roboto', 'open-sans', 'merriweather', 'eb-garamond', 'roboto-condensed', 'questrial', 'noto-serif', 'charis-sil'];
const outFuentes = join(root, 'public', 'fuentes');
mkdirSync(outFuentes, { recursive: true });
let copiadas = 0;
for (const paquete of LETRAS) {
  const dir = join(nm, '@fontsource', paquete, 'files');
  if (!existsSync(dir)) {
    console.warn(`[copy-ocr] Falta @fontsource/${paquete}`);
    continue;
  }
  for (const f of readdirSync(dir)) {
    if (new RegExp(`^${paquete}-(latin|latin-ext)-(400|700)-(normal|italic)\\.woff2$`).test(f)) {
      cpSync(join(dir, f), join(outFuentes, f));
      copiadas++;
    }
  }
}
console.log(`[copy-ocr] ${copiadas} archivos de letras copiados a public/fuentes`);
