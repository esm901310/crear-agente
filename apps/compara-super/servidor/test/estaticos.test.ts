import { describe, expect, it } from 'vitest';
import { CSP, PERMISSIONS_POLICY, servirEstatico } from '../src/estaticos';
import { ESTATICOS } from '../src/estaticos.generado';

// Solo tiene sentido con la app empaquetada (npm run build:app && npm run empaquetar).
const hayApp = !!ESTATICOS['/index.html'];

describe.skipIf(!hayApp)('archivos estáticos de la app', () => {
  const pedir = (ruta: string) => servirEstatico(new Request(`https://x${ruta}`), ruta)!;

  it('index.html lleva CSP, Permissions-Policy y las demás cabeceras de seguridad', () => {
    for (const ruta of ['/', '/lista', '/index.html']) {
      const r = pedir(ruta);
      expect(r.status).toBe(200);
      expect(r.headers.get('Content-Security-Policy')).toBe(CSP);
      expect(r.headers.get('Permissions-Policy')).toBe(PERMISSIONS_POLICY);
      expect(r.headers.get('X-Frame-Options')).toBe('DENY');
      expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
    }
    expect(CSP).toContain("frame-ancestors 'none'");
    expect(CSP).toContain("img-src 'self' https: data:");
  });

  it('un archivo que no existe da 404 con nosniff', () => {
    const r = pedir('/no-existe.js');
    expect(r.status).toBe(404);
    expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(r.headers.get('Content-Type')).toMatch(/^text\/plain/);
  });
});
