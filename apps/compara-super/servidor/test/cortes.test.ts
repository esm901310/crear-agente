/** Modo carnes por libra en el servidor: grupos 'corte', validación, comparar y refrescar. */
import { beforeEach, describe, expect, it } from 'vitest';
import { parsearColonial, parsearLaColonia, type ResultadoTienda } from '../../precios/src/index';
import type { Producto } from '../../precios/src/tipos';
import lcCarnes from '../../precios/test/fixtures/lacolonia-carnes.json';
import clCarnes from '../../precios/test/fixtures/colonial-carnes.json';
import { calcularComparacion } from '../src/comparar';
import { normalizarEan13 } from '../src/ean';
import { claveDeProducto, emparejar } from '../src/grupos';
import worker from '../src/index';
import { refrescarItems, type FuncionBuscar } from '../src/refrescar';
import type { Env, Grupo, ItemLista, Tienda } from '../src/tipos';
import { ErrorValidacion, validarCantidad, validarGrupo } from '../src/validar';
import { crearD1 } from './d1-falsa';

type Consulta = Exclude<keyof typeof lcCarnes, '_nota'>;
const T: Tienda[] = ['lacolonia', 'colonial'];

function resultados(q: Consulta) {
  return [
    { tienda: 'lacolonia' as const, productos: parsearLaColonia(lcCarnes[q]) },
    { tienda: 'colonial' as const, productos: parsearColonial(clCarnes[q]) },
  ];
}
/** Pares de corte como "nombre La Colonia ↔ nombre Colonial". */
function pares(q: Consulta): string[] {
  return emparejar(resultados(q), 40)
    .filter((g) => g.coincidencia === 'corte')
    .map((g) => `${g.precios.lacolonia!.nombre} ↔ ${g.precios.colonial!.nombre}`)
    .sort();
}

describe('códigos de balanza', () => {
  it('los EAN de circulación restringida ("2…" y UPC "02…") no sirven para emparejar', () => {
    expect(normalizarEan13('2020006000000')).toBeUndefined(); // verificador válido, pero de balanza
    expect(normalizarEan13('2051000000000')).toBeUndefined();
    expect(normalizarEan13('7421000917106')).toBe('7421000917106');
    const p = parsearLaColonia(lcCarnes['carne molida']).find((x) => x.id === '3213')!;
    expect(claveDeProducto(p)).toBe('lacolonia:3213');
  });
});

describe('emparejar: grupos "corte" con respuestas reales', () => {
  it('chuleta de cerdo', () => {
    expect(pares('chuleta de cerdo')).toEqual([
      'Chuleta Ahumada de Cerdo  x Lb ↔ CERDO Chuleta Ahumada X Lb',
      'Chuleta De Cerdo X Lb ↔ Chuleta de Cerdo Popular x Lb',
      'Chuleta De Lomo De Cerdo X Lb ↔ CHULETA Lomo De Cerdo Ent Premi X Lb',
    ]);
  });
  it('costilla de res: calidad parecida primero', () => {
    expect(pares('costilla de res')).toEqual([
      'Costilla De Res Premium X Lb ↔ RES Costilla Super X Libra',
      'Costilla De Res Prime Lb ↔ RES Costilla Especial X Libra',
      'Libra de Costilla de Res ↔ RES Costilla X Libra',
    ]);
  });
  it('pechuga de pollo: deshuesada con deshuesada (misma marca), nunca con hueso', () => {
    const p = pares('pechuga de pollo');
    expect(p).toEqual(['Pechuga de Pollo Deshuesada fresca ↔ NORTENO Pechuga Deshuesada Fresca X LB']);
    expect(p.join()).not.toContain('con Hueso');
  });
  it('carne molida: de res con de res, de cerdo con de cerdo; nunca con empacada', () => {
    expect(pares('carne molida')).toEqual([
      'Carne Molida De Cerdo X Lb ↔ CERDO Carne MolidaPremiun Lbr',
      'Carne Molida Popular de Res x Lb ↔ RES Molida Especial X Libra',
    ]);
  });
  it('pollo: pollo entero de Colonial no se une con la pechuga ni con el pollo "x Unidad"', () => {
    expect(pares('pollo')).toEqual([]);
  });

  it('forma del grupo: clave, corte, presentacion "por libra" y precios POR LIBRA', () => {
    const g = emparejar(resultados('chuleta de cerdo'), 40).find((x) => x.clave === 'corte:lacolonia:6382')!;
    expect(g).toMatchObject({
      coincidencia: 'corte',
      corte: 'Chuleta de cerdo',
      presentacion: 'por libra',
      nombre: 'Chuleta De Cerdo',
    });
    expect(g.marca).toBeUndefined(); // marcas distintas
    expect(g.precios.lacolonia).toMatchObject({ productoId: '6382', precio: 46, precioOferta: 41.86 });
    expect(g.precios.colonial).toMatchObject({ productoId: '10348498845988', precio: 55.99 });
    // El grupo pasa la validación de la app → servidor.
    expect(validarGrupo(JSON.parse(JSON.stringify(g)), T)).toEqual(g);
  });

  it('fresco por libra sin pareja: queda solo en su tienda, con corte y "por libra" (si el nombre lo confirma)', () => {
    const molida = emparejar(resultados('carne molida'), 40).find((g) => g.clave === 'lacolonia:6392')!;
    expect(molida).toMatchObject({ corte: 'Carne molida de res', presentacion: 'por libra', nombre: 'Carne Molida Económica' });
    expect(molida.coincidencia).toBeUndefined();
    expect(validarGrupo(JSON.parse(JSON.stringify(molida)), T)).toEqual(molida);
    // Por libra solo por código de balanza (el nombre no dice "lb"): sin pareja queda como producto normal.
    const gs = emparejar(resultados('pechuga de pollo'), 40);
    const conHueso = gs.find((g) => g.clave === 'lacolonia:6703')!;
    expect(conHueso.presentacion).toBeUndefined();
    expect(conHueso.corte).toBeUndefined();
    // Un empacado de peso fijo sigue normal.
    const empacado = gs.find((g) => g.precios.lacolonia?.nombre === 'Trocitos De Pechuga Rey Crispy Empanizado 400 Gr')!;
    expect(empacado.corte).toBeUndefined();
    expect(empacado.presentacion).toBe('400 g');
  });

  it('kg → libra: el precio del grupo queda por libra', () => {
    const lc: Producto = {
      tienda: 'lacolonia', id: '1', nombre: 'Chuleta De Cerdo X Kg', precio: 110.23, url: 'https://www.lacolonia.com/c/p',
      categoria: '/Supermercado/Carnes y Aves/Cerdo/',
    };
    const cl: Producto = {
      tienda: 'colonial', id: '2', nombre: 'Chuleta de Cerdo x Lb', precio: 52, url: 'https://supercolonial.com/products/c',
      categoria: 'Carnes y Refrigerados | carne, Cerdo',
    };
    const [g] = emparejar([{ tienda: 'lacolonia', productos: [lc] }, { tienda: 'colonial', productos: [cl] }]);
    expect(g.coincidencia).toBe('corte');
    expect(g.precios.lacolonia!.precio).toBe(50);
  });

  it('no rompe grupos por código: un producto ya unido por EAN no se usa para corte', () => {
    const base = { categoria: '/Supermercado/Carnes y Aves/Cerdo/', url: 'https://www.lacolonia.com/c/p' };
    const lc1: Producto = { ...base, tienda: 'lacolonia', id: '1', nombre: 'Chuleta de Cerdo x Lb', precio: 50, codigoBarras: '7421000917106' };
    const cl1: Producto = { ...base, tienda: 'colonial', id: '9', nombre: 'Chuleta Cerdo Especial x Lb', precio: 51, codigoBarras: '7421000917106' };
    const cl2: Producto = { ...base, tienda: 'colonial', id: '8', nombre: 'Chuleta Cerdo x Lb', precio: 50 };
    const gs = emparejar([{ tienda: 'lacolonia', productos: [lc1] }, { tienda: 'colonial', productos: [cl1, cl2] }]);
    expect(gs.find((g) => g.clave === 'ean:7421000917106')?.coincidencia).toBe('codigo');
    expect(gs.some((g) => g.coincidencia === 'corte')).toBe(false);
  });
});

describe('validar', () => {
  const grupoCorte = (): Grupo => ({
    clave: 'corte:lacolonia:6382',
    nombre: 'Chuleta De Cerdo',
    coincidencia: 'corte',
    corte: 'Chuleta de cerdo',
    presentacion: 'por libra',
    precios: {
      lacolonia: { productoId: '6382', nombre: 'Chuleta De Cerdo X Lb', precio: 46, precioOferta: 41.86, url: 'https://www.lacolonia.com/chuleta-de-cerdo-lb/p' },
      colonial: { productoId: '10348498845988', nombre: 'Chuleta de Cerdo Popular x Lb', precio: 55.99, url: 'https://supercolonial.com/products/chuleta' },
    },
  });
  it('acepta "corte" y conserva `corte`', () => {
    expect(validarGrupo(grupoCorte(), T)).toEqual(grupoCorte());
  });
  it('rechaza claves "corte:" incoherentes', () => {
    const otraId = { ...grupoCorte(), clave: 'corte:lacolonia:999' };
    const unaTienda = grupoCorte();
    delete unaTienda.precios.colonial;
    const sinCoincidencia = { ...grupoCorte(), coincidencia: 'probable' };
    for (const g of [otraId, unaTienda, sinCoincidencia]) expect(() => validarGrupo(g, T)).toThrow(ErrorValidacion);
  });
  it('"coincidencia: corte" sin clave "corte:" se ignora; `corte` largo se rechaza', () => {
    const g = { ...grupoCorte(), clave: 'ean:7421000917106', presentacion: '1 lb' };
    const v = validarGrupo(g, T);
    expect(v.coincidencia).toBeUndefined();
    expect(v.corte).toBeUndefined();
    expect(() => validarGrupo({ ...grupoCorte(), corte: 'x'.repeat(81) }, T)).toThrow(ErrorValidacion);
  });
  it('"por libra" que manda la app sin clave "corte:" solo vale si el servidor lo confirma', () => {
    const confirmable = {
      clave: 'colonial:1', nombre: 'Costilla', presentacion: 'por libra', corte: 'Costilla de res',
      precios: { colonial: { productoId: '1', nombre: 'RES Costilla X Libra', precio: 99.99, url: 'https://supercolonial.com/products/c' } },
    };
    expect(validarGrupo(confirmable, T)).toMatchObject({ presentacion: 'por libra', corte: 'Costilla de res' });
    // Arroz "por libra", o carne sin "lb" en el nombre: se quitan presentacion y corte.
    for (const nombre of ['PROGRESO Arroz Blanco', 'Pechuga de Pollo Deshuesada fresca', 'Pollo Entero c/u']) {
      const g = validarGrupo({ ...confirmable, precios: { colonial: { ...confirmable.precios.colonial, nombre } } }, T);
      expect(g.presentacion, nombre).toBeUndefined();
      expect(g.corte, nombre).toBeUndefined();
    }
  });

  it('cantidad: medias libras solo en grupos corte', () => {
    expect(validarCantidad(0.5, 'cantidad', true)).toBe(0.5);
    expect(validarCantidad(2.5, 'cantidad', true)).toBe(2.5);
    expect(validarCantidad(99, 'cantidad', true)).toBe(99);
    for (const v of [0, 0.25, 1.3, 99.5, '1']) expect(() => validarCantidad(v, 'cantidad', true)).toThrow(ErrorValidacion);
    expect(() => validarCantidad(1.5)).toThrow(ErrorValidacion);
  });
});

const itemCorte = (cantidad = 1): ItemLista => ({
  id: 'a',
  cantidad,
  grupo: {
    clave: 'corte:lacolonia:6382',
    nombre: 'Chuleta De Cerdo',
    coincidencia: 'corte',
    corte: 'Chuleta de cerdo',
    presentacion: 'por libra',
    precios: {
      lacolonia: { productoId: '6382', nombre: 'Chuleta De Cerdo X Lb', precio: 46, precioOferta: 41.86, url: 'https://www.lacolonia.com/a/p' },
      colonial: { productoId: '10348498845988', nombre: 'Chuleta de Cerdo Popular x Lb', precio: 55.99, url: 'https://supercolonial.com/products/a' },
    },
  },
  sustitutos: {},
});

describe('comparar: grupos corte', () => {
  it('cantidad en medias libras, redondeo al centavo por línea', () => {
    const r = calcularComparacion([itemCorte(1.5)], T);
    // 41.86 × 1.5 = 62.79; 55.99 × 1.5 = 83.985 → 83.99
    expect(r.tiendas.map((t) => t.total)).toEqual([62.79, 83.99]);
    expect(r.ganador).toBe('lacolonia');
    expect(r.ahorro).toBe(21.2);
  });
  it('el sustituto elegido MANDA sobre el original (solo en grupos corte)', () => {
    const item = itemCorte(2);
    item.sustitutos.colonial = { productoId: '10495000477988', nombre: 'Progcarne Chuleta Cerdo Espec xlb', precio: 82.99, url: 'https://supercolonial.com/products/b' };
    expect(calcularComparacion([item], T).tiendas[1].total).toBe(165.98);
    // En un grupo normal sigue mandando el original.
    const normal: ItemLista = { ...item, grupo: { ...item.grupo, clave: 'ean:7421000917106', coincidencia: 'codigo', presentacion: '1 lb' } };
    expect(calcularComparacion([normal], T).tiendas[1].total).toBe(111.98);
    // Sustituto no disponible: vuelve al original.
    item.sustitutos.colonial.disponible = false;
    expect(calcularComparacion([item], T).tiendas[1].total).toBe(111.98);
  });
});

describe('refrescar: grupos corte', () => {
  function buscador(porTienda: Partial<Record<Tienda, Producto[]>>) {
    const llamadas: Array<{ texto: string; tiendas: Tienda[] }> = [];
    const f: FuncionBuscar = async (texto, { tiendas }) => {
      llamadas.push({ texto, tiendas });
      const rs: ResultadoTienda[] = tiendas.map((t) => ({ tienda: t, nombreTienda: t, ok: true, productos: porTienda[t] ?? [], ms: 1 }));
      return { resultados: rs, consultasReales: tiendas.length };
    };
    return { f, llamadas };
  }
  const lc = parsearLaColonia(lcCarnes['chuleta de cerdo']);
  const cl = parsearColonial(clCarnes['chuleta de cerdo']);

  it('re-identifica por productoId y deja los precios por libra (kg → lb)', async () => {
    const enKg = lc.map((p) => (p.id === '6382' ? { ...p, nombre: 'Chuleta De Cerdo X Kg', precio: 110.23, precioOferta: undefined } : p));
    const { f } = buscador({ lacolonia: enKg, colonial: cl });
    const r = await refrescarItems([itemCorte()], T, f, { pausaMs: 0 });
    expect(r.items[0].grupo.precios.lacolonia).toMatchObject({ productoId: '6382', precio: 50 });
    expect(r.items[0].grupo.precios.lacolonia!.precioOferta).toBeUndefined();
    expect(r.items[0].grupo.precios.colonial).toMatchObject({ precio: 55.99 });
    expect(r.items[0].grupo.coincidencia).toBe('corte');
  });
  it('si el producto ya no se reconoce por peso, conserva el precio guardado (desactualizado)', async () => {
    const empacado = lc.map((p) => (p.id === '6382' ? { ...p, nombre: 'Chuleta De Cerdo 454 g', precio: 99 } : p));
    const { f } = buscador({ lacolonia: empacado, colonial: cl });
    const r = await refrescarItems([itemCorte()], T, f, { pausaMs: 0 });
    expect(r.items[0].grupo.precios.lacolonia).toMatchObject({ precio: 46, desactualizado: true });
  });
  it('refresca el sustituto aunque el original sirva', async () => {
    const item = itemCorte();
    item.sustitutos.colonial = { productoId: '10495000477988', nombre: 'Progcarne Chuleta Cerdo Espec xlb', precio: 80, url: 'https://supercolonial.com/products/b' };
    const { f, llamadas } = buscador({ lacolonia: lc, colonial: cl });
    const r = await refrescarItems([item], T, f, { pausaMs: 0 });
    expect(llamadas.some((l) => l.texto === 'Progcarne Chuleta Cerdo Espec xlb')).toBe(true);
    expect(r.items[0].sustitutos.colonial).toMatchObject({ productoId: '10495000477988', precio: 82.99 });
    expect(r.items[0].sustitutos.colonial!.desactualizado).toBeUndefined();
  });
});

describe('API: lista con medias libras', () => {
  let env: Env;
  beforeEach(async () => {
    env = { DB: await crearD1(), TIENDAS_ACTIVAS: 'lacolonia,colonial' };
  });
  const pedir = (ruta: string, op: { metodo?: string; cuerpo?: unknown; cookie?: string } = {}) =>
    worker.fetch(
      new Request(`http://localhost/api${ruta}`, {
        method: op.metodo ?? (op.cuerpo !== undefined ? 'POST' : 'GET'),
        headers: {
          'CF-Connecting-IP': '200.1.1.1',
          ...(op.cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(op.cookie ? { Cookie: op.cookie } : {}),
        },
        body: op.cuerpo !== undefined ? JSON.stringify(op.cuerpo) : undefined,
      }),
      env,
    );

  it('agrega un grupo corte con 0.5 lb, suma y cambia a 2.5; un grupo normal sigue entero', async () => {
    const reg = await pedir('/auth/registro', { cuerpo: { correo: 'ana@ejemplo.com', contrasena: 'clave-segura-1' } });
    const cookie = (reg.headers.get('Set-Cookie') ?? '').split(';')[0];
    const grupo = itemCorte().grupo;

    const a = await pedir('/lista/items', { cuerpo: { grupo, cantidad: 0.5 }, cookie });
    expect(a.status).toBe(201);
    const { item } = (await a.json()) as { item: ItemLista };
    expect(item.cantidad).toBe(0.5);
    expect(item.grupo).toMatchObject({ coincidencia: 'corte', corte: 'Chuleta de cerdo', presentacion: 'por libra' });

    const b = (await (await pedir('/lista/items', { cuerpo: { grupo, cantidad: 1.5 }, cookie })).json()) as { item: ItemLista };
    expect(b.item.cantidad).toBe(2);

    const c = await pedir(`/lista/items/${item.id}`, { metodo: 'PATCH', cuerpo: { cantidad: 2.5 }, cookie });
    expect(((await c.json()) as { item: ItemLista }).item.cantidad).toBe(2.5);
    expect((await pedir(`/lista/items/${item.id}`, { metodo: 'PATCH', cuerpo: { cantidad: 0.3 }, cookie })).status).toBe(400);

    // Fresco por libra sin pareja (una tienda, presentacion "por libra"): también medias libras.
    const solo = { clave: 'lacolonia:6382', nombre: 'Chuleta De Cerdo', corte: 'Chuleta de cerdo', presentacion: 'por libra', precios: { lacolonia: grupo.precios.lacolonia } };
    const r = (await (await pedir('/lista/items', { cuerpo: { grupo: solo, cantidad: 1.5 }, cookie })).json()) as { item: ItemLista };
    expect(r.item.cantidad).toBe(1.5);
    expect(r.item.grupo.corte).toBe('Chuleta de cerdo');
    // Un producto normal sigue con enteros.
    const normal = { clave: 'colonial:10348498845988', nombre: 'Arroz', presentacion: '1.75 kg', precios: { colonial: grupo.precios.colonial } };
    expect((await pedir('/lista/items', { cuerpo: { grupo: normal, cantidad: 0.5 }, cookie })).status).toBe(400);
    // "por libra" inventado por la app (el nombre no lo confirma): 400 con decimales.
    const falso = { ...normal, clave: 'colonial:999', presentacion: 'por libra', corte: 'Arroz', precios: { colonial: { ...grupo.precios.colonial!, productoId: '999', nombre: 'PROGRESO Arroz Blanco' } } };
    expect((await pedir('/lista/items', { cuerpo: { grupo: falso, cantidad: 1.5 }, cookie })).status).toBe(400);
    expect((await pedir('/lista/items', { cuerpo: { grupo: normal, cantidad: 1 }, cookie })).status).toBe(201);
  });
});
