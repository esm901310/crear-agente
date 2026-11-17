/** Validación estricta de todo lo que llega de la app. */
import { normalizarEan13 } from './ean';
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

export function validarCantidad(v: unknown, campo = 'cantidad'): number {
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

  // La clave debe ser coherente: "ean:<13 dígitos válidos>" o "<tienda>:<productoId de esa tienda>".
  const m = /^ean:(\d{8,14})$/.exec(clave);
  if (m) {
    const ean = normalizarEan13(m[1]);
    if (!ean || ean !== m[1]) falla('"grupo.clave" tiene un código de barras no válido (se espera EAN-13)');
  } else {
    const [t, id] = clave.split(':');
    if (!tiendas.includes(t as Tienda) || precios[t as Tienda]!.productoId !== id || tiendas.length !== 1) {
      falla('"grupo.clave" no coincide con sus precios');
    }
  }

  const grupo: Grupo = { clave, nombre: texto(v.nombre, 'grupo.nombre', 200, true), precios };
  const marca = texto(v.marca, 'grupo.marca', 80, false);
  const presentacion = texto(v.presentacion, 'grupo.presentacion', 40, false);
  const imagen = urlHttps(v.imagen, 'grupo.imagen');
  if (marca) grupo.marca = marca;
  if (presentacion) grupo.presentacion = presentacion;
  if (imagen) grupo.imagen = imagen;
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
