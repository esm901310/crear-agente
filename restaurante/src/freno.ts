// Freno por LUGAR ("Demasiados intentos en este lugar."): vale para todo el aparato, no solo para
// el usuario que lo recibió (docs/diseno.md, 32.2). Se guarda una sola vez en localStorage.
const LLAVE = 'freno-lugar-hasta';

/** Hasta cuándo (ms) está frenado este aparato, o null si no lo está. */
export function frenoLugarHasta(ahora = Date.now()): number | null {
  try {
    const v = Number(localStorage.getItem(LLAVE));
    if (Number.isFinite(v) && v > ahora) return v;
    if (v) localStorage.removeItem(LLAVE);
  } catch {
    // sin localStorage: no hay freno guardado
  }
  return null;
}

export function guardarFrenoLugar(hasta: number): void {
  try {
    localStorage.setItem(LLAVE, String(hasta));
  } catch {
    // no importa: el freno sigue en pantalla
  }
}

/** Segundos → "0:42", "2:59". */
export function reloj(segundos: number): string {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}
