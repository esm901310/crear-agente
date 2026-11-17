import { describe, expect, it } from 'vitest';
import { clasificarCorte, datosCorte, precioPorLibra, puntajePar, ventaPorPeso } from '../src/cortes';
import { parsearColonial } from '../src/tiendas/colonial';
import { parsearLaColonia } from '../src/tiendas/lacolonia';
import type { Producto } from '../src/tipos';
import lc from './fixtures/lacolonia-carnes.json';
import cl from './fixtures/colonial-carnes.json';

type Consulta = Exclude<keyof typeof lc, '_nota'>;
const todos: Producto[] = (Object.keys(lc).filter((k) => k !== '_nota') as Consulta[]).flatMap((q) => [
  ...parsearLaColonia(lc[q]),
  ...parsearColonial(cl[q]),
]);
const prod = (nombre: string) => {
  const p = todos.find((x) => x.nombre === nombre);
  if (!p) throw new Error(`No está en las fixtures: ${nombre}`);
  return p;
};
const clase = (nombre: string) => clasificarCorte(prod(nombre))?.clave;
/** ¿Se pueden emparejar (misma clase y precio por libra razonable)? */
const emparejables = (a: string, b: string) => puntajePar(datosCorte(prod(a))!, datosCorte(prod(b))!) !== undefined;

describe('adaptadores: datos para el modo carnes', () => {
  it('La Colonia trae categoría y, si la dice, la unidad de venta', () => {
    const p = prod('Piernitas De Pollo Rey Fresca Granel X Lb');
    expect(p.unidadVenta).toEqual({ unidad: 'lb', multiplicador: 1 });
    expect(p.categoria).toBe('/Supermercado/Carnes y Aves/Pollo/');
    expect(prod('Chuleta De Cerdo X Lb').unidadVenta).toBeUndefined(); // viene "un"
  });
  it('Colonial trae tipo y etiquetas como categoría', () => {
    expect(prod('Chuleta de Cerdo Popular x Lb').categoria).toBe('Carnes y Refrigerados | carne, carnes, Cerdo, proteina');
  });
});

describe('ventaPorPeso / precioPorLibra', () => {
  it('detecta "x Lb", "Lb", "Libra de", "XLB" pegado, "Lbr", "Libr"', () => {
    for (const n of [
      'Chuleta De Cerdo X Lb',
      'Costilla De Res Prime Lb',
      'Libra de Costilla de Res',
      'PROGCARNE ChuletaAhumadaXLB',
      'COLONIAL Chuleta Cerdo PremXlb',
      'CERDO Carne MolidaPremiun Lbr',
      'SM PESCADO Tilapia Rojo X Libr',
      'SM CABEZA Pescado TilapiaxLB',
    ]) {
      expect(ventaPorPeso(prod(n)), n).toMatchObject({ fuente: 'nombre', factorLibra: 1 });
    }
  });
  it('La Colonia sin "x Lb": usa el código de balanza + categoría de carne', () => {
    expect(ventaPorPeso(prod('Pechuga de Pollo Deshuesada fresca'))?.fuente).toBe('balanza');
    expect(ventaPorPeso(prod('Pechuga de Pollo Fresca con Hueso'))?.fuente).toBe('balanza');
    // Colonial también (código en el nombre de la imagen).
    expect(ventaPorPeso(prod('REY Pechuga Desh Bandeja'))?.fuente).toBe('balanza');
  });
  it('dato de la tienda (measurementUnit) y conversión de kg a libra', () => {
    expect(ventaPorPeso(prod('Piernitas De Pollo Rey Fresca Granel X Lb'))?.fuente).toBe('tienda');
    const porKg = { nombre: 'Lomo de Cerdo x Kg', precio: 220.46, categoria: '/Supermercado/Carnes y Aves/Cerdo/' };
    expect(precioPorLibra(porKg)).toEqual({ precio: 100 });
    const vtexKg = { ...porKg, nombre: 'Lomo de Cerdo', unidadVenta: { unidad: 'kg' as const, multiplicador: 0.5 } };
    expect(precioPorLibra(vtexKg)).toEqual({ precio: 200 }); // 220.46 por medio kilo = 200 por libra
  });
  it('oferta también por libra', () => {
    expect(precioPorLibra(prod('Chuleta De Cerdo X Lb'))).toEqual({ precio: 46, precioOferta: 41.86 });
  });
  it('bandeja de "1 Lb" con código de balanza sí; empacados de peso fijo no', () => {
    expect(ventaPorPeso(prod('Muslo De Pollo Rey En Bandeja Deshuesada 1 Lb'))).toMatchObject({ factorLibra: 1 });
    for (const n of [
      'Chuleta De Cerdo Santa Lucía Deshuesda 454Gr',
      'Progcarne Chuleta Ahumada 454gr',
      'DELICIA Carne Molida 454 Grs',
      'Filete De Tilapia Regal Spring Premium 1Lb', // 1 lb pero con EAN real (empacado)
      'Pechuga Con Ala Pollo Rey Separadito 2.27 Kg',
    ]) {
      expect(ventaPorPeso(prod(n)), n).toBeUndefined();
    }
  });
  it('por unidad, embutidos, rostizados y preparados no entran', () => {
    for (const n of [
      'Pollo Entero Norteño Fresco X Unidad',
      'Pechuga De Pollo Rey Deshuesada Fresca Granel X Unidad',
      'Pechuga de Pollo Mezquite Kretschmar x Lb', // categoría Embutidos
      'COLONIAL Pasta de Pollo X Lbs', // "Productos Colonial"
      'COLONIAL Carne Molida Prep Lb',
      'Pollo Rostizado Unidad',
    ]) {
      expect(ventaPorPeso(prod(n)), n).toBeUndefined();
    }
  });
});

describe('clasificarCorte', () => {
  it('animal + corte + atributos, con nombre legible', () => {
    expect(clasificarCorte(prod('Chuleta De Cerdo X Lb'))).toMatchObject({ clave: 'cerdo|chuleta|', nombre: 'Chuleta de cerdo', calidad: 1 });
    expect(clasificarCorte(prod('Chuleta de Cerdo Popular x Lb'))).toMatchObject({ clave: 'cerdo|chuleta|', calidad: 0 });
    expect(clasificarCorte(prod('Chuleta De Lomo De Cerdo X Lb'))).toMatchObject({ clave: 'cerdo|chuleta|lomo', nombre: 'Chuleta de lomo de cerdo' });
    expect(clasificarCorte(prod('REY Pechuga Deshuesad Fresca X LB'))).toMatchObject({
      clave: 'pollo|pechuga|deshuesada',
      nombre: 'Pechuga de pollo deshuesada',
      marca: 'rey',
    });
    expect(clasificarCorte(prod('NORTEÑO Pechuga-Ala XLb'))?.nombre).toBe('Pechuga de pollo con ala');
    expect(clasificarCorte(prod('Carne Molida De Cerdo X Lb'))?.nombre).toBe('Carne molida de cerdo');
    expect(clasificarCorte(prod('Filete De Tilapia Nacional X Lb'))?.nombre).toBe('Filete de tilapia');
    expect(clasificarCorte(prod('SM PESCADO Tilapia Rojo X Libr'))?.nombre).toBe('Tilapia entera roja');
    expect(clasificarCorte(prod('CORTIJO Pollo Fresco Entero Lb'))?.nombre).toBe('Pollo entero');
  });
  it('calidad: popular/económica < normal < especial/super < premium/prime', () => {
    expect(clasificarCorte(prod('Carne Molida Económica x Lb'))?.calidad).toBe(0);
    expect(clasificarCorte(prod('RES Costilla X Libra'))?.calidad).toBe(1);
    expect(clasificarCorte(prod('RES Costilla Super X Libra'))?.calidad).toBe(2);
    expect(clasificarCorte(prod('Costilla De Res Prime Lb'))?.calidad).toBe(3);
  });
  it('la marca del súper ("La Colonia", "Selecta Fresh", "COLONIAL") no cuenta como marca', () => {
    expect(clasificarCorte(prod('Costilla De Res Prime Lb'))?.marca).toBeUndefined();
    expect(clasificarCorte(prod('COLONIAL Chuleta Cerdo PremXlb'))?.marca).toBeUndefined();
    expect(clasificarCorte(prod('Pechuga de Pollo Deshuesada fresca'))?.marca).toBe('norteno');
  });
  it('el animal sale de la categoría si el nombre no lo dice', () => {
    const p = { nombre: 'Chuleta Popular x Lb', categoria: 'Carnes y Refrigerados | carne, Cerdo' };
    expect(clasificarCorte(p)?.clave).toBe('cerdo|chuleta|');
  });
});

describe('casos que SÍ se emparejan', () => {
  it.each([
    ['Chuleta De Cerdo X Lb', 'Chuleta de Cerdo Popular x Lb'],
    ['Chuleta De Lomo De Cerdo X Lb', 'CHULETA Lomo De Cerdo Ent Premi X Lb'],
    ['Chuleta Ahumada de Cerdo  x Lb', 'CERDO Chuleta Ahumada X Lb'],
    ['Pechuga de Pollo Deshuesada fresca', 'NORTENO Pechuga Deshuesada Fresca X LB'],
    ['Pechuga de Pollo Deshuesada fresca', 'REY Pechuga Desh Bandeja'],
    ['Libra de Costilla de Res', 'RES Costilla X Libra'],
    ['Costilla De Res Premium X Lb', 'RES Costilla Super X Libra'],
    ['Carne Molida Popular de Res x Lb', 'RES Molida Especial X Libra'],
    ['Cortes de Carne de Res para Bistec x Lb', 'RES Bistec Especial X Libra'],
    ['Filete De Tilapia Nacional X Lb', 'FILETE Tilapia Criolla Fresca X Lb'],
  ])('%s ↔ %s', (a, b) => {
    expect(emparejables(a, b)).toBe(true);
  });
});

describe('casos que NO se emparejan', () => {
  it.each([
    ['Pechuga de Pollo Fresca con Hueso', 'NORTENO Pechuga Deshuesada Fresca X LB'], // con hueso ↔ deshuesada
    ['Chuleta Ahumada de Cerdo  x Lb', 'Chuleta de Cerdo Popular x Lb'], // ahumada ↔ normal
    ['Chuleta De Cerdo X Lb', 'CERDO Chuleta Ahumada X Lb'],
    ['Carne Molida Popular de Res x Lb', 'CERDO Carne MolidaPremiun Lbr'], // molida de res ↔ de cerdo
    ['Carne Molida De Cerdo X Lb', 'RES Molida Especial X Libra'],
    ['Chuleta De Lomo De Cerdo X Lb', 'Chuleta de Cerdo Popular x Lb'], // chuleta de lomo ↔ chuleta común
    ['Pechuga de Pollo Deshuesada fresca', 'CORTIJO Pollo Fresco Entero Lb'], // pollo entero ↔ pechuga
    ['Pechuga de Pollo Deshuesada fresca', 'NORTEÑO Pechuga-Ala XLb'], // deshuesada ↔ con ala
    ['Libra de Costilla de Res', 'COSTILLA de Cerdo x Libra'], // res ↔ cerdo
    ['Filete De Tilapia Nacional X Lb', 'SM FILETE TilapiaCongelad XLB'], // fresco ↔ congelado
    ['Filete De Tilapia Nacional X Lb', 'SM FILETE Tilapia Trocito XLB'], // filete ↔ filete en trocitos
    ['Cortes de Carne de Res para Bistec x Lb', 'RES Tajo Molido X Libra'],
  ])('%s ↔ %s', (a, b) => {
    expect(emparejables(a, b)).toBe(false);
  });

  it('carne fresca ↔ empacada de peso fijo: la empacada no entra al modo carnes', () => {
    expect(datosCorte(prod('Chuleta De Cerdo Santa Lucía Deshuesda 454Gr'))).toBeUndefined();
    expect(datosCorte(prod('Progcarne Chuleta Ahumada 454gr'))).toBeUndefined();
  });

  it('seguro de precio: más del doble por libra no se une', () => {
    const a = datosCorte({ ...prod('Chuleta De Cerdo X Lb'), precioOferta: undefined, precio: 40 })!;
    const b = datosCorte({ ...prod('Chuleta de Cerdo Popular x Lb'), precio: 101 })!;
    expect(puntajePar(a, b)).toBeUndefined();
  });
});

describe('puntajePar elige la opción más parecida', () => {
  const d = (n: string) => datosCorte(prod(n))!;
  it('calidad parecida primero, luego precio por libra', () => {
    const lcNormal = d('Chuleta De Cerdo X Lb'); // normal, L41.86
    const popular = puntajePar(lcNormal, d('Chuleta de Cerdo Popular x Lb'))!; // popular, L55.99
    const especial = puntajePar(lcNormal, d('Progcarne Chuleta Cerdo Espec xlb'))!; // especial, L82.99
    const premium = puntajePar(d('Chuleta de Cerdo Popular x Lb'), d('COLONIAL Chuleta Cerdo PremXlb'))!; // popular ↔ premium
    expect(popular).toBeLessThan(especial); // misma distancia de calidad, precio más cercano
    expect(especial).toBeLessThan(premium); // distancia de calidad 3
    // Normal L41.86 ↔ premium L86.99: más del doble por libra.
    expect(puntajePar(lcNormal, d('COLONIAL Chuleta Cerdo PremXlb'))).toBeUndefined();
  });
  it('misma marca gana a igual calidad', () => {
    const lcNorteno = d('Pechuga de Pollo Deshuesada fresca'); // Norteño, L83.95
    expect(puntajePar(lcNorteno, d('NORTENO Pechuga Deshuesada Bandeja X LB'))!).toBeLessThan(
      puntajePar(lcNorteno, d('REY Pechuga Deshuesad Fresca X LB'))!, // Rey, L86.99 (más cerca en precio)
    );
  });
});
