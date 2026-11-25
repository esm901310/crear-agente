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

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const FAMILIAS: Record<Fuente, string> = {
  sans: 'Arial, Helvetica, "Liberation Sans", "Nimbus Sans", Arimo, sans-serif',
  serif: '"Times New Roman", Times, "Liberation Serif", "Nimbus Roman", Tinos, Georgia, serif',
};

/** Letras que bajan de la línea base. */
const DESCENDENTES = /[gjpqyQçÇ,;()[\]{}|/µ]/;

/** Proporción de píxeles "más distintos al fondo" que se usan para el color del texto. */
const FRACCION_TINTA = 0.15;

/** Lo mínimo que puede quedar un espacio entre palabras al apretar la línea. */
const ESPACIO_MINIMO = 0.5;
/** Lo mínimo que se achica el texto nuevo (último recurso). */
const ESCALA_MINIMA = 0.95;

function fuenteCss(tamano: number, negrita: boolean, fuente: Fuente): string {
  return `${negrita ? 'bold ' : ''}${tamano.toFixed(2)}px ${FAMILIAS[fuente]}`;
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

function hexARgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
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

function medir(texto: string, tamano: number, negrita: boolean, fuente: Fuente): TextMetrics {
  const ctx = ctxMedida();
  ctx.font = fuenteCss(tamano, negrita, fuente);
  return ctx.measureText(texto);
}

/** Mediana del largo de los trazos horizontales en una máscara de tinta. */
function trazoMediano(mascara: Uint8Array, ancho: number, alto: number): number {
  const largos: number[] = [];
  for (let y = 0; y < alto; y++) {
    let run = 0;
    for (let x = 0; x < ancho; x++) {
      if (mascara[y * ancho + x]) run++;
      else if (run > 0) {
        largos.push(run);
        run = 0;
      }
    }
    if (run > 0) largos.push(run);
  }
  return mediana(largos);
}

const cacheTrazo = new Map<string, number>();
/** Grosor de trazo que tendría el texto dibujado con nuestra fuente. */
function trazoSintetico(texto: string, tamano: number, negrita: boolean, fuente: Fuente): number {
  const clave = `${texto}|${tamano.toFixed(1)}|${negrita}|${fuente}`;
  const guardado = cacheTrazo.get(clave);
  if (guardado !== undefined) return guardado;
  const m = medir(texto, tamano, negrita, fuente);
  const ancho = Math.max(1, Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + 4);
  const alto = Math.max(1, Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + 4);
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  const ctx = ctxLectura(c);
  ctx.font = fuenteCss(tamano, negrita, fuente);
  ctx.fillStyle = '#000';
  ctx.fillText(texto, 2 + m.actualBoundingBoxLeft, 2 + m.actualBoundingBoxAscent);
  const datos = ctx.getImageData(0, 0, ancho, alto).data;
  const mascara = new Uint8Array(ancho * alto);
  for (let i = 0; i < mascara.length; i++) mascara[i] = (datos[i * 4 + 3] ?? 0) > 127 ? 1 : 0;
  const t = trazoMediano(mascara, ancho, alto);
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
  const dist = new Float32Array(bw * bh);
  const interior: { d: number; i: number }[] = [];
  for (let i = 0; i < bw * bh; i++) {
    const d = distancia([datos[i * 4] ?? 0, datos[i * 4 + 1] ?? 0, datos[i * 4 + 2] ?? 0], fondo);
    dist[i] = d;
    interior.push({ d, i });
  }
  interior.sort((a, b) => b.d - a.d);
  const n = Math.max(1, Math.floor(interior.length * FRACCION_TINTA));
  const masDistintos = interior.slice(0, n).map(({ i }) => [datos[i * 4] ?? 0, datos[i * 4 + 1] ?? 0, datos[i * 4 + 2] ?? 0]);
  let tinta: RGB = medianaRGB(masDistintos) ?? [0, 0, 0];
  let contraste = distancia(tinta, fondo);
  if (contraste < 20) {
    // Casi no hay tinta: usamos un gris oscuro razonable.
    tinta = lumFondo > 128 ? [40, 40, 40] : [230, 230, 230];
    contraste = distancia(tinta, fondo);
  }

  // Máscara de tinta: más de la mitad del contraste.
  const umbral = contraste * 0.5;
  const mascara = new Uint8Array(bw * bh);
  let intermedios = 0;
  let tintaTotal = 0;
  const filas = new Array<number>(bh).fill(0);
  const columnas = new Array<number>(bw).fill(0);
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i] ?? 0;
    if (d > umbral) {
      mascara[i] = 1;
      tintaTotal++;
      filas[Math.floor(i / bw)]! += 1;
      columnas[i % bw]! += 1;
    }
    if (d > contraste * 0.2 && d < contraste * 0.8) intermedios++;
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
  let base: number;
  if (!DESCENDENTES.test(textoOriginal)) {
    base = yAbajo + 1;
  } else if (linea?.base) {
    const b = linea.base;
    const xc = (caja.x0 + caja.x1) / 2;
    const t = b.x1 === b.x0 ? 0 : (xc - b.x0) / (b.x1 - b.x0);
    base = b.y0 + (b.y1 - b.y0) * t;
    base = limitar(base, yArriba + (yAbajo - yArriba) * 0.4, yAbajo + 1);
  } else {
    // Perfil de filas: debajo de la base solo quedan las colitas (pocas).
    const maxFila = Math.max(...filas);
    let ultimaFuerte = tintaAbajo;
    for (let i = tintaAbajo; i >= tintaArriba; i--) {
      if ((filas[i] ?? 0) >= maxFila * 0.35) {
        ultimaFuerte = i;
        break;
      }
    }
    base = cy0 + ultimaFuerte + 1;
  }
  const alturaTinta = Math.max(2, base - yArriba);

  // --- d. Grosor del trazo original. ---
  const trazo = trazoMediano(mascara, bw, bh);

  // --- g. Desenfoque: cuántos píxeles "a medio tono" hay respecto a la tinta. ---
  const proporcionBorde = tintaTotal > 0 ? intermedios / tintaTotal : 0.5;
  const desenfoque = limitar(0.3 + (proporcionBorde - 0.5) * 0.5, 0.3, 0.9);

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
  /** Escala horizontal para imitar el ancho de las letras originales. */
  escalaX: number;
}

/** Tamaño de letra que hace que la tinta mida lo mismo que la original. */
function tamanoCalibrado(a: Analisis, fuente: Fuente): number {
  const ref = 100;
  const m = medir(a.textoOriginal, ref, false, fuente);
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
  let tamano = tamanoCalibrado(a, fuente);

  // Imita el ancho de las letras originales (fuentes más angostas o anchas).
  let escalaX = 1;
  if (a.textoOriginal.replace(/\s/g, '').length >= 3) {
    const m = medir(a.textoOriginal, tamano, false, fuente);
    const anchoNuestro = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    if (anchoNuestro > 0) escalaX = limitar(a.anchoTinta / anchoNuestro, 0.82, 1.18);
  }

  // Negrita: comparamos el grosor del trazo original con el nuestro.
  const tNormal = trazoSintetico(a.textoOriginal, tamano, false, fuente);
  const tNegrita = trazoSintetico(a.textoOriginal, tamano, true, fuente);
  const negritaDetectada = Math.abs(a.trazo - tNegrita) < Math.abs(a.trazo - tNormal);
  const negrita = ajustes.negrita ?? negritaDetectada;

  tamano *= ajustes.escala * escalaAjuste;
  const colorDetectado = rgbAHex(a.tinta);
  return { tamano, negrita, negritaDetectada, color: ajustes.color ?? colorDetectado, colorDetectado, fuente, escalaX };
}

/** Ancho de la tinta del texto con ese estilo. */
function anchoDeTinta(texto: string, e: EstiloFinal): number {
  if (!texto) return 0;
  const m = medir(texto, e.tamano, e.negrita, e.fuente);
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
}

export interface Disposicion {
  /** Corrimiento horizontal (px, entero) de cada palabra original que se movió. */
  dx: Map<string, number>;
  /** Corrimiento para mostrar marcas y tocar: incluye las palabras dentro de una edición. */
  dxVista: Map<string, number>;
  ediciones: Map<string, PosicionEdicion>;
}

type Elemento =
  | { tipo: 'palabra'; p: Palabra; x0: number; x1: number }
  | { tipo: 'edicion'; e: Edicion; x0: number; x1: number; ancho: number; vacia: boolean };

/** Borde derecho más lejano entre las líneas de la página. */
function margenDerecho(pagina: Pagina): number {
  let m = 0;
  for (const l of pagina.lineas) m = Math.max(m, l.caja.x1);
  return m || pagina.ancho;
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
  const propias = ediciones.filter((e) => e.pagina === pagina.indice && e.palabras.length > 0);
  if (propias.length === 0) return { dx, dxVista, ediciones: posiciones };

  const porId = new Map(pagina.palabras.map((p) => [p.id, p]));
  const edicionDe = new Map<string, Edicion>();
  for (const e of propias) for (const id of e.palabras) edicionDe.set(id, e);
  const lineasConCambios = new Set(propias.map((e) => porId.get(e.palabras[0] ?? '')?.lineaId).filter(Boolean));
  const margen = margenDerecho(pagina);

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
    const tope = Math.max(margen, finOriginal);
    if (r.fin > tope) {
      // 1) Apretar los espacios entre palabras de toda la línea, parejo (hasta la mitad).
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

    elementos.forEach((el, i) => {
      const x = r.xs[i] ?? el.x0;
      if (el.tipo === 'palabra') {
        const d = Math.round(x - el.x0);
        if (d !== 0) {
          dx.set(el.p.id, d);
          dxVista.set(el.p.id, d);
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
        });
      }
    });
  }
  return { dx, dxVista, ediciones: posiciones };
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
 * g. Desenfoque leve sin depender de `ctx.filter` (no existe en Safari de
 * iOS): desenfoque gaussiano 3x3 sobre el canal alfa del texto.
 */
function desenfocarAlfa(t: CanvasRenderingContext2D, ancho: number, alto: number, sigma: number, color: RGB): void {
  if (sigma <= 0.05) return;
  const img = t.getImageData(0, 0, ancho, alto);
  const d = img.data;
  const alfa = new Float32Array(ancho * alto);
  for (let i = 0; i < alfa.length; i++) alfa[i] = d[i * 4 + 3] ?? 0;
  const w1 = Math.exp(-1 / (2 * sigma * sigma));
  const w2 = Math.exp(-2 / (2 * sigma * sigma));
  const total = 1 + 4 * w1 + 4 * w2;
  const a = (x: number, y: number) => (x < 0 || y < 0 || x >= ancho || y >= alto ? 0 : (alfa[y * ancho + x] ?? 0));
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const v =
        a(x, y) +
        w1 * (a(x - 1, y) + a(x + 1, y) + a(x, y - 1) + a(x, y + 1)) +
        w2 * (a(x - 1, y - 1) + a(x + 1, y - 1) + a(x - 1, y + 1) + a(x + 1, y + 1));
      const i = (y * ancho + x) * 4;
      d[i] = color[0];
      d[i + 1] = color[1];
      d[i + 2] = color[2];
      d[i + 3] = v / total;
    }
  }
  t.putImageData(img, 0, 0);
}

/** f + g. Dibuja el texto nuevo: borde izquierdo en `x`, sobre la línea base. */
function dibujarTexto(ctx: CanvasRenderingContext2D, a: Analisis, texto: string, estilo: EstiloFinal, x: number): void {
  const m = medir(texto, estilo.tamano, estilo.negrita, estilo.fuente);
  const margen = Math.ceil(estilo.tamano * 0.25) + 4;
  const ancho = Math.max(1, Math.ceil((m.actualBoundingBoxLeft + m.actualBoundingBoxRight) * estilo.escalaX) + margen * 2);
  const alto = Math.max(1, Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + margen * 2);
  const temp = document.createElement('canvas');
  temp.width = ancho;
  temp.height = alto;
  const t = ctxLectura(temp);
  const baseLocal = margen + m.actualBoundingBoxAscent;
  t.font = fuenteCss(estilo.tamano, estilo.negrita, estilo.fuente);
  t.fillStyle = estilo.color;
  t.textBaseline = 'alphabetic';
  t.save();
  t.translate(margen, baseLocal);
  t.scale(estilo.escalaX, 1);
  t.fillText(texto, m.actualBoundingBoxLeft, 0);
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
  const W = pagina.ancho;
  const H = pagina.alto;
  const movidas = pagina.palabras.filter((p) => d.dx.has(p.id));

  // 1) Borrar: palabras editadas y palabras que se corren.
  for (const e of propias) {
    const a = e.analisis;
    borrarZona(ctx, a.cajaBorrado, { izq: a.fondoIzq, der: a.fondoDer, arr: a.fondoArr, abj: a.fondoAbj, ruido: a.ruido }, semillaDe(e.caja));
  }
  for (const p of movidas) {
    const zona = expandir(p.caja, margenBorrado(p.caja), W, H);
    borrarZona(ctx, zona, fondoCacheado(original, p.id, p.caja), semillaDe(p.caja));
  }

  // 2) Pegar las palabras corridas, recortadas de la imagen ORIGINAL.
  for (const p of movidas) {
    const dx = d.dx.get(p.id) ?? 0;
    const z = expandir(p.caja, 2, W, H);
    const w = z.x1 - z.x0;
    const h = z.y1 - z.y0;
    if (w <= 0 || h <= 0) continue;
    ctx.drawImage(original, z.x0, z.y0, w, h, z.x0 + dx, z.y0, w, h);
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
