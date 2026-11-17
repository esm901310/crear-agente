import type { Tienda } from '../api/cliente';

export interface InfoTienda {
  corto: string;
  completo: string;
  iniciales: string;
  color: string;
}

// Colores neutros inventados (no son colores de marca). Ver diseño §2.1.
const INFO: Record<Tienda, InfoTienda> = {
  lacolonia: { corto: 'La Colonia', completo: 'La Colonia', iniciales: 'LC', color: '#3B5B7A' },
  colonial: { corto: 'Colonial', completo: 'Colonial', iniciales: 'CL', color: '#6B4C7A' },
  losandes: { corto: 'Los Andes', completo: 'Comisariato Los Andes', iniciales: 'LA', color: '#7A5A2E' },
};

/** Orden fijo en que se muestran las tiendas. */
export const ORDEN_TIENDAS: Tienda[] = ['lacolonia', 'colonial', 'losandes'];

export function infoTienda(t: string): InfoTienda {
  const info = INFO[t as Tienda];
  if (info) return info;
  // Tienda que la app aún no conoce: se muestra igual, con nombre genérico.
  const nombre = t.charAt(0).toUpperCase() + t.slice(1);
  return { corto: nombre, completo: nombre, iniciales: nombre.slice(0, 2).toUpperCase(), color: '#4A5560' };
}

export function ordenarTiendas<T extends string>(tiendas: Iterable<T>): T[] {
  const lista = [...new Set(tiendas)];
  const pos = (t: string) => {
    const i = ORDEN_TIENDAS.indexOf(t as Tienda);
    return i === -1 ? 99 : i;
  };
  return lista.sort((a, b) => pos(a) - pos(b) || a.localeCompare(b));
}

/** "La Colonia", "La Colonia y Colonial", "La Colonia, Colonial y Los Andes". */
export function unirNombres(tiendas: string[], conjuncion: 'y' | 'o' | 'ni' = 'y', completo = false): string {
  const nombres = tiendas.map((t) => (completo ? infoTienda(t).completo : infoTienda(t).corto));
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} ${conjuncion} ${nombres[nombres.length - 1]}`;
}

/** Tiendas que se anuncian en textos fijos (bienvenida, Mi cuenta). Configurable. */
export const TIENDAS_ANUNCIADAS: Tienda[] = ordenarTiendas(
  (import.meta.env.VITE_TIENDAS_ANUNCIADAS || 'lacolonia,colonial')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean) as Tienda[],
);
