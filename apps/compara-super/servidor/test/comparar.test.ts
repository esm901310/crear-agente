import { describe, expect, it } from 'vitest';
import { calcularComparacion } from '../src/comparar';
import type { ItemLista, PrecioTienda, Tienda } from '../src/tipos';

const T: Tienda[] = ['lacolonia', 'colonial'];

const p = (precio: number, extra: Partial<PrecioTienda> = {}): PrecioTienda => ({
  productoId: 'p' + precio,
  nombre: 'x',
  precio,
  url: 'https://www.lacolonia.com/x/p',
  ...extra,
});

function item(
  id: string,
  precios: Partial<Record<Tienda, PrecioTienda>>,
  cantidad = 1,
  sustitutos: Partial<Record<Tienda, PrecioTienda>> = {},
): ItemLista {
  return { id, cantidad, grupo: { clave: 'k' + id, nombre: 'n' + id, precios }, sustitutos };
}

describe('calcularComparacion', () => {
  it('gana la completa más barata; ahorro contra la completa más cara; usa precio de oferta y cantidad', () => {
    const r = calcularComparacion(
      [
        item('a', { lacolonia: p(10.1), colonial: p(12) }, 3),
        item('b', { lacolonia: p(50, { precioOferta: 40 }), colonial: p(45) }),
      ],
      T,
    );
    expect(r.tiendas).toEqual([
      { tienda: 'lacolonia', total: 70.3, completa: true, faltantes: [], error: null },
      { tienda: 'colonial', total: 81, completa: true, faltantes: [], error: null },
    ]);
    expect(r.ganador).toBe('lacolonia');
    expect(r.ahorro).toBe(10.7);
    expect(r.empate).toBe(false);
    expect(r.comparacionParcial).toBeNull();
  });

  it('una tienda incompleta no puede ganar aunque su total sea menor', () => {
    const r = calcularComparacion(
      [item('a', { lacolonia: p(10), colonial: p(12) }), item('b', { colonial: p(30) })],
      T,
    );
    expect(r.tiendas[0]).toMatchObject({ tienda: 'lacolonia', total: 10, completa: false, faltantes: ['b'] });
    expect(r.ganador).toBe('colonial');
    expect(r.ahorro).toBeNull(); // es la única completa
  });

  it('un sustituto completa la tienda', () => {
    const r = calcularComparacion(
      [item('a', { lacolonia: p(10), colonial: p(12) }), item('b', { colonial: p(30) }, 2, { lacolonia: p(20) })],
      T,
    );
    expect(r.tiendas[0]).toMatchObject({ total: 50, completa: true, faltantes: [] });
    expect(r.ganador).toBe('lacolonia');
    expect(r.ahorro).toBe(22);
  });

  it('producto marcado como no disponible cuenta como faltante (salvo que haya sustituto)', () => {
    const r = calcularComparacion([item('a', { lacolonia: p(10, { disponible: false }), colonial: p(12) })], T);
    expect(r.tiendas[0]).toMatchObject({ completa: false, faltantes: ['a'], total: 0 });
    const r2 = calcularComparacion(
      [item('a', { lacolonia: p(10, { disponible: false }), colonial: p(12) }, 1, { lacolonia: p(11) })],
      T,
    );
    expect(r2.tiendas[0]).toMatchObject({ completa: true, total: 11 });
    expect(r2.ganador).toBe('lacolonia');
  });

  it('empate exacto (al centavo)', () => {
    const r = calcularComparacion([item('a', { lacolonia: p(0.1), colonial: p(0.05) }, 1), item('b', { lacolonia: p(0.2), colonial: p(0.25) })], T);
    expect(r.empate).toBe(true);
    expect(r.ganador).toBe('lacolonia'); // el primero en el orden de TIENDAS_ACTIVAS
    expect(r.ahorro).toBeNull();
  });

  it('ninguna completa → comparación parcial solo con los productos que están en todas', () => {
    const r = calcularComparacion(
      [
        item('a', { lacolonia: p(10), colonial: p(12) }, 2),
        item('b', { lacolonia: p(5) }),
        item('c', { colonial: p(7) }),
      ],
      T,
    );
    expect(r.ganador).toBeNull();
    expect(r.ahorro).toBeNull();
    expect(r.comparacionParcial).toEqual({ tiendas: { lacolonia: 20, colonial: 24 }, itemsComparados: 1 });
    expect(r.tiendas[0].faltantes).toEqual(['c']);
    expect(r.tiendas[1].faltantes).toEqual(['b']);
  });

  it('tienda con error no compite; la otra gana sola', () => {
    const r = calcularComparacion([item('a', { lacolonia: p(10), colonial: p(5) })], T, {
      colonial: 'No respondió a tiempo',
    });
    expect(r.tiendas[1].error).toBe('No respondió a tiempo');
    expect(r.ganador).toBe('lacolonia');
    expect(r.ahorro).toBeNull();
  });

  it('todas con error → sin ganador ni parcial', () => {
    const r = calcularComparacion([item('a', { lacolonia: p(10) })], T, { lacolonia: 'x', colonial: 'y' });
    expect(r.ganador).toBeNull();
    expect(r.comparacionParcial).toBeNull();
  });

  it('lista vacía → sin ganador', () => {
    const r = calcularComparacion([], T);
    expect(r.ganador).toBeNull();
    expect(r.comparacionParcial).toBeNull();
    expect(r.tiendas.every((t) => t.total === 0 && t.completa)).toBe(true);
  });

  it('redondeo a centavos sin errores de coma flotante', () => {
    const r = calcularComparacion([item('a', { lacolonia: p(0.1), colonial: p(0.3) }, 3)], T);
    expect(r.tiendas[0].total).toBe(0.3);
    expect(r.ahorro).toBe(0.6);
  });
});
