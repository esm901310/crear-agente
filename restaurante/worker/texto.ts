// Limpieza y validación de textos que escribe el dueño (nombres, descripciones).

import { HttpError } from './http';

export const MAX_NOMBRE = 60;
export const MAX_DESCRIPCION = 140;

/** Quita caracteres de control, junta espacios repetidos y recorta. */
export function limpiarTexto(texto: string): string {
  return texto.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Clave para comparar nombres sin distinguir mayúsculas ni acentos
 * ("Dueño" = "dueno", "Mesa  1" = "mesa 1"). Se guarda en `nombre_clave` y la
 * base de datos impide claves repetidas entre los registros activos.
 */
export function claveNombre(texto: string): string {
  return limpiarTexto(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Nombre obligatorio de 1 a 60 caracteres (ya limpio). `queEs` = "el nombre", "el nombre de la mesa"... */
export function nombreValido(valor: unknown, queEs = 'el nombre'): string {
  if (typeof valor !== 'string') throw new HttpError(400, `Escribe ${queEs}.`);
  const limpio = limpiarTexto(valor);
  if (limpio === '') throw new HttpError(400, `Escribe ${queEs}.`);
  if ([...limpio].length > MAX_NOMBRE) {
    throw new HttpError(400, `${mayuscula(queEs)} no puede tener más de ${MAX_NOMBRE} caracteres.`);
  }
  return limpio;
}

/** Descripción opcional (hasta 140 caracteres); vacía → null. */
export function descripcionValida(valor: unknown): string | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') throw new HttpError(400, 'La descripción debe ser texto.');
  const limpio = limpiarTexto(valor);
  if ([...limpio].length > MAX_DESCRIPCION) {
    throw new HttpError(400, `La descripción no puede tener más de ${MAX_DESCRIPCION} caracteres.`);
  }
  return limpio === '' ? null : limpio;
}

export function booleano(valor: unknown, mensaje: string): boolean {
  if (typeof valor !== 'boolean') throw new HttpError(400, mensaje);
  return valor;
}

/** ¿El error de la base de datos es por un nombre repetido (índice único)? */
export function esNombreRepetido(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes('UNIQUE constraint failed') && msg.includes('nombre_clave');
}

function mayuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
