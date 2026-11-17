/**
 * "Modo carnes por libra": carnes, aves y pescados FRESCOS vendidos por peso.
 *
 * Cada súper usa sus propios nombres y calidades para la carne fresca y no hay código
 * de barras común (usan códigos internos de balanza que empiezan con "2"). En vez de
 * exigir el mismo nombre, se clasifica cada producto en una CLASE DE CORTE:
 *
 *   animal + corte + atributos que deben coincidir
 *   p. ej. cerdo | chuleta | (ninguno)          → "Chuleta de cerdo"
 *          pollo | pechuga | deshuesada         → "Pechuga de pollo deshuesada"
 *          tilapia | filete | (ninguno)         → "Filete de tilapia"
 *
 * Dos productos de tiendas distintas con la MISMA clase se pueden comparar por libra.
 * La calidad (popular < normal < especial/super < premium/prime), la marca y palabras
 * como "fresca", "bandeja", "MAP", "granel" NO impiden emparejar: solo sirven para elegir
 * la opción más parecida (ver `puntajePar`).
 *
 * Solo aplica a productos vendidos POR PESO (ver `ventaPorPeso`); lo empacado con peso
 * fijo ("Chuleta Santa Lucía 454 g") sigue con el emparejamiento normal.
 * Vocabulario completo y reglas: docs/datos-y-api.md, sección "Carnes por libra".
 */
import { interpretarPresentacion, normalizarTexto, separarPalabras } from './normalizar';
import type { Producto } from './tipos';

export const GRAMOS_POR_LIBRA = 453.592;
export const LIBRAS_POR_KG = 1000 / GRAMOS_POR_LIBRA; // 2.20462

/**
 * Seguro de precio: si el precio por libra de uno es más del doble del otro, no se
 * emparejan (calidades demasiado distintas o algo mal clasificado). Es más amplio que el de
 * productos iguales (1.5) porque aquí se comparan calidades distintas a propósito.
 * Medido: con 2.5 entraba "Carne Molida Económica" L51.95 ↔ "RES Molida Super Esp" L116.99.
 */
export const RAZON_PRECIO_LIBRA_MAXIMA = 2;

export interface VentaPorPeso {
  /** Cómo se supo: nombre ("x lb", "por libra", "x kg"), dato de la tienda o código de balanza. */
  fuente: 'nombre' | 'tienda' | 'balanza';
  /** Multiplicar el precio de la tienda por esto da lempiras por libra. */
  factorLibra: number;
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

/** Frases que se unen o cambian antes de separar palabras (texto ya normalizado). */
const FRASES: Array<[RegExp, string]> = [
  // "TilapiaxLB", "PremXlb", "XLB": la "x" pegada a la unidad.
  [/([a-z]{3,})x (?=(?:lb|lbs|lbr|libr|libra|libras|kg|kgs|kilo|kilos)\b)/g, '$1 x '],
  [/\bx(lb|lbs|lbr|libr|libra|libras|kg|kgs|kilo|kilos)\b/g, 'x $1'],
  [/\b(?:sin hueso|boneless)\b/g, ' deshuesada '],
  [/\bcon hueso\b/g, ' conhueso '],
  [/\bpechuga (?:con )?ala\b/g, ' pechuga conala '],
  [/\bsin ala\b/g, ' sinala '],
  [/\bsin piel\b/g, ' sinpiel '],
  [/\bcon piel\b/g, ' conpiel '],
  [/\bsin escama\b/g, ' '],
  [/\bpunta de anca\b/g, ' puntadeanca '],
  [/\bmano de piedra\b/g, ' manodepiedra '],
  [/\blomo de aguja\b/g, ' lomodeaguja '],
  [/\brib ?eye\b/g, ' ribeye '],
  [/\bnew york\b/g, ' newyork '],
  [/\bt ?bone\b/g, ' tbone '],
  [/\bshort rib\b/g, ' costilla corta '],
  [/\ben (?:piezas|trozos)\b/g, ' piezas '],
  [/\ben mariposa\b/g, ' mariposa '],
];

/** Palabras normalizadas (sin tildes, minúsculas) con frases ya unidas. */
export function palabrasCorte(nombre: string): string[] {
  let s = ` ${normalizarTexto(separarPalabras(nombre).replace(/[/&+-]/g, ' '))} `;
  for (const [re, por] of FRASES) s = s.replace(re, por);
  return s.split(/\s+/).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Venta por peso
// ---------------------------------------------------------------------------

const LIBRA = new Set(['lb', 'lbs', 'lbr', 'libr', 'libra', 'libras']);
const KILO = new Set(['kg', 'kgs', 'kilo', 'kilos', 'kilogramo', 'kilogramos']);
const POR_UNIDAD = new Set(['unidad', 'unidades', 'und', 'unds', 'unid', 'un', 'pieza', 'piezas']);

/** Código interno de balanza / peso variable (GS1 prefijo 20–29): no sirve entre tiendas. */
export function esCodigoDeBalanza(codigo: string | undefined): boolean {
  return !!codigo && /^2\d{12}$/.test(codigo);
}

/** Palabras que indican producto procesado/preparado (no carne fresca), aunque se venda por libra. */
const PROCESADOS = new Set([
  'salchicha', 'salchichas', 'jamon', 'chorizo', 'chorizos', 'mortadela', 'salami', 'rostizado', 'rostizada',
  'rostizad', 'rost', 'emparedado', 'pasta', 'nugget', 'nuggets', 'sopa', 'consome', 'caldo', 'enlatado', 'lata',
  'mezquite', 'pastrami', 'pate', 'croqueta', 'croquetas', 'hamburguesa', 'hamburguesas', 'medallones', 'sandwich',
]);

/**
 * ¿La categoría de la tienda es carne/ave/pescado? `undefined` si la tienda no la dio
 * (respuestas guardadas antiguas): entonces solo se decide por el nombre.
 */
export function esCategoriaCarne(categoria: string | undefined): boolean | undefined {
  if (!categoria) return undefined;
  const c = normalizarTexto(categoria);
  if (/\b(?:embutidos?|deli|comidas listas|mascotas?|abarrotes|productos colonial|otros)\b/.test(c)) return false;
  return /\b(?:carnes?|aves|pescados?|mariscos?)\b/.test(c);
}

/**
 * ¿Se vende por peso? Devuelve el factor para pasar su precio a lempiras por libra.
 * Reglas, en orden:
 *  1. "x unidad"/"und" sin número → por unidad: NO.
 *  2. Una cantidad fija en el nombre ("454 g", "2.27 kg", "5 oz") → empacado: NO. Excepción:
 *     "1 lb" con código de balanza (bandeja de 1 libra pesada en la tienda) → sí, factor 1.
 *  3. La tienda dice la unidad (La Colonia `measurementUnit` "lb"/"kg") → sí.
 *  4. El nombre dice "x lb", "lb", "libra", "por libra", "xlb", "Lbr", "Libr" (sin número
 *     delante) → por libra; "x kg"/"kilo" (sin número) → por kilo (÷ 2.20462).
 *  5. Código de balanza ("2…", 13 dígitos) + categoría de carne + sin cantidad en el nombre
 *     → por libra (en Honduras la carne fresca se pesa por libra; verificado con precios
 *     de las dos tiendas: "Pechuga de Pollo Deshuesada fresca" L83.95 ≈ "x LB" L86.99).
 * Nunca para procesados (salchicha, jamón, rostizado…) ni si la categoría no es de carne.
 */
export function ventaPorPeso(p: Pick<Producto, 'nombre' | 'codigoBarras' | 'categoria' | 'unidadVenta'>): VentaPorPeso | undefined {
  const palabras = palabrasCorte(p.nombre);
  if (palabras.some((w) => PROCESADOS.has(w))) return undefined;
  if (esCategoriaCarne(p.categoria) === false) return undefined;
  const esNumero = (w: string | undefined) => !!w && /^\d+(?:\.\d+)?$/.test(w);

  // 1) Por unidad.
  if (palabras.some((w, i) => POR_UNIDAD.has(w) && !esNumero(palabras[i - 1]))) return undefined;

  // 2) Cantidad fija.
  const fija = interpretarPresentacion(separarPalabras(p.nombre));
  if (fija) {
    if (fija.texto === '1 lb' && esCodigoDeBalanza(p.codigoBarras)) return { fuente: 'balanza', factorLibra: 1 };
    return undefined;
  }

  // 3) Dato de la tienda.
  if (p.unidadVenta) {
    const { unidad, multiplicador } = p.unidadVenta;
    const porUnidad = 1 / multiplicador;
    return { fuente: 'tienda', factorLibra: unidad === 'lb' ? porUnidad : porUnidad / LIBRAS_POR_KG };
  }

  // 4) Nombre.
  for (let i = 0; i < palabras.length; i++) {
    if (esNumero(palabras[i - 1])) continue;
    if (LIBRA.has(palabras[i])) return { fuente: 'nombre', factorLibra: 1 };
    if (KILO.has(palabras[i])) return { fuente: 'nombre', factorLibra: 1 / LIBRAS_POR_KG };
  }

  // 5) Código de balanza en una categoría de carne.
  if (esCodigoDeBalanza(p.codigoBarras) && esCategoriaCarne(p.categoria) === true) {
    return { fuente: 'balanza', factorLibra: 1 };
  }
  return undefined;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Precio y oferta en lempiras por libra; undefined si no se vende por peso. */
export function precioPorLibra(
  p: Pick<Producto, 'nombre' | 'codigoBarras' | 'categoria' | 'unidadVenta' | 'precio' | 'precioOferta'>,
): { precio: number; precioOferta?: number } | undefined {
  const venta = ventaPorPeso(p);
  if (!venta) return undefined;
  const precio = redondear(p.precio * venta.factorLibra);
  const oferta = p.precioOferta !== undefined ? redondear(p.precioOferta * venta.factorLibra) : undefined;
  return oferta !== undefined && oferta < precio ? { precio, precioOferta: oferta } : { precio };
}

// ---------------------------------------------------------------------------
// Vocabulario
// ---------------------------------------------------------------------------

/** Animales (y especies de pescado/marisco). valor = nombre para mostrar. */
const ANIMALES: Record<string, string> = {
  res: 'res', novillo: 'res', beef: 'res', vaca: 'res', ternera: 'ternera',
  cerdo: 'cerdo', puerco: 'cerdo', cochino: 'cerdo', pork: 'cerdo',
  pollo: 'pollo', chicken: 'pollo', gallina: 'gallina', pavo: 'pavo', conejo: 'conejo', cordero: 'cordero',
  pescado: 'pescado', tilapia: 'tilapia', pargo: 'pargo', corvina: 'corvina', salmon: 'salmón', robalo: 'róbalo',
  bagre: 'bagre', macarela: 'macarela', merluza: 'merluza', mero: 'mero', basa: 'basa', guapote: 'guapote',
  dorado: 'dorado', camaron: 'camarón', camarones: 'camarón', langosta: 'langosta', calamar: 'calamar',
  pulpo: 'pulpo', jaiba: 'jaiba', caracol: 'caracol', almeja: 'almeja', almejas: 'almeja', mejillon: 'mejillón',
};
const PESCADOS = new Set(['pescado', 'tilapia', 'pargo', 'corvina', 'salmon', 'robalo', 'bagre', 'macarela',
  'merluza', 'mero', 'basa', 'guapote', 'dorado']);
const FEMENINOS_ANIMAL = new Set(['tilapia', 'corvina', 'macarela', 'merluza', 'basa', 'res', 'ternera', 'gallina',
  'langosta', 'jaiba', 'almeja']);

interface DefCorte {
  palabras: string[];
  nombre: string;
  femenino: boolean;
}

/**
 * Cortes, en orden de PRIORIDAD: si el nombre dice varios, el primero es el corte y los
 * demás pasan a ser atributos que deben coincidir ("Chuleta de Lomo" = chuleta + lomo;
 * "Tajo Molido" = molida + tajo; "Filete Trocito" = filete + trocitos).
 */
const CORTES: Array<[string, DefCorte]> = [
  ['molida', { palabras: ['molida', 'molido', 'molidas'], nombre: 'Carne molida', femenino: true }],
  ['chuleta', { palabras: ['chuleta', 'chuletas', 'chuletita', 'chuletitas'], nombre: 'Chuleta', femenino: true }],
  ['costilla', { palabras: ['costilla', 'costillas', 'costillita', 'costillitas', 'rib', 'ribs'], nombre: 'Costilla', femenino: true }],
  ['pechuga', { palabras: ['pechuga', 'pechugas'], nombre: 'Pechuga', femenino: true }],
  ['muslo', { palabras: ['muslo', 'muslos'], nombre: 'Muslo', femenino: false }],
  ['piernita', { palabras: ['piernita', 'piernitas', 'drumstick'], nombre: 'Piernita', femenino: true }],
  ['pierna', { palabras: ['pierna', 'piernas'], nombre: 'Pierna', femenino: true }],
  ['ala', { palabras: ['ala', 'alas', 'alita', 'alitas'], nombre: 'Ala', femenino: true }],
  ['tender', { palabras: ['tender', 'tenders'], nombre: 'Tender', femenino: false }],
  ['filete', { palabras: ['filete', 'filetes'], nombre: 'Filete', femenino: false }],
  ['bistec', { palabras: ['bistec', 'bisteck', 'bistek', 'bisteces', 'steak'], nombre: 'Bistec', femenino: false }],
  ['lomodeaguja', { palabras: ['lomodeaguja'], nombre: 'Lomo de aguja', femenino: false }],
  ['lomo', { palabras: ['lomo', 'lomito', 'lomitos'], nombre: 'Lomo', femenino: false }],
  ['posta', { palabras: ['posta', 'postas'], nombre: 'Posta', femenino: true }],
  ['puntadeanca', { palabras: ['puntadeanca'], nombre: 'Punta de anca', femenino: true }],
  ['manodepiedra', { palabras: ['manodepiedra'], nombre: 'Mano de piedra', femenino: true }],
  ['ribeye', { palabras: ['ribeye'], nombre: 'Rib eye', femenino: false }],
  ['newyork', { palabras: ['newyork'], nombre: 'New York', femenino: false }],
  ['tbone', { palabras: ['tbone'], nombre: 'T-bone', femenino: false }],
  ['picana', { palabras: ['picana', 'picanha'], nombre: 'Picaña', femenino: true }],
  ['arrachera', { palabras: ['arrachera'], nombre: 'Arrachera', femenino: true }],
  ['entrana', { palabras: ['entrana'], nombre: 'Entraña', femenino: true }],
  ['churrasco', { palabras: ['churrasco'], nombre: 'Churrasco', femenino: false }],
  ['tajo', { palabras: ['tajo', 'tajos'], nombre: 'Tajo', femenino: false }],
  ['falda', { palabras: ['falda'], nombre: 'Falda', femenino: true }],
  ['milanesa', { palabras: ['milanesa', 'milanesas'], nombre: 'Milanesa', femenino: true }],
  ['carpaccio', { palabras: ['carpaccio'], nombre: 'Carpaccio', femenino: false }],
  ['pulpa', { palabras: ['pulpa'], nombre: 'Pulpa', femenino: true }],
  ['paleta', { palabras: ['paleta'], nombre: 'Paleta', femenino: true }],
  ['cecina', { palabras: ['cecina'], nombre: 'Cecina', femenino: true }],
  ['lengua', { palabras: ['lengua'], nombre: 'Lengua', femenino: true }],
  ['higado', { palabras: ['higado'], nombre: 'Hígado', femenino: false }],
  ['mondongo', { palabras: ['mondongo', 'panza'], nombre: 'Mondongo', femenino: false }],
  ['pata', { palabras: ['pata', 'patas', 'patita', 'patitas'], nombre: 'Pata', femenino: true }],
  ['oreja', { palabras: ['oreja', 'orejas'], nombre: 'Oreja', femenino: true }],
  ['cola', { palabras: ['cola', 'colas'], nombre: 'Cola', femenino: true }],
  ['hueso', { palabras: ['hueso', 'huesos'], nombre: 'Hueso', femenino: false }],
  ['menudo', { palabras: ['menudo', 'menudos'], nombre: 'Menudo', femenino: false }],
  ['molleja', { palabras: ['molleja', 'mollejas'], nombre: 'Molleja', femenino: true }],
  ['pescuezo', { palabras: ['pescuezo', 'pescuezos'], nombre: 'Pescuezo', femenino: false }],
  ['cabeza', { palabras: ['cabeza', 'cabezas'], nombre: 'Cabeza', femenino: true }],
  ['chicharron', { palabras: ['chicharron', 'chicharrones'], nombre: 'Chicharrón', femenino: false }],
  ['albondiga', { palabras: ['albondiga', 'albondigas'], nombre: 'Albóndiga', femenino: true }],
  ['tocino', { palabras: ['tocino'], nombre: 'Tocino', femenino: false }],
  ['trocitos', { palabras: ['trocito', 'trocitos'], nombre: 'Trocitos', femenino: false }],
  // "entero" va al final: solo es el corte si no hay otro ("Pollo Entero", "Tilapia").
  ['entero', { palabras: ['entero', 'entera', 'enteros', 'enteras'], nombre: 'Entero', femenino: false }],
];
const CORTE_DE_PALABRA = new Map<string, string>();
for (const [id, def] of CORTES) for (const w of def.palabras) CORTE_DE_PALABRA.set(w, id);
const DEF_CORTE = new Map(CORTES);
const PRIORIDAD = new Map(CORTES.map(([id], i) => [id, i]));

/** Atributos que DEBEN coincidir. valor = [id, femenino, masculino]. */
const ATRIBUTOS: Record<string, [string, string, string]> = {};
const atributo = (id: string, fem: string, masc: string, palabras: string[]) => {
  for (const w of palabras) ATRIBUTOS[w] = [id, fem, masc];
};
atributo('deshuesada', 'deshuesada', 'deshuesado', ['deshuesada', 'deshuesado', 'deshuesadas', 'deshuesados', 'deshuesad', 'deshuesda', 'desh', 'deshues']);
atributo('conhueso', 'con hueso', 'con hueso', ['conhueso']);
atributo('ahumada', 'ahumada', 'ahumado', ['ahumada', 'ahumado', 'ahumadas', 'ahumados', 'ahum', 'smoked']);
atributo('empanizada', 'empanizada', 'empanizado', ['empanizada', 'empanizado', 'empanizadas', 'empanizados', 'empaniz', 'apanada', 'apanado', 'breaded']);
atributo('marinada', 'marinada', 'marinado', ['marinada', 'marinado', 'marinadas', 'marinados']);
atributo('adobada', 'adobada', 'adobado', ['adobada', 'adobado', 'adobadas', 'adobados']);
atributo('condimentada', 'condimentada', 'condimentado', ['condimentada', 'condimentado', 'sazonada', 'sazonado']);
atributo('preparada', 'preparada', 'preparado', ['preparada', 'preparado', 'prep']);
atributo('cocida', 'cocida', 'cocido', ['cocida', 'cocido']);
atributo('bbq', 'BBQ', 'BBQ', ['bbq', 'barbacoa']);
atributo('picante', 'picante', 'picante', ['picante', 'picosa', 'picoso']);
atributo('congelada', 'congelada', 'congelado', ['congelada', 'congelado', 'congeladas', 'congelados', 'congelad', 'congel']);
atributo('conala', 'con ala', 'con ala', ['conala']);
atributo('sinala', 'sin ala', 'sin ala', ['sinala']);
atributo('sinpiel', 'sin piel', 'sin piel', ['sinpiel']);
atributo('conpiel', 'con piel', 'con piel', ['conpiel']);
atributo('piezas', 'en piezas', 'en piezas', ['piezas', 'troceado', 'troceada', 'partido', 'partida']);
atributo('corta', 'corta', 'corto', ['corta', 'corto']);
atributo('mariposa', 'en mariposa', 'en mariposa', ['mariposa']);
atributo('roja', 'roja', 'rojo', ['roja', 'rojo']);
atributo('gris', 'gris', 'gris', ['gris']);
atributo('negra', 'negra', 'negro', ['negra', 'negro']);

/** Calidad: 0 = popular/económica, 1 = normal (sin decir), 2 = especial/super, 3 = premium/prime. */
const CALIDAD: Record<string, number> = {
  popular: 0, economica: 0, economico: 0, eco: 0, econ: 0, economy: 0,
  especial: 2, espec: 2, esp: 2, super: 2, extra: 2,
  premium: 3, premi: 3, prem: 3, premiun: 3, prime: 3, angus: 3, gourmet: 3, choice: 3,
};

/** Marcas propias de cada súper (no cuentan como marca para elegir la opción más parecida). */
const MARCAS_DE_TIENDA = new Set(['lacolonia', 'colonial', 'supercolonial', 'selectafresh', 'selecta']);

// ---------------------------------------------------------------------------
// Clasificación
// ---------------------------------------------------------------------------

export interface ClaseCorte {
  /** "cerdo", "pollo", "res+pollo" (mezcla), "tilapia"… */
  animal: string;
  /** Id del corte ("chuleta", "pechuga", "molida", "filete"…). */
  corte: string;
  /** Atributos que deben coincidir, ordenados ("deshuesada", "ahumada", "lomo"…). */
  atributos: string[];
  /** animal|corte|atributos: dos productos se emparejan solo con la misma clave. */
  clave: string;
  /** Nombre legible: "Chuleta de cerdo", "Pechuga de pollo deshuesada", "Filete de tilapia". */
  nombre: string;
  /** 0 popular/económica, 1 normal, 2 especial/super, 3 premium/prime. */
  calidad: number;
  /** Marca normalizada (sin las del súper ni palabras del vocabulario), si la hay. */
  marca?: string;
  venta: VentaPorPeso;
}

const capitalizar = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

function animalDeCategoria(categoria: string | undefined): string | undefined {
  if (!categoria) return undefined;
  const c = normalizarTexto(categoria);
  for (const a of ['res', 'cerdo', 'pollo', 'pavo']) if (new RegExp(`\\b${a}\\b`).test(c)) return a;
  if (/\bpescados?\b/.test(c)) return 'pescado';
  return undefined;
}

/** Palabras que son del vocabulario (no pueden ser marca). */
const esVocabulario = (w: string) =>
  w in ANIMALES || CORTE_DE_PALABRA.has(w) || w in ATRIBUTOS || w in CALIDAD || LIBRA.has(w) || w === 'carne';

function marcaCorte(marca: string | undefined): string | undefined {
  if (!marca) return undefined;
  const palabras = normalizarTexto(marca).split(' ').filter((w) => w && !esVocabulario(w));
  const unida = palabras.join('');
  return unida.length >= 2 && !MARCAS_DE_TIENDA.has(unida) ? unida : undefined;
}

/**
 * Clasifica un producto fresco vendido por peso. undefined si no se vende por peso o
 * no se reconoce el corte/animal (entonces sigue con el emparejamiento normal).
 */
export function clasificarCorte(
  p: Pick<Producto, 'nombre' | 'marca' | 'codigoBarras' | 'categoria' | 'unidadVenta'>,
): ClaseCorte | undefined {
  const venta = ventaPorPeso(p);
  if (!venta) return undefined;
  const palabras = palabrasCorte(p.nombre);

  const animales = new Set<string>();
  const cortes = new Set<string>();
  const atributos = new Set<string>();
  let calidad: number | undefined;
  for (const w of palabras) {
    if (w in ANIMALES) animales.add(w === 'camarones' ? 'camaron' : w === 'almejas' ? 'almeja' : normalizarAnimal(w));
    const c = CORTE_DE_PALABRA.get(w);
    if (c) cortes.add(c);
    const a = ATRIBUTOS[w];
    if (a) atributos.add(a[0]);
    if (w in CALIDAD) calidad = calidad === undefined ? CALIDAD[w] : Math.max(calidad, CALIDAD[w]);
  }
  // "pescado tilapia": la especie basta.
  if (animales.size > 1 && animales.has('pescado')) animales.delete('pescado');
  if (animales.size === 0) {
    const deCategoria = animalDeCategoria(p.categoria);
    if (deCategoria) animales.add(deCategoria);
  }
  if (animales.size === 0) return undefined;
  const animal = [...animales].sort().join('+');
  const esPescado = [...animales].every((a) => PESCADOS.has(a));

  // Corte principal y cortes secundarios (pasan a atributos).
  const ordenados = [...cortes].sort((a, b) => PRIORIDAD.get(a)! - PRIORIDAD.get(b)!);
  let corte = ordenados[0];
  if (!corte) {
    // Un pescado sin corte ("Pescado Tilapia Roja x Lb") se vende entero.
    if (esPescado) corte = 'entero';
    else return undefined;
  }
  for (const c of ordenados.slice(1)) atributos.add(c === 'entero' ? 'entera' : c);

  const lista = [...atributos].sort();
  return {
    animal,
    corte,
    atributos: lista,
    clave: `${animal}|${corte}|${lista.join(',')}`,
    nombre: nombreCorte(animal, corte, lista),
    calidad: calidad ?? 1,
    marca: marcaCorte(p.marca),
    venta,
  };
}

function normalizarAnimal(w: string): string {
  const v = ANIMALES[w];
  // id = palabra base sin tilde (res, cerdo, pollo, tilapia…)
  return normalizarTexto(v);
}

function nombreAnimal(animal: string): string {
  return animal
    .split('+')
    .map((a) => Object.entries(ANIMALES).find(([k]) => normalizarAnimal(k) === a)?.[1] ?? a)
    .join(' y ');
}

/** "Chuleta de cerdo", "Pechuga de pollo deshuesada", "Carne molida de cerdo", "Tilapia entera roja". */
function nombreCorte(animal: string, corte: string, atributos: string[]): string {
  const def = DEF_CORTE.get(corte)!;
  const animalTexto = nombreAnimal(animal);
  let base: string;
  let femenino = def.femenino;
  if (corte === 'entero') {
    femenino = !animal.includes('+') && FEMENINOS_ANIMAL.has(animal);
    base = `${capitalizar(animalTexto)} ${femenino ? 'entera' : 'entero'}`;
  } else {
    // Cortes secundarios van antes del animal: "Chuleta de lomo de cerdo", "Bistec de tajo de res".
    const secundarios = atributos.filter((a) => DEF_CORTE.has(a) && a !== 'trocitos' && a !== 'entero');
    const de = secundarios.map((a) => ` de ${DEF_CORTE.get(a)!.nombre.toLowerCase()}`).join('');
    base = `${def.nombre}${de} de ${animalTexto}`;
    atributos = atributos.filter((a) => !secundarios.includes(a));
  }
  const extras = atributos.map((a) => {
    const attr = Object.values(ATRIBUTOS).find(([id]) => id === a);
    if (attr) return femenino ? attr[1] : attr[2];
    if (a === 'entera') return femenino ? 'entera' : 'entero';
    if (a === 'trocitos') return 'en trocitos';
    const sec = DEF_CORTE.get(a);
    return sec ? `de ${sec.nombre.toLowerCase()}` : a;
  });
  return [base, ...extras].join(' ');
}

// ---------------------------------------------------------------------------
// Elegir la opción más parecida
// ---------------------------------------------------------------------------

export interface DatosCorte {
  clase: ClaseCorte;
  /** Precio efectivo (oferta si hay) en lempiras por libra. */
  precioLibra: number;
}

/** Clase + precio efectivo por libra, o undefined si el producto no entra en el modo carnes. */
export function datosCorte(p: Producto): DatosCorte | undefined {
  const clase = clasificarCorte(p);
  if (!clase) return undefined;
  const precios = precioPorLibra(p);
  if (!precios) return undefined;
  return { clase, precioLibra: precios.precioOferta ?? precios.precio };
}

/**
 * Puntaje de un par de la MISMA clase (menor = más parecido), o undefined si no se pueden
 * emparejar (clases distintas o precios por libra demasiado distintos).
 * Orden de preferencia: calidad parecida (×100), misma marca (×10), precio por libra más
 * cercano (logaritmo de la razón, < 1).
 */
export function puntajePar(a: DatosCorte, b: DatosCorte): number | undefined {
  if (a.clase.clave !== b.clase.clave) return undefined;
  const razon = Math.max(a.precioLibra, b.precioLibra) / Math.min(a.precioLibra, b.precioLibra);
  if (!(razon <= RAZON_PRECIO_LIBRA_MAXIMA)) return undefined;
  const calidad = Math.abs(a.clase.calidad - b.clase.calidad);
  const marca = a.clase.marca && b.clase.marca && a.clase.marca === b.clase.marca ? 0 : 1;
  return calidad * 100 + marca * 10 + Math.log(razon);
}
