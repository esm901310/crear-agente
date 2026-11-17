import { describe, expect, it } from 'vitest';
import type { ResultadoTienda } from '../../precios/src/index';
import type { Producto } from '../../precios/src/tipos';
import { enParalelo, refrescarItems, type FuncionBuscar } from '../src/refrescar';
import type { ItemLista, Tienda } from '../src/tipos';

const T: Tienda[] = ['lacolonia', 'colonial'];

const prod = (p: Partial<Producto> & Pick<Producto, 'tienda' | 'id' | 'precio'>): Producto => ({
  nombre: 'Arroz',
  url: `https://x/${p.id}`,
  ...p,
});

/** Buscador falso: devuelve productos por tienda; registra las llamadas. */
function buscadorFalso(porTienda: Partial<Record<Tienda, Producto[] | 'error'>>) {
  const llamadas: Array<{ texto: string; tiendas: Tienda[] }> = [];
  const f: FuncionBuscar = async (texto, { tiendas, presupuesto }) => {
    llamadas.push({ texto, tiendas });
    const resultados: ResultadoTienda[] = tiendas.map((t) => {
      const v = porTienda[t];
      if (presupuesto) presupuesto.restante--;
      return v === 'error'
        ? { tienda: t, nombreTienda: t, ok: false, productos: [], error: { tipo: 'timeout', mensaje: '' }, ms: 1 }
        : { tienda: t, nombreTienda: t, ok: true, productos: v ?? [], ms: 1 };
    });
    return { resultados, consultasReales: tiendas.length };
  };
  return { f, llamadas };
}

const itemBase = (): ItemLista => ({
  id: '1',
  cantidad: 1,
  grupo: {
    clave: 'ean:0707517002083',
    nombre: 'Arroz Progreso',
    precios: {
      lacolonia: { productoId: '10', nombre: 'Arroz Progreso Blanco 1.75 Kg', precio: 60, url: 'https://www.lacolonia.com/a/p' },
      colonial: { productoId: '20', nombre: 'PROGRESO Arroz BlancoGranoLar1.75Kg', precio: 62, url: 'https://supercolonial.com/products/a' },
    },
  },
  sustitutos: {},
});

describe('refrescarItems', () => {
  it('actualiza precios por productoId y descubre la tienda nueva por código de barras', async () => {
    const item = itemBase();
    delete item.grupo.precios.colonial;
    const { f } = buscadorFalso({
      lacolonia: [prod({ tienda: 'lacolonia', id: '10', precio: 58, precioOferta: 55 })],
      colonial: [prod({ tienda: 'colonial', id: '77', precio: 61, codigoBarras: '707517002083' })],
    });
    const r = await refrescarItems([item], T, f, { pausaMs: 0 });
    expect(r.items[0].grupo.precios.lacolonia).toMatchObject({ productoId: '10', precio: 58, precioOferta: 55 });
    expect(r.items[0].grupo.precios.lacolonia?.desactualizado).toBeUndefined();
    expect(r.items[0].grupo.precios.colonial).toMatchObject({ productoId: '77', precio: 61 });
    expect(r.errores).toEqual({});
    expect(item.grupo.precios.lacolonia?.precio).toBe(60); // no modifica el original
  });

  it('si no lo encuentra conserva el precio guardado y lo marca desactualizado', async () => {
    const { f } = buscadorFalso({ lacolonia: [], colonial: 'error' });
    const r = await refrescarItems([itemBase()], T, f, { pausaMs: 0 });
    expect(r.items[0].grupo.precios.lacolonia).toMatchObject({ precio: 60, desactualizado: true });
    expect(r.items[0].grupo.precios.colonial).toMatchObject({ precio: 62, desactualizado: true });
    expect(r.errores.colonial).toMatch(/No respondió a tiempo/);
    expect(r.errores.lacolonia).toBeUndefined();
  });

  it('no repite búsquedas con el mismo texto y refresca sustitutos solo cuando se usan', async () => {
    const a = itemBase();
    const b = { ...itemBase(), id: '2' };
    delete b.grupo.precios.colonial;
    b.sustitutos = {
      colonial: { productoId: '30', nombre: 'Arroz Otro', precio: 40, url: 'https://supercolonial.com/products/o' },
      lacolonia: { productoId: '31', nombre: 'No usado', precio: 1, url: 'https://www.lacolonia.com/n/p' },
    };
    const { f, llamadas } = buscadorFalso({
      lacolonia: [prod({ tienda: 'lacolonia', id: '10', precio: 60 })],
      colonial: [prod({ tienda: 'colonial', id: '30', precio: 41 })],
    });
    const r = await refrescarItems([a, b], T, f, { pausaMs: 0 });
    expect(llamadas).toEqual([
      // En cada tienda se busca con el nombre original de esa tienda (sin repetir textos)...
      { texto: 'Arroz Progreso Blanco 1.75 Kg', tiendas: ['lacolonia'] },
      { texto: 'PROGRESO Arroz BlancoGranoLar1.75Kg', tiendas: ['colonial'] },
      // ...y donde aún no está: Colonial busca por código de barras (UPC de 12 dígitos).
      { texto: '707517002083', tiendas: ['colonial'] },
      { texto: 'Arroz Otro', tiendas: ['colonial'] },
    ]);
    expect(r.items[1].sustitutos.colonial).toMatchObject({ productoId: '30', precio: 41 });
    expect(r.items[1].sustitutos.lacolonia).toMatchObject({ precio: 1 }); // sin tocar
  });

  it('respeta el tope de consultas por comparación', async () => {
    const items = Array.from({ length: 5 }, (_, i) => {
      const item = { ...itemBase(), id: String(i) };
      item.grupo.precios.lacolonia!.nombre = `Producto ${i}`;
      item.grupo.precios.colonial!.nombre = `Producto ${i}`;
      return item;
    });
    let reales = 0;
    const f: FuncionBuscar = async (_texto, { tiendas, presupuesto }) => {
      const resultados: ResultadoTienda[] = tiendas.map((t) => {
        if (presupuesto!.restante <= 0) {
          return { tienda: t, nombreTienda: t, ok: false, productos: [], error: { tipo: 'limite', mensaje: '' }, ms: 0 };
        }
        presupuesto!.restante--;
        reales++;
        return { tienda: t, nombreTienda: t, ok: true, productos: [], ms: 0 };
      });
      return { resultados, consultasReales: 0 };
    };
    const r = await refrescarItems(items, T, f, { pausaMs: 0, maxConsultas: 4 });
    expect(reales).toBe(4);
    expect(r.items.every((i) => i.grupo.precios.lacolonia?.desactualizado)).toBe(true);
  });
});

describe('refrescarItems con grupos "probable"', () => {
  it('re-identifica en cada tienda por productoId aunque Colonial no traiga código de barras', async () => {
    const item: ItemLista = {
      id: '9',
      cantidad: 2,
      grupo: {
        clave: 'ean:7421000811367',
        coincidencia: 'probable',
        nombre: 'Leche Uht Sula Entera',
        precios: {
          lacolonia: { productoId: '369', nombre: 'Leche Uht Sula Entera 0.946 Lt', precio: 43.95, url: 'https://www.lacolonia.com/l/p' },
          colonial: { productoId: '10348551962916', nombre: 'SULA Leche Entera 946ml', precio: 45.49, url: 'https://supercolonial.com/products/l' },
        },
      },
      sustitutos: {},
    };
    const { f, llamadas } = buscadorFalso({
      lacolonia: [prod({ tienda: 'lacolonia', id: '369', precio: 44.5, codigoBarras: '7421000811367' })],
      colonial: [
        prod({ tienda: 'colonial', id: '10348495906084', precio: 30 }), // otro producto sin código
        prod({ tienda: 'colonial', id: '10348551962916', precio: 45.49, precioOferta: 43.29 }),
      ],
    });
    const r = await refrescarItems([item], T, f, { pausaMs: 0 });
    expect(r.items[0].grupo.coincidencia).toBe('probable');
    expect(r.items[0].grupo.precios.lacolonia).toMatchObject({ productoId: '369', precio: 44.5 });
    expect(r.items[0].grupo.precios.colonial).toMatchObject({ productoId: '10348551962916', precioOferta: 43.29 });
    expect(r.items[0].grupo.precios.colonial?.desactualizado).toBeUndefined();
    // Cada tienda con su nombre original, sin búsquedas extra por código.
    expect(llamadas.map((l) => l.texto)).toEqual(['Leche Uht Sula Entera 0.946 Lt', 'SULA Leche Entera 946ml']);
  });
});

describe('refrescarItems con nombres de grupo limpios', () => {
  it('una sola búsqueda si ambas tiendas usan el mismo texto', async () => {
    const item = itemBase();
    item.grupo.precios.lacolonia!.nombre = 'Arroz X';
    item.grupo.precios.colonial!.nombre = 'ARROZ x';
    const { f, llamadas } = buscadorFalso({ lacolonia: [], colonial: [] });
    await refrescarItems([item], T, f, { pausaMs: 0 });
    expect(llamadas).toEqual([{ texto: 'Arroz X', tiendas: T }]);
  });
});

describe('enParalelo', () => {
  it('nunca pasa del límite de tareas simultáneas y conserva el orden', async () => {
    let activas = 0;
    let maximo = 0;
    const r = await enParalelo([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      activas++;
      maximo = Math.max(maximo, activas);
      await new Promise((ok) => setTimeout(ok, 5));
      activas--;
      return n * 2;
    });
    expect(maximo).toBe(3);
    expect(r).toEqual([2, 4, 6, 8, 10, 12, 14]);
  });
});
