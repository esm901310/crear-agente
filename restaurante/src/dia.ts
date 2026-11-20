// Ayudas del día (jornada): conteo del efectivo guardado en el navegador,
// el último corte recibido y textos de diferencia. Ver docs/diseno.md, secciones 16–19.
import { CANTIDAD_MAX, DENOMINACIONES, TOLERANCIA_CUADRE } from './config';
import { dinero } from './formato';
import type { Conteo, Corte } from './tipos';

/** Las 11 llaves del conteo, en orden ("100000" … "50"). */
export const LLAVES_CONTEO = DENOMINACIONES.map((d) => String(d.valor));

/** Conteo con todas las denominaciones en 0. */
export function conteoVacio(): Conteo {
  return Object.fromEntries(LLAVES_CONTEO.map((k) => [k, 0]));
}

/** Total en centavos de un conteo (solo billetes, solo monedas o todo). */
export function totalConteo(conteo: Conteo, tipo?: 'billete' | 'moneda'): number {
  return DENOMINACIONES.filter((d) => !tipo || d.tipo === tipo).reduce(
    (s, d) => s + d.valor * (conteo[String(d.valor)] ?? 0),
    0,
  );
}

const llaveConteo = (jornadaId: number) => `conteo-jornada-${jornadaId}`;

/** Conteo guardado de un día (si no hay o está dañado, todo en 0). */
export function leerConteo(jornadaId: number): Conteo {
  const base = conteoVacio();
  try {
    const guardado = JSON.parse(localStorage.getItem(llaveConteo(jornadaId)) ?? 'null') as unknown;
    if (guardado && typeof guardado === 'object') {
      for (const k of LLAVES_CONTEO) {
        const v = (guardado as Record<string, unknown>)[k];
        if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= CANTIDAD_MAX) base[k] = v;
      }
    }
  } catch {
    // dañado: se empieza en 0
  }
  return base;
}

export function guardarConteo(jornadaId: number, conteo: Conteo): void {
  try {
    localStorage.setItem(llaveConteo(jornadaId), JSON.stringify(conteo));
  } catch {
    // sin espacio o modo privado: el conteo sigue en pantalla
  }
}

/** Borra el conteo del día y los de días anteriores que hayan quedado. */
export function borrarConteos(): void {
  limpiarConteosExcepto(null);
}

/** Borra el conteo guardado de un día (p. ej. ya lo cerró otra caja). */
export function borrarConteo(jornadaId: number): void {
  try {
    localStorage.removeItem(llaveConteo(jornadaId));
  } catch {
    // no importa
  }
}

/** Borra los conteos guardados de cualquier día que no sea `jornadaId` (null: todos). */
export function limpiarConteosExcepto(jornadaId: number | null): void {
  const conservar = jornadaId === null ? null : llaveConteo(jornadaId);
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith('conteo-jornada-') && k !== conservar) localStorage.removeItem(k);
    }
  } catch {
    // no importa
  }
}

// --- Último corte (lo que regresó "Cerrar el día"), para mostrarlo sin volver a pedirlo ---

const LLAVE_ULTIMO = 'ultimo-corte-id';
let corteEnMemoria: Corte | null = null;

export function recordarCorte(corte: Corte): void {
  corteEnMemoria = corte;
  try {
    localStorage.setItem(LLAVE_ULTIMO, String(corte.jornada.id));
  } catch {
    // no importa
  }
}

/** El corte recién cerrado en esta pestaña (o null si se recargó la página o ya se mostró). */
export function corteRecienCerrado(): Corte | null {
  return corteEnMemoria;
}

/** Ya se mostró: la próxima vez se pide al servidor (y sin el indicador de pasos). */
export function olvidarCorteReciente(): void {
  corteEnMemoria = null;
}

// --- Diferencia de efectivo (tabla 16.3) ---

export type TipoDiferencia = 'ok' | 'alerta' | 'peligro' | 'neutra';

/** true si la diferencia es menor que la moneda más chica (no se puede ajustar contando). */
export function cuadra(diferencia: number): boolean {
  return Math.abs(diferencia) < TOLERANCIA_CUADRE;
}

export function tipoDiferencia(diferencia: number | null): TipoDiferencia {
  if (diferencia === null) return 'neutra';
  if (cuadra(diferencia)) return 'ok';
  return diferencia > 0 ? 'alerta' : 'peligro';
}

/** "Cuadra ✓", "Sobran $50.00", "Faltan $120.00" o "En curso". */
export function textoDiferencia(diferencia: number | null): string {
  if (diferencia === null) return 'En curso';
  if (cuadra(diferencia)) return 'Cuadra ✓';
  return diferencia > 0 ? `Sobran ${dinero(diferencia)}` : `Faltan ${dinero(-diferencia)}`;
}

/** "(diferencia de $0.30 por centavos)" si cuadra pero no es exactamente 0; si no, null. */
export function notaCentavos(diferencia: number | null): string | null {
  if (diferencia === null || diferencia === 0 || !cuadra(diferencia)) return null;
  return `(diferencia de ${dinero(Math.abs(diferencia))} por centavos)`;
}
