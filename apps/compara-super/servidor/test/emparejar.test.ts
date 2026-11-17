import { describe, expect, it } from 'vitest';
import type { Producto } from '../../precios/src/tipos';
import { parsearColonial, parsearLaColonia } from '../../precios/src/index';
import lacoloniaJson from '../../precios/test/fixtures/lacolonia-busqueda.json';
import colonialJson from '../../precios/test/fixtures/colonial-suggest.json';
import { normalizarEan13 } from '../src/ean';
import { claveDeProducto, eanDeClave, emparejar, reidentificar } from '../src/grupos';

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
