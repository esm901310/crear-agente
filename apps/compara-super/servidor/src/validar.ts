/** Validación estricta de todo lo que llega de la app. */
import { normalizarEan13 } from './ean';
import { esGrupoCorte } from './grupos';
import type { Grupo, PrecioTienda, PreciosPorTienda, Tienda } from './tipos';
import { TODAS_LAS_TIENDAS } from './tipos';

export class ErrorValidacion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorValidacion';
  }
}

const falla = (mensaje: string): never => {
  throw new ErrorValidacion(mensaje);
};

/** Dominios válidos para el enlace de cada tienda (evita guardar enlaces a otros sitios o "javascript:"). */
const DOMINIOS_TIENDA: Record<Tienda, string[]> = {
  lacolonia: ['www.lacolonia.com', 'lacolonia.com'],
  colonial: ['supercolonial.com', 'www.supercolonial.com'],
  losandes: [],
};

export const MAX_ITEMS_LISTA = 40;

export function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validarCorreo(v: unknown): string {
  if (typeof v !== 'string') falla('Escribe tu correo');
  const correo = (v as string).trim().toLowerCase();
  if (correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) falla('El correo no es válido');
  return correo;
}

export function validarContrasena(v: unknown, nueva: boolean): string {
  if (typeof v !== 'string' || v.length === 0) falla('Escribe tu contraseña');
  const c = v as string;
  if (c.length > 128) falla('La contraseña es demasiado larga (máximo 128 caracteres)');
  if (nueva && c.length < 8) falla('La contraseña debe tener al menos 8 caracteres');
  return c;
}

/**
 * Cantidad de un producto de la lista: entero de 1 a 99. Si `porLibra` (grupos 'corte', la
 * cantidad son libras): múltiplo de 0.5 de 0.5 a 99 (media libra, 1, 1.5…).
 */
export function validarCantidad(v: unknown, campo = 'cantidad', porLibra = false): number {
  if (porLibra) {
    if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v * 2) || v < 0.5 || v > 99) {
      falla(`"${campo}" debe ser de 0.5 a 99 libras, en medias libras (0.5, 1, 1.5…)`);
    }
    return v as number;
  }
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 99) falla(`"${campo}" debe ser un número entero de 1 a 99`);
  return v as number;
}

export function validarBusqueda(v: string | null): string {
  const q = (v ?? '').trim().replace(/\s+/g, ' ');
  if (q.length < 2 || q.length > 60) falla('Escribe entre 2 y 60 caracteres para buscar');
  return q;
}

function texto(v: unknown, campo: string, max: number, obligatorio: true): string;
function texto(v: unknown, campo: string, max: number, obligatorio: false): string | undefined;
function texto(v: unknown, campo: string, max: number, obligatorio: boolean): string | undefined {
  if (v === undefined || v === null || v === '') {
    if (obligatorio) falla(`Falta "${campo}"`);
    return undefined;
  }
  if (typeof v !== 'string') return falla(`"${campo}" debe ser texto`);
  const limpio = v.trim();
  if (obligatorio && limpio.length === 0) falla(`Falta "${campo}"`);
  if (limpio.length > max) falla(`"${campo}" es demasiado largo`);
  return limpio;
}

function precioNumero(v: unknown, campo: string, obligatorio: boolean): number | undefined {
  if (v === undefined || v === null) {
    if (obligatorio) falla(`Falta "${campo}"`);
    return undefined;
  }
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > 100_000) falla(`"${campo}" no es un precio válido`);
  return Math.round((v as number) * 100) / 100;
}

function urlHttps(v: unknown, campo: string, dominios?: string[]): string | undefined {
  const t = texto(v, campo, 600, false);
  if (t === undefined) return undefined;
  let url: URL;
  try {
    url = new URL(t);
  } catch {
    return falla(`"${campo}" no es un enlace válido`);
  }
  if (url.protocol !== 'https:') falla(`"${campo}" debe empezar con https://`);
  if (dominios && !dominios.includes(url.hostname)) falla(`"${campo}" no pertenece a la tienda`);
  return url.toString();
}

export function validarTienda(v: string, activas: Tienda[]): Tienda {
  if (!(TODAS_LAS_TIENDAS as readonly string[]).includes(v)) falla(`Tienda desconocida: ${v.slice(0, 20)}`);
  if (!activas.includes(v as Tienda)) falla(`La tienda ${v} no está activa`);
  return v as Tienda;
}

export function validarPrecioTienda(v: unknown, tienda: Tienda, campo: string): PrecioTienda {
  if (!esObjeto(v)) return falla(`"${campo}" debe ser un objeto`);
  const productoId = texto(v.productoId, `${campo}.productoId`, 64, true);
  if (!/^[A-Za-z0-9_.-]+$/.test(productoId)) falla(`"${campo}.productoId" no es válido`);
  const precio = precioNumero(v.precio, `${campo}.precio`, true)!;
  const precioOferta = precioNumero(v.precioOferta, `${campo}.precioOferta`, false);
  const salida: PrecioTienda = {
    productoId,
    nombre: texto(v.nombre, `${campo}.nombre`, 200, true),
    precio,
    url: urlHttps(v.url, `${campo}.url`, DOMINIOS_TIENDA[tienda]) ?? falla(`Falta "${campo}.url"`),
  };
  if (precioOferta !== undefined && precioOferta < precio) salida.precioOferta = precioOferta;
  const imagen = urlHttps(v.imagen, `${campo}.imagen`);
  if (imagen) salida.imagen = imagen;
  if (v.disponible !== undefined && v.disponible !== null) {
    if (typeof v.disponible !== 'boolean') falla(`"${campo}.disponible" debe ser verdadero o falso`);
    salida.disponible = v.disponible as boolean;
  }
  // "desactualizado" lo decide el servidor; no se acepta de la app.
  return salida;
}

export function validarGrupo(v: unknown, activas: Tienda[]): Grupo {
  if (!esObjeto(v)) return falla('Falta "grupo"');
  const clave = texto(v.clave, 'grupo.clave', 80, true);
  if (!esObjeto(v.precios)) return falla('"grupo.precios" debe ser un objeto');
  const precios: PreciosPorTienda = {};
  for (const [t, p] of Object.entries(v.precios)) {
    const tienda = validarTienda(t, activas);
    precios[tienda] = validarPrecioTienda(p, tienda, `grupo.precios.${t}`);
  }
  const tiendas = Object.keys(precios) as Tienda[];
  if (tiendas.length === 0) falla('El producto no tiene precios en ninguna tienda activa');

  // La clave debe ser coherente: "ean:<13 dígitos válidos>", "<tienda>:<productoId de esa tienda>"
  // (una sola tienda) o "corte:<tienda>:<productoId de esa tienda>" (carne por libra, 2+ tiendas).
  const m = /^ean:(\d{8,14})$/.exec(clave);
  const mc = /^corte:([a-z]+):([A-Za-z0-9_.-]+)$/.exec(clave);
  const esCorte = !!mc;
  if (m) {
    const ean = normalizarEan13(m[1]);
    if (!ean || ean !== m[1]) falla('"grupo.clave" tiene un código de barras no válido (se espera EAN-13)');
  } else if (mc) {
    const [, t, id] = mc;
    if (!tiendas.includes(t as Tienda) || precios[t as Tienda]!.productoId !== id || tiendas.length < 2) {
      falla('"grupo.clave" no coincide con sus precios');
    }
    if (v.coincidencia !== 'corte') falla('Un grupo "corte:..." debe tener coincidencia "corte"');
  } else {
    const [t, id] = clave.split(':');
    if (!tiendas.includes(t as Tienda) || precios[t as Tienda]!.productoId !== id || tiendas.length !== 1) {
      falla('"grupo.clave" no coincide con sus precios');
    }
  }

  const grupo: Grupo = { clave, nombre: texto(v.nombre, 'grupo.nombre', 200, true), precios };
  // Cómo se emparejó (solo tiene sentido con 2 o más tiendas; otro valor se ignora).
  // 'corte' solo con clave "corte:..." (y esa clave exige 'corte'): precios por libra.
  if (esCorte) {
    grupo.coincidencia = 'corte';
  } else if (tiendas.length >= 2 && (v.coincidencia === 'codigo' || v.coincidencia === 'probable')) {
    grupo.coincidencia = v.coincidencia;
  }
  const marca = texto(v.marca, 'grupo.marca', 80, false);
  const presentacion = texto(v.presentacion, 'grupo.presentacion', 40, false);
  const imagen = urlHttps(v.imagen, 'grupo.imagen');
  if (marca) grupo.marca = marca;
  if (presentacion) grupo.presentacion = presentacion;
  if (imagen) grupo.imagen = imagen;
  // Nombre del corte: en grupos 'corte' y en frescos por libra de una tienda ("por libra").
  const corte = texto(v.corte, 'grupo.corte', 80, false);
  if (corte && esGrupoCorte(grupo)) grupo.corte = corte;
  return grupo;
}

/** Sustitutos para PATCH: cada tienda → PrecioTienda o null (quitar). */
export function validarCambiosSustitutos(v: unknown, activas: Tienda[]): Partial<Record<Tienda, PrecioTienda | null>> {
  if (!esObjeto(v)) return falla('"sustitutos" debe ser un objeto');
  const salida: Partial<Record<Tienda, PrecioTienda | null>> = {};
  for (const [t, p] of Object.entries(v)) {
    const tienda = validarTienda(t, activas);
    salida[tienda] = p === null ? null : validarPrecioTienda(p, tienda, `sustitutos.${t}`);
  }
  return salida;
}

/** Id de item (UUID). */
export function validarIdItem(v: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) falla('Id de producto no válido');
  return v.toLowerCase();
}

/**
 * Fecha de consulta de precios que manda la app al agregar un producto (el `consultadoEn` de
 * /api/buscar). Opcional: undefined o null → null. Si viene, debe ser una fecha ISO válida.
 * Una fecha en el futuro se recorta a `ahora` (no se puede "rejuvenecer" más allá del presente).
 */
export function validarConsultadoEn(v: unknown, ahora: number): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string' || v.length > 40) falla('"consultadoEn" debe ser una fecha ISO (p. ej. 2026-11-17T16:45:00.000Z)');
  const s = v as string;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(s)) {
    falla('"consultadoEn" debe ser una fecha ISO (p. ej. 2026-11-17T16:45:00.000Z)');
  }
  const ms = Date.parse(s);
  if (!Number.isFinite(ms) || ms <= 0) falla('"consultadoEn" no es una fecha válida');
  return Math.min(ms, ahora);
}
