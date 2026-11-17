import { describe, expect, it } from 'vitest';
import { compararProductos, confirmarMismoProducto, firmaDe, palabrasIguales, UMBRAL_PROBABLE } from '../src/similitud';
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
    no(lc('Frijoles La Chula Volteados 400 Gr', 'La Chula'), cl('LA CHULA FrijoleslVolteadPican14oz'), /palabras/);
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

describe('revisión del Probador: falsos positivos que NO deben unirse', () => {
  const no = (a: ReturnType<typeof lc>, b: ReturnType<typeof cl>, motivo: RegExp) => {
    const r = compararProductos(a, b);
    expect(r.puntuacion, `${a.nombre} / ${b.nombre}`).toBe(0);
    expect(r.motivo).toMatch(motivo);
  };
  it('a) números que no son la cantidad: etapa, %, 2en1, talla N, capas', () => {
    no(lc('Pañales Huggies Etapa 3 40 Un', 'Huggies'), cl('HUGGIES Pañal Etapa 4 40un'), /numeros/);
    no(lc('Leche Dos Pinos 2% Grasa 946 Ml', 'Dos Pinos'), cl('DOS PINOS Leche 1% Grasa 946ml'), /numeros/);
    no(lc('Alcohol Etílico Lister 70% 500 Ml', 'Lister'), cl('LISTER Alcohol Etilico 90% 500ml'), /numeros/);
    no(lc('Champú Head & Shoulders 2en1 375 Ml', 'Head & Shoulders'), cl('HEAD & SHOULDERS Champu 375ml'), /numeros/);
    no(lc('Champú Pantene 2 En 1 400 Ml', 'Pantene'), cl('PANTENE Champu 400ml'), /numeros/);
    no(lc('Pañal Pampers Talla 3 30 Un', 'Pampers'), cl('PAMPERS Pañal Talla 4 30u'), /numeros/);
    no(lc('Papel Higiénico Scott 3 Capas 4 Rollos', 'Scott'), cl('SCOTT Papel Higienico 4 Rollos'), /numeros/);
    // Si un lado tiene el número y el otro no, tampoco.
    no(lc('Pañales Huggies Etapa 3 40 Un', 'Huggies'), cl('HUGGIES Pañal 40un'), /numeros/);
  });
  it('b) tallas en letras (pañales, ropa)', () => {
    no(lc('Pañal Huggies Supreme Talla M 40 Un', 'Huggies'), cl('HUGGIES Pañal Supreme Talla G 40un'), /variante \(talla\)/);
    no(lc('Pañal Huggies Talla XG 40 Un', 'Huggies'), cl('HUGGIES Pañal Talla XXG 40un'), /variante \(talla\)/);
    no(lc('Pañal Huggies Talla M 40 Un', 'Huggies'), cl('HUGGIES Pañal 40un'), /talla/);
  });
  it('c) prefijos que son palabras distintas: coco/cocoa, sal/salsa, pan/panqueques, des…', () => {
    no(lc('Galletas Pozuelo Coco 300 Gr', 'Pozuelo'), cl('POZUELO Galletas Cocoa 300g'), /palabras/);
    no(lc('Sal Maggi 500 Gr', 'Maggi'), cl('MAGGI Salsa 500g'), /palabras/);
    no(lc('Mezcla Aunt Jemima Pan 907 Gr', 'Aunt Jemima'), cl('AUNT JEMIMA Mezcla Panqueques 907g'), /palabras/);
    no(lc('Leche Sula Des 946 Ml', 'Sula'), cl('SULA Leche Descremada 946ml'), /palabras/);
    no(lc('Leche Sula Descremada 946 Ml', 'Sula'), cl('SULA Leche Deslactosada 946ml'), /palabras/);
    expect(palabrasIguales('coco', 'cocoa')).toBe(false);
    expect(palabrasIguales('sal', 'salsa')).toBe(false);
    expect(palabrasIguales('pan', 'panqueque')).toBe(false);
    expect(palabrasIguales('des', 'descremada')).toBe(false);
  });
  it('d) una letra de diferencia entre palabras distintas: fresa/fresca', () => {
    no(lc('Yogurt Yoplait Fresa 1 Lt', 'Yoplait'), cl('YOPLAIT Yogurt Fresca 1L'), /palabras/);
    expect(palabrasIguales('fresa', 'fresca')).toBe(false);
    expect(palabrasIguales('tostada', 'tostado')).toBe(false); // distinta última letra
  });
  it('e) color que solo dice un lado (morena, integral, negro, rojo…)', () => {
    no(lc('Azúcar Morena Cañal 2 Lb', 'Cañal'), cl('CAÑAL Azucar 2lb'), /color/);
    no(lc('Arroz Integral Progreso 2 Lb', 'Progreso'), cl('PROGRESO Arroz 2lb'), /palabras distintas \(integral\)/);
    no(lc('Frijoles Negros Naturas 400 Gr', 'Naturas'), cl('NATURAS Frijoles 400g'), /color/);
    no(lc('Frijoles Rojos Don Pablo 1400 Gr', 'Don Pablo'), cl('DON PABLO Frijoles 1400g'), /color/);
    no(lc('Azúcar Rubia Cañal 2 Lb', 'Cañal'), cl('CAÑAL Azucar Morena 2lb'), /color/);
  });
  it('f) la marca debe ser la misma completa, no una palabra dentro de otra', () => {
    no(lc('Leche Dos Pinos Entera 946 Ml', 'Dos Pinos'), cl('PINOS Leche Entera 946ml'), /marca/);
    // La Colonia pone "Leyde" a una leche Sula: con las dos marcas distintas, no se une.
    no(lc('Leche Sula Entera Uht Bolsa 946 Ml', 'Leyde'), cl('SULA Leche Entera BolsaLD 946ml'), /marca/);
  });
});

describe('revisión del Probador: lo que SÍ debe unirse', () => {
  const si = (a: ReturnType<typeof lc>, b: ReturnType<typeof cl>) =>
    expect(puntos(a, b), `${a.nombre} / ${b.nombre}`).toBeGreaterThanOrEqual(UMBRAL_PROBABLE);
  it('"MC CORMICK" = "McCormick"; "Ketchup" = "Salsa Ketchup"; "blanca" es el color por defecto', () => {
    si(lc('Mayonesa McCormick Con Limón 400 Gr', 'McCormick'), cl('MC CORMICK Mayonesa C/Limon 400g'));
    si(lc('Salsa Ketchup Del Monte 397 Gr', 'Del Monte'), cl('DEL MONTE Ketchup 397g'));
    si(lc('Azúcar Blanca El Cañal Vitaminada 2000 Gr', 'El Cañal'), cl('EL CAÑAL Azucar 2000g'));
  });
  it('mismos números y misma talla sí se unen', () => {
    si(lc('Pañal Huggies Supreme Talla M 40 Un', 'Huggies'), cl('HUGGIES Pañal Supreme Talla M 40un'));
    si(lc('Leche Dos Pinos 2% Grasa 946 Ml', 'Dos Pinos'), cl('DOS PINOS Leche 2% Grasa 946ml'));
    si(lc('Champú Pantene 2 En 1 400 Ml', 'Pantene'), cl('PANTENE Champu 2en1 400ml'));
  });
});

describe('paquetes: "12 x 355 ml" = "12 Pack 355ml"', () => {
  const si = (a: ReturnType<typeof lc>, b: ReturnType<typeof cl>) =>
    expect(puntos(a, b), `${a.nombre} / ${b.nombre}`).toBeGreaterThanOrEqual(UMBRAL_PROBABLE);
  it('el número del paquete no cuenta como "otro número"', () => {
    si(lc('Refresco Coca Cola 12 X 355 Ml', 'Coca Cola', 200), cl('COCA COLA 12 Pack 355ml', 205));
    si(lc('Refresco Coca Cola 6 Pack 355 Ml', 'Coca Cola', 100), cl('COCA COLA Regular 6x355ml', 102));
    si(lc('Refresco Coca Cola Six Pack Lata 355 Ml', 'Coca Cola', 100), cl('COCA COLA Lata Pack de 6 355ml', 102));
  });
  it('paquete contra unidad, o paquetes distintos, siguen sin unirse', () => {
    expect(compararProductos(lc('Refresco Coca Cola 6x355 Ml', 'Coca Cola', 20), cl('COCA COLA Regular 355ml', 19)).motivo).toBe('paquete');
    expect(compararProductos(lc('Refresco Coca Cola 6 Pack 355 Ml', 'Coca Cola'), cl('COCA COLA 12 Pack 355ml')).motivo).toBe('paquete');
  });
});

describe('confirmarMismoProducto (hallado por código, sin código en la imagen)', () => {
  it('rechaza variantes, color, talla, números, paquete, otra marca y falta de cantidad', () => {
    const sula = { nombre: 'Leche Sula Entera 946 Ml', marca: 'Sula' };
    expect(confirmarMismoProducto(sula, cl('SULA Leche Deslactosada 946ml'))).toBe(false);
    expect(confirmarMismoProducto(sula, { nombre: 'Leche Entera' })).toBe(false); // sin marca ni cantidad
    expect(confirmarMismoProducto(sula, cl('SULA Leche Entera Light 946ml'))).toBe(false);
    expect(confirmarMismoProducto(sula, cl('DOS PINOS Leche Entera 946ml'))).toBe(false);
    expect(confirmarMismoProducto({ nombre: 'Refresco Coca Cola Original 355 Ml', marca: 'Coca Cola' }, cl('COCA COLA Sin Azucar 355ml'))).toBe(false);
    expect(confirmarMismoProducto({ nombre: 'Refresco Coca Cola 6x355 Ml', marca: 'Coca Cola' }, cl('COCA COLA Regular 355ml'))).toBe(false);
    expect(confirmarMismoProducto({ nombre: 'Azúcar Morena Cañal 2 Lb', marca: 'Cañal' }, cl('CAÑAL Azucar 2lb'))).toBe(false);
    expect(confirmarMismoProducto({ nombre: 'Pañal Huggies Talla M 40 Un', marca: 'Huggies' }, cl('HUGGIES Pañal Talla G 40un'))).toBe(false);
    expect(confirmarMismoProducto({ nombre: 'Pañal Huggies Etapa 3 40 Un', marca: 'Huggies' }, cl('HUGGIES Pañal Etapa 4 40un'))).toBe(false);
  });
  it('acepta el mismo producto con palabras distintas que no son variantes', () => {
    expect(confirmarMismoProducto(sula2(), cl('SULA Leche Entera 946ml'))).toBe(true);
    expect(
      confirmarMismoProducto(
        { nombre: 'Galletas Voortman Sin Azucar Glacial Almendra 227 Gr', marca: 'Voortman' },
        cl('VOORTMAN Galletas Almonette Sin Azucar 227g'),
      ),
    ).toBe(true);
    expect(confirmarMismoProducto({ nombre: 'Bebida Energizante Red Bull Sin Azucar 250 Ml', marca: 'Red Bull' }, cl('RED BULL Energ SugarFree 250ml'))).toBe(true);
    // Colonial sin marca en mayúsculas: basta que no contradiga.
    expect(
      confirmarMismoProducto({ nombre: 'Papel Higiénico Scott Esencias Doble Hoja 12 Rollos', marca: 'Scott' }, { nombre: 'Scott PapelHigién Esencias 12R' }),
    ).toBe(true);
    // "Limón" y "limonada" son variantes conocidas distintas: no se confirma por nombre (solo por la imagen).
    expect(confirmarMismoProducto({ nombre: 'Refresco Carnaval Con Limón Y Soda Lata 350 Ml', marca: 'Free' }, { nombre: 'Carnaval Limonada C/Soda lata 350ml' })).toBe(false);
  });
});
const sula2 = () => ({ nombre: 'Leche Uht Sula Entera 0.946 Lt', marca: 'Sula' });

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

  it('búsqueda por código: pide 3 resultados y, sin código en la imagen, exige que coincida con la referencia', async () => {
    const urls: string[] = [];
    const f = (async (url: string) => {
      urls.push(url);
      const q = new URL(url).searchParams.get('q')!;
      const resp = (porCodigo.respuestas as Record<string, unknown>)[q] ?? { results: { products: [] } };
      return new Response(JSON.stringify({ resources: resp }), { status: 200 });
    }) as unknown as typeof fetch;
    // Imagen sin código: se acepta solo si coincide con la referencia (marca, cantidad, variante…).
    const referencia = { nombre: 'Refresco Coca Cola Sin Azúcar 355 Ml', marca: 'Coca Cola' };
    const [p] = await colonial.buscar('7422110102840', { fetch: f, referencia });
    expect(urls[0]).toContain('q=7422110102840');
    expect(urls[0]).toContain('resources%5Blimit%5D=3');
    expect(p).toMatchObject({ nombre: 'COCA COLA Sin Azucar 355ml', codigoBarras: '7422110102840' });
    // Sin referencia, o con una que no coincide (otra variante / otro tamaño / otra marca): nada.
    expect(await colonial.buscar('7422110102840', { fetch: f })).toEqual([]);
    expect(await colonial.buscar('7422110102840', { fetch: f, referencia: { nombre: 'Refresco Coca Cola Original 355 Ml', marca: 'Coca Cola' } })).toEqual([]);
    expect(await colonial.buscar('7422110102840', { fetch: f, referencia: { nombre: 'Refresco Coca Cola Sin Azúcar 500 Ml', marca: 'Coca Cola' } })).toEqual([]);
    expect(await colonial.buscar('7422110102840', { fetch: f, referencia: { nombre: 'Refresco Pepsi Sin Azúcar 355 Ml', marca: 'Pepsi' } })).toEqual([]);
    // Colonial no dice el tamaño de esta leche: sin cantidad en ambos, no se confirma.
    const leche = { nombre: 'Leche Uht Sula Deslactosada Y Semidescremada 0.946 Lt', marca: 'Sula' };
    expect(await colonial.buscar('7421000840817', { fetch: f, referencia: leche })).toEqual([]);
    // Con el código en la imagen ("Items_2f7411000345078_…") basta, aunque los nombres difieran ("Rojo").
    const [naturas] = await colonial.buscar('7411000345078', { fetch: f, referencia: { nombre: 'Frijoles Refritos Naturas Rojo Volteado 380 Gr', marca: 'Naturas' } });
    expect(naturas?.codigoBarras).toBe('7411000345078');
    expect(await colonial.buscar('7421000811176', { fetch: f, referencia })).toEqual([]); // no lo tiene
  });

  it('con el mismo código en la imagen basta; si la imagen trae OTRO código, nada', async () => {
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
    expect((await colonial.buscar('7424142400093', { fetch: f }))[0]?.codigoBarras).toBe('7424142400093');
  });
});
