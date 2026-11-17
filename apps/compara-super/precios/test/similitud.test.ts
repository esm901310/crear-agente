import { describe, expect, it } from 'vitest';
import { compararProductos, firmaDe, palabrasIguales, UMBRAL_PROBABLE } from '../src/similitud';
import { interpretarPresentacion, marcaEnMayusculas } from '../src/normalizar';
import { codigoDesdeImagen, colonial, parsearColonial } from '../src/tiendas/colonial';
import porCodigo from './fixtures/colonial-por-codigo.json';

/** Producto de La Colonia (trae la marca aparte) o de Colonial (marca en MAYÚSCULAS al inicio). */
const lc = (nombre: string, marca: string, precio = 20) => ({ nombre, marca, precio });
const cl = (nombre: string, precio = 20) => ({ nombre, marca: marcaEnMayusculas(nombre), precio });
const puntos = (a: Parameters<typeof compararProductos>[0], b: Parameters<typeof compararProductos>[1]) =>
  compararProductos(a, b).puntuacion;

describe('unidades nuevas en interpretarPresentacion', () => {
  it('reconoce "30u", "12 onz", "3 Ltrs", "4 Rollos", "10 uni"', () => {
    expect(interpretarPresentacion('RICA YEMA Huevos 30u')).toMatchObject({ cantidad: 30, unidad: 'un' });
    expect(interpretarPresentacion('COCA COLA Zero 12 onz')).toMatchObject({ unidad: 'g', texto: '12 oz' });
    expect(interpretarPresentacion('COCA COLA Regular 3 Ltrs')).toMatchObject({ cantidad: 3000, unidad: 'ml' });
    expect(interpretarPresentacion('Papel Higiénico Scott Doble Hoja 4 Rollos')).toMatchObject({ cantidad: 4, unidad: 'un' });
    expect(interpretarPresentacion('Bonovo Huevo Premiun XL 10 uni')).toMatchObject({ cantidad: 10, unidad: 'un' });
  });
});

describe('emparejamiento probable: casos que SÍ son el mismo producto', () => {
  it('Leche Sula Entera: 0.946 l ≈ 946 ml', () => {
    expect(puntos(lc('Leche Uht Sula Entera 0.946 Lt', 'Sula', 43.95), cl('SULA Leche Entera 946ml', 43.29))).toBeGreaterThanOrEqual(
      UMBRAL_PROBABLE,
    );
  });
  it('Huevos Rica Yema: "30 un" = "30u" (y "medianos" solo en un lado se perdona)', () => {
    expect(puntos(lc('Huevos Medianos Rica Yema 30 Un', 'Rica Yema'), cl('RICA YEMA Huevos 30u'))).toBeGreaterThanOrEqual(
      UMBRAL_PROBABLE,
    );
  });
  it('Coca Cola lata: 354 ml ≈ 12 oz (líquidas)', () => {
    expect(
      puntos(lc('Refresco Coca Cola Sabor Original Lata 354 Ml', 'Coca Cola'), cl('COCA COLA Original Lata 12oz')),
    ).toBeGreaterThanOrEqual(UMBRAL_PROBABLE);
    expect(
      puntos(lc('Refresco Coca Cola Sin Azúcar 354 Ml', 'Coca Cola'), cl('COCA COLA Sin Azucar Lata 12oz')),
    ).toBeGreaterThanOrEqual(UMBRAL_PROBABLE);
  });
  it('"Regular" = "Original", abreviaturas y palabras pegadas de Colonial', () => {
    expect(puntos(lc('Refresco Coca Cola Original 2 Lt', 'Coca Cola'), cl('COCA COLA Regular 2 Ltrs'))).toBeGreaterThanOrEqual(
      UMBRAL_PROBABLE,
    );
    expect(
      puntos(lc('Leche Sula Deslactosada Semi-Descremada Uht Bolsa 946 mL', 'Sula'), cl('SULA LecheDeslSemidBolsaLD 946ml')),
    ).toBeGreaterThanOrEqual(UMBRAL_PROBABLE);
  });
  it('una letra de diferencia ("Ridemax" / "Rindemax") y la marca mal puesta en una tienda', () => {
    expect(
      puntos(lc('Papel Higiénico Scott Ridemax Doble Hoja 4 Rollos', 'Scott'), cl('SCOTT Papel Higienico  Rindemax 4un')),
    ).toBeGreaterThanOrEqual(UMBRAL_PROBABLE);
    // La Colonia dice marca "Leyde", pero el nombre dice Sula.
    expect(puntos(lc('Leche Sula Entera Uht Bolsa 946 Ml', 'Leyde'), cl('SULA Leche Entera BolsaLD 946ml'))).toBeGreaterThanOrEqual(
      UMBRAL_PROBABLE,
    );
  });
});

describe('emparejamiento probable: casos que NO deben unirse', () => {
  const no = (a: ReturnType<typeof lc>, b: ReturnType<typeof cl>, motivo: RegExp) => {
    const r = compararProductos(a, b);
    expect(r.puntuacion).toBe(0);
    expect(r.motivo).toMatch(motivo);
  };
  it('misma línea, distinto tamaño (Naturas 380 g vs 1000 g)', () => {
    no(lc('Frijoles Refritos Naturas Rojo Volteado 380 Gr', 'Naturas'), cl('NATURAS Frijoles Rojos Volt 1000g'), /cantidad/);
  });
  it('variantes: sin azúcar, light, deslactosada, fortificada, bolsa, picante', () => {
    no(lc('Refresco Coca Cola Original 355 Ml', 'Coca Cola'), cl('COCA COLA Sin Azucar 355ml'), /palabras/);
    no(lc('Leche Uht Sula Entera 0.946 Lt', 'Sula'), cl('SULA Leche Descremada Light 946ml'), /palabras/);
    no(lc('Leche Uht Sula Semidescremada 0.946 Lt', 'Sula'), cl('SULA LecheDeslSemidBolsaLD 946ml'), /palabras/);
    no(lc('Leche Uht Sula Entera Fortificada 946 Ml', 'Sula'), cl('SULA Leche Entera 946ml'), /palabras distintas \(fortificada\)/);
    no(lc('Leche Uht Sula Entera 0.946 Lt', 'Sula'), cl('SULA Leche Entera BolsaLD 946ml'), /palabras distintas \(bolsa\)/);
    no(lc('Frijoles Rojos La Chula Volteados 400 Gr', 'La Chula'), cl('LA CHULA FrijoleslVolteadPican14oz'), /palabras/);
  });
  it('grupos excluyentes: tamaño de huevo, color, preparación', () => {
    no(lc('Huevos Bonovo Cartón M 30Un', 'Bonovo'), cl('Bonovo Huevo G 30 und'), /variante \(tamano\)/);
    no(lc('Frijoles Naturas Negros 400 Gr', 'Naturas'), cl('NATURAS Frijoles Rojos 400g'), /variante \(color\)/);
    no(lc('Frijoles La Chula Rojos Enteros 800 Gr', 'La Chula'), cl('LA CHULA Frijoles Rojos Volteados 800g'), /variante/);
  });
  it('otra marca, sin cantidad, paquete distinto o precio muy distinto', () => {
    no(lc('Refresco Pepsi Lata 355 Ml', 'Pepsi'), cl('COCA COLA Regular 355ml'), /marca/);
    no(lc('Leche Uht Sula Deslactosada Y Semidescremada 0.946 Lt', 'Sula'), cl('SULA Leche Deslactosada SemiDescremada'), /cantidad/);
    no(lc('Refresco Coca Cola Original 6 Pack 355 Ml', 'Coca Cola'), cl('COCA COLA Regular 355ml'), /paquete/);
    no(lc('Refresco Coca Cola Sin Azúcar 355 Ml', 'Coca Cola', 20.65), cl('COCA COLA Zero 12 onz', 34.99), /precio/);
  });
});

describe('detalles del comparador', () => {
  it('palabrasIguales: abreviaturas y una letra', () => {
    expect(palabrasIguales('desl', 'deslactosada')).toBe(true);
    expect(palabrasIguales('volt', 'volteado')).toBe(true);
    expect(palabrasIguales('ridemax', 'rindemax')).toBe(true);
    expect(palabrasIguales('negro', 'rojo')).toBe(false);
    expect(palabrasIguales('ca', 'cafe')).toBe(false); // prefijo muy corto
  });
  it('firma: 12 oz vale como peso o como volumen; marca sin espacios', () => {
    const f = firmaDe({ nombre: 'COCA COLA Original Lata 12oz', marca: 'Coca Cola' });
    expect(f.marca).toBe('cocacola');
    expect(f.cantidades.map((c) => c.unidad)).toEqual(['g', 'ml']);
    expect(f.cantidades[1].cantidad).toBeCloseTo(354.88, 1);
  });
});

describe('Colonial: código de barras', () => {
  it('lo saca del nombre de la imagen con o sin "_" después de los dígitos', () => {
    expect(codigoDesdeImagen('https://cdn.shopify.com/s/files/1/x/files/Items_2f7424142400093.jpg?v=1')).toBe('7424142400093');
    expect(codigoDesdeImagen('https://cdn.shopify.com/s/files/1/x/files/Items_2f707517002083_abc.jpg')).toBe('707517002083');
    expect(codigoDesdeImagen('https://cdn.shopify.com/s/files/1/x/files/sulaentera.webp')).toBeUndefined();
  });

  it('búsqueda por código: pide 3 resultados, se queda con el primero y le pone el código', async () => {
    const urls: string[] = [];
    const f = (async (url: string) => {
      urls.push(url);
      const q = new URL(url).searchParams.get('q')!;
      const resp = (porCodigo.respuestas as Record<string, unknown>)[q] ?? { results: { products: [] } };
      return new Response(JSON.stringify({ resources: resp }), { status: 200 });
    }) as unknown as typeof fetch;
    const [p] = await colonial.buscar('7421000840817', { fetch: f });
    expect(urls[0]).toContain('q=7421000840817');
    expect(urls[0]).toContain('resources%5Blimit%5D=3');
    expect(p).toMatchObject({ nombre: 'SULA Leche Deslactosada SemiDescremada', codigoBarras: '7421000840817' });
    expect(await colonial.buscar('7421000811176', { fetch: f })).toEqual([]); // no lo tiene
  });

  it('si la imagen trae OTRO código, la búsqueda por código no devuelve nada', async () => {
    const respuesta = {
      resources: {
        results: {
          products: [
            { id: 1, title: 'X 1kg', handle: 'x', price: '10', image: 'https://cdn.shopify.com/s/files/Items_2f7424142400093.jpg' },
          ],
        },
      },
    };
    const f = (async () => new Response(JSON.stringify(respuesta), { status: 200 })) as unknown as typeof fetch;
    expect(parsearColonial(respuesta)[0].codigoBarras).toBe('7424142400093');
    expect(await colonial.buscar('7421000811367', { fetch: f })).toEqual([]);
  });
});
