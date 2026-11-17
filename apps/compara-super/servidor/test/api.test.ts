/** Pruebas de punta a punta del Worker (con D1 en memoria y datos de prueba, sin internet). */
import { beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { ipDe, leerLimites, LIMITES_POR_DEFECTO } from '../src/seguridad';
import type { Env } from '../src/tipos';
import { crearD1 } from './d1-falsa';

let env: Env;
beforeEach(async () => {
  env = { DB: await crearD1(), TIENDAS_ACTIVAS: 'lacolonia,colonial' };
});

const BASE = 'http://localhost/api';

function pedir(ruta: string, op: { metodo?: string; cuerpo?: unknown; ip?: string; cookie?: string } = {}) {
  const headers: Record<string, string> = {};
  if (op.cuerpo !== undefined) headers['Content-Type'] = 'application/json';
  if (op.ip) headers['CF-Connecting-IP'] = op.ip;
  if (op.cookie) headers.Cookie = op.cookie;
  const req = new Request(BASE + ruta, {
    method: op.metodo ?? (op.cuerpo !== undefined ? 'POST' : 'GET'),
    headers,
    body: op.cuerpo !== undefined ? JSON.stringify(op.cuerpo) : undefined,
  });
  return worker.fetch(req, env);
}
const cookieDe = (r: Response) => (r.headers.get('Set-Cookie') ?? '').split(';')[0];

const ANA = { correo: 'ana@ejemplo.com', contrasena: 'clave-segura-1' };
const MALA = { correo: ANA.correo, contrasena: 'equivocada-99' };

async function registrarAna() {
  const r = await pedir('/auth/registro', { cuerpo: ANA, ip: '200.1.1.1' });
  expect(r.status).toBe(201);
}

describe('entrar: límites de contraseñas incorrectas', () => {
  it('5 fallos desde la IP del atacante NO bloquean a la dueña desde su propia IP', async () => {
    await registrarAna();
    for (let i = 0; i < 5; i++) expect((await pedir('/auth/entrar', { cuerpo: MALA, ip: '10.6.6.6' })).status).toBe(401);
    // El 6.º fallo desde la misma IP bloquea ese correo en esa IP.
    const sexto = await pedir('/auth/entrar', { cuerpo: MALA, ip: '10.6.6.6' });
    expect(sexto.status).toBe(429);
    expect(Number(sexto.headers.get('Retry-After'))).toBeGreaterThan(0);
    // Desde esa IP ni la contraseña correcta pasa mientras dure el bloqueo.
    expect((await pedir('/auth/entrar', { cuerpo: ANA, ip: '10.6.6.6' })).status).toBe(429);
    // La dueña, desde su conexión, entra normalmente.
    const r = await pedir('/auth/entrar', { cuerpo: ANA, ip: '200.1.1.1' });
    expect(r.status).toBe(200);
    expect(cookieDe(r)).toMatch(/^sesion=/);
  });

  it('límite por IP sumando todos los correos (20 en 15 min)', async () => {
    await registrarAna();
    for (let i = 0; i < 20; i++) {
      const r = await pedir('/auth/entrar', { cuerpo: { correo: `otro${i}@ejemplo.com`, contrasena: 'x' }, ip: '10.7.7.7' });
      expect(r.status).toBe(401);
    }
    expect((await pedir('/auth/entrar', { cuerpo: { correo: 'otro99@ejemplo.com', contrasena: 'x' }, ip: '10.7.7.7' })).status).toBe(429);
    expect((await pedir('/auth/entrar', { cuerpo: ANA, ip: '10.7.7.7' })).status).toBe(429);
    expect((await pedir('/auth/entrar', { cuerpo: ANA, ip: '200.1.1.1' })).status).toBe(200);
  });

  it('freno extremo por correo desde muchas IP (configurable)', async () => {
    env.LIMITE_ENTRAR_CORREO = '6';
    await registrarAna();
    for (let i = 0; i < 6; i++) expect((await pedir('/auth/entrar', { cuerpo: MALA, ip: `10.0.0.${i}` })).status).toBe(401);
    expect((await pedir('/auth/entrar', { cuerpo: MALA, ip: '10.0.0.99' })).status).toBe(429);
    expect((await pedir('/auth/entrar', { cuerpo: ANA, ip: '200.1.1.1' })).status).toBe(429);
  });

  it('entrar bien reinicia solo el contador correo + IP', async () => {
    await registrarAna();
    for (let i = 0; i < 4; i++) await pedir('/auth/entrar', { cuerpo: MALA, ip: '200.1.1.1' });
    expect((await pedir('/auth/entrar', { cuerpo: ANA, ip: '200.1.1.1' })).status).toBe(200);
    for (let i = 0; i < 5; i++) expect((await pedir('/auth/entrar', { cuerpo: MALA, ip: '200.1.1.1' })).status).toBe(401);
  });
});

describe('registro: límite por IP configurable', () => {
  it('por defecto 30 por hora', () => {
    expect(leerLimites({}).registro.maximo).toBe(30);
  });

  it('respeta LIMITE_REGISTROS_IP', async () => {
    env.LIMITE_REGISTROS_IP = '2';
    const reg = (n: number, ip: string) =>
      pedir('/auth/registro', { cuerpo: { correo: `p${n}@ejemplo.com`, contrasena: 'clave-segura-1' }, ip });
    expect((await reg(1, '10.1.1.1')).status).toBe(201);
    expect((await reg(2, '10.1.1.1')).status).toBe(201);
    expect((await reg(3, '10.1.1.1')).status).toBe(429);
    expect((await reg(4, '10.2.2.2')).status).toBe(201);
  });
});

describe('leerLimites e ipDe', () => {
  it('ignora valores inválidos y usa el valor por defecto', () => {
    const l = leerLimites({ LIMITE_BUSQUEDAS: 'muchas', LIMITE_COMPARACIONES: '0', LIMITE_ENTRAR_IP: ' 40 ' });
    expect(l.buscar.maximo).toBe(LIMITES_POR_DEFECTO.buscar.maximo);
    expect(l.comparar.maximo).toBe(30);
    expect(l.entrarIp.maximo).toBe(40);
  });

  it('agrupa IPv6 por /64 y deja IPv4 igual', () => {
    const ip = (v?: string) => ipDe(new Request('http://x', { headers: v ? { 'CF-Connecting-IP': v } : {} }));
    expect(ip('190.4.5.6')).toBe('190.4.5.6');
    expect(ip('2800:a4:1:2:aaaa::1')).toBe('2800:a4:1:2::/64');
    expect(ip('2800:a4:1:2:bbbb:cccc:dddd:eeee')).toBe('2800:a4:1:2::/64');
    expect(ip('2800:a4::1')).toBe('2800:a4:0:0::/64');
    expect(ip('::ffff:190.4.5.6')).toBe('190.4.5.6');
    expect(ip()).toBe('local');
    expect(ip('no es ip')).toBe('desconocida');
  });
});

describe('modo prueba (fixtures): producto en las dos tiendas', () => {
  it('"arroz" trae el Arroz Progreso 1.75 kg emparejado y la comparación tiene ganador sin sustitutos', async () => {
    env.PRECIOS_MODO = 'fixtures';
    const r = await pedir('/auth/registro', { cuerpo: ANA, ip: '200.1.1.1' });
    const cookie = cookieDe(r);
    const busqueda = (await (await pedir('/buscar?q=arroz', { cookie })).json()) as any;
    expect(busqueda.modoPrueba).toBe(true);
    const progreso = busqueda.grupos[0];
    expect(progreso.clave).toBe('ean:0707517002083');
    expect(Object.keys(progreso.precios).sort()).toEqual(['colonial', 'lacolonia']);
    expect(progreso.nombre).toBe('Arroz Progreso Blanco Grano Largo');
    expect(progreso.presentacion).toBe('1.75 kg');
    expect(progreso.precios.colonial.nombre).toBe('PROGRESO Arroz BlancoGranoLar1.75Kg'); // original intacto
    // Nombre limpio también para un grupo solo de Colonial.
    const manhattan = busqueda.grupos.find((g: any) => g.precios.colonial?.nombre === 'MANHATTAN Arroz Blanco 3.3 LBS');
    expect(manhattan.nombre).toBe('Manhattan Arroz Blanco');

    expect((await pedir('/lista/items', { cuerpo: { grupo: progreso, cantidad: 2 }, cookie })).status).toBe(201);
    const comp = (await (await pedir('/lista/comparar', { metodo: 'POST', cookie })).json()) as any;
    expect(comp.ganador).toBe('colonial');
    expect(comp.ahorro).toBeCloseTo((66.5 - 62.49) * 2, 2);
    expect(comp.tiendas.every((t: any) => t.completa)).toBe(true);
    expect(comp.items[0].grupo.precios.lacolonia.desactualizado).toBeUndefined();
    expect(comp.items[0].grupo.precios.colonial.desactualizado).toBeUndefined();
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
