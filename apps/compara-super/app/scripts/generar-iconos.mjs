// Genera los PNG de la app a partir de los SVG propios (sin logos de supermercados).
// Uso: npm run iconos   (requiere Playwright instalado en el equipo)
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

const salidas = [
  { svg: 'public/favicon.svg', archivo: 'public/icono-192.png', lado: 192 },
  { svg: 'public/favicon.svg', archivo: 'public/icono-512.png', lado: 512 },
  { svg: 'scripts/icono-maskable.svg', archivo: 'public/icono-maskable-512.png', lado: 512 },
  { svg: 'scripts/icono-maskable.svg', archivo: 'public/apple-touch-icon.png', lado: 180 },
];

const navegador = await chromium.launch();
for (const s of salidas) {
  const svg = await readFile(join(raiz, s.svg), 'utf8');
  const pagina = await navegador.newPage({ viewport: { width: s.lado, height: s.lado } });
  await pagina.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${s.lado}" height="${s.lado}" `)}</body></html>`,
  );
  await pagina.screenshot({ path: join(raiz, s.archivo), omitBackground: true });
  await pagina.close();
  console.log('Listo', s.archivo);
}
await navegador.close();
