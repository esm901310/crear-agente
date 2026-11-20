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

/** Agrega el punto final sin duplicarlo ("6:15 a.m." → "6:15 a.m.", "Hielo" → "Hielo."). */
export function conPunto(texto: string): string {
  return texto.endsWith('.') ? texto : `${texto}.`;
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

// ---------- Entrega 2 (docs/diseno.md, sección 16.3) ----------

/** Primera letra en mayúscula. */
export function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** ISO → "jueves 20 de noviembre de 2026" (hora local). */
export function fechaLarga(iso: string): string {
  // es-MX pone coma después del día de la semana ("jueves, 20 de…"); el diseño la quita.
  return new Date(iso)
    .toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .replace(',', '');
}

/** ISO → "Jue 20 nov" (+ año solo si no es el actual). */
export function fechaCorta(iso: string, ahora = Date.now()): string {
  const d = new Date(iso);
  const mismoAnio = d.getFullYear() === new Date(ahora).getFullYear();
  const dia = d.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '');
  const mes = d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');
  return `${capitalizar(dia)} ${d.getDate()} ${mes}${mismoAnio ? '' : ` ${d.getFullYear()}`}`;
}

/** true si las dos fechas ISO caen el mismo día (hora local). */
export function mismoDia(a: string | number, b: string | number): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

/** ISO → "20/11/2026" (hora local). */
export function fechaNumerica(iso: string | number): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** "1 cuenta" / "2 cuentas". */
export function plural(n: number, singular: string, pluralTexto = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

/** Centavos con signo: "+$25.00", "−$74.50", "$0.00". */
export function dineroConSigno(centavos: number): string {
  if (centavos > 0) return `+${dinero(centavos)}`;
  if (centavos < 0) return `−${dinero(-centavos)}`;
  return dinero(0);
}

/** Etiqueta de una denominación: "$1,000", "$20", "$1", "50¢". */
export function etiquetaDenominacion(centavos: number): string {
  if (centavos < 100) return `${centavos}¢`;
  return dinero(centavos).replace('.00', '');
}

// --- Fechas de calendario "AAAA-MM-DD" en hora de México (reporte de propinas) ---

const ZONA_MEXICO = 'America/Mexico_City';

/** Hoy en hora de México como "AAAA-MM-DD". */
export function hoyMexico(ahora = Date.now()): string {
  // 'en-CA' da el formato AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_MEXICO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(ahora),
  );
}

/** "AAAA-MM-DD" → Date a mediodía UTC (para hacer cuentas de calendario sin brincos de zona). */
function diaUtc(fecha: string): Date {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d, 12));
}
function aTexto(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Suma (o resta) días a una fecha "AAAA-MM-DD". */
export function sumarDias(fecha: string, dias: number): string {
  const d = diaUtc(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return aTexto(d);
}

/** Lunes de la semana de `fecha` (la semana empieza en lunes). */
export function lunesDe(fecha: string): string {
  const diaSemana = diaUtc(fecha).getUTCDay(); // 0 = domingo
  return sumarDias(fecha, -((diaSemana + 6) % 7));
}

/** Primer día del mes de `fecha`. */
export function inicioDeMes(fecha: string): string {
  return `${fecha.slice(0, 8)}01`;
}

/** true si es una fecha de calendario válida "AAAA-MM-DD". */
export function fechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  return aTexto(diaUtc(fecha)) === fecha;
}

/** Días entre dos fechas contando ambos extremos (17 al 20 = 4). */
export function diasEnRango(desde: string, hasta: string): number {
  return Math.round((diaUtc(hasta).getTime() - diaUtc(desde).getTime()) / 86400000) + 1;
}

function partes(fecha: string) {
  const d = diaUtc(fecha);
  const f = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('es-MX', { timeZone: 'UTC', ...o });
  return { semana: f({ weekday: 'long' }), dia: d.getUTCDate(), mes: f({ month: 'long' }), anio: d.getUTCFullYear() };
}

/**
 * Rango en palabras: "Del lunes 17 al jueves 20 de noviembre", "Del viernes 31 de octubre al
 * domingo 2 de noviembre", "Jueves 20 de noviembre". Con `conAnio` agrega el año.
 */
export function rangoEnPalabras(desde: string, hasta: string, conAnio = false): string {
  const a = partes(desde);
  const b = partes(hasta);
  const anioB = conAnio ? ` de ${b.anio}` : '';
  if (desde === hasta) return capitalizar(`${a.semana} ${a.dia} de ${a.mes}${anioB}`);
  if (a.anio !== b.anio) return `Del ${a.semana} ${a.dia} de ${a.mes} de ${a.anio} al ${b.semana} ${b.dia} de ${b.mes} de ${b.anio}`;
  if (a.mes !== b.mes) return `Del ${a.semana} ${a.dia} de ${a.mes} al ${b.semana} ${b.dia} de ${b.mes}${anioB}`;
  return `Del ${a.semana} ${a.dia} al ${b.semana} ${b.dia} de ${b.mes}${anioB}`;
}

/** Rango corto para títulos impresos: "del 17 al 20 de noviembre de 2026". */
export function rangoCorto(desde: string, hasta: string): string {
  const a = partes(desde);
  const b = partes(hasta);
  if (desde === hasta) return `del ${b.dia} de ${b.mes} de ${b.anio}`;
  if (a.anio !== b.anio) return `del ${a.dia} de ${a.mes} de ${a.anio} al ${b.dia} de ${b.mes} de ${b.anio}`;
  if (a.mes !== b.mes) return `del ${a.dia} de ${a.mes} al ${b.dia} de ${b.mes} de ${b.anio}`;
  return `del ${a.dia} al ${b.dia} de ${b.mes} de ${b.anio}`;
}
