/** preciosConsultadosEn: fecha de consulta de precios más antigua de la lista (GET /api/lista y comparar). */
import { beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import type { Env } from '../src/tipos';
import { crearD1 } from './d1-falsa';

/* eslint-disable @typescript-eslint/no-explicit-any */
let env: Env;
let cookie: string;
let grupos: any[];

function pedir(ruta: string, op: { metodo?: string; cuerpo?: unknown } = {}) {
  const headers: Record<string, string> = { Cookie: cookie };
  if (op.cuerpo !== undefined) headers['Content-Type'] = 'application/json';
  return worker.fetch(
    new Request('http://localhost/api' + ruta, {
      method: op.metodo ?? (op.cuerpo !== undefined ? 'POST' : 'GET'),
      headers,
      body: op.cuerpo !== undefined ? JSON.stringify(op.cuerpo) : undefined,
    }),
    env,
  );
}
const lista = async () => (await (await pedir('/lista')).json()) as any;

beforeEach(async () => {
  env = { DB: await crearD1(), TIENDAS_ACTIVAS: 'lacolonia,colonial', PRECIOS_MODO: 'fixtures' };
  cookie = '';
  const r = await pedir('/auth/registro', { cuerpo: { correo: 'ana@ejemplo.com', contrasena: 'clave-segura-1' } });
  cookie = (r.headers.get('Set-Cookie') ?? '').split(';')[0];
  grupos = ((await (await pedir('/buscar?q=arroz')).json()) as any).grupos;
});

const HACE_UNA_HORA = new Date(Date.now() - 60 * 60_000).toISOString();
const HACE_DOS_HORAS = new Date(Date.now() - 2 * 60 * 60_000).toISOString();

describe('preciosConsultadosEn', () => {
  it('lista vacía → null', async () => {
    const l = await lista();
    expect(l.items).toEqual([]);
    expect(l.preciosConsultadosEn).toBeNull();
    expect(l.actualizadoEn).toBeNull();
  });

  it('agregar toma el consultadoEn de la búsqueda; editar cantidad o sustitutos no la cambia', async () => {
    const r = await pedir('/lista/items', { cuerpo: { grupo: grupos[0], cantidad: 1, consultadoEn: HACE_UNA_HORA } });
    expect(r.status).toBe(201);
    const { item } = (await r.json()) as any;
    expect((await lista()).preciosConsultadosEn).toBe(HACE_UNA_HORA);

    expect((await pedir(`/lista/items/${item.id}`, { metodo: 'PATCH', cuerpo: { cantidad: 5 } })).status).toBe(200);
    const sust = grupos.find((g) => g.precios.colonial && g.clave !== grupos[0].clave).precios.colonial;
    expect(
      (await pedir(`/lista/items/${item.id}`, { metodo: 'PATCH', cuerpo: { sustitutos: { colonial: sust } } })).status,
    ).toBe(200);
    const l = await lista();
    expect(l.items[0].cantidad).toBe(5);
    expect(l.preciosConsultadosEn).toBe(HACE_UNA_HORA);
    // actualizadoEn sigue siendo el último cambio de la lista (reciente).
    expect(Date.parse(l.actualizadoEn)).toBeGreaterThan(Date.parse(HACE_UNA_HORA));
  });

  it('es la fecha MÁS ANTIGUA entre los productos', async () => {
    await pedir('/lista/items', { cuerpo: { grupo: grupos[0], consultadoEn: HACE_UNA_HORA } });
    await pedir('/lista/items', { cuerpo: { grupo: grupos[1], consultadoEn: HACE_DOS_HORAS } });
    expect((await lista()).preciosConsultadosEn).toBe(HACE_DOS_HORAS);
  });

  it('un producto sin fecha (nunca consultado) → null', async () => {
    await pedir('/lista/items', { cuerpo: { grupo: grupos[0], consultadoEn: HACE_UNA_HORA } });
    expect((await pedir('/lista/items', { cuerpo: { grupo: grupos[1] } })).status).toBe(201);
    expect((await lista()).preciosConsultadosEn).toBeNull();
  });

  it('volver a agregar el mismo producto guarda la fecha de la nueva búsqueda', async () => {
    await pedir('/lista/items', { cuerpo: { grupo: grupos[0], consultadoEn: HACE_DOS_HORAS } });
    await pedir('/lista/items', { cuerpo: { grupo: grupos[0], consultadoEn: HACE_UNA_HORA } });
    const l = await lista();
    expect(l.items).toHaveLength(1);
    expect(l.preciosConsultadosEn).toBe(HACE_UNA_HORA);
  });

  it('comparar la actualiza (también en su respuesta) y GET /api/lista la refleja', async () => {
    await pedir('/lista/items', { cuerpo: { grupo: grupos[0], consultadoEn: HACE_DOS_HORAS } });
    await pedir('/lista/items', { cuerpo: { grupo: grupos[1] } });
    expect((await lista()).preciosConsultadosEn).toBeNull();
    const comp = (await (await pedir('/lista/comparar', { metodo: 'POST' })).json()) as any;
    expect(comp.preciosConsultadosEn).toBe(comp.consultadoEn);
    expect(Date.now() - Date.parse(comp.preciosConsultadosEn)).toBeLessThan(60_000);
    expect((await lista()).preciosConsultadosEn).toBe(comp.consultadoEn);
  });

  it('comparar con la lista vacía → null', async () => {
    const comp = (await (await pedir('/lista/comparar', { metodo: 'POST' })).json()) as any;
    expect(comp.preciosConsultadosEn).toBeNull();
  });

  it('una fecha en el futuro se recorta a ahora; una inválida da 400', async () => {
    const futuro = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
    await pedir('/lista/items', { cuerpo: { grupo: grupos[0], consultadoEn: futuro } });
    const fecha = Date.parse((await lista()).preciosConsultadosEn);
    expect(fecha).toBeLessThanOrEqual(Date.now());
    expect(Date.now() - fecha).toBeLessThan(60_000);

    for (const malo of ['ayer', 12345, '2026-13-45T99:99:00Z', { a: 1 }]) {
      const r = await pedir('/lista/items', { cuerpo: { grupo: grupos[1], consultadoEn: malo } });
      expect(r.status).toBe(400);
      expect(((await r.json()) as any).error.codigo).toBe('validacion');
    }
  });
});
