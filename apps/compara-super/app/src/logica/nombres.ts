// Nombre más legible para los productos que vienen con el nombre crudo de la tienda
// (p. ej. un sustituto: "PROGRESO Arroz BlancoGranoLar1.75Kg" -> "Progreso Arroz Blanco Grano Lar 1.75 Kg").
// Es la misma idea que `nombreParaMostrar` del servidor (precios/src/normalizar.ts), que
// limpia el nombre de los grupos; aquí no se quita la presentación porque el
// nombre de la tienda es lo único que dice el tamaño.
// Solo cambia lo que se MUESTRA: el nombre original se guarda tal cual porque el
// servidor lo usa para volver a encontrar el producto en la tienda.

const MINUS = 'a-záéíóúñü';
const MAYUS = 'A-ZÁÉÍÓÚÑÜ';
const UNIDADES =
  'kgs?|kilos?|kilogramos?|grs?|gramos?|g|lbs?|libras?|oz|onzas?|fl\\.?\\s?oz|mls?|mililitros?|lts?|litros?|l|gal(?:on|ones)?|unidades|unidad|unds?|un|ct|pzs|piezas?';

const tieneMinusculas = (t: string) => new RegExp(`[${MINUS}]`).test(t);

/** "PROGRESO" -> "Progreso", "MR DIECK" -> "Mr Dieck". */
function tipoTitulo(texto: string): string {
  return texto
    .toLowerCase()
    .split(' ')
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(' ');
}

/**
 * Separa palabras pegadas: "BlancoGranoLar1.75Kg" -> "Blanco Grano Lar 1.75 Kg".
 * Para no romper marcas como "McCormick" solo separa una mayúscula si antes hay
 * al menos 3 minúsculas seguidas.
 */
function separarPalabras(texto: string): string {
  return texto
    .replace(new RegExp(`(?<=[${MINUS}]{3})(?=[${MAYUS}])`, 'g'), ' ')
    .replace(new RegExp(`(?<=[${MINUS}]{2})(?=\\d)`, 'g'), ' ')
    .replace(new RegExp(`(?<=\\d)(?=(?:${UNIDADES})(?![a-z]))`, 'gi'), ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cuántas palabras del inicio están en MAYÚSCULAS (así pone Colonial la marca). */
function palabrasInicialesEnMayusculas(palabras: string[]): number {
  let n = 0;
  for (const p of palabras) {
    const letras = p.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g, '');
    if (letras.length >= 1 && letras === letras.toUpperCase() && new RegExp(`[${MAYUS}]`).test(letras)) n++;
    else break;
  }
  return n === palabras.length ? 0 : n;
}

/**
 * Nombre de un producto tal como lo da la tienda, más fácil de leer:
 * separa palabras pegadas y pasa a formato Título la marca en MAYÚSCULAS
 * (o todo el nombre si viene entero en mayúsculas).
 * "PROGRESO Arroz BlancoGranoLar1.75Kg" -> "Progreso Arroz Blanco Grano Lar 1.75 Kg".
 */
export function nombreLegible(nombre: string): string {
  const original = nombre.trim();
  const s = separarPalabras(original);
  if (!s) return original;
  if (!tieneMinusculas(s)) return tipoTitulo(s);
  const palabras = s.split(' ');
  const n = palabrasInicialesEnMayusculas(palabras);
  if (n === 0) return s;
  return [tipoTitulo(palabras.slice(0, n).join(' ')), ...palabras.slice(n)].join(' ');
}
