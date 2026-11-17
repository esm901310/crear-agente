// Cantidades de los productos ("1.75 kg", "3.3 LBS", "Galón", "Cartón de 30")
// llevadas a una unidad base para poder compararlas sin importar cómo se escriben.

export type Magnitud = 'masa' | 'volumen' | 'unidades';

export interface Cantidad {
  magnitud: Magnitud;
  /** En gramos, mililitros o unidades. */
  valor: number;
}

/** Cuánto vale cada unidad en la unidad base de su magnitud. */
const UNIDADES: Record<string, { magnitud: Magnitud; factor: number }> = {
  kg: { magnitud: 'masa', factor: 1000 },
  kgs: { magnitud: 'masa', factor: 1000 },
  kilo: { magnitud: 'masa', factor: 1000 },
  kilos: { magnitud: 'masa', factor: 1000 },
  kilogramo: { magnitud: 'masa', factor: 1000 },
  kilogramos: { magnitud: 'masa', factor: 1000 },
  g: { magnitud: 'masa', factor: 1 },
  gr: { magnitud: 'masa', factor: 1 },
  grs: { magnitud: 'masa', factor: 1 },
  gramo: { magnitud: 'masa', factor: 1 },
  gramos: { magnitud: 'masa', factor: 1 },
  lb: { magnitud: 'masa', factor: 453.592 },
  lbs: { magnitud: 'masa', factor: 453.592 },
  libra: { magnitud: 'masa', factor: 453.592 },
  libras: { magnitud: 'masa', factor: 453.592 },
  oz: { magnitud: 'masa', factor: 28.3495 },
  onza: { magnitud: 'masa', factor: 28.3495 },
  onzas: { magnitud: 'masa', factor: 28.3495 },
  floz: { magnitud: 'volumen', factor: 29.5735 },
  ml: { magnitud: 'volumen', factor: 1 },
  cc: { magnitud: 'volumen', factor: 1 },
  l: { magnitud: 'volumen', factor: 1000 },
  lt: { magnitud: 'volumen', factor: 1000 },
  lts: { magnitud: 'volumen', factor: 1000 },
  litro: { magnitud: 'volumen', factor: 1000 },
  litros: { magnitud: 'volumen', factor: 1000 },
  gal: { magnitud: 'volumen', factor: 3785.41 },
  galon: { magnitud: 'volumen', factor: 3785.41 },
  galones: { magnitud: 'volumen', factor: 3785.41 },
  u: { magnitud: 'unidades', factor: 1 },
  un: { magnitud: 'unidades', factor: 1 },
  und: { magnitud: 'unidades', factor: 1 },
  unds: { magnitud: 'unidades', factor: 1 },
  unid: { magnitud: 'unidades', factor: 1 },
  unidad: { magnitud: 'unidades', factor: 1 },
  unidades: { magnitud: 'unidades', factor: 1 },
  uds: { magnitud: 'unidades', factor: 1 },
  pzas: { magnitud: 'unidades', factor: 1 },
  piezas: { magnitud: 'unidades', factor: 1 },
};

const ALTERNATIVAS = Object.keys(UNIDADES)
  .sort((a, b) => b.length - a.length)
  .join('|');
/** "1.75 kg", "3,3lbs", "16 fl oz" */
const CON_UNIDAD = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${ALTERNATIVAS})(?![a-z])`, 'g');
/** "Cartón de 30", "x 12" */
const CONTEO = /(?:\bde|\bx)\s*(\d+)\b(?!\s*[.,]?\d)/g;

/** Minúsculas, sin tildes ni puntos de abreviatura ("Galón" -> "galon", "fl. oz" -> "floz"). */
function limpiar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bfl\.?\s*oz\b/g, 'floz')
    .replace(/([a-z])\./g, '$1');
}

/** Todas las cantidades que aparecen en un texto, en el orden en que aparecen. */
export function cantidadesEn(texto: string | undefined | null): Cantidad[] {
  if (!texto) return [];
  const t = limpiar(texto);
  const encontradas: { pos: number; c: Cantidad }[] = [];
  for (const m of t.matchAll(CON_UNIDAD)) {
    const u = UNIDADES[m[2]];
    const numero = Number(m[1].replace(',', '.'));
    if (u && Number.isFinite(numero) && numero > 0) {
      encontradas.push({ pos: m.index ?? 0, c: { magnitud: u.magnitud, valor: numero * u.factor } });
    }
  }
  if (encontradas.length === 0) {
    for (const m of t.matchAll(CONTEO)) {
      encontradas.push({ pos: m.index ?? 0, c: { magnitud: 'unidades', valor: Number(m[1]) } });
    }
  }
  // "Galón" o "Litro" solos = 1 galón / 1 litro.
  if (encontradas.length === 0) {
    const sola = /(?:^|\s)(galon|litro|kilo|libra)(?![a-z])/.exec(t);
    if (sola) {
      const u = UNIDADES[sola[1]];
      encontradas.push({ pos: sola.index, c: { magnitud: u.magnitud, valor: u.factor } });
    }
  }
  return encontradas.sort((a, b) => a.pos - b.pos).map((x) => x.c);
}

/** La cantidad de una presentación ("Bolsa 5 lb" -> 2268 g). Null si no se entiende. */
export function cantidadDe(texto: string | undefined | null): Cantidad | null {
  return cantidadesEn(texto)[0] ?? null;
}

/** ¿Son la misma cantidad? Tolera el redondeo de las etiquetas (3.3 lb ≈ 1.5 kg). */
export function mismaCantidad(a: Cantidad, b: Cantidad): boolean {
  if (a.magnitud !== b.magnitud) return false;
  const mayor = Math.max(a.valor, b.valor);
  return Math.abs(a.valor - b.valor) <= mayor * 0.015;
}

function textoPlano(texto: string): string {
  return limpiar(texto)
    .replace(/[^a-z0-9ñ.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * ¿El nombre ya dice la presentación? ("MANHATTAN Arroz Blanco 3.3 LBS" + "3.3 lb" -> sí).
 * Compara cantidades normalizadas; si la presentación no trae cantidad, compara el texto.
 */
export function nombreIncluyePresentacion(nombre: string, presentacion: string | undefined | null): boolean {
  if (!presentacion) return false;
  const delaPresentacion = cantidadDe(presentacion);
  if (delaPresentacion) return cantidadesEn(nombre).some((c) => mismaCantidad(c, delaPresentacion));
  const p = textoPlano(presentacion);
  return p.length > 0 && textoPlano(nombre).endsWith(p);
}

/** Presentación a mostrar junto al nombre, o undefined si el nombre ya la dice. */
export function presentacionVisible(g: { nombre: string; presentacion?: string }): string | undefined {
  return g.presentacion && !nombreIncluyePresentacion(g.nombre, g.presentacion) ? g.presentacion : undefined;
}

/** "Arroz Progreso · Bolsa 5 lb", sin repetir la presentación si ya está en el nombre. */
export function nombreCompleto(g: { nombre: string; presentacion?: string }, separador = ' · '): string {
  return [g.nombre, presentacionVisible(g)].filter(Boolean).join(separador);
}

/**
 * ¿Los dos productos tienen distinto tamaño? Usa la presentación (o el nombre si no hay).
 * Si no se puede saber, compara el texto de la presentación.
 */
export function tamanoDistinto(
  a: { nombre: string; presentacion?: string },
  b: { nombre: string; presentacion?: string },
): boolean {
  const ca = cantidadDe(a.presentacion) ?? cantidadesEn(a.nombre).at(-1) ?? null;
  const cb = cantidadDe(b.presentacion) ?? cantidadesEn(b.nombre).at(-1) ?? null;
  if (ca && cb) return !mismaCantidad(ca, cb);
  if (ca || cb) return false; // Solo uno dice su tamaño: no lo sabemos.
  if (!a.presentacion || !b.presentacion) return false;
  const sinEnvase = (t: string) => textoPlano(t).replace(/^(bolsa|caja|botella|lata|frasco|paquete)\s+/, '');
  return sinEnvase(a.presentacion) !== sinEnvase(b.presentacion);
}
