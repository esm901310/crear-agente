/**
 * Emparejamiento "probable" de productos de distintas tiendas cuando no hay
 * código de barras en común. Es CONSERVADOR: prefiere dejar dos productos sin
 * emparejar antes que juntar dos productos distintos (una app de precios no puede
 * decir "más barato" comparando productos distintos).
 *
 * Dos productos son "probablemente el mismo" solo si:
 *  1. Marca: si las dos tiendas dicen la marca, debe ser la MISMA completa
 *     (sin tildes ni espacios, con alias: "MC CORMICK" = "McCormick"; "PINOS" ≠
 *     "Dos Pinos"). Si solo una la dice, debe aparecer completa en el nombre del otro.
 *  2. Cantidad igual con tolerancia de 3 % (946 ml ≈ 0.946 l; 12 oz ≈ 355 ml;
 *     "30u" = "30 un") y el mismo número de unidades por paquete.
 *  3. Los OTROS números del nombre deben ser iguales en los dos ("Etapa 3",
 *     "2%", "70%", "2en1", "Talla 4", "1000 hojas"…): si un lado tiene uno que el
 *     otro no, no se une.
 *  4. Las palabras que describen el producto (quitando marca, cantidades y ruido
 *     como "refresco", "uht", "sabor") coinciden TODAS. Se aceptan abreviaturas
 *     ("Desl" = deslactosada, "Volt" = volteado: prefijo de ≥ 4 letras que no
 *     termina en vocal, o de una lista blanca) y una letra de diferencia en
 *     palabras de ≥ 6 letras con la misma primera y última letra ("Ridemax" =
 *     "Rindemax"). Nunca se aceptan entre dos palabras conocidas distintas
 *     (fresa/fresca, coco/cocoa, sal/salsa, descremada/deslactosada…).
 *     Solo se perdona que un lado no diga una palabra "leve" ("entera",
 *     "original"), un dato de un grupo excluyente perdonable (tamaño del huevo,
 *     envase, hoja doble/triple, frijol volteado/entero) o "blanco/a" (valor por
 *     defecto del color). Color (morena, rubia, negro, rojo…) y talla (S, M, G,
 *     XG…) deben coincidir y NO se perdonan si solo un lado los dice.
 *  5. Si se conocen los precios, ninguno cuesta más de 1.5 veces el otro.
 * Cualquier variante que solo diga un lado ("sin azúcar", "light", "deslactosada",
 * "integral", "bolsa", "picante", "fortificada"…) descarta el par.
 */
import { interpretarPresentacion, normalizarTexto, separarPalabras, UNIDADES_RE, type UnidadBase } from './normalizar';
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
  'de', 'del', 'la', 'el', 'los', 'las', 'con', 'en', 'y', 'e', 'a', 'o', 'al', 'para', 'por', 'x', 'c', 'd',
  'refresco', 'bebida', 'uht', 'ld', 'carbonatado', 'carbonatada', 'sabor', 'marca', 'brand', 'producto',
  'hoja', 'hj', 'hja', 'hjas', 'nuevo', 'nueva', 'oferta', 'promo', 'presentacion', 'talla',
  // unidades sueltas (la cantidad se compara aparte)
  'kg', 'kgs', 'g', 'gr', 'grs', 'gramo', 'ml', 'mls', 'l', 'lt', 'lts', 'ltr', 'ltrs', 'litro', 'oz', 'onz',
  'onza', 'lb', 'lbs', 'libr', 'libra', 'gal', 'gl', 'galon', 'un', 'und', 'unds', 'uni', 'u', 'unidad',
  'unidade', 'ct', 'rollo', 'rol', 'r', 'pack', 'pk', 'paq', 'paquete',
]);

/** Si solo un lado la dice, no impide emparejar (pero baja un poco la puntuación). */
const LEVES = new Set(['entera', 'entero', 'original', 'clasico', 'clasica', 'tradicional', 'medio', 'vitaminada', 'vitaminado']);

/** Palabras que una tienda puede omitir porque otra palabra ya las implica ("Ketchup" = "Salsa Ketchup"). */
const IMPLICITAS: Record<string, string[]> = {
  ketchup: ['salsa'],
  catsup: ['salsa'],
};

interface DefGrupo {
  valores: Record<string, string>;
  /** true: si solo un lado lo dice, NO se perdona (salvo `porDefecto`). */
  estricto?: boolean;
  /** Valor que se asume cuando no se dice (se perdona si solo un lado lo dice). */
  porDefecto?: string;
}

/**
 * Grupos excluyentes: si los dos productos dicen algo del grupo, debe coincidir.
 * Si solo uno lo dice: se perdona, salvo en los grupos estrictos.
 */
const GRUPOS: Record<string, DefGrupo> = {
  color: {
    estricto: true,
    porDefecto: 'blanco',
    valores: {
      rojo: 'rojo', roja: 'rojo', negro: 'negro', negra: 'negro', blanco: 'blanco', blanca: 'blanco',
      amarillo: 'amarillo', amarilla: 'amarillo', verde: 'verde', morena: 'morena', moreno: 'morena',
      rubia: 'rubia', rubio: 'rubia', rosado: 'rosado', rosada: 'rosado', dorada: 'dorado', dorado: 'dorado',
    },
  },
  talla: { estricto: true, valores: {} }, // los valores se ponen al leer el nombre ("talla:m")
  tamano: {
    valores: {
      pequeno: 'pequeno', pequena: 'pequeno', mediano: 'mediano', mediana: 'mediano', grande: 'grande',
      extragrande: 'extragrande', jumbo: 'jumbo',
    },
  },
  envase: {
    valores: {
      lata: 'lata', botella: 'botella', vidrio: 'vidrio', pet: 'pet', carton: 'carton', bote: 'bote',
      frasco: 'frasco', doypack: 'doypack', tetra: 'tetra', tetrapack: 'tetra', caja: 'caja',
    },
  },
  capas: { valores: { sencilla: 'sencilla', doble: 'doble', triple: 'triple' } },
  // frijoles: "volteados" y "refritos" son lo mismo en Honduras
  preparacion: {
    valores: { entero: 'entero', volteado: 'volteado', voltead: 'volteado', volt: 'volteado', refrito: 'volteado', licuado: 'licuado', parado: 'parado' },
  },
};

/** Tallas (pañales, ropa). Solo cuentan como talla en un nombre que habla de tallas o pañales. */
const TALLAS = new Set(['rn', 'xs', 's', 'p', 'ch', 'm', 'med', 'g', 'gde', 'l', 'xl', 'xg', 'xxg', 'xxxg', 'eg', 'xxl', 'xxxl']);
const CONTEXTO_TALLA = /\b(?:talla|panal|panales|calzon|calzoncito|calzoncitos|etapa)\b/;

/** Abreviaturas que las tiendas usan (se aceptan como prefijo aunque sean cortas o terminen en vocal). */
const ABREVIATURAS = new Set([
  'desl', 'deslac', 'semid', 'desc', 'volt', 'voltead', 'ext', 'prem', 'orig', 'hig', 'higien', 'veg', 'oliv',
  'pican', 'energ', 'integ', 'trad', 'refr', 'choc', 'vain', 'natu', 'conc', 'past', 'pasteur',
]);

/**
 * Palabras conocidas que distinguen productos: un prefijo o una letra de
 * diferencia nunca puede hacer "iguales" a dos de ellas si son distintas.
 */
const DISCRIMINANTES = new Set([
  'fresa', 'fresca', 'fresco', 'coco', 'cocoa', 'sal', 'salsa', 'pan', 'panqueque', 'descremada', 'deslactosada',
  'semidescremada', 'entera', 'integral', 'light', 'picante', 'natural', 'original', 'vainilla', 'chocolate',
  'limon', 'limonada', 'naranja', 'naranjada', 'manzana', 'uva', 'pina', 'mango', 'durazno', 'melocoton', 'cafe',
  'canela', 'menta', 'mantequilla', 'mantequillosa', 'queso', 'crema', 'leche', 'polvo', 'fortificada',
  'sinazucar', 'molido', 'grano', 'soluble', 'instantaneo', 'instantanea', 'pollo', 'res', 'cerdo', 'pavo',
  'atun', 'arroz', 'frijol', 'maiz', 'trigo', 'avena', 'harina', 'aceite', 'oliva', 'canola', 'girasol', 'soya',
  'bolsa', 'lata', 'botella', 'regular', 'mediano', 'grande', 'pequeno', 'jumbo', 'extragrande',
  ...Object.values(GRUPOS).flatMap((g) => Object.keys(g.valores)),
  ...LEVES,
].filter((t) => !ABREVIATURAS.has(t)));

/** Frases que se unen o cambian antes de separar palabras (texto ya normalizado). */
const FRASES: Array<[RegExp, string]> = [
  [/\b(?:sin|cero|0|0pct|s) azucar(?:es)?\b/g, ' sinazucar '],
  [/\b(?:zero|sugar ?free)\b/g, ' sinazucar '],
  [/\bvanilla\b/g, ' vainilla '],
  [/\b(?:diet|dieta|dietetica|lite)\b/g, ' light '],
  [/\bsemi descremada\b/g, ' semidescremada '],
  [/\bsin lactosa\b/g, ' deslactosada '],
  [/\bextra grande\b/g, ' extragrande '],
  [/\bdoy pack\b/g, ' doypack '],
  [/\bregular\b/g, ' original '],
  [/\bsix pack\b/g, ' 6 pack '],
  [/\bmil hojas\b/g, ' 1000 hojas '],
  [/\bmc (?=[a-z])/g, ' mc'],
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
  /** Números del nombre que NO son la cantidad ni el paquete ("3", "2pct", "2en1"). */
  numeros: string[];
  /** Palabras descriptivas (sin ruido, sin números, en singular; tallas como "talla:m"). */
  descriptivas: string[];
  /** Precio normal y, si hay, de oferta (para el seguro de precio). */
  precios: number[];
}

type DatosProducto = Pick<Producto, 'nombre' | 'marca'> & Partial<Pick<Producto, 'precio' | 'precioOferta'>>;

const sinEspacios = (t: string) => t.replace(/\s+/g, '');

/** Marca normalizada: "Coca-Cola" → "cocacola", "MC CORMICK" → "mccormick", "CLOVER BRAND" → "clover". */
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

/** Texto normalizado, con números separados de las letras y frases unidas. */
function textoNormalizado(nombre: string): string {
  const crudo = separarPalabras(nombre)
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/(?<![\d.])(\d+)\s*\/\s*(\d+)(?![\d.])/g, (m, a, b) => (Number(b) ? String(Number(a) / Number(b)) : m))
    .replace(/(\d+(?:\.\d+)?)\s*%/g, ' $1pct ');
  let s = ` ${normalizarTexto(crudo)} `
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d+(?:\.\d+)?) pct\b/g, '$1pct')
    .replace(/\b(\d+) en (\d+)\b/g, '$1en$2');
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
  const r = texto.match(/\b(\d+) r\b/);
  return r ? [{ cantidad: Number(r[1]), unidad: 'un' }] : [];
}

const RE_PAQUETE: RegExp[] = [
  /\b(\d+) ?x ?(?=\d)/,
  /\b(\d+) ?(?:pack|pk|paq)\b/,
  /\b(?:pack|paquete|fardo) (?:de )?(\d+)\b/,
  /\bx ?(\d+)$/,
];

function paqueteDe(texto: string): number | 'si' | undefined {
  for (const re of RE_PAQUETE) {
    const m = texto.match(re);
    if (m) return Number(m[1]);
  }
  return /\b(?:pack|paquete|fardo)\b/.test(texto) ? 'si' : undefined;
}

/** Quita del texto las cantidades ("946 ml", "12 r") y el paquete, para ver qué otros números quedan. */
function sinCantidades(texto: string): string {
  // Primero el paquete ("12 x 355 ml", "6 pack", "pack de 6"): si se quitara antes la
  // cantidad, de "12 x 355 ml" quedaría un "12" suelto que parecería otro número.
  let s = ` ${texto} `;
  for (const re of RE_PAQUETE) s = s.replace(new RegExp(re.source, 'g'), ' ');
  s = s
    .replace(new RegExp(`\\b\\d+(?:\\.\\d+)? ?(?:${UNIDADES_RE})(?![a-z])`, 'g'), ' ')
    .replace(/\b\d+ r\b/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

/** Calcula la "firma" de un producto para compararlo con otros. */
export function firmaDe(p: DatosProducto): Firma {
  const texto = textoNormalizado(p.nombre);
  const palabras = texto.split(' ').filter(Boolean);
  const esHuevo = palabras.some((w) => w.startsWith('huevo'));
  const hayTallas = CONTEXTO_TALLA.test(texto);
  const resto = sinCantidades(texto).split(' ').filter(Boolean);
  const numeros: string[] = [];
  const descriptivas: string[] = [];
  const agregar = (lista: string[], t: string) => {
    if (!lista.includes(t)) lista.push(t);
  };
  for (const w of resto) {
    let t = w.replace(/\./g, '');
    if (!t) continue;
    if (/\d/.test(t)) {
      agregar(numeros, w.replace(/\.0+(?=\D|$)/, ''));
      continue;
    }
    // Letras de tamaño de huevo: "Cartón M", "Huevo G".
    if (esHuevo && ['p', 'm', 'g'].includes(t)) t = { p: 'pequeno', m: 'mediano', g: 'grande' }[t]!;
    else if (hayTallas && TALLAS.has(t)) {
      agregar(descriptivas, `talla:${t}`);
      continue;
    } else if (!esHuevo && ['xg', 'xxg', 'xxxg', 'xxl', 'xxxl'].includes(t)) {
      agregar(descriptivas, `talla:${t}`);
      continue;
    } else if (esHuevo && t === 'xl') t = 'extragrande';
    t = singular(t);
    if (RUIDO.has(t)) continue;
    agregar(descriptivas, t);
  }
  return {
    marca: normalizarMarca(p.marca),
    palabras,
    cantidades: cantidadesDe(p.nombre, texto),
    paquete: paqueteDe(texto),
    numeros: numeros.sort(),
    descriptivas,
    precios: [p.precio, p.precioOferta].filter((x): x is number => typeof x === 'number' && x > 0),
  };
}

/** ¿La marca (sin espacios) aparece como palabras COMPLETAS seguidas en el nombre? */
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

/**
 * Misma marca. Si las dos tiendas la dicen, debe ser idéntica (normalizada o alias).
 * Si solo una la dice, debe aparecer completa en el nombre del otro producto.
 */
export function marcasCompatibles(a: Firma, b: Firma): boolean {
  if (a.marca && b.marca) return a.marca === b.marca;
  if (a.marca) return a.marca.length >= 3 && marcaEnPalabras(a.marca, b.palabras);
  if (b.marca) return b.marca.length >= 3 && marcaEnPalabras(b.marca, a.palabras);
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

/**
 * Dos palabras "son la misma":
 * - iguales;
 * - abreviatura: la corta es prefijo de la larga y está en la lista blanca, o tiene
 *   ≥ 4 letras y no termina en vocal ("desl", "volt", "frijol"), y no es una palabra
 *   conocida distinta;
 * - una letra de diferencia, solo con ≥ 6 letras, misma primera y última letra y
 *   ninguna de las dos conocida ("ridemax" / "rindemax").
 * Dos palabras conocidas distintas (fresa/fresca, coco/cocoa) nunca son iguales.
 */
export function palabrasIguales(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.includes(':') || b.includes(':')) return false; // tallas: solo iguales
  const conocidaA = DISCRIMINANTES.has(a);
  const conocidaB = DISCRIMINANTES.has(b);
  if (conocidaA && conocidaB) return false;
  const [corta, larga] = a.length <= b.length ? [a, b] : [b, a];
  if (larga.startsWith(corta)) {
    if (ABREVIATURAS.has(corta)) return true;
    return corta.length >= 4 && !/[aeiou]$/.test(corta) && !DISCRIMINANTES.has(corta);
  }
  return (
    corta.length >= 6 &&
    !conocidaA &&
    !conocidaB &&
    a[0] === b[0] &&
    a[a.length - 1] === b[b.length - 1] &&
    unaLetra(a, b)
  );
}

function grupoDe(t: string): [string, string] | undefined {
  if (t.startsWith('talla:')) return ['talla', t.slice(6)];
  for (const [g, def] of Object.entries(GRUPOS)) if (def.valores[t]) return [g, def.valores[t]];
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

/** Palabras descriptivas sin las de la marca (de cualquiera de los dos). */
function sinMarca(a: Firma, b: Firma): [string[], string[]] {
  const marcas = [a.marca, b.marca].filter((m): m is string => !!m);
  const esDeMarca = (t: string) =>
    marcas.some((m) => m === t || (t.length >= 3 && (m.startsWith(t) || m.endsWith(t)) && marcaEnPalabras(m, [...a.palabras, ...b.palabras])));
  return [a.descriptivas.filter((t) => !esDeMarca(t)), b.descriptivas.filter((t) => !esDeMarca(t))];
}

/**
 * `modo: 'confirmar'` (producto hallado por código sin código en la imagen): igual
 * que emparejar, salvo que (1) si solo una tienda dice la marca basta, y (2) se
 * toleran palabras distintas que NO son variantes conocidas ("Glacial Almendra" /
 * "Almonette"); una variante conocida sin pareja (light, deslactosada, sin azúcar,
 * vainilla…) descarta igual.
 */
export function compararFirmas(a: Firma, b: Firma, modo: 'emparejar' | 'confirmar' = 'emparejar'): Comparacion {
  const confirmar = modo === 'confirmar';
  const marcaOk = confirmar ? !(a.marca && b.marca) || a.marca === b.marca : marcasCompatibles(a, b);
  if (!marcaOk) return { puntuacion: 0, motivo: 'marca' };
  const cercania = cercaniaCantidad(a, b);
  if (cercania === undefined) return { puntuacion: 0, motivo: 'cantidad' };
  if (a.paquete !== b.paquete) return { puntuacion: 0, motivo: 'paquete' };
  if (a.numeros.join(' ') !== b.numeros.join(' ')) {
    return { puntuacion: 0, motivo: `numeros (${a.numeros.join(' ') || '-'} / ${b.numeros.join(' ') || '-'})` };
  }
  const razon = razonPrecio(a, b);
  if (razon !== undefined && razon > RAZON_PRECIO_MAXIMA) return { puntuacion: 0, motivo: 'precio' };

  const [da, db] = sinMarca(a, b);

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
  let gruposSueltos = 0;
  for (const g of new Set([...ga.keys(), ...gb.keys()])) {
    const va = ga.get(g);
    const vb = gb.get(g);
    if (va && vb) {
      if (![...va].some((v) => vb.has(v))) return { puntuacion: 0, motivo: `variante (${g})` };
      gruposIguales++;
      continue;
    }
    const def = GRUPOS[g];
    const dicho = [...(va ?? vb)!];
    if (def.estricto && !dicho.every((v) => v === def.porDefecto)) {
      return { puntuacion: 0, motivo: `variante (${g}: solo un lado dice ${dicho.join(', ')})` };
    }
    gruposSueltos++;
  }

  // Palabras restantes: todas deben tener pareja, salvo las leves o implícitas.
  const libres = (ts: string[]) => ts.filter((t) => !grupoDe(t));
  const la = libres(da);
  const lb = libres(db);
  const implicita = (t: string, otras: string[]) => otras.some((o) => IMPLICITAS[o]?.includes(t));
  let comunes = 0;
  let levesSueltas = 0;
  const sobrantes: string[] = [];
  for (const t of la) {
    if (lb.some((u) => palabrasIguales(t, u))) comunes++;
    else if (LEVES.has(t) || implicita(t, lb)) levesSueltas++;
    else sobrantes.push(t);
  }
  for (const u of lb) {
    if (la.some((t) => palabrasIguales(t, u))) continue;
    if (LEVES.has(u) || implicita(u, la)) levesSueltas++;
    else sobrantes.push(u);
  }
  const graves = confirmar ? sobrantes.filter((t) => DISCRIMINANTES.has(t)) : sobrantes;
  if (graves.length > 0) return { puntuacion: 0, motivo: `palabras distintas (${graves.join(', ')})` };
  levesSueltas += sobrantes.length - graves.length;

  // Puntuación: base por pasar todos los filtros + cercanía de cantidad, de palabras y de precio.
  const acuerdo = (comunes + gruposIguales + 1) / (comunes + gruposIguales + levesSueltas + gruposSueltos + 1);
  const marcaExacta = a.marca && b.marca && a.marca === b.marca ? 1 : 0;
  const cercaniaPrecio = razon === undefined ? 0.5 : 1 - (razon - 1) / (RAZON_PRECIO_MAXIMA - 1);
  const puntuacion = 0.6 + 0.15 * cercania + 0.1 * acuerdo + 0.05 * marcaExacta + 0.1 * cercaniaPrecio;
  return { puntuacion: Math.round(puntuacion * 1000) / 1000 };
}

/** Puntuación mínima para confirmar un producto hallado por código (sin código en la imagen). */
export const UMBRAL_CONFIRMAR = 0.7;

/**
 * Confirmación para un producto encontrado buscando un código de barras en otra
 * tienda cuando su imagen NO trae el código (el buscador podría equivocarse).
 * Aplica TODAS las reglas que distinguen productos de `compararFirmas` (cantidad
 * presente en ambos y igual ±3 %, paquete, otros números, color, talla, variantes
 * como light/deslactosada/sin azúcar, marca si las dos la dicen, precio) y exige
 * puntuación ≥ UMBRAL_CONFIRMAR. Solo es más flexible en palabras que no son
 * variantes conocidas y en la marca cuando una tienda no la dice.
 */
export function confirmarMismoProducto(pa: DatosProducto, pb: DatosProducto): boolean {
  return compararFirmas(firmaDe(pa), firmaDe(pb), 'confirmar').puntuacion >= UMBRAL_CONFIRMAR;
}
