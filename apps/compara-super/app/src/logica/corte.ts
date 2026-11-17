// "Modo carnes por libra": cortes frescos que el servidor empareja entre súper
// aunque cada tienda los llame distinto (coincidencia 'corte'). Sus precios son
// por libra y la cantidad del producto en la lista son libras.
import type { Grupo, Tienda } from '../api/cliente';

/** En grupos por libra la cantidad va de media en media libra (0.5 a 99). */
export const PASO_LIBRAS = 0.5;

/**
 * ¿Es un grupo por libra? Misma regla que el servidor (docs/api-contrato.md):
 * `coincidencia: 'corte'`, clave "corte:…" o presentación "por libra".
 */
export function esCorte(grupo: Pick<Grupo, 'coincidencia' | 'presentacion'> & { clave?: string }): boolean {
  return (
    grupo.coincidencia === 'corte' ||
    !!grupo.clave?.startsWith('corte:') ||
    esPresentacionPorLibra(grupo.presentacion)
  );
}

/** ¿Cantidad válida para el grupo? Por libra: 0.5..99 en medias libras; si no, entero 1..99. */
export function cantidadValida(cantidad: number, porLibra: boolean): boolean {
  if (!Number.isFinite(cantidad) || cantidad > 99) return false;
  return porLibra ? Number.isInteger(cantidad * 2) && cantidad >= 0.5 : Number.isInteger(cantidad) && cantidad >= 1;
}

function esPresentacionPorLibra(presentacion: string | undefined): boolean {
  return !!presentacion && sinTildes(presentacion).replace(/\s+/g, ' ').trim() === 'por libra';
}

function sinTildes(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Título del grupo: en cortes, el nombre del corte ("Chuleta de cerdo"). */
export function tituloGrupo(grupo: Pick<Grupo, 'nombre' | 'corte'>): string {
  return grupo.corte?.trim() || grupo.nombre;
}

/** El mismo grupo, con el título que se muestra en vez del nombre (para nombreCompleto, etc.). */
export function grupoVisible<G extends Pick<Grupo, 'nombre' | 'corte'>>(grupo: G): G {
  return { ...grupo, nombre: tituloGrupo(grupo) };
}

/**
 * true si es un grupo 'corte' con precio en 2 o más de las tiendas indicadas:
 * entonces se avisa que el corte es similar y se muestra el nombre de cada tienda.
 */
export function esCorteEmparejado(grupo: Grupo, tiendas: Tienda[]): boolean {
  if (!esCorte(grupo)) return false;
  return tiendas.filter((t) => grupo.precios[t]).length >= 2;
}

/**
 * ¿La opción se vende por libra? Sí si la presentación es "por libra" o si el nombre dice
 * "x Lb", "por libra", "/lb"… sin un número delante ("Chuleta ahumada 1 lb" es un paquete).
 */
export function esOpcionPorLibra(nombre: string, presentacion?: string): boolean {
  if (esPresentacionPorLibra(presentacion)) return true;
  const t = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  return /(?<![\d.,]\s*)(?:^|[^a-z0-9])(lbs?|libras?)(?![a-z0-9])/.test(t);
}

/** "2 lb", "1.5 lb", "0.5 lb" */
export function librasTexto(cantidad: number): string {
  return `${Math.round(cantidad * 100) / 100} lb`;
}

/** "media libra", "1 libra", "1 libra y media", "2 libras" (lector de pantalla). */
export function librasHablado(cantidad: number): string {
  const enteras = Math.floor(cantidad);
  const media = Math.abs(cantidad - enteras - 0.5) < 1e-9;
  if (enteras === 0 && media) return 'media libra';
  const base = `${enteras} ${enteras === 1 ? 'libra' : 'libras'}`;
  if (media) return `${base} y media`;
  return Number.isInteger(cantidad) ? base : `${cantidad} libras`;
}
