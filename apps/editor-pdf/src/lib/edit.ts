/**
 * Edición de texto sobre la imagen de una página escaneada.
 *
 * Todo se mide sobre la imagen ORIGINAL de la página, y cada cambio se guarda
 * como una operación. Para mostrar la página se parte de la imagen original y
 * se aplican las operaciones en orden (así deshacer / rehacer es exacto).
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

let lienzoMedida: HTMLCanvasElement | null = null;
function ctxMedida(): CanvasRenderingContext2D {
  if (!lienzoMedida) lienzoMedida = document.createElement('canvas');
  const ctx = lienzoMedida.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new RangeError('Sin memoria para medir');
  return ctx;
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
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 0;
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
// Análisis del texto original
// ---------------------------------------------------------------------------

/**
 * Mide fondo, color, tamaño, línea base y grosor del texto original en la
 * zona de las palabras elegidas.
 */
export function analizar(pagina: Pagina, seleccion: Palabra[], linea: Linea | undefined): Analisis {
  const caja = unirCajas(seleccion.map((p) => p.caja));
  const textoOriginal = seleccion.map((p) => p.texto).join(' ');
  const W = pagina.ancho;
  const H = pagina.alto;
  const ctx = pagina.original.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new RangeError('Sin memoria');

  // Zona de trabajo: la caja + un borde de 6 px.
  const M = 6;
  const zx0 = Math.max(0, Math.floor(caja.x0) - M);
  const zy0 = Math.max(0, Math.floor(caja.y0) - M);
  const zx1 = Math.min(W, Math.ceil(caja.x1) + M);
  const zy1 = Math.min(H, Math.ceil(caja.y1) + M);
  const zw = zx1 - zx0;
  const zh = zy1 - zy0;
  const datos = ctx.getImageData(zx0, zy0, zw, zh).data;
  const px = (x: number, y: number): number[] => {
    const i = ((y - zy0) * zw + (x - zx0)) * 4;
    return [datos[i] ?? 0, datos[i + 1] ?? 0, datos[i + 2] ?? 0];
  };

  // --- a. Fondo: borde de ~3 px alrededor de la caja (de 2 a 5 px afuera). ---
  const izq: number[][] = [];
  const der: number[][] = [];
  const arr: number[][] = [];
  const abj: number[][] = [];
  const cx0 = Math.floor(caja.x0);
  const cy0 = Math.floor(caja.y0);
  const cx1 = Math.ceil(caja.x1);
  const cy1 = Math.ceil(caja.y1);
  for (let y = zy0; y < zy1; y++) {
    for (let x = zx0; x < zx1; x++) {
      const dentroX = x >= cx0 && x < cx1;
      const dentroY = y >= cy0 && y < cy1;
      if (dentroY && x >= cx0 - 5 && x <= cx0 - 2) izq.push(px(x, y));
      else if (dentroY && x >= cx1 + 1 && x <= cx1 + 4) der.push(px(x, y));
      else if (dentroX && y >= cy0 - 5 && y <= cy0 - 2) arr.push(px(x, y));
      else if (dentroX && y >= cy1 + 1 && y <= cy1 + 4) abj.push(px(x, y));
    }
  }
  const anillo = [...izq, ...der, ...arr, ...abj];
  const fondo: RGB = medianaRGB(anillo) ?? [255, 255, 255];
  const fondoIzq = medianaRGB(izq) ?? fondo;
  const fondoDer = medianaRGB(der) ?? fondo;
  const fondoArr = medianaRGB(arr) ?? fondo;
  const fondoAbj = medianaRGB(abj) ?? fondo;

  // Textura del papel: desviación robusta de la luminancia del borde.
  const lumFondo = luminancia(...fondo);
  const desvios = anillo.map((p) => Math.abs(luminancia(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0) - lumFondo));
  const ruido = limitar(mediana(desvios) * 1.4826, 0, 10);

  // --- b. Color del texto: el 15 % de píxeles más distintos al fondo. ---
  const bw = Math.max(1, cx1 - cx0);
  const bh = Math.max(1, cy1 - cy0);
  const dist = new Float32Array(bw * bh);
  const interior: { d: number; p: number[] }[] = [];
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const gx = Math.min(W - 1, cx0 + x);
      const gy = Math.min(H - 1, cy0 + y);
      const p = px(gx, gy);
      const d = distancia(p, fondo);
      dist[y * bw + x] = d;
      interior.push({ d, p });
    }
  }
  interior.sort((a, b) => b.d - a.d);
  const n = Math.max(1, Math.floor(interior.length * FRACCION_TINTA));
  const masDistintos = interior.slice(0, n).map((e) => e.p);
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

  const primera = (arrl: number[], min: number) => arrl.findIndex((v) => v >= min);
  const ultima = (arrl: number[], min: number) => {
    for (let i = arrl.length - 1; i >= 0; i--) if ((arrl[i] ?? 0) >= min) return i;
    return -1;
  };
  let tintaArriba = primera(filas, 1);
  let tintaAbajo = ultima(filas, 1);
  let tintaIzq = primera(columnas, 1);
  let tintaDer = ultima(columnas, 1);
  if (tintaArriba < 0) {
    tintaArriba = 0;
    tintaAbajo = bh - 1;
    tintaIzq = 0;
    tintaDer = bw - 1;
  }
  const yArriba = cy0 + tintaArriba;
  const yAbajo = cy0 + tintaAbajo;
  const xTinta = cx0 + tintaIzq;
  const anchoTinta = tintaDer - tintaIzq + 1;

  // --- c. Línea base y tamaño. ---
  let base: number;
  const tieneDescendentes = DESCENDENTES.test(textoOriginal);
  if (!tieneDescendentes) {
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

  // Hasta dónde puede crecer el texto nuevo sin pisar la palabra siguiente.
  const ultimaSel = seleccion[seleccion.length - 1];
  const siguiente =
    linea && ultimaSel
      ? pagina.palabras.find((p) => p.lineaId === linea.id && p.posEnLinea === ultimaSel.posEnLinea + 1)
      : undefined;
  // Respetamos el mismo espacio que había entre las palabras originales.
  const espacio = ultimaSel && siguiente ? Math.max(2, siguiente.caja.x0 - ultimaSel.caja.x1) : 0;
  const limiteDerecho = siguiente
    ? Math.max(caja.x1, siguiente.caja.x0 - espacio)
    : Math.min(W - 4, caja.x1 + (caja.y1 - caja.y0) * 1.5);

  // Zona de borrado: la caja con 2 px (o un poco más en letras grandes) de margen.
  const margen = Math.max(2, Math.round((caja.y1 - caja.y0) * 0.06));
  const cajaBorrado: Caja = {
    x0: Math.max(0, Math.floor(caja.x0) - margen),
    y0: Math.max(0, Math.floor(caja.y0) - margen),
    x1: Math.min(W, Math.ceil(caja.x1) + margen),
    y1: Math.min(H, Math.ceil(caja.y1) + margen),
  };

  return {
    fondo,
    fondoIzq,
    fondoDer,
    fondoArr,
    fondoAbj,
    ruido,
    tinta,
    xTinta,
    base,
    alturaTinta,
    anchoTinta,
    limiteDerecho,
    trazo,
    desenfoque,
    cajaBorrado,
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
  /** Escala horizontal (1 = normal). */
  escalaX: number;
  /** true si tuvimos que achicar el texto para que quepa. */
  achicado: boolean;
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

export function resolverEstilo(a: Analisis, ajustes: Ajustes, textoNuevo: string): EstiloFinal {
  const fuente = ajustes.fuente;
  let tamano = tamanoCalibrado(a, fuente);

  // Imita el ancho de las letras originales (fuentes más angostas o anchas).
  let escalaX = 1;
  const letras = a.textoOriginal.replace(/\s/g, '').length;
  if (letras >= 3) {
    const m = medir(a.textoOriginal, tamano, false, fuente);
    const anchoNuestro = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    if (anchoNuestro > 0) escalaX = limitar(a.anchoTinta / anchoNuestro, 0.82, 1.18);
  }

  // Negrita: comparamos el grosor del trazo original con el nuestro.
  const tNormal = trazoSintetico(a.textoOriginal, tamano, false, fuente);
  const tNegrita = trazoSintetico(a.textoOriginal, tamano, true, fuente);
  const negritaDetectada = Math.abs(a.trazo - tNegrita) < Math.abs(a.trazo - tNormal);
  const negrita = ajustes.negrita ?? negritaDetectada;

  tamano *= ajustes.escala;

  // Si el texto nuevo no cabe, primero lo angostamos un poco y luego lo achicamos.
  let achicado = false;
  if (textoNuevo) {
    const m = medir(textoNuevo, tamano, negrita, fuente);
    const ancho = (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) * escalaX;
    const disponible = Math.max(4, a.limiteDerecho - a.xTinta);
    if (ancho > disponible) {
      const f = disponible / ancho;
      achicado = f < 0.95;
      const fAncho = Math.max(f, 0.88);
      escalaX *= fAncho;
      if (f < fAncho) tamano *= f / fAncho;
    }
  }

  const colorDetectado = rgbAHex(a.tinta);
  return {
    tamano,
    negrita,
    negritaDetectada,
    color: ajustes.color ?? colorDetectado,
    colorDetectado,
    fuente,
    escalaX,
    achicado,
  };
}

// ---------------------------------------------------------------------------
// Aplicar cambios sobre la imagen
// ---------------------------------------------------------------------------

/** e. Borra la zona rellenando con el fondo interpolado entre sus bordes. */
function borrar(ctx: CanvasRenderingContext2D, a: Analisis, semilla: number): void {
  const c = a.cajaBorrado;
  const w = Math.max(1, c.x1 - c.x0);
  const h = Math.max(1, c.y1 - c.y0);
  const img = ctx.getImageData(c.x0, c.y0, w, h);
  const d = img.data;
  const azar = aleatorio(semilla);
  for (let y = 0; y < h; y++) {
    const ty = h > 1 ? y / (h - 1) : 0.5;
    for (let x = 0; x < w; x++) {
      const tx = w > 1 ? x / (w - 1) : 0.5;
      const grano = (azar() + azar() + azar() - 1.5) * 2 * a.ruido;
      const i = (y * w + x) * 4;
      for (let k = 0; k < 3; k++) {
        const hz = (a.fondoIzq[k] ?? 0) * (1 - tx) + (a.fondoDer[k] ?? 0) * tx;
        const vt = (a.fondoArr[k] ?? 0) * (1 - ty) + (a.fondoAbj[k] ?? 0) * ty;
        d[i + k] = limitar((hz + vt) / 2 + grano, 0, 255);
      }
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, c.x0, c.y0);
}

/** f + g. Dibuja el texto nuevo en la línea base, con un leve desenfoque. */
function dibujarTexto(ctx: CanvasRenderingContext2D, a: Analisis, texto: string, estilo: EstiloFinal): void {
  const m = medir(texto, estilo.tamano, estilo.negrita, estilo.fuente);
  const margen = Math.ceil(estilo.tamano * 0.5) + 4;
  const ancho = Math.ceil((m.actualBoundingBoxLeft + m.actualBoundingBoxRight) * estilo.escalaX) + margen * 2;
  const alto = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + margen * 2;
  const temp = document.createElement('canvas');
  temp.width = Math.max(1, ancho);
  temp.height = Math.max(1, alto);
  const t = temp.getContext('2d');
  if (!t) return;
  const baseLocal = margen + m.actualBoundingBoxAscent;
  t.font = fuenteCss(estilo.tamano, estilo.negrita, estilo.fuente);
  t.fillStyle = estilo.color;
  t.textBaseline = 'alphabetic';
  t.translate(margen, baseLocal);
  t.scale(estilo.escalaX, 1);
  t.fillText(texto, m.actualBoundingBoxLeft, 0);

  const ox = Math.round(a.xTinta - margen);
  const oy = Math.round(a.base - baseLocal);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.filter = `blur(${a.desenfoque.toFixed(2)}px)`;
  ctx.drawImage(temp, ox, oy);
  ctx.restore();
}

function semillaDe(c: Caja): number {
  return (Math.round(c.x0) * 73856093) ^ (Math.round(c.y0) * 19349663) ^ (Math.round(c.x1) * 83492791);
}

export function aplicarEdicion(ctx: CanvasRenderingContext2D, e: Edicion): void {
  borrar(ctx, e.analisis, semillaDe(e.caja));
  if (e.textoNuevo.trim()) {
    const estilo = resolverEstilo(e.analisis, e.ajustes, e.textoNuevo);
    dibujarTexto(ctx, e.analisis, e.textoNuevo, estilo);
  }
}

/** Dibuja la página: imagen original + todas sus ediciones, en orden. */
export function componerPagina(pagina: Pagina, ediciones: Edicion[], destino?: HTMLCanvasElement): HTMLCanvasElement {
  const lienzo = destino ?? document.createElement('canvas');
  if (lienzo.width !== pagina.ancho) lienzo.width = pagina.ancho;
  if (lienzo.height !== pagina.alto) lienzo.height = pagina.alto;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new RangeError('Sin memoria para dibujar la página');
  ctx.drawImage(pagina.original, 0, 0);
  for (const e of ediciones) if (e.pagina === pagina.indice) aplicarEdicion(ctx, e);
  return lienzo;
}
