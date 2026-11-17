/**
 * Emparejamiento "probable" de productos de distintas tiendas cuando no hay
 * código de barras en común. Es CONSERVADOR: prefiere dejar dos productos sin
 * emparejar antes que juntar dos productos distintos.
 *
 * Dos productos son "probablemente el mismo" solo si:
 *  1. Tienen la misma marca (normalizada: sin tildes ni espacios, con alias).
 *  2. Tienen la misma cantidad (tolerancia 3 %: 946 ml ≈ 0.946 l; 12 oz ≈ 355 ml;
 *     "30u" = "30 un") y el mismo número de unidades por paquete.
 *  3. Las palabras que describen el producto (quitando marca, cantidades y ruido
 *     como "refresco", "uht", "sabor") coinciden TODAS. Se aceptan abreviaturas
 *     ("Desl" = deslactosada, "Volt" = volteado) y una letra de diferencia
 *     ("Ridemax" = "Rindemax"). Solo se perdona que falte en un lado una palabra
 *     "leve" (p. ej. "entera", "original", "lata") y, en los grupos excluyentes
 *     (color, tamaño del huevo, envase, hoja doble/triple…), que un lado no lo diga;
 *     si los dos lo dicen, debe coincidir.
 *  4. Si se conocen los precios, ninguno cuesta más de 1.5 veces el otro.
 * Cualquier variante que solo diga un lado ("sin azúcar", "light", "deslactosada",
 * "bolsa", "picante", "fortificada"…) descarta el par.
 */
import { interpretarPresentacion, normalizarTexto, separarPalabras, type UnidadBase } from './normalizar';
import type { Producto } from './tipos';

/** Puntuación mínima para emparejar como "probable" (0 a 1). */
export const UMBRAL_PROBABLE = 0.8;
/** Diferencia relativa máxima entre cantidades (3 %). */
export const TOLERANCIA_CANTIDAD = 0.03;
/**
 * Seguro de precio: si uno cuesta más de 1.5 veces el otro (comparando los precios
 * más cercanos entre normal y oferta), probablemente no es el mismo producto.
 */
export const RAZON_PRECIO_MAXIMA = 1.5;

/** Marcas que las tiendas escriben distinto (ya sin espacios ni tildes). */
const ALIAS_MARCAS: Record<string, string> = {
  coke: 'cocacola',
  cocacolacompany: 'cocacola',
  coffemate: 'coffeemate',
  guitty: 'gutty',
};

/** Palabras que no dicen nada del producto. */
const RUIDO = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'con', 'en', 'y', 'e', 'a', 'al', 'para', 'por', 'x', 'c', 'd',
  'refresco', 'bebida', 'uht', 'ld', 'carbonatado', 'carbonatada', 'sabor', 'marca', 'brand', 'producto',
  'hoja', 'hj', 'hja', 'hjas', 'nuevo', 'nueva', 'oferta', 'promo', 'presentacion',
  // unidades sueltas (la cantidad se compara aparte)
  'kg', 'kgs', 'g', 'gr', 'grs', 'gramo', 'ml', 'mls', 'l', 'lt', 'lts', 'ltr', 'ltrs', 'litro', 'oz', 'onz',
  'onza', 'lb', 'lbs', 'libra', 'gal', 'galon', 'un', 'und', 'unds', 'uni', 'u', 'unidad', 'unidade', 'ct',
  'rollo', 'rol', 'r', 'pack', 'pk', 'paquete',
]);

/** Si solo un lado la dice, no impide emparejar (pero baja un poco la puntuación). */
const LEVES = new Set(['entera', 'entero', 'original', 'clasico', 'clasica', 'tradicional', 'medio', 'vitaminada', 'vitaminado']);

/**
 * Grupos excluyentes: si los dos productos dicen algo del grupo, debe coincidir;
 * si solo uno lo dice, se perdona.
 */
const GRUPOS: Record<string, Record<string, string>> = {
  color: {
    rojo: 'rojo', roja: 'rojo', negro: 'negro', negra: 'negro', blanco: 'blanco', blanca: 'blanco',
    amarillo: 'amarillo', amarilla: 'amarillo', verde: 'verde', morena: 'morena', moreno: 'morena',
    rosado: 'rosado', rosada: 'rosado',
  },
  tamano: {
    pequeno: 'pequeno', pequena: 'pequeno', mediano: 'mediano', mediana: 'mediano', grande: 'grande',
    extragrande: 'extragrande', jumbo: 'jumbo',
  },
  envase: {
    lata: 'lata', botella: 'botella', vidrio: 'vidrio', pet: 'pet', carton: 'carton', bote: 'bote',
    frasco: 'frasco', doypack: 'doypack', tetra: 'tetra', tetrapack: 'tetra', caja: 'caja',
  },
  capas: { sencilla: 'sencilla', doble: 'doble', triple: 'triple' },
  // frijoles: "volteados" y "refritos" son lo mismo en Honduras
  preparacion: { entero: 'entero', volteado: 'volteado', voltead: 'volteado', volt: 'volteado', refrito: 'volteado', licuado: 'licuado', parado: 'parado' },
};

/** Frases que se unen o cambian antes de separar palabras (texto ya normalizado). */
const FRASES: Array<[RegExp, string]> = [
  [/\b(?:sin|cero|0|s) azucar(?:es)?\b/g, ' sinazucar '],
  [/\bzero\b/g, ' sinazucar '],
  [/\b(?:diet|dieta|dietetica|lite)\b/g, ' light '],
  [/\bsemi descremada\b/g, ' semidescremada '],
  [/\bsin lactosa\b/g, ' deslactosada '],
  [/\bextra grande\b/g, ' extragrande '],
  [/\bxl\b/g, ' extragrande '],
  [/\bdoy pack\b/g, ' doypack '],
  [/\bregular\b/g, ' original '],
  [/\bsix pack\b/g, ' 6 pack '],
  [/\bmil hojas\b/g, ' 1000 hojas '],
];

export interface Cantidad {
  cantidad: number;
  unidad: UnidadBase;
}

export interface Firma {
  /** Marca normalizada y sin espacios ("cocacola"), si se conoce. */
  marca?: string;
  /** Palabras del nombre (normalizadas, sin quitar nada), para buscar la marca dentro. */
  palabras: string[];
  /** Cantidad del producto con equivalencias (p. ej. oz → g y ml). Vacío si no se sabe. */
  cantidades: Cantidad[];
  /** Unidades por paquete ("6 pack", "12 x 355 ml"); 'si' si es paquete sin número. */
  paquete?: number | 'si';
  /** Palabras descriptivas (sin ruido, sin números, en singular). */
  descriptivas: string[];
  /** Precio normal y, si hay, de oferta (para el seguro de precio). */
  precios: number[];
}

type DatosProducto = Pick<Producto, 'nombre' | 'marca'> & Partial<Pick<Producto, 'precio' | 'precioOferta'>>;

const sinEspacios = (t: string) => t.replace(/\s+/g, '');

/** Marca normalizada: "Coca-Cola" → "cocacola", "CLOVER BRAND" → "clover". */
export function normalizarMarca(marca: string | undefined): string | undefined {
  if (!marca) return undefined;
  const n = sinEspacios(normalizarTexto(marca).replace(/\b(?:brand|marca)\b/g, '').replace(/\./g, ''));
  if (n.length < 2) return undefined;
  return ALIAS_MARCAS[n] ?? n;
}

/** "frijoles" → "frijole", "rojos" → "rojo" (basta para comparar con prefijos). */
function singular(t: string): string {
  return t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t;
}

function textoNormalizado(nombre: string): string {
  let s = ` ${normalizarTexto(separarPalabras(nombre).replace(/%/g, ' '))} `;
  for (const [re, por] of FRASES) s = s.replace(re, por);
  return s.replace(/\s+/g, ' ').trim();
}

function cantidadesDe(nombre: string, texto: string): Cantidad[] {
  const p = interpretarPresentacion(separarPalabras(nombre));
  if (p) {
    const salida: Cantidad[] = [{ cantidad: p.cantidad, unidad: p.unidad }];
    // "12 oz" puede ser peso (340 g) o volumen (355 ml): se aceptan las dos.
    if (/ oz$/.test(p.texto)) salida.push({ cantidad: Math.round(parseFloat(p.texto) * 29.5735 * 100) / 100, unidad: 'ml' });
    return salida;
  }
  // "12R", "4 R" (rollos de papel) que el intérprete general no toma.
  const r = texto.match(/\b(\d+)\s?r\b/);
  return r ? [{ cantidad: Number(r[1]), unidad: 'un' }] : [];
}

function paqueteDe(texto: string): number | 'si' | undefined {
  const m =
    texto.match(/\b(\d+)\s?x\s?\d/) ??
    texto.match(/\b(\d+)\s?(?:pack|pk|paq)\b/) ??
    texto.match(/\b(?:pack|paquete|fardo)\s(?:de\s)?(\d+)\b/) ??
    texto.match(/\bx\s?(\d+)$/);
  if (m) return Number(m[1]);
  return /\b(?:pack|paquete|fardo)\b/.test(texto) ? 'si' : undefined;
}

/** Calcula la "firma" de un producto para compararlo con otros. */
export function firmaDe(p: DatosProducto): Firma {
  const texto = textoNormalizado(p.nombre);
  const palabras = texto.split(' ').filter(Boolean);
  const esHuevo = palabras.some((w) => w.startsWith('huevo'));
  const descriptivas: string[] = [];
  for (const w of palabras) {
    let t = w.replace(/\./g, '');
    if (!t || /\d/.test(t)) continue;
    // Letras de tamaño de huevo: "Cartón M", "Huevo G".
    if (esHuevo && ['p', 'm', 'g'].includes(t)) t = { p: 'pequeno', m: 'mediano', g: 'grande' }[t]!;
    t = singular(t);
    if (t.length < 2 || RUIDO.has(t)) continue;
    if (!descriptivas.includes(t)) descriptivas.push(t);
  }
  return {
    marca: normalizarMarca(p.marca),
    palabras,
    cantidades: cantidadesDe(p.nombre, texto),
    paquete: paqueteDe(texto),
    descriptivas,
    precios: [p.precio, p.precioOferta].filter((x): x is number => typeof x === 'number' && x > 0),
  };
}

/** ¿La marca (sin espacios) aparece como palabras seguidas en el nombre? */
function marcaEnPalabras(marca: string, palabras: string[]): boolean {
  for (let i = 0; i < palabras.length; i++) {
    let unidas = '';
    for (let j = i; j < Math.min(i + 4, palabras.length); j++) {
      unidas += palabras[j];
      if ((ALIAS_MARCAS[unidas] ?? unidas) === marca) return true;
      if (unidas.length >= marca.length) break;
    }
  }
  return false;
}

/** Misma marca: iguales, o la marca de uno aparece en el nombre del otro. */
export function marcasCompatibles(a: Firma, b: Firma): boolean {
  if (a.marca && b.marca && a.marca === b.marca) return true;
  if (a.marca && a.marca.length >= 3 && marcaEnPalabras(a.marca, b.palabras)) return true;
  if (b.marca && b.marca.length >= 3 && marcaEnPalabras(b.marca, a.palabras)) return true;
  return false;
}

/** Cercanía de cantidades: 1 = idénticas, 0 = en el límite; undefined = distintas o desconocidas. */
export function cercaniaCantidad(a: Firma, b: Firma): number | undefined {
  let mejor: number | undefined;
  for (const x of a.cantidades) {
    for (const y of b.cantidades) {
      if (x.unidad !== y.unidad) continue;
      const dif = Math.abs(x.cantidad - y.cantidad) / Math.max(x.cantidad, y.cantidad);
      if (dif <= TOLERANCIA_CANTIDAD) mejor = Math.max(mejor ?? 0, 1 - dif / TOLERANCIA_CANTIDAD);
    }
  }
  return mejor;
}

/** Precio mayor / menor, con la combinación (normal u oferta) más cercana; undefined si falta alguno. */
function razonPrecio(a: Firma, b: Firma): number | undefined {
  let mejor: number | undefined;
  for (const x of a.precios) {
    for (const y of b.precios) {
      const r = Math.max(x, y) / Math.min(x, y);
      mejor = mejor === undefined ? r : Math.min(mejor, r);
    }
  }
  return mejor;
}

/** Distancia de edición ≤ 1 (una letra cambiada, sobrante o faltante). */
function unaLetra(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let difs = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++difs > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return difs + (a.length - i) + (b.length - j) <= 1;
}

/** Dos palabras "son la misma": iguales, abreviatura (prefijo ≥ 3 letras) o una letra de diferencia (≥ 5 letras). */
export function palabrasIguales(a: string, b: string): boolean {
  if (a === b) return true;
  const [corta, larga] = a.length <= b.length ? [a, b] : [b, a];
  if (corta.length >= 3 && larga.startsWith(corta)) return true;
  return corta.length >= 5 && unaLetra(a, b);
}

function grupoDe(t: string): [string, string] | undefined {
  for (const [g, valores] of Object.entries(GRUPOS)) if (valores[t]) return [g, valores[t]];
  return undefined;
}

export interface Comparacion {
  puntuacion: number;
  /** Por qué se descartó (para depurar y para las pruebas). */
  motivo?: string;
}

/**
 * Compara dos productos (de tiendas distintas) y devuelve una puntuación de 0 a 1.
 * 0 = no son el mismo (con el motivo). Emparejar solo si ≥ UMBRAL_PROBABLE.
 */
export function compararProductos(pa: DatosProducto, pb: DatosProducto): Comparacion {
  return compararFirmas(firmaDe(pa), firmaDe(pb));
}

export function compararFirmas(a: Firma, b: Firma): Comparacion {
  if (!marcasCompatibles(a, b)) return { puntuacion: 0, motivo: 'marca' };
  const cercania = cercaniaCantidad(a, b);
  if (cercania === undefined) return { puntuacion: 0, motivo: 'cantidad' };
  if (a.paquete !== b.paquete) return { puntuacion: 0, motivo: 'paquete' };
  const razon = razonPrecio(a, b);
  if (razon !== undefined && razon > RAZON_PRECIO_MAXIMA) return { puntuacion: 0, motivo: 'precio' };

  // Quitar de las palabras las de la marca (de cualquiera de los dos lados).
  const marcas = [a.marca, b.marca].filter((m): m is string => !!m);
  const esDeMarca = (t: string) => marcas.some((m) => m === t || (t.length >= 3 && m.includes(t) && (m.startsWith(t) || m.endsWith(t))));
  const da = a.descriptivas.filter((t) => !esDeMarca(t));
  const db = b.descriptivas.filter((t) => !esDeMarca(t));

  // Grupos excluyentes.
  const valores = (ts: string[]) => {
    const m = new Map<string, Set<string>>();
    for (const t of ts) {
      const g = grupoDe(t);
      if (g) (m.get(g[0]) ?? m.set(g[0], new Set()).get(g[0])!).add(g[1]);
    }
    return m;
  };
  const ga = valores(da);
  const gb = valores(db);
  let gruposIguales = 0;
  for (const [g, va] of ga) {
    const vb = gb.get(g);
    if (!vb) continue;
    if (![...va].some((v) => vb.has(v))) return { puntuacion: 0, motivo: `variante (${g})` };
    gruposIguales++;
  }

  // Palabras restantes: todas deben tener pareja, salvo las leves.
  const libres = (ts: string[]) => ts.filter((t) => !grupoDe(t));
  const la = libres(da);
  const lb = libres(db);
  let comunes = 0;
  let levesSueltas = 0;
  const sobrantes: string[] = [];
  for (const t of la) {
    if (lb.some((u) => palabrasIguales(t, u))) comunes++;
    else if (LEVES.has(t)) levesSueltas++;
    else sobrantes.push(t);
  }
  for (const u of lb) {
    if (la.some((t) => palabrasIguales(t, u))) continue;
    if (LEVES.has(u)) levesSueltas++;
    else sobrantes.push(u);
  }
  if (sobrantes.length > 0) return { puntuacion: 0, motivo: `palabras distintas (${sobrantes.join(', ')})` };

  // Puntuación: base por pasar todos los filtros + cercanía de cantidad, de palabras y de precio.
  const gruposSueltos = [...ga.keys(), ...gb.keys()].filter((g) => !(ga.has(g) && gb.has(g))).length;
  const acuerdo = (comunes + gruposIguales + 1) / (comunes + gruposIguales + levesSueltas + gruposSueltos + 1);
  const marcaExacta = a.marca && b.marca && a.marca === b.marca ? 1 : 0;
  const cercaniaPrecio = razon === undefined ? 0.5 : 1 - (razon - 1) / (RAZON_PRECIO_MAXIMA - 1);
  const puntuacion = 0.6 + 0.15 * cercania + 0.1 * acuerdo + 0.05 * marcaExacta + 0.1 * cercaniaPrecio;
  return { puntuacion: Math.round(puntuacion * 1000) / 1000 };
}
