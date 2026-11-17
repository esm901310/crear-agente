import type { Grupo, Tienda } from '../api/cliente';

/**
 * true si el servidor emparejó el producto entre súper por parecido (no por código de barras)
 * y hay precio en 2 o más de las tiendas indicadas. Solo entonces se pide a la persona
 * que revise el nombre que publica cada tienda.
 */
export function esCoincidenciaProbable(grupo: Grupo, tiendas: Tienda[]): boolean {
  if (grupo.coincidencia !== 'probable') return false;
  return tiendas.filter((t) => grupo.precios[t]).length >= 2;
}
