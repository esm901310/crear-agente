/**
 * Detección automática de la letra más parecida a la del escaneo.
 *
 * 1. Se toman varias palabras bien leídas de la línea tocada y de líneas
 *    vecinas con el mismo tamaño de letra (más muestras = decisión estable).
 * 2. De cada palabra se saca la tinta original binarizada, su altura sobre la
 *    línea base y su ancho.
 * 3. Primera pasada barata (solo medir, sin dibujar): para cada candidata
 *    (letra x negrita x cursiva) se compara el ancho natural del texto con el
 *    ancho real; las que no se parecen en proporciones se descartan.
 * 4. Pasada fina: se dibuja el texto leído con cada candidata, a la altura de
 *    la tinta y en la línea base, estirado al mismo ancho (para comparar solo
 *    la FORMA), y se compara con la tinta original: correlación sobre versiones
 *    suavizadas + coincidencia (IoU). El ancho natural también suma al puntaje.
 * 5. El resultado se guarda por página y línea (y se comparte con las líneas
 *    cuyas palabras se usaron como muestra).
 */
import { analizar } from './edit';
import { CATALOGO, cargarCatalogo, cursivaSimulada, fuenteCss, letraPorId } from './catalogo';
import type { Linea, Pagina, Palabra } from './types';

export interface PuntajeLetra {
  letra: string;
  negrita: boolean;
  cursiva: boolean;
  /** Puntaje final (más alto = más parecida). */
  puntaje: number;
  /** Parecido de forma (0 a 1). */
  forma: number;
  /** Diferencia de ancho natural (0 = igual). */
  difAncho: number;
}

export interface Deteccion {
  /** Todas las candidatas evaluadas en detalle, de mejor a peor. */
  ranking: PuntajeLetra[];
  /** La mejor variante de cada letra, de mejor a peor. */
  porLetra: PuntajeLetra[];
  mejor: PuntajeLetra;
  confianza: 'alta' | 'baja';
  muestras: number;
  ms: number;
}

/** Cuántas candidatas pasan a la comparación fina. */
const FINALISTAS = 14;
const MAX_MUESTRAS = 10;
/** Altura de trabajo (px) para comparar: más chico = más rápido. */
const ALTO_TRABAJO = 30;
const PESO_ANCHO = 0.6;
const INCLINACION = 0.21;

interface Muestra {
  texto: string;
  /** Máscara suave (0..1) a escala de trabajo. */
  mascara: Float32Array;
  ancho: number;
  alto: number;
  /** Escala de trabajo respecto a la imagen. */
  f: number;
  /** Origen de la zona en la imagen. */
  x0: number;
  y0: number;
  base: number;
  xTinta: number;
  anchoTinta: number;
  alturaTinta: number;
}

interface Candidata {
  letra: string;
  negrita: boolean;
  cursiva: boolean;
}

function todasLasCandidatas(): Candidata[] {
  const lista: Candidata[] = [];
  for (const l of CATALOGO) {
    for (const negrita of l.tieneNegrita ? [false, true] : [false]) {
      for (const cursiva of [false, true]) lista.push({ letra: l.id, negrita, cursiva });
    }
  }
  return lista;
}

let lienzoTrabajo: HTMLCanvasElement | null = null;
function ctxTrabajo(ancho: number, alto: number): CanvasRenderingContext2D {
  if (!lienzoTrabajo) lienzoTrabajo = document.createElement('canvas');
  if (lienzoTrabajo.width < ancho) lienzoTrabajo.width = ancho;
  if (lienzoTrabajo.height < alto) lienzoTrabajo.height = alto;
  const ctx = lienzoTrabajo.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new RangeError('Sin memoria');
  return ctx;
}

const letrasUtiles = (t: string) => (t.match(/\p{L}/gu) ?? []).length;

/** Saca la tinta de una palabra como máscara suave a escala de trabajo. */
function extraerMuestra(pagina: Pagina, p: Palabra, linea: Linea | undefined): Muestra | null {
  const a = analizar(pagina, [p], linea);
  if (a.alturaTinta < 6 || a.anchoTinta < 6) return null;
  const pad = 3;
  const x0 = Math.max(0, Math.floor(p.caja.x0) - pad);
  const y0 = Math.max(0, Math.floor(p.caja.y0) - pad);
  const x1 = Math.min(pagina.ancho, Math.ceil(p.caja.x1) + pad);
  const y1 = Math.min(pagina.alto, Math.ceil(p.caja.y1) + pad);
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);
  const ctx = pagina.original.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const datos = ctx.getImageData(x0, y0, w, h).data;
  const [fr, fg, fb] = a.fondo;
  const [tr, tg, tb] = a.tinta;
  const contraste = Math.hypot(tr - fr, tg - fg, tb - fb) || 1;

  const f = Math.min(1, ALTO_TRABAJO / a.alturaTinta);
  const ancho = Math.max(1, Math.round(w * f));
  const alto = Math.max(1, Math.round(h * f));
  const mascara = new Float32Array(ancho * alto);
  const cuenta = new Float32Array(ancho * alto);
  for (let y = 0; y < h; y++) {
    const yy = Math.min(alto - 1, Math.floor(y * f));
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const d = Math.hypot((datos[i] ?? 0) - fr, (datos[i + 1] ?? 0) - fg, (datos[i + 2] ?? 0) - fb);
      const v = d > contraste * 0.5 ? 1 : 0;
      const j = yy * ancho + Math.min(ancho - 1, Math.floor(x * f));
      mascara[j]! += v;
      cuenta[j]! += 1;
    }
  }
  for (let j = 0; j < mascara.length; j++) mascara[j] = (cuenta[j] ?? 0) > 0 ? (mascara[j] ?? 0) / (cuenta[j] ?? 1) : 0;
  return {
    texto: p.texto,
    mascara,
    ancho,
    alto,
    f,
    x0,
    y0,
    base: a.base,
    xTinta: a.xTinta,
    anchoTinta: a.anchoTinta,
    alturaTinta: a.alturaTinta,
  };
}

interface Medida {
  tamano: number;
  /** Ancho de la tinta a ese tamaño. */
  anchoNatural: number;
  izquierda: number;
}

function medirCandidata(c: Candidata, m: Muestra): Medida | null {
  const ctx = ctxTrabajo(1, 1);
  ctx.font = fuenteCss(c.letra, 100, c.negrita, c.cursiva);
  const t = ctx.measureText(m.texto);
  if (t.actualBoundingBoxAscent < 10) return null;
  const tamano = (100 * m.alturaTinta) / t.actualBoundingBoxAscent;
  const k = tamano / 100;
  let anchoNatural = (t.actualBoundingBoxLeft + t.actualBoundingBoxRight) * k;
  if (cursivaSimulada(c.letra, c.cursiva)) anchoNatural += t.actualBoundingBoxAscent * k * INCLINACION * 0.5;
  return { tamano, anchoNatural, izquierda: t.actualBoundingBoxLeft * k };
}

/** Suavizado 3x3 (caja) para que la comparación tolere pequeños corrimientos. */
function suavizar(v: Float32Array, ancho: number, alto: number): Float32Array {
  const out = new Float32Array(v.length);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      let s = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= alto) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= ancho) continue;
          s += v[yy * ancho + xx] ?? 0;
          n++;
        }
      }
      out[y * ancho + x] = s / n;
    }
  }
  return out;
}

const cacheSuave = new WeakMap<Muestra, Float32Array>();

/** Parecido de forma entre la tinta original y el texto dibujado con la candidata. */
function compararForma(c: Candidata, m: Muestra, med: Medida): number {
  const { ancho, alto, f } = m;
  const ctx = ctxTrabajo(ancho, alto);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ancho, alto);
  // Estirado al mismo ancho que la tinta original: así se compara solo la forma.
  const escalaX = m.anchoTinta / Math.max(1, med.anchoNatural);
  ctx.font = fuenteCss(c.letra, med.tamano * f, c.negrita, c.cursiva);
  ctx.fillStyle = '#000';
  ctx.translate((m.xTinta - m.x0) * f, (m.base - m.y0) * f);
  ctx.scale(escalaX, 1);
  if (cursivaSimulada(c.letra, c.cursiva)) ctx.transform(1, 0, -INCLINACION, 1, 0, 0);
  ctx.fillText(m.texto, med.izquierda * f, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const datos = ctx.getImageData(0, 0, ancho, alto).data;
  const dibujo = new Float32Array(ancho * alto);
  for (let i = 0; i < dibujo.length; i++) dibujo[i] = (datos[i * 4 + 3] ?? 0) / 255;

  // IoU sobre las versiones binarizadas.
  let inter = 0;
  let union = 0;
  for (let i = 0; i < dibujo.length; i++) {
    const a = (m.mascara[i] ?? 0) > 0.5;
    const b = (dibujo[i] ?? 0) > 0.5;
    if (a && b) inter++;
    if (a || b) union++;
  }
  const iou = union > 0 ? inter / union : 0;

  // Correlación sobre versiones suavizadas.
  let A = cacheSuave.get(m);
  if (!A) {
    A = suavizar(m.mascara, ancho, alto);
    cacheSuave.set(m, A);
  }
  const B = suavizar(dibujo, ancho, alto);
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < A.length; i++) {
    ma += A[i] ?? 0;
    mb += B[i] ?? 0;
  }
  ma /= A.length;
  mb /= B.length;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < A.length; i++) {
    const da = (A[i] ?? 0) - ma;
    const db = (B[i] ?? 0) - mb;
    sab += da * db;
    saa += da * da;
    sbb += db * db;
  }
  const ncc = saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : 0;
  return 0.6 * Math.max(0, ncc) + 0.4 * iou;
}

function mediana(v: number[]): number {
  if (v.length === 0) return 0;
  const o = [...v].sort((a, b) => a - b);
  return o[o.length >> 1] ?? 0;
}

// ---------------------------------------------------------------------------

const cache = new WeakMap<Pagina['original'], Map<string, Deteccion>>();

function cacheDe(pagina: Pagina): Map<string, Deteccion> {
  let m = cache.get(pagina.original);
  if (!m) {
    m = new Map();
    cache.set(pagina.original, m);
  }
  return m;
}

export function deteccionGuardada(pagina: Pagina, lineaId: string): Deteccion | undefined {
  return cacheDe(pagina).get(lineaId);
}

/** Elige palabras de muestra: la línea tocada primero y luego líneas vecinas de igual tamaño. */
function elegirMuestras(pagina: Pagina, linea: Linea): { muestras: Muestra[]; lineas: Set<string> } {
  const indice = pagina.lineas.findIndex((l) => l.id === linea.id);
  const porId = new Map(pagina.palabras.map((p) => [p.id, p]));
  const candidatasLinea = (l: Linea) =>
    l.palabras
      .map((id) => porId.get(id))
      .filter((p): p is Palabra => !!p && p.confianza >= 70 && letrasUtiles(p.texto) >= 3)
      .sort((a, b) => b.texto.length - a.texto.length);

  const muestras: Muestra[] = [];
  const lineas = new Set<string>();
  const alturaLinea = linea.caja.y1 - linea.caja.y0;
  // Línea tocada.
  for (const p of candidatasLinea(linea).slice(0, 5)) {
    const m = extraerMuestra(pagina, p, linea);
    if (m) muestras.push(m);
  }
  if (muestras.length) lineas.add(linea.id);
  const referencia = muestras.length ? mediana(muestras.map((m) => m.alturaTinta)) : 0;

  // Vecinas, alternando arriba y abajo.
  for (let d = 1; d <= 6 && muestras.length < MAX_MUESTRAS; d++) {
    for (const j of [indice - d, indice + d]) {
      const l = pagina.lineas[j];
      if (!l || muestras.length >= MAX_MUESTRAS) continue;
      const alto = l.caja.y1 - l.caja.y0;
      if (Math.abs(alto - alturaLinea) > alturaLinea * 0.35) continue;
      let usada = false;
      for (const p of candidatasLinea(l).slice(0, 2)) {
        const m = extraerMuestra(pagina, p, l);
        if (!m) continue;
        if (referencia && Math.abs(m.alturaTinta - referencia) > referencia * 0.25) continue;
        muestras.push(m);
        usada = true;
      }
      if (usada) lineas.add(l.id);
    }
  }

  // Si la línea solo tiene palabras cortas, usamos lo que haya.
  if (muestras.length === 0) {
    for (const id of linea.palabras) {
      const p = porId.get(id);
      if (!p || letrasUtiles(p.texto) < 1) continue;
      const m = extraerMuestra(pagina, p, linea);
      if (m) muestras.push(m);
      if (muestras.length >= 3) break;
    }
    if (muestras.length) lineas.add(linea.id);
  }
  return { muestras, lineas };
}

/** Detecta la letra más parecida para la línea de `palabra` (usa caché). */
export async function detectarLetra(pagina: Pagina, palabra: Palabra): Promise<Deteccion | null> {
  const linea = pagina.lineas.find((l) => l.id === palabra.lineaId);
  if (!linea) return null;
  const guardada = cacheDe(pagina).get(linea.id);
  if (guardada) return guardada;
  const textos = pagina.palabras.map((p) => p.texto).join('') || palabra.texto;
  await cargarCatalogo(textos);
  return detectarLineaSinCache(pagina, linea);
}

function detectarLineaSinCache(pagina: Pagina, linea: Linea): Deteccion | null {
  const inicio = performance.now();
  const { muestras, lineas } = elegirMuestras(pagina, linea);
  if (muestras.length === 0) return null;

  // Pasada barata: proporciones (ancho natural / ancho real) con solo medir.
  const previas = todasLasCandidatas()
    .map((c) => {
      const logs: number[] = [];
      for (const m of muestras) {
        const med = medirCandidata(c, m);
        if (med) logs.push(Math.log(med.anchoNatural / m.anchoTinta));
      }
      if (logs.length === 0) return null;
      const centro = mediana(logs);
      const dispersion = mediana(logs.map((l) => Math.abs(l - centro)));
      return { c, difAncho: mediana(logs.map(Math.abs)), costo: Math.abs(centro) + 1.5 * dispersion };
    })
    .filter((x): x is { c: Candidata; difAncho: number; costo: number } => !!x)
    .sort((a, b) => a.costo - b.costo);

  // Siempre comparamos en detalle al menos la mejor variante de cada letra
  // recta, para no descartar por error una letra correcta con texto mal leído.
  const finalistas = previas.slice(0, FINALISTAS);
  for (const l of CATALOGO) {
    if (!finalistas.some((f) => f.c.letra === l.id)) {
      const mejor = previas.find((p) => p.c.letra === l.id && !p.c.cursiva);
      if (mejor) finalistas.push(mejor);
    }
  }

  const ranking: PuntajeLetra[] = finalistas.map(({ c, difAncho }) => {
    const formas: number[] = [];
    for (const m of muestras) {
      const med = medirCandidata(c, m);
      if (med) formas.push(compararForma(c, m, med));
    }
    const forma = formas.reduce((s, v) => s + v, 0) / Math.max(1, formas.length);
    return { ...c, forma, difAncho, puntaje: forma - PESO_ANCHO * difAncho };
  });
  ranking.sort((a, b) => b.puntaje - a.puntaje);

  const porLetra: PuntajeLetra[] = [];
  for (const r of ranking) if (!porLetra.some((p) => p.letra === r.letra)) porLetra.push(r);
  const mejor = ranking[0];
  if (!mejor) return null;
  const segunda = porLetra[1];
  const margen = segunda ? mejor.puntaje - segunda.puntaje : 1;
  const confianza = muestras.length >= 2 && mejor.puntaje >= 0.5 && margen >= 0.03 ? 'alta' : 'baja';

  const resultado: Deteccion = {
    ranking,
    porLetra,
    mejor,
    confianza,
    muestras: muestras.length,
    ms: Math.round(performance.now() - inicio),
  };
  const c = cacheDe(pagina);
  for (const id of lineas) if (!c.has(id)) c.set(id, resultado);
  c.set(linea.id, resultado);
  return resultado;
}

/**
 * En segundo plano (después de leer la página): detecta la letra de las
 * líneas de texto, de a una por vez, para que al tocar ya esté lista.
 */
export function precalentar(pagina: Pagina, cancelado: () => boolean): void {
  if (pagina.lineas.length === 0) return;
  const pendientes = [...pagina.lineas];
  const siguiente = async () => {
    if (cancelado()) return;
    const l = pendientes.shift();
    if (!l) return;
    if (!cacheDe(pagina).has(l.id)) {
      const primera = pagina.palabras.find((p) => p.id === l.palabras[0]);
      if (primera) {
        try {
          await detectarLetra(pagina, primera);
        } catch (e) {
          console.error(e);
        }
      }
    }
    window.setTimeout(() => void siguiente(), 30);
  };
  window.setTimeout(() => void siguiente(), 200);
}

/** Nombre para mostrar de una variante. */
export function nombreVariante(p: PuntajeLetra): string {
  const l = letraPorId(p.letra);
  return `${l.nombre}${p.negrita ? ' negrita' : ''}${p.cursiva ? ' cursiva' : ''}`;
}
