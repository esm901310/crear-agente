import { describe, expect, it } from 'vitest';
import lcLeche from '../../precios/test/fixtures/lacolonia-leche-sula.json';
import clLeche from '../../precios/test/fixtures/colonial-leche-sula.json';
import porCodigo from '../../precios/test/fixtures/colonial-por-codigo.json';
import { buscar, codigoParaBuscar, MAX_CONSULTAS_POR_CODIGO } from '../src/busqueda';
import { emparejar } from '../src/grupos';
import { crearD1 } from './d1-falsa';

/** fetch falso con las respuestas reales guardadas; registra las URL pedidas. */
function fetchGuardado() {
  const urls: URL[] = [];
  const f = (async (entrada: string) => {
    const url = new URL(entrada);
    urls.push(url);
    const json = (c: unknown) => new Response(JSON.stringify(c), { status: 200 });
    if (url.hostname === 'www.lacolonia.com') return json(lcLeche);
    const q = url.searchParams.get('q') ?? '';
    if (/^\d+$/.test(q)) {
      const r = (porCodigo.respuestas as Record<string, unknown>)[q] ?? { results: { products: [] } };
      return json({ resources: r });
    }
    return json(clLeche);
  }) as unknown as typeof fetch;
  return { f, urls };
}

describe('buscar: completar por código de barras en Colonial', () => {
  it('busca en Colonial los códigos de La Colonia que quedaron sin pareja (máx. 6) y los une por código', async () => {
    const db = await crearD1();
    const { f, urls } = fetchGuardado();
    const r = await buscar(db, 'leche sula', { tiendas: ['lacolonia', 'colonial'], modo: 'vivo', fetch: f, pausaMs: 0 });
    const porCodigoPedidas = urls.filter((u) => /^\d+$/.test(u.searchParams.get('q') ?? ''));
    expect(porCodigoPedidas.length).toBe(MAX_CONSULTAS_POR_CODIGO);
    expect(urls.length).toBe(2 + MAX_CONSULTAS_POR_CODIGO);
    expect(r.consultasReales).toBe(2 + MAX_CONSULTAS_POR_CODIGO);
    // Solo se buscan códigos de productos que no tienen pareja (la entera 946 ml ya la tiene por parecido).
    expect(porCodigoPedidas.map((u) => u.searchParams.get('q'))).not.toContain('7421000811367');
    expect(porCodigoPedidas[0].searchParams.get('q')).toBe('7421000840817');

    const gs = emparejar(r.resultados.filter((x) => x.ok).map((x) => ({ tienda: x.tienda, productos: x.productos })), 40);
    // La deslactosada semidescremada de Colonial no trae código en la imagen ni dice tamaño:
    // no se puede confirmar que sea la misma, así que queda solo en La Colonia.
    expect(Object.keys(gs.find((g) => g.clave === 'ean:7421000840817')!.precios)).toEqual(['lacolonia']);
    // La fortificada sí trae el código en la imagen ("Items_2f7421000851868.jpg"): se une por código.
    expect(gs.find((g) => g.clave === 'ean:7421000851868')).toMatchObject({
      coincidencia: 'codigo',
      precios: { lacolonia: { productoId: '15497' }, colonial: { nombre: 'SULA LecheFortificadaP/Niño946' } },
    });

    // Segunda vez: todo sale de la caché de D1, sin peticiones.
    const n = urls.length;
    const r2 = await buscar(db, 'leche sula', { tiendas: ['lacolonia', 'colonial'], modo: 'vivo', fetch: f, pausaMs: 0 });
    expect(urls.length).toBe(n);
    expect(r2.consultasReales).toBe(0);
  });

  it('no completa si se apaga, o si falta una de las tiendas', async () => {
    const db = await crearD1();
    const { f, urls } = fetchGuardado();
    await buscar(db, 'leche sula', { tiendas: ['lacolonia', 'colonial'], modo: 'vivo', fetch: f, completarPorCodigo: false });
    expect(urls.length).toBe(2);
    await buscar(db, 'leche', { tiendas: ['lacolonia'], modo: 'vivo', fetch: f });
    expect(urls.length).toBe(3);
  });

  it('codigoParaBuscar: UPC sin el 0 de EAN-13 y EAN-8 sin ceros', () => {
    expect(codigoParaBuscar('7421000811367')).toBe('7421000811367');
    expect(codigoParaBuscar('0707517002083')).toBe('707517002083');
    expect(codigoParaBuscar('0000007811801')).toBe('07811801'); // EAN-8 tal cual
  });
});
