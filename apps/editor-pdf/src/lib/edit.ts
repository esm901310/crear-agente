/**
 * Edición de texto sobre la imagen de una página escaneada.
 *
 * Todo se mide sobre la imagen ORIGINAL de la página, y cada cambio se guarda
 * como una operación. Para mostrar la página se parte de la imagen original y
 * se aplican las operaciones (así deshacer / rehacer es exacto).
 *
 * Si el texto nuevo es más largo o más corto, las palabras que siguen en la
 * misma línea se corren: se borran y se vuelven a pegar (recortadas de la
 * imagen original) en su nueva posición. Ese corrimiento se calcula siempre a
 * partir de la lista de operaciones (ver `calcularDisposicion`), por lo que
 * deshacer una operación también deshace su corrimiento.
 */
import type { Ajustes, Analisis, Caja, Edicion, Fuente, Linea, Pagina, Palabra, RGB } from './types';
import { cursivaSimulada, fuenteCss as cssLetra } from './catalogo';
import { anchoBorde, BORDE_POR_SIGMA, desenfocar, grosorContinuo } from './imagen';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------


/** Letras que bajan de la línea base. */
const DESCENDENTES = /[gjpqyQçÇ,;()[\]{}|/µ]/;

/** Proporción de píxeles "más distintos al fondo" que se usan para el color del texto. */
const FRACCION_TINTA = 0.15;

/** Lo mínimo que puede quedar un espacio entre palabras al apretar la línea. */
const ESPACIO_MINIMO = 0.75;
/** Lo mínimo que se achica el texto nuevo (último recurso). */
const ESCALA_MINIMA = 0.95;

/** Inclinación con la que se simula la cursiva en letras que no la traen. */
export const INCLINACION_SIMULADA = 0.21;

function fuenteCss(tamano: number, negrita: boolean, fuente: Fuente, cursiva = false): string {
  return cssLetra(fuente, tamano, negrita, cursiva);
}

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const orden = Float64Array.from(valores).sort();
  return orden[orden.length >> 1] ?? 0;
}

function medianaRGB(px: number[][]): RGB | null {
  if (px.length === 0) return null;
  return [mediana(px.map((p) => p[0] ?? 0)), mediana(px.map((p) => p[1] ?? 0)), mediana(px.map((p) => p[2] ?? 0))];
}

function distancia(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const dr = (a[0] ?? 0) - (b[0] ?? 0);
  const dg = (a[1] ?? 0) - (b[1] ?? 0);
  const db = (a[2] ?? 0) - (b[2] ?? 0);
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function luminancia(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function limitar(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function unirCajas(cajas: Caja[]): Caja {
  if (cajas.length === 0) return { x0: 0, y0: 0, x1: 0, y1: 0 };
  return {
    x0: Math.min(...cajas.map((c) => c.x0)),
    y0: Math.min(...cajas.map((c) => c.y0)),
    x1: Math.max(...cajas.map((c) => c.x1)),
    y1: Math.max(...cajas.map((c) => c.y1)),
  };
}

export function rgbAHex([r, g, b]: RGB): string {
  const h = (n: number) => Math.round(limitar(n, 0, 255)).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function hexARgb(hex: string): RGB {
  let h = hex.replace('#', '').trim();
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('');
  const n = parseInt(h.padEnd(6, '0').slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Generador pseudoaleatorio con semilla: la textura del borrado es siempre igual. */
function aleatorio(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function semillaDe(c: Caja): number {
  return (Math.round(c.x0) * 73856093) ^ (Math.round(c.y0) * 19349663) ^ (Math.round(c.x1) * 83492791);
}

function ctxLectura(lienzo: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new RangeError('Sin memoria para el lienzo');
  return ctx;
}

let lienzoMedida: HTMLCanvasElement | null = null;
function ctxMedida(): CanvasRenderingContext2D {
  if (!lienzoMedida) lienzoMedida = document.createElement('canvas');
  return ctxLectura(lienzoMedida);
}

function medir(texto: string, tamano: number, negrita: boolean, fuente: Fuente, cursiva = false): TextMetrics {
  const ctx = ctxMedida();
  ctx.font = fuenteCss(tamano, negrita, fuente, cursiva);
  return ctx.measureText(texto);
}

/** Dibuja un texto en un canvas propio y devuelve su alfa (0..1). */
function alfaDeTexto(texto: string, tamano: number, negrita: boolean, fuente: Fuente, cursiva: boolean, margen: number) {
  const m = medir(texto, tamano, negrita, fuente, cursiva);
  const ancho = Math.max(1, Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + margen * 2);
  const alto = Math.max(1, Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + margen * 2);
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  const ctx = ctxLectura(c);
  ctx.font = fuenteCss(tamano, negrita, fuente, cursiva);
  ctx.fillStyle = '#000';
  ctx.fillText(texto, margen + m.actualBoundingBoxLeft, margen + m.actualBoundingBoxAscent);
  const datos = ctx.getImageData(0, 0, ancho, alto).data;
  const v = new Float32Array(ancho * alto);
  for (let i = 0; i < v.length; i++) v[i] = (datos[i * 4 + 3] ?? 0) / 255;
  return { v, ancho, alto };
}

let bordePropio: number | null = null;
/** Ancho de borde (20–80 %) que ya trae el suavizado del canvas, sin desenfoque. */
function anchoBordePropio(): number {
  if (bordePropio === null) {
    const { v, ancho, alto } = alfaDeTexto('HOLAMNE', 80, true, 'arimo', false, 4);
    bordePropio = anchoBorde(v, ancho, alto) || 0.7;
  }
  return bordePropio;
}

/** σ del desenfoque que hay que agregar para que los bordes queden igual de nítidos que el original. */
export function sigmaParaBorde(anchoOriginal: number): number {
  if (!anchoOriginal) return 0.5;
  const propio = anchoBordePropio();
  return limitar(Math.sqrt(Math.max(0, anchoOriginal * anchoOriginal - propio * propio)) / BORDE_POR_SIGMA, 0, 2.5);
}

const cacheTrazo = new Map<string, number>();
/** Olvida medidas guardadas (p. ej. cuando termina de cargar una letra). */
export function olvidarMedidas(): void {
  cacheTrazo.clear();
  bordePropio = null;
}
/**
 * Grosor de trazo que tendría el texto con nuestra letra, medido DESPUÉS de
 * aplicarle el mismo desenfoque que tiene el original (así se compara igual).
 */
function trazoSintetico(texto: string, tamano: number, negrita: boolean, fuente: Fuente, cursiva: boolean, sigma: number): number {
  const clave = `${texto}|${tamano.toFixed(1)}|${negrita}|${fuente}|${cursiva}|${sigma.toFixed(2)}`;
  const guardado = cacheTrazo.get(clave);
  if (guardado !== undefined) return guardado;
  const margen = Math.ceil(sigma * 3) + 2;
  const { v, ancho, alto } = alfaDeTexto(texto, tamano, negrita, fuente, cursiva, margen);
  const t = grosorContinuo(desenfocar(v, ancho, alto, sigma), ancho, alto);
  cacheTrazo.set(clave, t);
  return t;
}

// ---------------------------------------------------------------------------
// Fondo alrededor de una caja
// ---------------------------------------------------------------------------

interface Fondo {
  fondo: RGB;
  izq: RGB;
  der: RGB;
  arr: RGB;
  abj: RGB;
  ruido: number;
}

/** a. Fondo: medianas de un borde de ~3 px alrededor de la caja (de 2 a 5 px afuera). */
function medirFondo(original: HTMLCanvasElement, caja: Caja): Fondo {
  const W = original.width;
  const H = original.height;
  const M = 6;
  const zx0 = limitar(Math.floor(caja.x0) - M, 0, W - 1);
  const zy0 = limitar(Math.floor(caja.y0) - M, 0, H - 1);
  const zx1 = limitar(Math.ceil(caja.x1) + M, zx0 + 1, W);
  const zy1 = limitar(Math.ceil(caja.y1) + M, zy0 + 1, H);
  const zw = Math.max(1, zx1 - zx0);
  const zh = Math.max(1, zy1 - zy0);
  const datos = ctxLectura(original).getImageData(zx0, zy0, zw, zh).data;
  const cx0 = Math.floor(caja.x0);
  const cy0 = Math.floor(caja.y0);
  const cx1 = Math.ceil(caja.x1);
  const cy1 = Math.ceil(caja.y1);
  const izq: number[][] = [];
  const der: number[][] = [];
  const arr: number[][] = [];
  const abj: number[][] = [];
  for (let y = zy0; y < zy1; y++) {
    for (let x = zx0; x < zx1; x++) {
      const dentroX = x >= cx0 && x < cx1;
      const dentroY = y >= cy0 && y < cy1;
      let destino: number[][] | null = null;
      if (dentroY && x >= cx0 - 5 && x <= cx0 - 2) destino = izq;
      else if (dentroY && x >= cx1 + 1 && x <= cx1 + 4) destino = der;
      else if (dentroX && y >= cy0 - 5 && y <= cy0 - 2) destino = arr;
      else if (dentroX && y >= cy1 + 1 && y <= cy1 + 4) destino = abj;
      if (!destino) continue;
      const i = ((y - zy0) * zw + (x - zx0)) * 4;
      destino.push([datos[i] ?? 0, datos[i + 1] ?? 0, datos[i + 2] ?? 0]);
    }
  }
  const anillo = [...izq, ...der, ...arr, ...abj];
  const fondo: RGB = medianaRGB(anillo) ?? [255, 255, 255];
  const lumFondo = luminancia(...fondo);
  const desvios = anillo.map((p) => Math.abs(luminancia(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0) - lumFondo));
  return {
    fondo,
    izq: medianaRGB(izq) ?? fondo,
    der: medianaRGB(der) ?? fondo,
    arr: medianaRGB(arr) ?? fondo,
    abj: medianaRGB(abj) ?? fondo,
    // Textura del papel: desviación robusta de la luminancia del borde.
    ruido: limitar(mediana(desvios) * 1.4826, 0, 10),
  };
}

const cacheFondos = new WeakMap<HTMLCanvasElement, Map<string, Fondo>>();
function fondoCacheado(original: HTMLCanvasElement, clave: string, caja: Caja): Fondo {
  let mapa = cacheFondos.get(original);
  if (!mapa) {
    mapa = new Map();
    cacheFondos.set(original, mapa);
  }
  let f = mapa.get(clave);
  if (!f) {
    f = medirFondo(original, caja);
    mapa.set(clave, f);
  }
  return f;
}

function margenBorrado(caja: Caja): number {
  return Math.max(2, Math.round((caja.y1 - caja.y0) * 0.06));
}

function expandir(caja: Caja, m: number, W: number, H: number): Caja {
  return {
    x0: Math.max(0, Math.floor(caja.x0) - m),
    y0: Math.max(0, Math.floor(caja.y0) - m),
    x1: Math.min(W, Math.ceil(caja.x1) + m),
    y1: Math.min(H, Math.ceil(caja.y1) + m),
  };
}

// ---------------------------------------------------------------------------
// Análisis del texto original
// ---------------------------------------------------------------------------

/**
 * Mide fondo, color, tamaño, línea base y grosor del texto original en la
 * zona de las palabras elegidas.
 */
export function analizar(pagina: Pagina, seleccion: Palabra[], linea: Linea | undefined): Analisis {
  if (seleccion.length === 0) throw new Error('Selección vacía');
  const caja = unirCajas(seleccion.map((p) => p.caja));
  const textoOriginal = seleccion.map((p) => p.texto).join(' ');
  const original = pagina.original;
  const W = original.width;
  const H = original.height;

  const f = medirFondo(original, caja);
  const fondo = f.fondo;
  const lumFondo = luminancia(...fondo);

  // --- b. Color del texto: el 15 % de píxeles más distintos al fondo. ---
  const cx0 = limitar(Math.floor(caja.x0), 0, W - 1);
  const cy0 = limitar(Math.floor(caja.y0), 0, H - 1);
  const bw = Math.max(1, Math.min(W, Math.ceil(caja.x1)) - cx0);
  const bh = Math.max(1, Math.min(H, Math.ceil(caja.y1)) - cy0);
  const datos = ctxLectura(original).getImageData(cx0, cy0, bw, bh).data;
  // Distancias al fondo + histograma (evita ordenar todos los píxeles: es más rápido).
  const n = bw * bh;
  const dist = new Float32Array(n);
  const hist = new Uint32Array(452);
  for (let i = 0; i < n; i++) {
    const dr = (datos[i * 4] ?? 0) - fondo[0];
    const dg = (datos[i * 4 + 1] ?? 0) - fondo[1];
    const db = (datos[i * 4 + 2] ?? 0) - fondo[2];
    const d = Math.sqrt(dr * dr + dg * dg + db * db);
    dist[i] = d;
    hist[Math.min(451, Math.round(d))]! += 1;
  }
  /** Valor de distancia por encima del cual queda la fracción pedida de píxeles (entre los que superan `desde`). */
  const umbralSuperior = (fraccion: number, desde = 0): number => {
    let total = 0;
    for (let v = Math.ceil(desde); v < hist.length; v++) total += hist[v] ?? 0;
    const objetivo = Math.max(1, total * fraccion);
    let acumulado = 0;
    for (let v = hist.length - 1; v >= 0; v--) {
      acumulado += hist[v] ?? 0;
      if (acumulado >= objetivo) return v;
    }
    return 0;
  };
  const colores = (min: number, max: number): number[][] => {
    const lista: number[][] = [];
    for (let i = 0; i < n; i++) {
      const d = dist[i] ?? 0;
      if (d >= min - 0.5 && d <= max + 0.5) lista.push([datos[i * 4] ?? 0, datos[i * 4 + 1] ?? 0, datos[i * 4 + 2] ?? 0]);
    }
    return lista;
  };
  let tinta: RGB = medianaRGB(colores(umbralSuperior(FRACCION_TINTA), Infinity)) ?? [0, 0, 0];
  let contraste = distancia(tinta, fondo);
  // Color del CENTRO del trazo: entre el 5 % y el 10 % de los píxeles de tinta más distintos al fondo.
  const t05 = umbralSuperior(0.05, contraste * 0.5);
  const t10 = umbralSuperior(0.1, contraste * 0.5);
  const centro = colores(t10, t05);
  if (centro.length >= 5) {
    tinta = medianaRGB(centro) ?? tinta;
    contraste = distancia(tinta, fondo);
  }
  if (contraste < 20) {
    // Casi no hay tinta: usamos un gris oscuro razonable.
    tinta = lumFondo > 128 ? [40, 40, 40] : [230, 230, 230];
    contraste = distancia(tinta, fondo);
  }

  // Máscara de tinta: más de la mitad del contraste.
  const umbral = contraste * 0.5;
  const filas = new Array<number>(bh).fill(0);
  const columnas = new Array<number>(bw).fill(0);
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i] ?? 0;
    if (d > umbral) {
      filas[Math.floor(i / bw)]! += 1;
      columnas[i % bw]! += 1;
    }
  }

  const primera = (arrl: number[]) => arrl.findIndex((v) => v >= 1);
  const ultima = (arrl: number[]) => {
    for (let i = arrl.length - 1; i >= 0; i--) if ((arrl[i] ?? 0) >= 1) return i;
    return -1;
  };
  let tintaArriba = primera(filas);
  let tintaAbajo = ultima(filas);
  let tintaIzq = primera(columnas);
  let tintaDer = ultima(columnas);
  if (tintaArriba < 0) {
    tintaArriba = 0;
    tintaAbajo = bh - 1;
    tintaIzq = 0;
    tintaDer = bw - 1;
  }
  const yArriba = cy0 + tintaArriba;
  const yAbajo = cy0 + tintaAbajo;
  const xTinta = cx0 + tintaIzq;
  const anchoTinta = Math.max(1, tintaDer - tintaIzq + 1);

  // --- c. Línea base. ---
  // Perfil de filas: debajo de la base solo quedan las colitas (pocas filas con tinta).
  const maxFila = Math.max(...filas);
  let ultimaFuerte = tintaAbajo;
  for (let i = tintaAbajo; i >= tintaArriba; i--) {
    if ((filas[i] ?? 0) >= maxFila * 0.35) {
      ultimaFuerte = i;
      break;
    }
  }
  const basePerfil = cy0 + ultimaFuerte + 1;
  let baseLinea: number | null = null;
  if (linea?.base) {
    const b = linea.base;
    const xc = (caja.x0 + caja.x1) / 2;
    const t = b.x1 === b.x0 ? 0 : (xc - b.x0) / (b.x1 - b.x0);
    baseLinea = limitar(b.y0 + (b.y1 - b.y0) * t, yArriba + (yAbajo - yArriba) * 0.4, yAbajo + 1);
  }
  let base: number;
  if (!DESCENDENTES.test(textoOriginal)) {
    base = yAbajo + 1;
    // Letras que bajan sin estar en la lista (p. ej. la "J" de algunas letras con remates).
    if (base - basePerfil > (base - yArriba) * 0.12) base = baseLinea !== null && Math.abs(baseLinea - basePerfil) < (base - yArriba) * 0.1 ? baseLinea : basePerfil;
  } else {
    base = baseLinea ?? basePerfil;
  }
  const alturaTinta = Math.max(2, base - yArriba);

  // --- d. Grosor del trazo original (continuo: 2 × área / perímetro). ---
  const nivel = new Float32Array(dist.length);
  for (let i = 0; i < dist.length; i++) nivel[i] = Math.min(1, (dist[i] ?? 0) / contraste);
  const trazo = grosorContinuo(nivel, bw, bh);

  // --- g. Desenfoque: el que haga falta para que los bordes tengan la misma nitidez. ---
  const desenfoque = sigmaParaBorde(anchoBorde(nivel, bw, bh));

  return {
    fondo,
    fondoIzq: f.izq,
    fondoDer: f.der,
    fondoArr: f.arr,
    fondoAbj: f.abj,
    ruido: f.ruido,
    tinta,
    xTinta,
    base,
    alturaTinta,
    anchoTinta,
    trazo,
    desenfoque,
    cajaBorrado: expandir(caja, margenBorrado(caja), W, H),
    textoOriginal,
  };
}

// ---------------------------------------------------------------------------
// Estilo final del texto nuevo
// ---------------------------------------------------------------------------

export interface EstiloFinal {
  tamano: number;
  negrita: boolean;
  negritaDetectada: boolean;
  color: string;
  colorDetectado: string;
  fuente: Fuente;
  cursiva: boolean;
  /** Escala horizontal para imitar el ancho de las letras originales. */
  escalaX: number;
  /** Grosor extra del trazo en px (negativo = más delgado). */
  contorno: number;
}

/** Tamaño de letra que hace que la tinta mida lo mismo que la original. */
function tamanoCalibrado(a: Analisis, fuente: Fuente, cursiva: boolean): number {
  const ref = 100;
  const m = medir(a.textoOriginal, ref, false, fuente, cursiva);
  const ascenso = m.actualBoundingBoxAscent;
  const alturaCaja = a.cajaBorrado.y1 - a.cajaBorrado.y0;
  if (ascenso < ref * 0.2 || a.alturaTinta < alturaCaja * 0.2) {
    // Signos sin altura útil (p. ej. "-"): usamos la altura de la caja.
    return Math.max(6, alturaCaja / 1.05);
  }
  return Math.max(4, (ref * a.alturaTinta) / ascenso);
}

/**
 * Estilo con el que se dibuja el texto nuevo: mismo tamaño de tinta y mismo
 * ancho de letra que el original. `escalaAjuste` solo baja de 1 como último
 * recurso cuando la línea no cabe (mínimo 0.95).
 */
export function resolverEstilo(a: Analisis, ajustes: Ajustes, escalaAjuste = 1): EstiloFinal {
  const fuente = ajustes.fuente;
  const cursiva = ajustes.cursiva;
  let tamano = tamanoCalibrado(a, fuente, cursiva);

  // Imita el ancho de las letras originales (fuentes más angostas o anchas).
  let escalaX = 1;
  if (a.textoOriginal.replace(/\s/g, '').length >= 3) {
    const m = medir(a.textoOriginal, tamano, false, fuente, cursiva);
    const anchoNuestro = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    if (anchoNuestro > 0) escalaX = limitar(a.anchoTinta / anchoNuestro, 0.82, 1.18);
  }

  // Negrita: comparamos el grosor del trazo original con el nuestro, ambos con el mismo desenfoque.
  const tNormal = trazoSintetico(a.textoOriginal, tamano, false, fuente, cursiva, a.desenfoque);
  const tNegrita = trazoSintetico(a.textoOriginal, tamano, true, fuente, cursiva, a.desenfoque);
  const negritaDetectada = Math.abs(a.trazo - tNegrita) < Math.abs(a.trazo - tNormal);
  const negrita = ajustes.negrita ?? negritaDetectada;
  // Ajuste continuo de grosor: contorno del mismo color (o "lija" si es negativo).
  const tElegido = negrita ? tNegrita : tNormal;
  const objetivo = a.trazo * (ajustes.grosor ?? 1);
  const contorno = tElegido > 0 && a.trazo > 0 ? limitar(objetivo - tElegido, -0.35 * tElegido, 1.5 * tElegido) : 0;

  tamano *= ajustes.escala * escalaAjuste;
  escalaX *= ajustes.ancho ?? 1;
  const colorDetectado = rgbAHex(a.tinta);
  const factor = ajustes.escala * escalaAjuste;
  return {
    tamano,
    negrita,
    negritaDetectada,
    color: ajustes.color ?? colorDetectado,
    colorDetectado,
    fuente,
    cursiva,
    escalaX,
    contorno: contorno * factor,
  };
}

/** Ancho de la tinta del texto con ese estilo. */
function anchoDeTinta(texto: string, e: EstiloFinal): number {
  if (!texto) return 0;
  const m = medir(texto, e.tamano, e.negrita, e.fuente, e.cursiva);
  return Math.max(0, (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) * e.escalaX);
}

// ---------------------------------------------------------------------------
// Disposición de las líneas: dónde queda cada palabra tras los cambios
// ---------------------------------------------------------------------------

export interface PosicionEdicion {
  /** Borde izquierdo de la tinta del texto nuevo. */
  x: number;
  ancho: number;
  /** Escala de último recurso (1 = sin achicar). */
  escala: number;
  /** Caja donde se ve el texto nuevo (para marcas y toques). */
  caja: Caja;
  /** Ni apretando ni achicando cupo en la línea. */
  noCabe: boolean;
}

/** Tramo de imagen original que se corre horizontalmente. */
export interface Tramo {
  caja: Caja;
  dx: number;
}

export interface Disposicion {
  /** Corrimiento horizontal (px, entero) de cada palabra original que se movió. */
  dx: Map<string, number>;
  /** Corrimiento para mostrar marcas y tocar: incluye las palabras dentro de una edición. */
  dxVista: Map<string, number>;
  ediciones: Map<string, PosicionEdicion>;
  /** Tramos de la línea (a la derecha de cada edición) que se corren completos. */
  tramos: Tramo[];
}

type Elemento =
  | { tipo: 'palabra'; p: Palabra; x0: number; x1: number }
  | { tipo: 'edicion'; e: Edicion; x0: number; x1: number; ancho: number; vacia: boolean };

/**
 * Hasta dónde puede crecer la línea: el margen derecho en blanco, es decir
 * `pagina.ancho − margen izquierdo`, salvo que haya otro texto a la derecha en
 * la misma altura (p. ej. otra columna).
 */
function limiteDeLinea(pagina: Pagina, linea: Linea): number {
  let margenIzq = pagina.ancho;
  for (const l of pagina.lineas) margenIzq = Math.min(margenIzq, l.caja.x0);
  let limite = pagina.ancho - Math.max(0, margenIzq);
  const alto = Math.max(1, linea.caja.y1 - linea.caja.y0);
  for (const l of pagina.lineas) {
    if (l.id === linea.id || l.caja.x0 <= linea.caja.x1) continue;
    const solape = Math.min(l.caja.y1, linea.caja.y1) - Math.max(l.caja.y0, linea.caja.y0);
    if (solape > alto * 0.3) limite = Math.min(limite, l.caja.x0 - alto * 0.5);
  }
  return limite;
}

/**
 * Recalcula cada línea con cambios: el texto nuevo usa su ancho real y las
 * palabras siguientes se corren. Si la línea se pasa del margen derecho,
 * primero se aprietan los espacios y, como último recurso, se achica el
 * texto nuevo (mínimo 0.95).
 */
export function calcularDisposicion(pagina: Pagina, ediciones: Edicion[]): Disposicion {
  const dx = new Map<string, number>();
  const dxVista = new Map<string, number>();
  const posiciones = new Map<string, PosicionEdicion>();
  const tramos: Tramo[] = [];
  const propias = ediciones.filter((e) => e.pagina === pagina.indice && e.palabras.length > 0);
  if (propias.length === 0) return { dx, dxVista, ediciones: posiciones, tramos };

  const porId = new Map(pagina.palabras.map((p) => [p.id, p]));
  const edicionDe = new Map<string, Edicion>();
  for (const e of propias) for (const id of e.palabras) edicionDe.set(id, e);
  const lineasConCambios = new Set(propias.map((e) => porId.get(e.palabras[0] ?? '')?.lineaId).filter(Boolean));

  for (const linea of pagina.lineas) {
    if (!lineasConCambios.has(linea.id)) continue;
    const palabras = linea.palabras.map((id) => porId.get(id)).filter((p): p is Palabra => !!p);
    palabras.sort((a, b) => a.posEnLinea - b.posEnLinea);

    // Elementos de la línea: palabras originales o ediciones (una por grupo).
    const elementos: Elemento[] = [];
    const vistas = new Set<string>();
    for (const p of palabras) {
      const e = edicionDe.get(p.id);
      if (!e) {
        elementos.push({ tipo: 'palabra', p, x0: p.caja.x0, x1: p.caja.x1 });
        continue;
      }
      if (vistas.has(e.id)) continue;
      vistas.add(e.id);
      const texto = e.textoNuevo.trim();
      const ancho = anchoDeTinta(texto, resolverEstilo(e.analisis, e.ajustes));
      elementos.push({
        tipo: 'edicion',
        e,
        x0: e.analisis.xTinta,
        x1: e.analisis.xTinta + e.analisis.anchoTinta,
        ancho,
        vacia: !texto,
      });
    }
    const primeraEdicion = elementos.findIndex((el) => el.tipo === 'edicion');
    if (primeraEdicion < 0) continue;

    // Coloca los elementos con un factor de espacios (k) y de achicado (s).
    const colocar = (k: number, s: number) => {
      const xs: number[] = [];
      const inicio = elementos[0]?.x0 ?? 0;
      let fin = inicio;
      let hayVisible = false;
      // Si se borró un texto, la palabra siguiente usa el espacio que tenía el borrado (cierra el hueco).
      let espacioHeredado: number | null = null;
      elementos.forEach((el, i) => {
        const anterior = elementos[i - 1];
        const espacio = anterior ? Math.max(0, el.x0 - anterior.x1) * k : 0;
        const x = hayVisible ? fin + (espacioHeredado ?? espacio) : i === 0 ? el.x0 : inicio;
        xs.push(x);
        if (el.tipo === 'edicion' && el.vacia) {
          if (espacioHeredado === null) espacioHeredado = espacio;
        } else {
          fin = x + (el.tipo === 'edicion' ? el.ancho * s : el.x1 - el.x0);
          hayVisible = true;
          espacioHeredado = null;
        }
      });
      return { xs, fin };
    };

    let k = 1;
    let s = 1;
    let r = colocar(k, s);
    const finOriginal = elementos[elementos.length - 1]?.x1 ?? 0;
    // 0) Primero la línea puede crecer hacia el margen derecho en blanco.
    const tope = Math.max(limiteDeLinea(pagina, linea), finOriginal);
    if (r.fin > tope) {
      // 1) Apretar los espacios entre palabras de toda la línea, parejo (hasta 0.75).
      let espacios = 0;
      elementos.forEach((el, i) => {
        const anterior = elementos[i - 1];
        if (anterior) espacios += Math.max(0, el.x0 - anterior.x1);
      });
      if (espacios > 0) {
        k = Math.max(ESPACIO_MINIMO, 1 - (r.fin - tope) / espacios);
        r = colocar(k, s);
      }
      // 2) Último recurso: achicar un poco el texto nuevo.
      if (r.fin > tope) {
        const anchoNuevo = elementos.reduce((t, el) => t + (el.tipo === 'edicion' ? el.ancho : 0), 0);
        if (anchoNuevo > 0) {
          s = Math.max(ESCALA_MINIMA, 1 - (r.fin - tope) / anchoNuevo);
          r = colocar(k, s);
        }
      }
    }

    // 3) Si ni así cabe: se achica lo necesario para no salirse nunca de la
    //    página (la persona confirma antes de guardar).
    let noCabe = false;
    if (r.fin > tope + 0.5) {
      noCabe = true;
      const anchoNuevo = elementos.reduce((t, el) => t + (el.tipo === 'edicion' ? el.ancho : 0), 0);
      const fijo = colocar(k, 0).fin;
      if (anchoNuevo > 0) {
        s = Math.max(0.2, (tope - fijo) / anchoNuevo);
        r = colocar(k, s);
      }
    }
    const W = pagina.ancho;
    const H = pagina.alto;
    elementos.forEach((el, i) => {
      const x = r.xs[i] ?? el.x0;
      if (el.tipo === 'palabra') {
        const d = Math.round(x - el.x0);
        if (d !== 0) {
          dx.set(el.p.id, d);
          dxVista.set(el.p.id, d);
          // Tramo completo de imagen: desde la mitad del espacio anterior (o justo después de
          // una edición) hasta la mitad del siguiente (o el final de la línea). Así se mueven
          // también la puntuación y lo que la lectura descartó.
          const anterior = elementos[i - 1];
          const siguiente = elementos[i + 1];
          let x0: number;
          if (!anterior) x0 = Math.min(el.x0, linea.caja.x0) - 3;
          else if (anterior.tipo === 'edicion') x0 = Math.min(el.x0 - 1, anterior.e.analisis.cajaBorrado.x1);
          else x0 = (anterior.x1 + el.x0) / 2;
          const x1 = siguiente ? (el.x1 + siguiente.x0) / 2 : Math.max(el.x1, linea.caja.x1) + 3;
          const caja = expandir(
            { x0, x1, y0: Math.min(linea.caja.y0, el.p.caja.y0), y1: Math.max(linea.caja.y1, el.p.caja.y1) },
            2,
            W,
            H,
          );
          caja.x0 = Math.max(0, Math.round(x0));
          caja.x1 = Math.min(W, Math.round(x1));
          if (caja.x1 > caja.x0) tramos.push({ caja, dx: d });
        }
      } else {
        const d = Math.round(x - el.x0);
        if (d !== 0) for (const id of el.e.palabras) dxVista.set(id, d);
        const ancho = el.ancho * s;
        const c = el.e.caja;
        posiciones.set(el.e.id, {
          x,
          ancho,
          escala: s,
          caja: { x0: c.x0 + (x - el.x0), y0: c.y0, x1: x + Math.max(ancho, 4), y1: c.y1 },
          noCabe,
        });
      }
    });
  }
  return { dx, dxVista, ediciones: posiciones, tramos };
}

/** Palabras con sus cajas en la posición donde se ven (tras los corrimientos). */
export function palabrasVisibles(pagina: Pagina, d: Disposicion): Palabra[] {
  if (d.dxVista.size === 0) return pagina.palabras;
  return pagina.palabras.map((p) => {
    const m = d.dxVista.get(p.id);
    return m ? { ...p, caja: { ...p.caja, x0: p.caja.x0 + m, x1: p.caja.x1 + m } } : p;
  });
}

// ---------------------------------------------------------------------------
// Dibujar sobre la imagen
// ---------------------------------------------------------------------------

/** e. Borra una zona rellenando con el fondo interpolado entre sus bordes. */
function borrarZona(ctx: CanvasRenderingContext2D, c: Caja, f: Omit<Fondo, 'fondo'>, semilla: number): void {
  const w = Math.max(1, Math.round(c.x1 - c.x0));
  const h = Math.max(1, Math.round(c.y1 - c.y0));
  const img = ctx.getImageData(c.x0, c.y0, w, h);
  const d = img.data;
  const azar = aleatorio(semilla);
  for (let y = 0; y < h; y++) {
    const ty = h > 1 ? y / (h - 1) : 0.5;
    for (let x = 0; x < w; x++) {
      const tx = w > 1 ? x / (w - 1) : 0.5;
      const grano = (azar() + azar() + azar() - 1.5) * 2 * f.ruido;
      const i = (y * w + x) * 4;
      for (let k = 0; k < 3; k++) {
        const hz = (f.izq[k] ?? 0) * (1 - tx) + (f.der[k] ?? 0) * tx;
        const vt = (f.arr[k] ?? 0) * (1 - ty) + (f.abj[k] ?? 0) * ty;
        d[i + k] = limitar((hz + vt) / 2 + grano, 0, 255);
      }
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, c.x0, c.y0);
}

/**
 * g. Desenfoque gaussiano del texto sin depender de `ctx.filter` (no existe en
 * Safari de iOS): se aplica a mano sobre el canal alfa.
 */
function desenfocarAlfa(t: CanvasRenderingContext2D, ancho: number, alto: number, sigma: number, color: RGB): void {
  if (sigma < 0.15) return;
  const img = t.getImageData(0, 0, ancho, alto);
  const d = img.data;
  const alfa = new Float32Array(ancho * alto);
  for (let i = 0; i < alfa.length; i++) alfa[i] = d[i * 4 + 3] ?? 0;
  const borroso = desenfocar(alfa, ancho, alto, sigma);
  for (let i = 0; i < alfa.length; i++) {
    d[i * 4] = color[0];
    d[i * 4 + 1] = color[1];
    d[i * 4 + 2] = color[2];
    d[i * 4 + 3] = borroso[i] ?? 0;
  }
  t.putImageData(img, 0, 0);
}

/** f + g. Dibuja el texto nuevo: borde izquierdo en `x`, sobre la línea base. */
function dibujarTexto(ctx: CanvasRenderingContext2D, a: Analisis, texto: string, estilo: EstiloFinal, x: number): void {
  const m = medir(texto, estilo.tamano, estilo.negrita, estilo.fuente, estilo.cursiva);
  const simulada = cursivaSimulada(estilo.fuente, estilo.cursiva);
  const margen = Math.ceil(estilo.tamano * 0.25 + a.desenfoque * 3 + Math.max(0, estilo.contorno)) + 4;
  const extraCursiva = simulada ? Math.ceil(m.actualBoundingBoxAscent * INCLINACION_SIMULADA) : 0;
  const ancho = Math.max(1, Math.ceil((m.actualBoundingBoxLeft + m.actualBoundingBoxRight) * estilo.escalaX) + margen * 2 + extraCursiva);
  const alto = Math.max(1, Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + margen * 2);
  const temp = document.createElement('canvas');
  temp.width = ancho;
  temp.height = alto;
  const t = ctxLectura(temp);
  const baseLocal = margen + m.actualBoundingBoxAscent;
  t.font = fuenteCss(estilo.tamano, estilo.negrita, estilo.fuente, estilo.cursiva);
  t.fillStyle = estilo.color;
  t.textBaseline = 'alphabetic';
  t.save();
  t.translate(margen, baseLocal);
  t.scale(estilo.escalaX, 1);
  if (simulada) t.transform(1, 0, -INCLINACION_SIMULADA, 1, 0, 0);
  t.fillText(texto, m.actualBoundingBoxLeft, 0);
  // Grosor continuo: contorno del mismo color (engrosa) o borde borrado (adelgaza).
  if (Math.abs(estilo.contorno) >= 0.1) {
    t.lineJoin = 'round';
    t.lineWidth = Math.abs(estilo.contorno) / estilo.escalaX;
    if (estilo.contorno > 0) {
      t.strokeStyle = estilo.color;
      t.strokeText(texto, m.actualBoundingBoxLeft, 0);
    } else {
      t.globalCompositeOperation = 'destination-out';
      t.strokeStyle = '#000';
      t.strokeText(texto, m.actualBoundingBoxLeft, 0);
      t.globalCompositeOperation = 'source-over';
    }
  }
  t.restore();
  desenfocarAlfa(t, ancho, alto, a.desenfoque, hexARgb(estilo.color));
  ctx.drawImage(temp, Math.round(x - margen), Math.round(a.base - baseLocal));
}

/** Dibuja la página: imagen original + todas sus ediciones y corrimientos. */
export function componerPagina(
  pagina: Pagina,
  ediciones: Edicion[],
  destino?: HTMLCanvasElement,
  disposicion?: Disposicion,
): HTMLCanvasElement {
  const lienzo = destino ?? document.createElement('canvas');
  if (lienzo.width !== pagina.ancho) lienzo.width = pagina.ancho;
  if (lienzo.height !== pagina.alto) lienzo.height = pagina.alto;
  const ctx = ctxLectura(lienzo);
  const original = pagina.original;
  ctx.drawImage(original, 0, 0);
  const propias = ediciones.filter((e) => e.pagina === pagina.indice);
  if (propias.length === 0) return lienzo;

  const d = disposicion ?? calcularDisposicion(pagina, propias);

  // 1) Borrar: palabras editadas y tramos de línea que se corren.
  for (const e of propias) {
    const a = e.analisis;
    borrarZona(ctx, a.cajaBorrado, { izq: a.fondoIzq, der: a.fondoDer, arr: a.fondoArr, abj: a.fondoAbj, ruido: a.ruido }, semillaDe(e.caja));
  }
  for (const t of d.tramos) {
    const c = t.caja;
    borrarZona(ctx, c, fondoCacheado(original, `tramo:${c.x0},${c.y0},${c.x1},${c.y1}`, c), semillaDe(c));
  }

  // 2) Pegar los tramos corridos, recortados de la imagen ORIGINAL.
  for (const t of d.tramos) {
    const c = t.caja;
    const w = c.x1 - c.x0;
    const h = c.y1 - c.y0;
    if (w <= 0 || h <= 0) continue;
    ctx.drawImage(original, c.x0, c.y0, w, h, c.x0 + t.dx, c.y0, w, h);
  }

  // 3) Dibujar los textos nuevos.
  for (const e of propias) {
    const texto = e.textoNuevo.trim();
    if (!texto) continue;
    const pos = d.ediciones.get(e.id);
    const estilo = resolverEstilo(e.analisis, e.ajustes, pos?.escala ?? 1);
    dibujarTexto(ctx, e.analisis, texto, estilo, pos?.x ?? e.analisis.xTinta);
  }
  return lienzo;
}
