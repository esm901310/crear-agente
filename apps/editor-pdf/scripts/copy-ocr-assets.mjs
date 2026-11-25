// Copia los archivos de lectura de texto (tesseract) a public/ para que la app
// funcione sin depender de internet (sin CDN).
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
