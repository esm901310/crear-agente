// Sirve las pantallas de la app (empaquetadas por scripts/empaquetar-app.mjs).
import { ESTATICOS } from './estaticos.generado';

const cache = new Map<string, Uint8Array>();

function bytes(ruta: string, cuerpo: string): Uint8Array {
  let b = cache.get(ruta);
  if (!b) {
    const bin = atob(cuerpo);
    b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    cache.set(ruta, b);
  }
  return b;
}

/** Devuelve la respuesta del archivo estático, o null si no hay app empaquetada. */
export function servirEstatico(req: Request, ruta: string): Response | null {
  if (!ESTATICOS['/index.html']) return null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Método no permitido', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  let clave = ruta === '/' ? '/index.html' : ruta;
  let archivo = ESTATICOS[clave];
  if (!archivo) {
    // Rutas de la app (sin extensión) → index.html; archivos inexistentes → 404.
    const ultimo = ruta.split('/').pop() ?? '';
    if (ultimo.includes('.')) return new Response('No encontrado', { status: 404 });
    clave = '/index.html';
    archivo = ESTATICOS[clave];
  }

  const inmutable = clave.startsWith('/assets/');
  const cabeceras = new Headers({
    'Content-Type': archivo.tipo,
    'Cache-Control': inmutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  if (clave === '/index.html') {
    cabeceras.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    cabeceras.set('X-Frame-Options', 'DENY');
  }
  return new Response(req.method === 'HEAD' ? null : bytes(clave, archivo.cuerpo), { headers: cabeceras });
}
