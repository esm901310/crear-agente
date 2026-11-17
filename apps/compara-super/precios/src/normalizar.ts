/** Utilidades para limpiar y comparar productos de distintas tiendas. */

/** Minúsculas, sin tildes, sin signos, espacios simples. Útil para comparar nombres. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Convierte "62.49", 62.49 o "L 62.49" a número; devuelve undefined si no es un precio válido (> 0). */
export function aPrecio(valor: unknown): number | undefined {
  if (valor === null || valor === undefined) return undefined;
  const n = typeof valor === 'number' ? valor : Number(String(valor).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n * 100) / 100;
}

/** Devuelve { precio, precioOferta } a partir de precio normal y precio actual. */
export function armarPrecios(
  normal: number | undefined,
  actual: number | undefined,
): { precio: number; precioOferta?: number } | undefined {
  if (actual === undefined && normal === undefined) return undefined;
  if (actual === undefined) return { precio: normal! };
  if (normal !== undefined && actual < normal) return { precio: normal, precioOferta: actual };
  return { precio: actual };
}

export type UnidadBase = 'g' | 'ml' | 'un';

export interface PresentacionInterpretada {
  cantidad: number;
  unidad: UnidadBase;
  /** Texto legible, p. ej. "1.75 kg". */
  texto: string;
}

const UNIDADES: Array<{ re: RegExp; unidad: UnidadBase; factor: number; etiqueta: string }> = [
  { re: /^(kg|kgs|kilo|kilos|kilogramos?)$/, unidad: 'g', factor: 1000, etiqueta: 'kg' },
  { re: /^(g|gr|grs|gramos?)$/, unidad: 'g', factor: 1, etiqueta: 'g' },
  { re: /^(lb|lbs|libras?)$/, unidad: 'g', factor: 453.592, etiqueta: 'lb' },
  { re: /^(oz|onzas?)$/, unidad: 'g', factor: 28.3495, etiqueta: 'oz' },
  { re: /^(ml|mls|mililitros?)$/, unidad: 'ml', factor: 1, etiqueta: 'ml' },
  { re: /^(l|lt|lts|litros?)$/, unidad: 'ml', factor: 1000, etiqueta: 'l' },
  { re: /^(gal|galon|galones)$/, unidad: 'ml', factor: 3785.41, etiqueta: 'gal' },
  { re: /^(fl\.?oz)$/, unidad: 'ml', factor: 29.5735, etiqueta: 'fl oz' },
  { re: /^(un|und|unds|unidad|unidades|u|ct|pzs|piezas?)$/, unidad: 'un', factor: 1, etiqueta: 'un' },
];

/** Unidades reconocidas en los nombres (en minúsculas). */
const UNIDADES_RE =
  'kgs?|kilos?|kilogramos?|grs?|gramos?|g|lbs?|libras?|oz|onzas?|fl\\.?\\s?oz|mls?|mililitros?|lts?|litros?|l|gal(?:on|ones)?|unidades|unidad|unds?|un|ct|pzs|piezas?';

/**
 * Busca en el nombre algo como "1.75 Kg", "1750Gr", "3.3 LBS", "946 ml", "BlancoGranoLar1.75Kg".
 * Toma la última coincidencia (suele ser la presentación). Devuelve cantidad en g, ml o unidades.
 */
export function interpretarPresentacion(nombre: string): PresentacionInterpretada | undefined {
  const texto = nombre
    .toLowerCase()
    .replace(/,(\d)/g, '.$1')
    // "1/2 galon" -> "0.5 galon"
    .replace(/(?<![\d.])(\d+)\s*\/\s*(\d+)(?![\d.])/g, (_, a, b) => (Number(b) ? String(Number(a) / Number(b)) : _));
  const re = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIDADES_RE})(?![a-z])`, 'g');
  let ultima: PresentacionInterpretada | undefined;
  for (const m of texto.matchAll(re)) {
    const numero = Number(m[1]);
    const u = m[2].replace(/\s/g, '');
    const def = UNIDADES.find((d) => d.re.test(u));
    if (!def || !(numero > 0)) continue;
    ultima = {
      cantidad: Math.round(numero * def.factor * 100) / 100,
      unidad: def.unidad,
      texto: `${numero} ${def.etiqueta}`,
    };
  }
  return ultima;
}

/** "PROGRESO" -> "Progreso", "MR DIECK" -> "Mr Dieck". */
export function tipoTitulo(texto: string): string {
  return texto
    .toLowerCase()
    .split(/\s+/)
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(' ');
}

/**
 * En Colonial el nombre empieza con la marca en MAYÚSCULAS ("PROGRESO Arroz Blanco...").
 * Devuelve esa marca si existe.
 */
export function marcaEnMayusculas(nombre: string): string | undefined {
  const palabras = nombre.trim().split(/\s+/);
  const marca: string[] = [];
  for (const p of palabras) {
    const letras = p.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g, '');
    if (letras.length >= 1 && letras === letras.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(letras)) {
      marca.push(p);
    } else break;
  }
  if (marca.length === 0 || marca.length === palabras.length) return undefined;
  return tipoTitulo(marca.join(' '));
}

/**
 * Agrega el dígito verificador GS1 a un código sin él (11 o 12 dígitos →
 * UPC-A o EAN-13). Los Andes guarda el UPC sin su último dígito
 * (p. ej. 70751700208 → 707517002083). Códigos internos cortos se ignoran.
 */
export function completarGtin(codigo: string): string | undefined {
  const limpio = codigo.replace(/\D/g, '');
  if (![11, 12].includes(limpio.length)) return undefined;
  let suma = 0;
  for (let i = 0; i < limpio.length; i++) {
    const digito = Number(limpio[limpio.length - 1 - i]);
    suma += digito * (i % 2 === 0 ? 3 : 1);
  }
  return limpio + ((10 - (suma % 10)) % 10);
}

/** Código de barras válido (8, 12, 13 o 14 dígitos) o undefined. */
export function limpiarCodigoBarras(codigo: unknown): string | undefined {
  if (typeof codigo !== 'string') return undefined;
  const limpio = codigo.replace(/\D/g, '');
  return [8, 12, 13, 14].includes(limpio.length) ? limpio : undefined;
}

// ---------------------------------------------------------------------------
// Nombre para mostrar
// ---------------------------------------------------------------------------

const MINUS = 'a-záéíóúñü';
const MAYUS = 'A-ZÁÉÍÓÚÑÜ';

/**
 * Separa palabras pegadas, como en los títulos de Colonial:
 * "BlancoGranoLar1.75Kg" → "Blanco Grano Lar 1.75 Kg".
 * Para no romper marcas como "McCormick" solo separa una mayúscula si antes
 * hay al menos 3 minúsculas seguidas.
 */
export function separarPalabras(texto: string): string {
  return texto
    .replace(new RegExp(`(?<=[${MINUS}]{3})(?=[${MAYUS}])`, 'g'), ' ')
    .replace(new RegExp(`(?<=[${MINUS}]{2})(?=\\d)`, 'g'), ' ')
    .replace(new RegExp(`(?<=\\d)(?=(?:${UNIDADES_RE})(?![a-z]))`, 'gi'), ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const tieneMinusculas = (t: string) => new RegExp(`[${MINUS}]`).test(t);
const escaparRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Nombre más limpio para mostrar en la app (el original se conserva aparte):
 * - separa palabras pegadas ("BlancoGranoLar1.75Kg" → "Blanco Grano Lar 1.75 Kg");
 * - pasa a formato Título la marca escrita en MAYÚSCULAS ("PROGRESO" → "Progreso"),
 *   o todo el nombre si viene entero en mayúsculas;
 * - quita la presentación del nombre si es la misma que va en `presentacion`
 *   ("... 1.75 Kg" con presentacion "1.75 kg").
 * Ej.: "PROGRESO Arroz BlancoGranoLar1.75Kg" → "Progreso Arroz Blanco Grano Lar".
 */
export function nombreParaMostrar(nombre: string, opciones: { marca?: string; presentacion?: string } = {}): string {
  let s = separarPalabras(nombre.trim());
  if (!s) return nombre.trim();

  // Mayúsculas → Título.
  if (!tieneMinusculas(s)) {
    s = tipoTitulo(s);
  } else {
    const marca = opciones.marca?.trim();
    if (marca) {
      const bonita = tieneMinusculas(marca) ? marca : tipoTitulo(marca);
      const re = new RegExp(`(?<![\\p{L}\\p{N}])${escaparRe(marca).replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}])`, 'giu');
      s = s.replace(re, (m) => (tieneMinusculas(m) ? m : bonita));
    }
    // Palabras iniciales en MAYÚSCULAS (así pone Colonial la marca) aunque no sepamos la marca.
    const inicial = marcaEnMayusculas(s);
    if (inicial) {
      const palabras = s.split(' ');
      s = [tipoTitulo(palabras.slice(0, inicial.split(' ').length).join(' ')), ...palabras.slice(inicial.split(' ').length)].join(' ');
    }
  }

  // Quitar la presentación si ya va aparte.
  const presentacion = opciones.presentacion?.trim().toLowerCase();
  if (presentacion) {
    const re = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNIDADES_RE})(?![a-z])`, 'gi');
    let ultima: RegExpMatchArray | undefined;
    for (const m of s.matchAll(re)) {
      if (interpretarPresentacion(m[0])?.texto.toLowerCase() === presentacion) ultima = m;
    }
    if (ultima && ultima.index !== undefined) {
      const sin = (s.slice(0, ultima.index) + ' ' + s.slice(ultima.index + ultima[0].length))
        .replace(/\s+/g, ' ')
        .replace(/(?:\s+(?:de|x|-|–|,|\/))+\s*$/i, '')
        .replace(/[\s,\-–/]+$/, '')
        .replace(/\(\s*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (sin.length >= 3) s = sin;
    }
  }
  return s;
}
