import { describe, expect, it } from 'vitest';
import { cifrarContrasena, cookieSesion, hashToken, ITERACIONES_PBKDF2, nuevoToken, verificarContrasena } from '../src/seguridad';
import { validarCambiosSustitutos, validarCorreo, validarGrupo } from '../src/validar';

const ACTIVAS = ['lacolonia', 'colonial'] as const;

const grupoValido = () => ({
  clave: 'ean:0707517002083',
  nombre: 'Arroz Progreso 1.75 kg',
  precios: {
    lacolonia: { productoId: '1598', nombre: 'Arroz', precio: 80.9, url: 'https://www.lacolonia.com/arroz/p' },
    colonial: { productoId: '10495005557028', nombre: 'Arroz', precio: 62.49, url: 'https://supercolonial.com/products/x' },
  },
});

describe('validación', () => {
  it('correo en minúsculas y sin espacios', () => {
    expect(validarCorreo('  Ana@Correo.HN ')).toBe('ana@correo.hn');
    expect(() => validarCorreo('ana')).toThrow();
    expect(() => validarCorreo(5)).toThrow();
  });

  it('acepta un grupo válido', () => {
    expect(validarGrupo(grupoValido(), [...ACTIVAS]).clave).toBe('ean:0707517002083');
  });

  it('rechaza enlaces de otros sitios o con javascript:', () => {
    const g = grupoValido();
    g.precios.lacolonia.url = 'javascript:alert(1)';
    expect(() => validarGrupo(g, [...ACTIVAS])).toThrow();
    const g2 = grupoValido();
    g2.precios.colonial.url = 'https://malo.com/products/x';
    expect(() => validarGrupo(g2, [...ACTIVAS])).toThrow(/no pertenece/);
  });

  it('rechaza tiendas inactivas, precios inválidos y claves incoherentes', () => {
    const g = grupoValido() as Record<string, any>;
    g.precios.losandes = { productoId: '1', nombre: 'x', precio: 1, url: 'https://x.com' };
    expect(() => validarGrupo(g, [...ACTIVAS])).toThrow(/no está activa/);
    const g2 = grupoValido();
    g2.precios.lacolonia.precio = -5;
    expect(() => validarGrupo(g2, [...ACTIVAS])).toThrow();
    expect(() => validarGrupo({ ...grupoValido(), clave: 'ean:707517002083' }, [...ACTIVAS])).toThrow(/EAN-13/);
    expect(() => validarGrupo({ ...grupoValido(), clave: 'lacolonia:1598' }, [...ACTIVAS])).toThrow(/no coincide/);
  });

  it('sustitutos: null quita, objeto valida', () => {
    const r = validarCambiosSustitutos(
      { colonial: null, lacolonia: { productoId: '9', nombre: 'Otro', precio: 5, url: 'https://www.lacolonia.com/o/p' } },
      [...ACTIVAS],
    );
    expect(r.colonial).toBeNull();
    expect(r.lacolonia?.precio).toBe(5);
  });
});

describe('seguridad', () => {
  it('contraseña cifrada con PBKDF2 y sal aleatoria', async () => {
    const a = await cifrarContrasena('secreta123');
    const b = await cifrarContrasena('secreta123');
    expect(a.iteraciones).toBe(ITERACIONES_PBKDF2);
    expect(a.iteraciones).toBeGreaterThanOrEqual(100_000);
    expect(a.hash).not.toBe(b.hash);
    expect(a.hash).not.toContain('secreta');
    expect(await verificarContrasena('secreta123', a)).toBe(true);
    expect(await verificarContrasena('secreta124', a)).toBe(false);
  });

  it('token aleatorio guardado como hash y cookie segura', async () => {
    const t = nuevoToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(cookieSesion(t)).toMatch(/HttpOnly; Secure; SameSite=Lax; Max-Age=2592000/);
  });
});
