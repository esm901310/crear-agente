// Formatos de dinero (lempiras), hora y fechas en hora de Honduras (docs/diseno.md, secciones 3, 16.3 y 25.2).
import { ZONA_HORARIA } from './config';

// Formato fijo "L 1,234.50": no se usa Intl con currency 'HNL' porque cada navegador lo escribe distinto.
const fmtNumero = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtEntero = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** Centavos enteros → "L 1,234.50" (negativo: "−L 74.50"). */
export function dinero(centavos: number): string {
  return (centavos < 0 ? '−' : '') + 'L ' + fmtNumero.format(Math.abs(centavos) / 100);
}

/** Etiqueta corta sin decimales ni espacio (chips): 50000 → "L500", 100000 → "L1,000". */
export function dineroCorto(centavos: number): string {
  if (centavos % 100 !== 0) return dinero(centavos).replace(' ', '');
  return 'L' + fmtEntero.format(centavos / 100);
}

/** Centavos → "1,234.50" (sin la L, para los campos de dinero). */
export function centavosATexto(centavos: number): string {
  return fmtNumero.format(centavos / 100);
}

/**
 * Texto escrito en lempiras ("300", "300.5", "1,234.50", "L 300", " 200 ") → centavos enteros.
 * Vacío → 0. Inválido → null: letras, negativos, más de 2 decimales, o comas que no
 * separan miles de 3 en 3 ("1,36.50" y "200,50" no valen; "12,345" y "1,234.50" sí).
 * No usa decimales flotantes para evitar errores de redondeo.
 */
export function textoACentavos(texto: string): number | null {
  const limpio = texto.trim().replace(/^L\s*/i, '');
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

// --- Hora y fecha en la zona del restaurante ---

const fmtPartes = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** Año, mes (1–12), día, hora (1–12), minutos y a.m./p.m. de un instante, en hora de Honduras. */
function enZona(fecha: string | number | Date) {
  const p: Record<string, string> = {};
  for (const x of fmtPartes.formatToParts(new Date(fecha))) p[x.type] = x.value;
  return {
    anio: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour),
    minuto: p.minute,
    pm: (p.dayPeriod ?? '').toUpperCase().startsWith('P'),
  };
}

/** ISO → "2:35 p.m." en hora de Honduras (formato fijo en todos los navegadores). */
export function hora(iso: string | number): string {
  const z = enZona(iso);
  return `${z.hora}:${z.minuto} ${z.pm ? 'p.m.' : 'a.m.'}`;
}

/** Fecha de calendario (en hora de Honduras) como Date a mediodía UTC, para nombres de día y mes. */
function diaCalendario(fecha: string | number): Date {
  const z = enZona(fecha);
  return new Date(Date.UTC(z.anio, z.mes - 1, z.dia, 12));
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

/** Nombres en español de un día de calendario (Date a mediodía UTC). */
function nombre(d: Date, o: Intl.DateTimeFormatOptions): string {
  return d.toLocaleDateString('es-419', { timeZone: 'UTC', ...o }).replace('.', '');
}

/** ISO → "jueves 20 de noviembre de 2026" (hora de Honduras). */
export function fechaLarga(iso: string): string {
  const d = diaCalendario(iso);
  return `${nombre(d, { weekday: 'long' })} ${d.getUTCDate()} de ${nombre(d, { month: 'long' })} de ${d.getUTCFullYear()}`;
}

/** ISO → "jueves 20" (hora de Honduras). */
export function diaSemanaYNumero(iso: string): string {
  const d = diaCalendario(iso);
  return `${nombre(d, { weekday: 'long' })} ${d.getUTCDate()}`;
}

/** ISO → "Jue 20 nov" (+ año solo si no es el actual). Hora de Honduras. */
export function fechaCorta(iso: string, ahora = Date.now()): string {
  const d = diaCalendario(iso);
  const mismoAnio = d.getUTCFullYear() === diaCalendario(ahora).getUTCFullYear();
  const dia = nombre(d, { weekday: 'short' });
  const mes = nombre(d, { month: 'short' });
  return `${capitalizar(dia)} ${d.getUTCDate()} ${mes}${mismoAnio ? '' : ` ${d.getUTCFullYear()}`}`;
}

/** true si las dos fechas caen el mismo día (hora de Honduras). */
export function mismoDia(a: string | number, b: string | number): boolean {
  const x = enZona(a);
  const y = enZona(b);
  return x.anio === y.anio && x.mes === y.mes && x.dia === y.dia;
}

/** ISO → "20/11/2026" (hora de Honduras). */
export function fechaNumerica(iso: string | number): string {
  const z = enZona(iso);
  return `${String(z.dia).padStart(2, '0')}/${String(z.mes).padStart(2, '0')}/${z.anio}`;
}

/** "1 cuenta" / "2 cuentas". */
export function plural(n: number, singular: string, pluralTexto = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

/** Centavos con signo: "+L 25.00", "−L 74.50", "L 0.00". */
export function dineroConSigno(centavos: number): string {
  if (centavos > 0) return `+${dinero(centavos)}`;
  return dinero(centavos); // negativo ya trae "−"
}

/** Etiqueta de una denominación: "L500", "L1", "50 ctvs". */
export function etiquetaDenominacion(centavos: number): string {
  if (centavos < 100) return `${centavos} ctvs`;
  return dineroCorto(centavos);
}

/** Nombre accesible de una denominación: "Billetes de L500", "Monedas de 50 centavos". */
export function nombreDenominacion(centavos: number, tipo: 'billete' | 'moneda'): string {
  const valor = centavos < 100 ? `${centavos} centavos` : dineroCorto(centavos);
  return `${tipo === 'billete' ? 'Billetes' : 'Monedas'} de ${valor}`;
}

// --- Búsqueda ---

/** Para buscar sin distinguir mayúsculas ni acentos ("Camarón" = "camaron"). */
export function sinAcentos(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Fechas de calendario "AAAA-MM-DD" en hora de Honduras (reporte de propinas) ---

/** Hoy en hora de Honduras como "AAAA-MM-DD". */
export function hoyHonduras(ahora = Date.now()): string {
  const z = enZona(ahora);
  return `${z.anio}-${String(z.mes).padStart(2, '0')}-${String(z.dia).padStart(2, '0')}`;
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
  const f = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('es-419', { timeZone: 'UTC', ...o });
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
