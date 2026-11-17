/** Pruebas de punta a punta del Worker (con D1 en memoria y datos de prueba, sin internet). */
import { beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { hashToken, ipDe, leerLimites, LIMITES_POR_DEFECTO } from '../src/seguridad';
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

describe('entrar: límites de contraseñas incorrectas (sin dispositivo de confianza)', () => {
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

  it('CGNAT: 30 fallos de otros correos desde una IP NO bloquean a quien pone bien su contraseña', async () => {
    await registrarAna();
    for (let i = 0; i < 30; i++) {
      const r = await pedir('/auth/entrar', { cuerpo: { correo: `otro${i}@ejemplo.com`, contrasena: 'x' }, ip: '181.115.0.1' });
      expect(r.status).toBe(401);
    }
    expect((await pedir('/auth/entrar', { cuerpo: ANA, ip: '181.115.0.1' })).status).toBe(200);
  });

  it('límite por IP sumando todos los correos (configurable; por defecto 100 en 15 min)', async () => {
    expect(leerLimites({}).entrarIp.maximo).toBe(100);
    env.LIMITE_ENTRAR_IP = '20';
    await registrarAna();
    for (let i = 0; i < 20; i++) {
      const r = await pedir('/auth/entrar', { cuerpo: { correo: `otro${i}@ejemplo.com`, contrasena: 'x' }, ip: '10.7.7.7' });
      expect(r.status).toBe(401);
    }
    expect((await pedir('/auth/entrar', { cuerpo: { correo: 'otro99@ejemplo.com', contrasena: 'x' }, ip: '10.7.7.7' })).status).toBe(429);
    expect((await pedir('/auth/entrar', { cuerpo: ANA, ip: '10.7.7.7' })).status).toBe(429);
    expect((await pedir('/auth/entrar', { cuerpo: ANA, ip: '200.1.1.1' })).status).toBe(200);
  });

  it('ataque repartido en muchas IP: sin dispositivo de confianza se aplica el límite por correo (10/hora)', async () => {
    expect(leerLimites({}).entrarCorreo.maximo).toBe(10);
    await registrarAna();
    // 11 IP × 5 fallos (IPv6: cada /64 distinta cuenta como otra conexión).
    let respuestas = 0;
    for (let i = 0; i < 11; i++) {
      for (let j = 0; j < 5; j++) {
        const r = await pedir('/auth/entrar', { cuerpo: MALA, ip: `2800:a4:${i}:1::${j + 1}` });
        expect([401, 429]).toContain(r.status);
        respuestas += r.status === 401 ? 1 : 0;
      }
    }
    // Solo 10 contraseñas se llegaron a revisar en total: adivinar es impráctico.
    expect(respuestas).toBe(10);
    // Desde una IP nueva, sin dispositivo, ni la contraseña correcta pasa (y el 429 no dice si lo era).
    const mala = await pedir('/auth/entrar', { cuerpo: MALA, ip: '10.9.9.9' });
    const buena = await pedir('/auth/entrar', { cuerpo: ANA, ip: '10.9.9.9' });
    expect(buena.status).toBe(429);
    expect(mala.status).toBe(429);
    expect(await buena.json()).toEqual(await mala.json());
    expect(buena.headers.get('Set-Cookie')).toBeNull();
    // La dueña sin dispositivo de confianza también espera (es el costo de frenar el ataque).
    expect((await pedir('/auth/entrar', { cuerpo: ANA, ip: '200.1.1.1' })).status).toBe(429);
  });

  it('entrar bien reinicia solo el contador correo + IP', async () => {
    await registrarAna();
    for (let i = 0; i < 4; i++) await pedir('/auth/entrar', { cuerpo: MALA, ip: '200.1.1.1' });
    expect((await pedir('/auth/entrar', { cuerpo: ANA, ip: '200.1.1.1' })).status).toBe(200);
    for (let i = 0; i < 5; i++) expect((await pedir('/auth/entrar', { cuerpo: MALA, ip: '200.1.1.1' })).status).toBe(401);
  });
});

describe('entrar: dispositivo de confianza', () => {
  const cookies = (r: Response) => r.headers.getSetCookie();
  const dispositivoDe = (r: Response) => cookies(r).find((c) => c.startsWith('__Secure-dispositivo='))!.split(';')[0];
  const tokensDe = (cookie: string) => cookie.slice('__Secure-dispositivo='.length).split('.');

  /** Ana se registra en su celular y queda con la cookie "__Secure-dispositivo". */
  async function anaConCelular(): Promise<string> {
    const r = await pedir('/auth/registro', { cuerpo: ANA, ip: '200.1.1.1' });
    expect(r.status).toBe(201);
    return dispositivoDe(r);
  }

  it('registrarse y entrar dan la cookie "__Secure-dispositivo" (HttpOnly, 1 año, solo /api/auth)', async () => {
    const reg = await pedir('/auth/registro', { cuerpo: ANA, ip: '200.1.1.1' });
    expect(cookies(reg)).toHaveLength(2);
    expect(cookies(reg)[0]).toMatch(/^sesion=/);
    const c = cookies(reg).find((x) => x.startsWith('__Secure-dispositivo='))!;
    expect(c).toMatch(/^__Secure-dispositivo=[A-Za-z0-9_-]{43}; Path=\/api\/auth; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000$/);
    // Entrar desde el mismo navegador conserva el mismo dispositivo.
    const r = await pedir('/auth/entrar', { cuerpo: ANA, ip: '200.1.1.1', cookie: dispositivoDe(reg) });
    expect(r.status).toBe(200);
    expect(dispositivoDe(r)).toBe(dispositivoDe(reg));
    // En la base solo se guarda el hash.
    const filas = await env.DB.prepare('SELECT token_hash FROM dispositivos').all<{ token_hash: string }>();
    expect(filas.results).toHaveLength(1);
    expect(filas.results[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ataque repartido (11 IP × 5 fallos): la dueña entra con su dispositivo de confianza, incluso desde una IP atacada', async () => {
    const celular = await anaConCelular();
    for (let i = 0; i < 11; i++) {
      for (let j = 0; j < 5; j++) await pedir('/auth/entrar', { cuerpo: MALA, ip: `10.0.${i}.${j + 1}` });
    }
    // Sin dispositivo: bloqueada.
    expect((await pedir('/auth/entrar', { cuerpo: ANA, ip: '200.1.1.1' })).status).toBe(429);
    // Con su celular: entra desde su IP y también desde una IP que el atacante usó (correo + IP bloqueado).
    expect((await pedir('/auth/entrar', { cuerpo: ANA, ip: '200.1.1.1', cookie: celular })).status).toBe(200);
    for (let j = 0; j < 6; j++) await pedir('/auth/entrar', { cuerpo: MALA, ip: '10.0.0.1' });
    expect((await pedir('/auth/entrar', { cuerpo: ANA, ip: '10.0.0.1', cookie: celular })).status).toBe(200);
  });

  it('CGNAT con la IP bloqueada (30 fallos de otros correos): quien tiene dispositivo entra; quien no, espera', async () => {
    env.LIMITE_ENTRAR_IP = '20';
    const celular = await anaConCelular();
    const BETO = { correo: 'beto@ejemplo.com', contrasena: 'clave-segura-2' };
    expect((await pedir('/auth/registro', { cuerpo: BETO, ip: '200.2.2.2' })).status).toBe(201);
    for (let i = 0; i < 30; i++) {
      await pedir('/auth/entrar', { cuerpo: { correo: `otro${i}@ejemplo.com`, contrasena: 'x' }, ip: '181.115.0.1' });
    }
    expect((await pedir('/auth/entrar', { cuerpo: ANA, ip: '181.115.0.1', cookie: celular })).status).toBe(200);
    expect((await pedir('/auth/entrar', { cuerpo: BETO, ip: '181.115.0.1' })).status).toBe(429);
  });

  it('el dispositivo de otra cuenta no sirve, y un dispositivo de confianza también tiene tope', async () => {
    const celular = await anaConCelular();
    const BETO = { correo: 'beto@ejemplo.com', contrasena: 'clave-segura-2' };
    const reg = await pedir('/auth/registro', { cuerpo: BETO, ip: '10.3.3.3' });
    const deBeto = dispositivoDe(reg);
    // Beto (atacante) con SU cookie contra la cuenta de Ana: cuenta como sin dispositivo (5 por IP).
    for (let i = 0; i < 5; i++) expect((await pedir('/auth/entrar', { cuerpo: MALA, ip: '10.3.3.3', cookie: deBeto })).status).toBe(401);
    expect((await pedir('/auth/entrar', { cuerpo: MALA, ip: '10.3.3.3', cookie: deBeto })).status).toBe(429);
    // Una cookie inventada tampoco.
    expect((await pedir('/auth/entrar', { cuerpo: ANA, ip: '10.3.3.3', cookie: '__Secure-dispositivo=inventadoInventado123456' })).status).toBe(429);
    // Desde el celular de Ana: 10 fallos permitidos, el 11.º bloquea ese dispositivo.
    for (let i = 0; i < 10; i++) expect((await pedir('/auth/entrar', { cuerpo: MALA, ip: '200.1.1.1', cookie: celular })).status).toBe(401);
    expect((await pedir('/auth/entrar', { cuerpo: MALA, ip: '200.1.1.1', cookie: celular })).status).toBe(429);
    expect((await pedir('/auth/entrar', { cuerpo: ANA, ip: '200.1.1.1', cookie: celular })).status).toBe(429);
    // Ese bloqueo no afecta a Ana sin cookie desde su IP (otro contador).
    expect((await pedir('/auth/entrar', { cuerpo: ANA, ip: '200.1.1.1' })).status).toBe(200);
  });

  it('teléfono compartido: la cookie guarda un token por cuenta y las dos siguen de confianza', async () => {
    const celular = await anaConCelular();
    const BETO = { correo: 'beto@ejemplo.com', contrasena: 'clave-segura-2' };
    const reg = await pedir('/auth/registro', { cuerpo: BETO, ip: '200.1.1.1', cookie: celular });
    const compartido = dispositivoDe(reg);
    // Beto recibe SU propio token (primero) y se conserva el de Ana.
    const [tokBeto, tokAna] = tokensDe(compartido);
    expect(tokensDe(compartido)).toHaveLength(2);
    expect(tokAna).toBe(tokensDe(celular)[0]);
    expect(tokBeto).not.toBe(tokAna);
    const n = await env.DB.prepare('SELECT COUNT(DISTINCT token_hash) AS n FROM dispositivos').first<{ n: number }>();
    expect(n?.n).toBe(2);
    // Ana entra desde ese teléfono: reutiliza su token, conserva el de Beto.
    const ana = await pedir('/auth/entrar', { cuerpo: ANA, ip: '200.1.1.1', cookie: compartido });
    expect(ana.status).toBe(200);
    expect(tokensDe(dispositivoDe(ana))).toEqual([tokAna, tokBeto]);
    // Con correo + IP bloqueados (ataque), las DOS cuentas siguen entrando desde el teléfono.
    for (let i = 0; i < 6; i++) await pedir('/auth/entrar', { cuerpo: MALA, ip: '10.5.5.5' });
    for (let i = 0; i < 6; i++) await pedir('/auth/entrar', { cuerpo: { ...BETO, contrasena: 'mala-mala-1' }, ip: '10.5.5.5' });
    expect((await pedir('/auth/entrar', { cuerpo: ANA, ip: '10.5.5.5' })).status).toBe(429);
    expect((await pedir('/auth/entrar', { cuerpo: BETO, ip: '10.5.5.5' })).status).toBe(429);
    expect((await pedir('/auth/entrar', { cuerpo: ANA, ip: '10.5.5.5', cookie: compartido })).status).toBe(200);
    expect((await pedir('/auth/entrar', { cuerpo: BETO, ip: '10.5.5.5', cookie: compartido })).status).toBe(200);
  });

  it('token plantado de OTRA cuenta: no se reutiliza ni da confianza', async () => {
    // El atacante (Beto) tiene una cuenta y su token de dispositivo.
    const BETO = { correo: 'beto@ejemplo.com', contrasena: 'clave-segura-2' };
    const deBeto = dispositivoDe(await pedir('/auth/registro', { cuerpo: BETO, ip: '10.3.3.3' }));
    await registrarAna();
    // Lo planta en el navegador de Ana; Ana entra bien con esa cookie.
    const r = await pedir('/auth/entrar', { cuerpo: ANA, ip: '200.1.1.1', cookie: deBeto });
    expect(r.status).toBe(200);
    const [tokAna, ...resto] = tokensDe(dispositivoDe(r));
    expect(tokAna).not.toBe(tokensDe(deBeto)[0]);
    expect(resto).toEqual(tokensDe(deBeto));
    // El token de Beto NO quedó ligado a la cuenta de Ana (sigue siendo solo de Beto).
    const duenos = await env.DB.prepare(
      'SELECT u.correo FROM dispositivos d JOIN usuarios u ON u.id = d.usuario_id WHERE d.token_hash = ?',
    ).bind(await hashToken(tokensDe(deBeto)[0])).all<{ correo: string }>();
    expect(duenos.results.map((f) => f.correo)).toEqual([BETO.correo]);
    // Con su token, Beto sigue sin poder saltarse el bloqueo de Ana: 5 fallos y 429.
    for (let i = 0; i < 5; i++) expect((await pedir('/auth/entrar', { cuerpo: MALA, ip: '10.3.3.3', cookie: deBeto })).status).toBe(401);
    expect((await pedir('/auth/entrar', { cuerpo: ANA, ip: '10.3.3.3', cookie: deBeto })).status).toBe(429);
  });

  it('cookies repetidas: se revisan todos los valores y solo vale el token de esa cuenta', async () => {
    const BETO = { correo: 'beto@ejemplo.com', contrasena: 'clave-segura-2' };
    const deBeto = dispositivoDe(await pedir('/auth/registro', { cuerpo: BETO, ip: '10.3.3.3' }));
    const celular = await anaConCelular();
    // El navegador manda dos cookies con el mismo nombre (una plantada primero).
    const dos = `${deBeto}; ${celular}`;
    for (let i = 0; i < 6; i++) await pedir('/auth/entrar', { cuerpo: MALA, ip: '10.6.6.6' });
    expect((await pedir('/auth/entrar', { cuerpo: ANA, ip: '10.6.6.6' })).status).toBe(429);
    const r = await pedir('/auth/entrar', { cuerpo: ANA, ip: '10.6.6.6', cookie: dos });
    expect(r.status).toBe(200);
    expect(tokensDe(dispositivoDe(r))[0]).toBe(tokensDe(celular)[0]);
    // Para la cuenta de Beto, el token de Ana no sirve: solo el suyo.
    for (let i = 0; i < 6; i++) await pedir('/auth/entrar', { cuerpo: { ...BETO, contrasena: 'mala-mala-1' }, ip: '10.6.6.6' });
    expect((await pedir('/auth/entrar', { cuerpo: BETO, ip: '10.6.6.6', cookie: celular })).status).toBe(429);
    expect((await pedir('/auth/entrar', { cuerpo: BETO, ip: '10.6.6.6', cookie: dos })).status).toBe(200);
  });

  it('la cookie guarda como máximo 5 tokens y descarta los desconocidos', async () => {
    const correos = Array.from({ length: 6 }, (_, i) => ({ correo: `p${i}@ejemplo.com`, contrasena: 'clave-segura-1' }));
    let cookie = '';
    for (const c of correos) {
      const r = await pedir('/auth/registro', { cuerpo: c, ip: '200.9.9.9', cookie: cookie || undefined });
      cookie = dispositivoDe(r);
    }
    expect(tokensDe(cookie)).toHaveLength(5);
    const conBasura = `${cookie}.inventadoInventado123456`;
    const r = await pedir('/auth/entrar', { cuerpo: correos[5], ip: '200.9.9.9', cookie: conBasura });
    expect(tokensDe(dispositivoDe(r))).toEqual(tokensDe(cookie));
  });

  it('la cookie vieja sin prefijo (dispositivo=) ya no se acepta', async () => {
    const celular = await anaConCelular();
    for (let i = 0; i < 6; i++) await pedir('/auth/entrar', { cuerpo: MALA, ip: '10.6.6.6' });
    const viejo = celular.replace('__Secure-dispositivo=', 'dispositivo=');
    expect((await pedir('/auth/entrar', { cuerpo: ANA, ip: '10.6.6.6', cookie: viejo })).status).toBe(429);
  });

  it('borrar la cuenta borra sus dispositivos y contadores (la cookie de dispositivo se queda)', async () => {
    const celular = await anaConCelular();
    const r = await pedir('/auth/entrar', { cuerpo: ANA, ip: '200.1.1.1', cookie: celular });
    const sesion = cookieDe(r);
    await pedir('/auth/entrar', { cuerpo: MALA, ip: '200.1.1.1', cookie: celular });
    await pedir('/auth/entrar', { cuerpo: MALA, ip: '10.4.4.4' });
    const borrar = await pedir('/cuenta', { metodo: 'DELETE', cookie: sesion });
    expect(borrar.status).toBe(204);
    expect(cookies(borrar)).toEqual([expect.stringMatching(/^sesion=; .*Max-Age=0$/)]);
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM dispositivos').first<{ n: number }>())?.n).toBe(0);
    const quedan = await env.DB.prepare("SELECT clave FROM limites WHERE clave LIKE 'entrar-%'").all<{ clave: string }>();
    // Solo queda el contador de la IP (no es de la persona).
    expect(quedan.results.map((f) => f.clave)).toEqual(['entrar-ip:10.4.4.4']);
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
