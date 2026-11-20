// Formatos de dinero, hora y tiempo transcurrido (docs/diseno.md, sección 3).

const fmtDinero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const fmtNumero = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Centavos enteros → "$1,234.50". */
export function dinero(centavos: number): string {
  return fmtDinero.format(centavos / 100);
}

/** Centavos → "1,234.50" (sin signo de pesos, para los campos de dinero). */
export function centavosATexto(centavos: number): string {
  return fmtNumero.format(centavos / 100);
}

/**
 * Texto escrito en pesos ("300", "300.5", "1,234.50", "$300", " 200 ") → centavos enteros.
 * Vacío → 0. Inválido → null: letras, negativos, más de 2 decimales, o comas que no
 * separan miles de 3 en 3 ("1,36.50" y "200,50" no valen; "12,345" y "1,234.50" sí).
 * No usa decimales flotantes para evitar errores de redondeo.
 */
export function textoACentavos(texto: string): number | null {
  const limpio = texto.trim().replace(/^\$\s*/, '');
  if (limpio === '') return 0;
  const m = /^(\d{1,3}(?:,\d{3})+|\d+)?(?:\.(\d{0,2}))?$/.exec(limpio);
  if (!m) return null;
  const enterosTexto = (m[1] ?? '').replace(/,/g, '');
  const decimalesTexto = m[2] ?? '';
  if (enterosTexto === '' && decimalesTexto === '') return null; // solo "."
  if (enterosTexto.length > 9) return null;
  const enteros = enterosTexto === '' ? 0 : Number(enterosTexto);
  const decimales = Number(decimalesTexto.padEnd(2, '0'));
  return enteros * 100 + decimales;
}

/** ISO → "2:35 p.m." en hora local. */
export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
}

/** Minutos enteros desde una fecha ISO hasta `ahora` (ms). */
export function minutosDesde(iso: string, ahora: number): number {
  return Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 60000));
}

/** Minutos → "menos de 1 min" (o "<1 min" si `corto`), "5 min", "1 h 12 min". */
export function transcurrido(minutos: number, corto = false): string {
  if (minutos < 1) return corto ? '<1 min' : 'menos de 1 min';
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
