// Empaqueta la app ya construida (../app/dist) dentro del Worker como un módulo
// TypeScript generado (src/estaticos.generado.ts). Así el Worker sirve las
// pantallas sin usar la subida de "Static Assets" de Cloudflare.
// Si ../app/dist no existe, genera un mapa vacío (para pruebas y typecheck).
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const dist = join(aqui, '..', '..', 'app', 'dist');
const salida = join(aqui, '..', 'src', 'estaticos.generado.ts');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function recorrer(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? recorrer(p) : [p];
  });
}

const archivos = existsSync(dist) ? recorrer(dist) : [];
const entradas = archivos
  .filter((p) => !p.endsWith('.map'))
  .map((p) => {
    const ruta = '/' + relative(dist, p).split('\\').join('/');
    const tipo = TIPOS[extname(p).toLowerCase()] ?? 'application/octet-stream';
    const cuerpo = readFileSync(p).toString('base64');
    return `  ${JSON.stringify(ruta)}: { tipo: ${JSON.stringify(tipo)}, cuerpo: ${JSON.stringify(cuerpo)} },`;
  });

writeFileSync(
  salida,
  `// ARCHIVO GENERADO por scripts/empaquetar-app.mjs. No editar a mano.\n` +
    `export const ESTATICOS: Record<string, { tipo: string; cuerpo: string }> = {\n${entradas.join('\n')}\n};\n`,
);
console.log(`Empaquetados ${entradas.length} archivos de la app en src/estaticos.generado.ts`);
