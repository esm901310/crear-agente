// Sirve la app Retoca desde Workers KV (archivos estáticos; nada del usuario pasa por aquí).
const TIPOS = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8', svg: 'image/svg+xml', png: 'image/png', json: 'application/json',
  wasm: 'application/wasm', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', pfb: 'application/octet-stream',
  bcmap: 'application/octet-stream', icc: 'application/octet-stream', gz: 'application/octet-stream',
};
const SEGURIDAD = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Método no permitido', { status: 405 });
    let ruta = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (ruta === '' || ruta.endsWith('/')) ruta += 'index.html';
    let datos = await env.ARCHIVOS.get(ruta, 'arrayBuffer');
    if (datos === null && !ruta.includes('.')) { ruta = 'index.html'; datos = await env.ARCHIVOS.get(ruta, 'arrayBuffer'); }
    if (datos === null) return new Response('No encontrado', { status: 404 });
    const ext = ruta.split('.').pop().toLowerCase();
    const cache = ruta === 'index.html' ? 'no-cache' : ruta.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=86400';
    return new Response(req.method === 'HEAD' ? null : datos, {
      headers: { 'Content-Type': TIPOS[ext] || 'application/octet-stream', 'Cache-Control': cache, ...SEGURIDAD },
    });
  },
};
