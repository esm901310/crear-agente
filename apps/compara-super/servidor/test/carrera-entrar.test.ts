/**
 * Ráfagas simultáneas contra /api/auth/entrar: el intento se reserva de forma atómica ANTES de
 * revisar la contraseña, así que nunca se revisan más contraseñas que el máximo del límite.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/tipos';
import { crearD1 } from './d1-falsa';

// Cuenta cuántas contraseñas se revisan de verdad (reales y ficticias).
const revisadas = vi.hoisted(() => ({ n: 0 }));
vi.mock('../src/seguridad', async (original) => {
  const real = await original<typeof import('../src/seguridad')>();
  return {
    ...real,
    verificarContrasena: async (...a: Parameters<typeof real.verificarContrasena>) => {
      revisadas.n++;
      return real.verificarContrasena(...a);
    },
    verificacionFicticia: async (...a: Parameters<typeof real.verificacionFicticia>) => {
      revisadas.n++;
      return real.verificacionFicticia(...a);
    },
  };
});

const { default: worker } = await import('../src/index');

let env: Env;
beforeEach(async () => {
  env = { DB: await crearD1(), TIENDAS_ACTIVAS: 'lacolonia,colonial' };
  revisadas.n = 0;
});

const ANA = { correo: 'ana@ejemplo.com', contrasena: 'clave-segura-1' };
const MALA = { correo: ANA.correo, contrasena: 'equivocada-99' };

function entrar(cuerpo: unknown, ip: string, cookie?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip };
  if (cookie) headers.Cookie = cookie;
  return worker.fetch(
    new Request('http://localhost/api/auth/entrar', { method: 'POST', headers, body: JSON.stringify(cuerpo) }),
    env,
  );
}

async function registrarAna(): Promise<string> {
  const r = await worker.fetch(
    new Request('http://localhost/api/auth/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '200.1.1.1' },
      body: JSON.stringify(ANA),
    }),
    env,
  );
  expect(r.status).toBe(201);
  return r.headers.getSetCookie().find((c) => c.startsWith('__Secure-dispositivo='))!.split(';')[0];
}

describe('entrar: ráfagas simultáneas', () => {
  it('50 intentos a la vez desde una IP: solo se revisan 5 contraseñas (correo + IP)', async () => {
    await registrarAna();
    revisadas.n = 0;
    const r = await Promise.all(Array.from({ length: 50 }, () => entrar(MALA, '10.6.6.6')));
    expect(revisadas.n).toBe(5);
    expect(r.filter((x) => x.status === 401)).toHaveLength(5);
    expect(r.filter((x) => x.status === 429)).toHaveLength(45);
  });

  it('ataque repartido a la vez (20 IP × 5): solo se revisan 10 contraseñas (correo global)', async () => {
    await registrarAna();
    revisadas.n = 0;
    const r = await Promise.all(
      Array.from({ length: 100 }, (_, i) => entrar(MALA, `10.0.${Math.floor(i / 5)}.${(i % 5) + 1}`)),
    );
    expect(revisadas.n).toBe(10);
    expect(r.filter((x) => x.status === 401)).toHaveLength(10);
  });

  it('correo que no existe: tampoco pasan más de 5 revisiones (ficticias)', async () => {
    const r = await Promise.all(
      Array.from({ length: 40 }, () => entrar({ correo: 'nadie@ejemplo.com', contrasena: 'x' }, '10.8.8.8')),
    );
    expect(revisadas.n).toBe(5);
    expect(r.filter((x) => x.status === 401)).toHaveLength(5);
  });

  it('con dispositivo de confianza: 40 a la vez → solo 10 revisiones', async () => {
    const celular = await registrarAna();
    revisadas.n = 0;
    await Promise.all(Array.from({ length: 40 }, () => entrar(MALA, '200.1.1.1', celular)));
    expect(revisadas.n).toBe(10);
  });

  it('el 429 es idéntico con contraseña buena o mala y no trae cookies', async () => {
    await registrarAna();
    await Promise.all(Array.from({ length: 20 }, () => entrar(MALA, '10.6.6.6')));
    revisadas.n = 0;
    const [buena, mala] = await Promise.all([entrar(ANA, '10.6.6.6'), entrar(MALA, '10.6.6.6')]);
    expect(revisadas.n).toBe(0);
    expect([buena.status, mala.status]).toEqual([429, 429]);
    expect(await buena.json()).toEqual(await mala.json());
    expect(buena.headers.get('Set-Cookie')).toBeNull();
  });

  it('entrar bien no gasta cupo: 4 fallos + éxito + 5 fallos siguen dando 401', async () => {
    await registrarAna();
    for (let i = 0; i < 4; i++) expect((await entrar(MALA, '200.1.1.1')).status).toBe(401);
    expect((await entrar(ANA, '200.1.1.1')).status).toBe(200);
    for (let i = 0; i < 5; i++) expect((await entrar(MALA, '200.1.1.1')).status).toBe(401);
    expect((await entrar(MALA, '200.1.1.1')).status).toBe(429);
    // Al contador global del correo solo suman las 9 contraseñas incorrectas revisadas: ni el
    // éxito ni el intento frenado con 429 cuentan (se devuelve su reserva).
    const fila = await env.DB.prepare("SELECT contador FROM limites WHERE clave = 'entrar-correo:ana@ejemplo.com'")
      .first<{ contador: number }>();
    expect(fila?.contador).toBe(9);
  });

  it('un intento frenado por un contador no gasta los demás (una sola IP no bloquea el correo global)', async () => {
    await registrarAna();
    await Promise.all(Array.from({ length: 60 }, () => entrar(MALA, '10.6.6.6')));
    const fila = await env.DB.prepare("SELECT contador, bloqueado_hasta FROM limites WHERE clave = 'entrar-correo:ana@ejemplo.com'")
      .first<{ contador: number; bloqueado_hasta: number }>();
    expect(fila?.contador).toBe(5);
    expect(fila?.bloqueado_hasta).toBe(0);
    expect((await entrar(ANA, '200.1.1.1')).status).toBe(200);
  });
});
