import { describe, expect, it } from 'vitest';
import lacoloniaJson from './fixtures/lacolonia-busqueda.json';
import colonialJson from './fixtures/colonial-suggest.json';
import losandesJson from './fixtures/losandes-paginate.json';
import {
  buscarEnTodas,
  colonial,
  crearCacheMemoria,
  laColonia,
  losAndes,
  parsearColonial,
  parsearLaColonia,
  parsearLosAndes,
} from '../src/index';
import { ErrorTienda } from '../src/tipos';

/** fetch falso: responde según la URL, sin internet. */
function fetchFalso(rutas: Record<string, unknown | number | 'colgar'>) {
  const llamadas: Array<{ url: string; init?: RequestInit }> = [];
  const f = (async (url: string, init?: RequestInit) => {
    llamadas.push({ url, init });
    const clave = Object.keys(rutas).find((k) => url.includes(k));
    const r = clave ? rutas[clave] : 404;
    if (r === 'colgar') {
      return new Promise((_, rechazar) =>
        init?.signal?.addEventListener('abort', () => rechazar(new Error('aborted'))),
      );
    }
    if (typeof r === 'number') return new Response('error', { status: r });
    return new Response(JSON.stringify(r), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { f, llamadas };
}

describe('La Colonia (VTEX)', () => {
  it('convierte la respuesta en productos', () => {
    const ps = parsearLaColonia(lacoloniaJson);
    expect(ps).toHaveLength(4);
    expect(ps[0]).toMatchObject({
      tienda: 'lacolonia',
      id: '1598',
      nombre: 'Arroz Tia Emely Blanco 1.75 Kg',
      marca: 'Tia Emely',
      presentacion: '1.75 kg',
      precio: 80.9,
      url: 'https://www.lacolonia.com/arroz-tia-emely-blanco-1-75-kg-ref707517002045/p',
      codigoBarras: '707517002045',
    });
    expect(ps[0].precioOferta).toBeUndefined();
    expect(ps[0].disponible).toBeUndefined(); // stock depende de la sucursal
    expect(ps[0].imagen).toMatch(/^https:\/\//);
  });

  it('detecta ofertas (Price < ListPrice)', () => {
    const leche = parsearLaColonia(lacoloniaJson).find((p) => p.id === '1605')!;
    expect(leche.precio).toBe(48.75);
    expect(leche.precioOferta).toBe(39);
    expect(leche.presentacion).toBe('12 oz');
  });

  it('arma la URL correcta y usa el fetch inyectado', async () => {
    const { f, llamadas } = fetchFalso({ 'intelligent-search': lacoloniaJson });
    const ps = await laColonia.buscar('arroz blanco', { fetch: f, limite: 2 });
    expect(ps).toHaveLength(2);
    expect(llamadas[0].url).toContain('/_v/api/intelligent-search/product_search/?query=arroz%20blanco&count=2');
  });

  it('error de formato si la tienda cambia', () => {
    expect(() => parsearLaColonia({ algo: 1 })).toThrow(ErrorTienda);
  });
});

describe('Colonial (Shopify)', () => {
  it('convierte la respuesta en productos', () => {
    const ps = parsearColonial(colonialJson);
    expect(ps).toHaveLength(3);
    expect(ps[0]).toMatchObject({
      tienda: 'colonial',
      id: '10495005557028',
      nombre: 'PROGRESO Arroz BlancoGranoLar1.75Kg',
      marca: 'Progreso',
      presentacion: '1.75 kg',
      precio: 62.49,
      disponible: true,
      url: 'https://supercolonial.com/products/progreso-arroz-blancogranolar175kg',
      codigoBarras: '707517002083',
    });
    expect(ps[0].precioOferta).toBeUndefined(); // compare_at_price 0.00 = sin oferta
    expect(ps[1]).toMatchObject({ marca: 'Manhattan', presentacion: '3.3 lb', precio: 53.99 });
    expect(ps[1].codigoBarras).toBeUndefined();
  });

  it('usa compare_at_price como precio normal cuando hay oferta', () => {
    const json = structuredClone(colonialJson);
    json.resources.results.products[0].compare_at_price_max = '70.00';
    const [p] = parsearColonial(json);
    expect(p.precio).toBe(70);
    expect(p.precioOferta).toBe(62.49);
  });

  it('pide como máximo 10 productos', async () => {
    const { f, llamadas } = fetchFalso({ 'suggest.json': colonialJson });
    await colonial.buscar('arroz', { fetch: f, limite: 50 });
    expect(llamadas[0].url).toContain('resources%5Blimit%5D=10');
  });
});

describe('Los Andes (API AVE)', () => {
  it('convierte la respuesta en productos', () => {
    const ps = parsearLosAndes(losandesJson);
    expect(ps).toHaveLength(3);
    expect(ps[0]).toMatchObject({
      tienda: 'losandes',
      id: '0001-000000000002099',
      nombre: 'Arroz para sushi libra',
      precio: 45,
      url: 'https://comisariatolosandes.com/granos-harinas-y-pastas/arroz-para-sushi-libra-2099',
    });
    expect(ps[0].marca).toBeUndefined(); // "Marca COMANDES" es genérica
    expect(ps[0].codigoBarras).toBeUndefined(); // código interno corto
    expect(ps[0].imagen).toContain('/folder/products/500X500/');
  });

  it('detecta ofertas (newPrice < price)', () => {
    const dulce = parsearLosAndes(losandesJson)[1];
    expect(dulce.precio).toBe(598.95);
    expect(dulce.precioOferta).toBe(419.27);
    expect(dulce.presentacion).toBe('34.8 oz');
  });

  it('manda un POST con el texto buscado', async () => {
    const { f, llamadas } = fetchFalso({ 'material/paginate': losandesJson });
    await losAndes.buscar('arroz', { fetch: f });
    expect(llamadas[0].url).toBe('https://andes.aveapplications.com/api/em/material/paginate?skip=0&take=20');
    expect(llamadas[0].init?.method).toBe('POST');
    expect(JSON.parse(String(llamadas[0].init?.body))).toMatchObject({ search: 'arroz', businessPartner: 1, type: 'PD' });
  });
});

describe('buscarEnTodas', () => {
  it('no falla si una tienda falla y reporta el error', async () => {
    const { f } = fetchFalso({
      'intelligent-search': lacoloniaJson,
      'suggest.json': 503,
      'material/paginate': losandesJson,
    });
    const r = await buscarEnTodas('arroz', { fetch: f });
    expect(r.map((x) => x.tienda)).toEqual(['lacolonia', 'colonial', 'losandes']);
    expect(r[0].ok).toBe(true);
    expect(r[1]).toMatchObject({ ok: false, productos: [], error: { tipo: 'http' } });
    expect(r[2].ok).toBe(true);
  });

  it('corta por timeout', async () => {
    const { f } = fetchFalso({ 'intelligent-search': 'colgar' });
    const [r] = await buscarEnTodas('arroz', { fetch: f, timeoutMs: 50, tiendas: ['lacolonia'] });
    expect(r.ok).toBe(false);
    expect(r.error?.tipo).toBe('timeout');
  });

  it('rechaza búsquedas vacías', async () => {
    const [r] = await buscarEnTodas(' ', { tiendas: ['colonial'] });
    expect(r.error?.tipo).toBe('entrada');
  });

  it('usa la caché y no repite peticiones', async () => {
    const { f, llamadas } = fetchFalso({ 'suggest.json': colonialJson });
    const cache = crearCacheMemoria();
    await buscarEnTodas('Arroz', { fetch: f, cache, tiendas: ['colonial'] });
    await buscarEnTodas('arroz ', { fetch: f, cache, tiendas: ['colonial'] });
    expect(llamadas).toHaveLength(1);
  });
});
