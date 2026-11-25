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
  if (/^tesseract-core.*\.wasm\.js$/.test(f)) cpSync(join(coreDir, f), join(out, 'core', f));
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
