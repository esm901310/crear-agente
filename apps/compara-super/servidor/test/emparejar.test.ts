import { describe, expect, it } from 'vitest';
import type { Producto } from '../../precios/src/tipos';
import { parsearColonial, parsearLaColonia } from '../../precios/src/index';
import lacoloniaJson from '../../precios/test/fixtures/lacolonia-busqueda.json';
import colonialJson from '../../precios/test/fixtures/colonial-suggest.json';
import { normalizarEan13 } from '../src/ean';
import { claveDeProducto, eanDeClave, emparejar, reidentificar } from '../src/grupos';
import type { Grupo } from '../src/tipos';
import lcLeche from '../../precios/test/fixtures/lacolonia-leche-sula.json';
import clLeche from '../../precios/test/fixtures/colonial-leche-sula.json';
import lcCoca from '../../precios/test/fixtures/lacolonia-coca-cola.json';
import clCoca from '../../precios/test/fixtures/colonial-coca-cola.json';
import lcHuevos from '../../precios/test/fixtures/lacolonia-huevos.json';
import clHuevos from '../../precios/test/fixtures/colonial-huevos.json';

const prod = (p: Partial<Producto> & Pick<Producto, 'tienda' | 'id'>): Producto => ({
  nombre: `Producto ${p.id}`,
  precio: 10,
  url: 'https://example.com',
  ...p,
});

describe('normalizarEan13', () => {
  it('UPC-A de 12 dígitos → antepone 0', () => {
    expect(normalizarEan13('707517002083')).toBe('0707517002083');
  });
  it('EAN-13 válido queda igual', () => {
    expect(normalizarEan13('7427960100473')).toBe('7427960100473');
  });
  it('UPC sin dígito verificador (11 dígitos, como Los Andes) se completa', () => {
    expect(normalizarEan13('70751700208')).toBe('0707517002083');
  });
  it('GTIN-14 con 0 inicial y EAN-8', () => {
    expect(normalizarEan13('00707517002083')).toBe('0707517002083');
    expect(normalizarEan13('96385074')).toBe('0000096385074');
  });
  it('rechaza dígito verificador incorrecto, códigos internos y basura', () => {
    expect(normalizarEan13('707517002084')).toBeUndefined();
    expect(normalizarEan13('12345')).toBeUndefined();
    expect(normalizarEan13('000000000000')).toBeUndefined();
    expect(normalizarEan13(undefined)).toBeUndefined();
    expect(normalizarEan13({})).toBeUndefined();
  });
});

describe('emparejar por código de barras', () => {
  it('une el mismo código aunque una tienda lo publique con 12 y otra con 13 dígitos', () => {
    const grupos = emparejar([
      {
        tienda: 'lacolonia',
        productos: [
          prod({ tienda: 'lacolonia', id: '1', nombre: 'Arroz Progreso 1.75 Kg', codigoBarras: '0707517002083', precio: 65 }),
        ],
      },
      {
        tienda: 'colonial',
        productos: [
          prod({ tienda: 'colonial', id: 'x', nombre: 'MANHATTAN Arroz', precio: 50 }),
          prod({ tienda: 'colonial', id: '99', nombre: 'PROGRESO Arroz 1.75Kg', codigoBarras: '707517002083', precio: 62.49 }),
        ],
      },
    ]);
    expect(grupos).toHaveLength(2);
    // El que está en 2 tiendas va primero.
    expect(grupos[0].clave).toBe('ean:0707517002083');
    expect(grupos[0].nombre).toBe('Arroz Progreso 1.75 Kg'); // se prefiere el nombre de La Colonia
    expect(grupos[0].precios.lacolonia).toMatchObject({ productoId: '1', precio: 65 });
    expect(grupos[0].precios.colonial).toMatchObject({ productoId: '99', precio: 62.49 });
    // Sin código de barras: grupo de una sola tienda.
    expect(grupos[1].clave).toBe('colonial:x');
    expect(Object.keys(grupos[1].precios)).toEqual(['colonial']);
  });

  it('código inválido no empareja: cada producto queda en su tienda', () => {
    const grupos = emparejar([
      { tienda: 'lacolonia', productos: [prod({ tienda: 'lacolonia', id: '1', codigoBarras: '707517002084' })] },
      { tienda: 'colonial', productos: [prod({ tienda: 'colonial', id: '2', codigoBarras: '707517002084' })] },
    ]);
    expect(grupos.map((g) => g.clave).sort()).toEqual(['colonial:2', 'lacolonia:1']);
  });

  it('respeta el máximo de grupos y conserva la oferta', () => {
    const muchos = Array.from({ length: 30 }, (_, i) =>
      prod({ tienda: 'lacolonia', id: String(i), precio: 20, precioOferta: 15 }),
    );
    const grupos = emparejar([{ tienda: 'lacolonia', productos: muchos }], 20);
    expect(grupos).toHaveLength(20);
    expect(grupos[0].precios.lacolonia).toMatchObject({ precio: 20, precioOferta: 15 });
  });

  it('funciona con las respuestas guardadas de las tiendas', () => {
    const grupos = emparejar([
      { tienda: 'lacolonia', productos: parsearLaColonia(lacoloniaJson) },
      { tienda: 'colonial', productos: parsearColonial(colonialJson) },
    ]);
    expect(grupos.length).toBe(7);
    expect(grupos.find((g) => g.clave === 'ean:0707517002083')?.precios.colonial?.precio).toBe(62.49);
    expect(grupos.find((g) => g.clave === 'colonial:10783533728036')).toBeDefined(); // imagen sin código
  });
});

describe('reidentificar', () => {
  const productos = [
    prod({ tienda: 'colonial', id: 'a', codigoBarras: '7427960100473' }),
    prod({ tienda: 'colonial', id: 'b', codigoBarras: '707517002083' }),
  ];
  it('primero por id del producto en la tienda', () => {
    expect(reidentificar(productos, 'a', '0707517002083')?.id).toBe('a');
  });
  it('si el id no aparece, por código de barras', () => {
    expect(reidentificar(productos, 'zzz', '0707517002083')?.id).toBe('b');
    expect(reidentificar(productos, undefined, eanDeClave('ean:0707517002083'))?.id).toBe('b');
  });
  it('si no hay coincidencia devuelve undefined', () => {
    expect(reidentificar(productos, 'zzz', undefined)).toBeUndefined();
  });
  it('claveDeProducto', () => {
    expect(claveDeProducto(productos[1])).toBe('ean:0707517002083');
    expect(claveDeProducto(prod({ tienda: 'lacolonia', id: '7' }))).toBe('lacolonia:7');
  });
});

// ---------------------------------------------------------------------------
// Emparejamiento probable (por nombre, marca y cantidad) con respuestas reales
// ---------------------------------------------------------------------------

const gruposDe = (lcJson: unknown, clJson: unknown) =>
  emparejar(
    [
      { tienda: 'lacolonia', productos: parsearLaColonia(lcJson) },
      { tienda: 'colonial', productos: parsearColonial(clJson) },
    ],
    40,
  );
/** Grupo que contiene el producto `id` de La Colonia. */
const conLc = (gs: Grupo[], id: string) => gs.find((g) => g.precios.lacolonia?.productoId === id);

describe('emparejar: respaldo por parecido (fixtures reales)', () => {
  it('leche sula: une la misma leche aunque los nombres y unidades difieran', () => {
    const gs = gruposDe(lcLeche, clLeche);
    // "Leche Uht Sula Entera 0.946 Lt" ↔ "SULA Leche Entera 946ml" (mismo EAN según /products/<handle>.js)
    expect(conLc(gs, '369')).toMatchObject({
      clave: 'ean:7421000811367',
      coincidencia: 'probable',
      precios: { colonial: { productoId: '10348551962916' } },
    });
    // Bolsa con bolsa (La Colonia pone marca "Leyde" a esta leche Sula).
    expect(conLc(gs, '14385')?.precios.colonial?.productoId).toBe('10495012110628');
    // Fortificada no se une con la entera normal; la deslactosada sin tamaño en Colonial tampoco.
    expect(Object.keys(conLc(gs, '15497')!.precios)).toEqual(['lacolonia']);
    expect(Object.keys(conLc(gs, '620')!.precios)).toEqual(['lacolonia']);
  });

  it('coca cola: 354 ml ≈ 12 oz; original y sin azúcar nunca se mezclan', () => {
    const gs = gruposDe(lcCoca, clCoca);
    expect(conLc(gs, '976')?.precios.colonial?.nombre).toBe('COCA COLA Original Lata 12oz');
    expect(conLc(gs, '395')?.precios.colonial?.nombre).toBe('COCA COLA Sin Azucar Lata 12oz');
    expect(conLc(gs, '239')?.precios.colonial?.nombre).toBe('COCA COLA Regular 355ml');
    // "Zero 12 onz" cuesta 1.7 veces más que la "Sin Azúcar 355 ml": no se une.
    const zero = gs.find((g) => g.precios.colonial?.productoId === '10348464996644')!;
    expect(Object.keys(zero.precios)).toEqual(['colonial']);
    for (const g of gs.filter((x) => x.coincidencia)) {
      const sinAzucar = (n: string) => /sin az[uú]car|zero/i.test(n);
      expect(sinAzucar(g.precios.lacolonia!.nombre)).toBe(sinAzucar(g.precios.colonial!.nombre));
    }
  });

  it('huevos: con el código de la imagen ("Items_2f<ean>.jpg") se unen por código', () => {
    const gs = gruposDe(lcHuevos, clHuevos);
    expect(conLc(gs, '1579')).toMatchObject({
      coincidencia: 'codigo',
      precios: { colonial: { nombre: 'RICA YEMA Huevos 30u' } },
    });
    // Bonovo "Cartón M" no se une con Bonovo "G" (tamaños distintos).
    expect(Object.keys(conLc(gs, '16284')!.precios)).toEqual(['lacolonia']);
  });

  it('uno a uno: ningún producto queda en dos grupos, y los grupos de 2 tiendas van primero', () => {
    for (const [a, b] of [
      [lcLeche, clLeche],
      [lcCoca, clCoca],
      [lcHuevos, clHuevos],
    ]) {
      const gs = gruposDe(a, b);
      const ids = gs.flatMap((g) => Object.entries(g.precios).map(([t, p]) => `${t}:${p!.productoId}`));
      expect(new Set(ids).size).toBe(ids.length);
      const tiendas = gs.map((g) => Object.keys(g.precios).length);
      expect(tiendas).toEqual([...tiendas].sort((x, y) => y - x));
      for (const g of gs) {
        if (tiendas.length && Object.keys(g.precios).length === 1) expect(g.coincidencia).toBeUndefined();
        if (g.coincidencia) expect(g.clave).toMatch(/^ean:\d{13}$/);
      }
    }
  });

  it('no une por parecido productos con códigos de barras distintos, ni si ninguno tiene código', () => {
    const a = prod({ tienda: 'lacolonia', id: '1', nombre: 'Leche Sula Entera 946 ml', marca: 'Sula', codigoBarras: '7421000811367' });
    const b = prod({ tienda: 'colonial', id: '2', nombre: 'SULA Leche Entera 946ml', marca: 'Sula', codigoBarras: '7424142400093' });
    expect(emparejar([{ tienda: 'lacolonia', productos: [a] }, { tienda: 'colonial', productos: [b] }])).toHaveLength(2);
    const a2 = { ...a, codigoBarras: undefined };
    const b2 = { ...b, codigoBarras: undefined };
    expect(emparejar([{ tienda: 'lacolonia', productos: [a2] }, { tienda: 'colonial', productos: [b2] }])).toHaveLength(2);
    // Con código en un solo lado sí: la clave es ese código.
    const [g] = emparejar([{ tienda: 'lacolonia', productos: [a] }, { tienda: 'colonial', productos: [b2] }]);
    expect(g).toMatchObject({ clave: 'ean:7421000811367', coincidencia: 'probable' });
  });

  it('se puede apagar el parecido (solo código)', () => {
    const gs = emparejar(
      [
        { tienda: 'lacolonia', productos: parsearLaColonia(lcLeche) },
        { tienda: 'colonial', productos: parsearColonial(clLeche) },
      ],
      40,
      { difuso: false },
    );
    expect(gs.some((g) => g.coincidencia === 'probable')).toBe(false);
  });
});
