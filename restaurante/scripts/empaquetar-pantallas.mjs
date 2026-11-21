// Empaqueta los archivos de las pantallas (dist/, salida de `vite build`) dentro
// del Worker, en worker/pantallas.generated.ts. Así el Worker sirve la app sin
// depender de la subida de "static assets" de Cloudflare.
// Si dist/ no existe, genera un mapa vacío (desarrollo local: las pantallas las
// sirve Vite en el puerto 5173).
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const raiz = new URL('..', import.meta.url).pathname;
const dist = join(raiz, 'dist');
const salida = join(raiz, 'worker', 'pantallas.generated.ts');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const TEXTO = new Set(['.html', '.js', '.css', '.svg', '.json', '.txt']);

function recorrer(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? recorrer(p) : [p];
  });
}

const archivos = {};
if (existsSync(dist)) {
  for (const p of recorrer(dist)) {
    const ext = extname(p).toLowerCase();
    const ruta = '/' + relative(dist, p).split('\\').join('/');
    const tipo = TIPOS[ext] ?? 'application/octet-stream';
    const datos = readFileSync(p);
    archivos[ruta] = TEXTO.has(ext)
      ? { tipo, texto: datos.toString('utf8') }
      : { tipo, base64: datos.toString('base64') };
  }
}

const cuerpo =
  '// ARCHIVO GENERADO por scripts/empaquetar-pantallas.mjs. No editar a mano.\n' +
  'export interface ArchivoPantalla { tipo: string; texto?: string; base64?: string }\n' +
  `export const PANTALLAS: Record<string, ArchivoPantalla> = ${JSON.stringify(archivos)};\n`;
writeFileSync(salida, cuerpo);
console.log(`pantallas empaquetadas: ${Object.keys(archivos).length} archivo(s)`);
