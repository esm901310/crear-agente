// Formatos de Honduras: lempiras y hora de America/Tegucigalpa.

const ZONA = 'America/Tegucigalpa';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** 1245 -> "L 1,245.00" */
export function lempiras(valor: number): string {
  const [entero, dec] = Math.abs(valor).toFixed(2).split('.');
  const conComas = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${valor < 0 ? '−' : ''}L ${conComas}.${dec}`;
}

/** 92.5 -> "92 lempiras con 50 centavos" (para lectores de pantalla). */
export function lempirasHablado(valor: number): string {
  const centavosTotales = Math.round(Math.abs(valor) * 100);
  const enteros = Math.floor(centavosTotales / 100);
  const centavos = centavosTotales % 100;
  const base = `${enteros} ${enteros === 1 ? 'lempira' : 'lempiras'}`;
  return centavos ? `${base} con ${centavos} centavos` : base;
}

interface PartesFecha {
  anio: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
}

function partes(fecha: Date): PartesFecha {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  });
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(fecha)) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return { anio: p.year, mes: p.month, dia: p.day, hora: p.hour % 24, minuto: p.minute };
}

/** "10:45 a. m." (con espacios que no se cortan) */
export function horaCorta(fecha: Date): string {
  const { hora, minuto } = partes(fecha);
  const h12 = hora % 12 === 0 ? 12 : hora % 12;
  const sufijo = hora < 12 ? 'a. m.' : 'p. m.';
  return `${h12}:${String(minuto).padStart(2, '0')} ${sufijo}`;
}

/** "hoy a las 10:45 a. m." o "el 15 nov, 6:20 p. m." */
export function cuandoSeConsulto(iso: string, ahora: Date = new Date()): string | null {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  const a = partes(fecha);
  const b = partes(ahora);
  if (a.anio === b.anio && a.mes === b.mes && a.dia === b.dia) {
    return `hoy a las ${horaCorta(fecha)}`;
  }
  return `el ${a.dia} ${MESES[a.mes - 1]}, ${horaCorta(fecha)}`;
}

export function productosTexto(n: number): string {
  return `${n} ${n === 1 ? 'producto' : 'productos'}`;
}

/** Línea gris debajo del nombre: marca (si no está ya en el nombre) y presentación. */
export function detalleGrupo(g: { nombre: string; marca?: string; presentacion?: string }): string {
  const partesTexto: string[] = [];
  if (g.marca && !g.nombre.toLowerCase().includes(g.marca.toLowerCase())) partesTexto.push(g.marca);
  if (g.presentacion) partesTexto.push(g.presentacion);
  return partesTexto.join(' · ');
}
