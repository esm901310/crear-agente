/**
 * Detección automática de la letra más parecida a la del escaneo.
 *
 * 1. Se toman varias palabras bien leídas de la línea tocada y de líneas
 *    vecinas con el mismo tamaño de letra (más muestras = decisión estable).
 * 2. De cada palabra se saca el nivel de tinta (0 = fondo, 1 = centro del
 *    trazo), su altura sobre la línea base, su ancho, su grosor de trazo y su
 *    desenfoque (nitidez de los bordes).
 * 3. Primera pasada barata (solo medir, sin dibujar): se compara el ancho
 *    natural de cada candidata (letra x negrita x cursiva) con el real.
 * 4. Pasada fina: se dibuja el texto leído con cada finalista a la altura de la
 *    tinta, en la línea base y estirado al mismo ancho, con el MISMO
 *    desenfoque que el original; se compara la forma (correlación + IoU), el
 *    grosor del trazo y el ancho natural.
 * 5. Primero se decide el grupo (con remates, simple o de máquina de escribir)
 *    y luego la letra dentro del grupo ganador.
 * 6. Todo el trabajo se reparte en bloques cortos (requestIdleCallback en
 *    segundo plano) para no trabar la pantalla. El resultado se guarda por
 *    página y línea.
 */
import { analizar } from './edit';
import { CATALOGO, caraLista, cargarCatalogo, cursivaSimulada, fuenteCss, letraDisponible, letraPorId, type Categoria } from './catalogo';
import { desenfocar, grosorContinuo } from './imagen';
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
  /** Diferencia de grosor de trazo (0 = igual). */
  difTrazo: number;
}

export interface Deteccion {
  /** Todas las candidatas evaluadas en detalle, de mejor a peor (grupo ganador primero). */
  ranking: PuntajeLetra[];
  /** La mejor variante de cada letra, de mejor a peor (grupo ganador primero). */
  porLetra: PuntajeLetra[];
  mejor: PuntajeLetra;
  grupo: Categoria;
  confianza: 'alta' | 'baja';
  muestras: number;
  ms: number;
}

const FINALISTAS = 14;
const MAX_MUESTRAS = 8;
/** Altura de trabajo (px) para comparar: más chico = más rápido. */
const ALTO_TRABAJO = 30;
const PESO_ANCHO = 0.6;
const PESO_TRAZO = 0.35;
const INCLINACION = 0.21;
/** Diferencia mínima entre grupos para decidir el grupo con seguridad. */
const MARGEN_GRUPO = 0.03;

// ---------------------------------------------------------------------------
// Reparto del trabajo en bloques cortos
// ---------------------------------------------------------------------------

type Modo = 'fondo' | 'rapido';

interface PlazoOcioso {
  timeRemaining(): number;
}

/** Duración del bloque de trabajo más largo sin ceder el control (para pruebas). */
export const estadisticasBloques = { maxMs: 0, bloques: 0, donde: '' };

/** Cede el control al navegador cada pocos milisegundos (nunca más de ~10 ms seguidos). */
class Presupuesto {
  modo: Modo;
  private inicio = performance.now();
  private plazo: PlazoOcioso | null = null;
  constructor(modo: Modo) {
    this.modo = modo;
  }
  private agotado(): boolean {
    const usado = performance.now() - this.inicio;
    if (usado > (this.modo === 'fondo' ? 8 : 10)) return true;
    return this.modo === 'fondo' && !!this.plazo && this.plazo.timeRemaining() < 3;
  }
  /** Empieza a contar de nuevo (después de esperar algo asíncrono, como cargar letras). */
  reiniciar(): void {
    this.inicio = performance.now();
  }
  private ultimo = '';
  async quizas(etiqueta = ''): Promise<void> {
    const usado = performance.now() - this.inicio;
    if (usado > estadisticasBloques.maxMs) {
      estadisticasBloques.maxMs = usado;
      estadisticasBloques.donde = `${this.ultimo} -> ${etiqueta}`;
    }
    this.ultimo = etiqueta;
    if (!this.agotado()) return;
    estadisticasBloques.bloques++;
    if (this.modo === 'fondo' && 'requestIdleCallback' in window) {
      this.plazo = await new Promise<PlazoOcioso>((ok) => window.requestIdleCallback((d) => ok(d), { timeout: 500 }));
    } else {
      this.plazo = null;
      // Canal de mensajes: cede el turno sin el retraso mínimo de setTimeout.
      await new Promise<void>((ok) => {
        const canal = new MessageChannel();
        canal.port1.onmessage = () => ok();
        canal.port2.postMessage(0);
      });
    }
    this.inicio = performance.now();
  }
}

// ---------------------------------------------------------------------------
// Muestras
// ---------------------------------------------------------------------------

interface Muestra {
  texto: string;
  /** Nivel de tinta (0..1) a escala de trabajo. */
  nivel: Float32Array;
  /** Nivel suavizado (para la correlación). */
  suave: Float32Array;
  ancho: number;
  alto: number;
  /** Escala de trabajo respecto a la imagen. */
  f: number;
  x0: number;
  y0: number;
  base: number;
  xTinta: number;
  anchoTinta: number;
  alturaTinta: number;
  /** σ del desenfoque a agregar a nuestro dibujo (en px de la imagen). */
  sigma: number;
  /** Grosor del trazo a escala de trabajo. */
  trazo: number;
}

interface Candidata {
  letra: string;
  negrita: boolean;
  cursiva: boolean;
}

function todasLasCandidatas(): Candidata[] {
  const lista: Candidata[] = [];
  for (const l of CATALOGO) {
    if (!letraDisponible(l.id)) continue;
    for (const negrita of l.tieneNegrita ? [false, true] : [false]) {
      for (const cursiva of [false, true]) {
        // Solo compiten las caras que ya cargaron bien (las fallidas quedan fuera).
        if (!caraLista(l.id, negrita, l.tieneCursiva ? cursiva : false)) continue;
        lista.push({ letra: l.id, negrita, cursiva });
      }
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

/** Saca la tinta de una palabra como nivel (0..1) a escala de trabajo. */
async function extraerMuestra(pagina: Pagina, p: Palabra, linea: Linea | undefined, pres: Presupuesto): Promise<Muestra | null> {
  const a = analizar(pagina, [p], linea);
  if (a.alturaTinta < 6 || a.anchoTinta < 6) return null;
  await pres.quizas('nivel');
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
  const nivel = new Float32Array(ancho * alto);
  const cuenta = new Float32Array(ancho * alto);
  for (let y = 0; y < h; y++) {
    const yy = Math.min(alto - 1, Math.floor(y * f));
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const dr = (datos[i] ?? 0) - fr;
      const dg = (datos[i + 1] ?? 0) - fg;
      const db = (datos[i + 2] ?? 0) - fb;
      const d = Math.sqrt(dr * dr + dg * dg + db * db);
      const j = yy * ancho + Math.min(ancho - 1, Math.floor(x * f));
      nivel[j]! += Math.min(1, d / contraste);
      cuenta[j]! += 1;
    }
  }
  for (let j = 0; j < nivel.length; j++) nivel[j] = (cuenta[j] ?? 0) > 0 ? (nivel[j] ?? 0) / (cuenta[j] ?? 1) : 0;
  return {
    texto: p.texto,
    nivel,
    suave: suavizar(nivel, ancho, alto),
    ancho,
    alto,
    f,
    x0,
    y0,
    base: a.base,
    xTinta: a.xTinta,
    anchoTinta: a.anchoTinta,
    alturaTinta: a.alturaTinta,
    sigma: a.desenfoque,
    trazo: Math.max(0.3, grosorContinuo(nivel, ancho, alto)),
  };
}

interface Medida {
  tamano: number;
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

/** Forma y grosor del texto dibujado con la candidata, con el mismo desenfoque que el original. */
function compararForma(c: Candidata, m: Muestra, med: Medida): { forma: number; trazo: number } {
  const { ancho, alto, f } = m;
  const ctx = ctxTrabajo(ancho, alto);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ancho, alto);
  const escalaX = m.anchoTinta / Math.max(1, med.anchoNatural);
  ctx.font = fuenteCss(c.letra, med.tamano * f, c.negrita, c.cursiva);
  ctx.fillStyle = '#000';
  ctx.translate((m.xTinta - m.x0) * f, (m.base - m.y0) * f);
  ctx.scale(escalaX, 1);
  if (cursivaSimulada(c.letra, c.cursiva)) ctx.transform(1, 0, -INCLINACION, 1, 0, 0);
  ctx.fillText(m.texto, med.izquierda * f, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const datos = ctx.getImageData(0, 0, ancho, alto).data;
  let dibujo: Float32Array = new Float32Array(ancho * alto);
  for (let i = 0; i < dibujo.length; i++) dibujo[i] = (datos[i * 4 + 3] ?? 0) / 255;
  // Mismo desenfoque que el original (a escala de trabajo).
  dibujo = desenfocar(dibujo, ancho, alto, m.sigma * f);

  let inter = 0;
  let union = 0;
  for (let i = 0; i < dibujo.length; i++) {
    const a = (m.nivel[i] ?? 0) >= 0.5;
    const b = (dibujo[i] ?? 0) >= 0.5;
    if (a && b) inter++;
    if (a || b) union++;
  }
  const iou = union > 0 ? inter / union : 0;

  const A = m.suave;
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
  return { forma: 0.6 * Math.max(0, ncc) + 0.4 * iou, trazo: grosorContinuo(dibujo, ancho, alto) };
}

function mediana(v: number[]): number {
  if (v.length === 0) return 0;
  const o = [...v].sort((a, b) => a - b);
  return o[o.length >> 1] ?? 0;
}

// ---------------------------------------------------------------------------

const cache = new WeakMap<Pagina['original'], Map<string, Deteccion>>();
type EnCurso = Map<string, { promesa: Promise<Deteccion | null>; presupuesto: Presupuesto }>;
/** Detecciones en marcha, por documento (imagen original de la página) y línea. */
const enCursoPorPagina = new WeakMap<Pagina['original'], EnCurso>();
function enCursoDe(pagina: Pagina): EnCurso {
  let m = enCursoPorPagina.get(pagina.original);
  if (!m) {
    m = new Map();
    enCursoPorPagina.set(pagina.original, m);
  }
  return m;
}

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
async function elegirMuestras(pagina: Pagina, linea: Linea, pres: Presupuesto): Promise<{ muestras: Muestra[]; lineas: Set<string> }> {
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
  for (const p of candidatasLinea(linea).slice(0, 4)) {
    await pres.quizas('muestra');
    const m = await extraerMuestra(pagina, p, linea, pres);
    if (m) muestras.push(m);
  }
  if (muestras.length) lineas.add(linea.id);
  const referencia = muestras.length ? mediana(muestras.map((m) => m.alturaTinta)) : 0;

  for (let d = 1; d <= 6 && muestras.length < MAX_MUESTRAS; d++) {
    for (const j of [indice - d, indice + d]) {
      const l = pagina.lineas[j];
      if (!l || muestras.length >= MAX_MUESTRAS) continue;
      const alto = l.caja.y1 - l.caja.y0;
      if (Math.abs(alto - alturaLinea) > alturaLinea * 0.35) continue;
      let usada = false;
      for (const p of candidatasLinea(l).slice(0, 2)) {
        await pres.quizas('muestra-vecina');
        const m = await extraerMuestra(pagina, p, l, pres);
        if (!m) continue;
        if (referencia && Math.abs(m.alturaTinta - referencia) > referencia * 0.25) continue;
        muestras.push(m);
        usada = true;
      }
      if (usada) lineas.add(l.id);
    }
  }

  if (muestras.length === 0) {
    for (const id of linea.palabras) {
      const p = porId.get(id);
      if (!p || letrasUtiles(p.texto) < 1) continue;
      await pres.quizas();
      const m = await extraerMuestra(pagina, p, linea, pres);
      if (m) muestras.push(m);
      if (muestras.length >= 3) break;
    }
    if (muestras.length) lineas.add(linea.id);
  }
  return { muestras, lineas };
}

/** Detecta la letra más parecida para la línea de `palabra` (usa caché). */
export function detectarLetra(pagina: Pagina, palabra: Palabra, modo: Modo = 'rapido'): Promise<Deteccion | null> {
  const linea = pagina.lineas.find((l) => l.id === palabra.lineaId);
  if (!linea) return Promise.resolve(null);
  const guardada = cacheDe(pagina).get(linea.id);
  if (guardada) return Promise.resolve(guardada);
  const enCurso = enCursoDe(pagina);
  const clave = linea.id;
  const actual = enCurso.get(clave);
  if (actual) {
    if (modo === 'rapido') actual.presupuesto.modo = 'rapido';
    return actual.promesa;
  }
  const presupuesto = new Presupuesto(modo);
  const promesa = (async () => {
    try {
      await cargarCatalogo(pagina.palabras.map((p) => p.texto).join('') || palabra.texto);
      return await detectarLinea(pagina, linea, presupuesto);
    } finally {
      enCurso.delete(clave);
    }
  })();
  enCurso.set(clave, { promesa, presupuesto });
  return promesa;
}

async function detectarLinea(pagina: Pagina, linea: Linea, pres: Presupuesto): Promise<Deteccion | null> {
  const inicio = performance.now();
  pres.reiniciar();
  const { muestras, lineas } = await elegirMuestras(pagina, linea, pres);
  if (muestras.length === 0) return null;

  // Pasada barata: proporciones (ancho natural / ancho real) con solo medir.
  const previas: { c: Candidata; difAncho: number; costo: number }[] = [];
  await pres.quizas('antes-candidatas');
  const todas = todasLasCandidatas();
  await pres.quizas('candidatas');
  for (const c of todas) {
    await pres.quizas('medir');
    const logs: number[] = [];
    for (const m of muestras) {
      const med = medirCandidata(c, m);
      if (med) logs.push(Math.log(med.anchoNatural / m.anchoTinta));
    }
    if (logs.length === 0) continue;
    const centro = mediana(logs);
    const dispersion = mediana(logs.map((l) => Math.abs(l - centro)));
    previas.push({ c, difAncho: mediana(logs.map(Math.abs)), costo: Math.abs(centro) + 1.5 * dispersion });
  }
  previas.sort((a, b) => a.costo - b.costo);

  // Finalistas: las mejores por proporciones + la mejor variante recta de cada letra.
  const finalistas = previas.slice(0, FINALISTAS);
  for (const l of CATALOGO) {
    if (!finalistas.some((f) => f.c.letra === l.id)) {
      const mejor = previas.find((p) => p.c.letra === l.id && !p.c.cursiva);
      if (mejor) finalistas.push(mejor);
    }
  }

  const ranking: PuntajeLetra[] = [];
  for (const { c, difAncho } of finalistas) {
    const formas: number[] = [];
    const trazos: number[] = [];
    for (const m of muestras) {
      await pres.quizas('comparar');
      const med = medirCandidata(c, m);
      if (!med) continue;
      const r = compararForma(c, m, med);
      formas.push(r.forma);
      if (r.trazo > 0) trazos.push(Math.abs(Math.log(r.trazo / m.trazo)));
    }
    const forma = formas.reduce((s, v) => s + v, 0) / Math.max(1, formas.length);
    const difTrazo = mediana(trazos);
    ranking.push({ ...c, forma, difAncho, difTrazo, puntaje: forma - PESO_ANCHO * difAncho - PESO_TRAZO * difTrazo });
  }
  ranking.sort((a, b) => b.puntaje - a.puntaje);
  if (!ranking[0]) return null;

  // Paso previo: decidir el grupo (con remates / simple / máquina de escribir)
  // con las dos mejores letras de cada grupo, y elegir dentro del ganador.
  const porLetraTodas: PuntajeLetra[] = [];
  for (const r of ranking) if (!porLetraTodas.some((p) => p.letra === r.letra)) porLetraTodas.push(r);
  const puntajeGrupo = (g: Categoria) => {
    const del = porLetraTodas.filter((p) => letraPorId(p.letra).categoria === g);
    const [a, b] = del;
    if (!a) return -Infinity;
    return b ? (2 * a.puntaje + b.puntaje) / 3 : a.puntaje - 0.01;
  };
  const grupos = (['serif', 'sans', 'mono'] as Categoria[])
    .map((g) => ({ g, p: puntajeGrupo(g) }))
    .sort((a, b) => b.p - a.p);
  const grupo = grupos[0]!.g;
  const margenGrupo = grupos[1] && Number.isFinite(grupos[1].p) ? grupos[0]!.p - grupos[1].p : 1;
  const enGrupo = (r: PuntajeLetra) => letraPorId(r.letra).categoria === grupo;
  const rankingFinal = [...ranking.filter(enGrupo), ...ranking.filter((r) => !enGrupo(r))];
  const porLetra = [...porLetraTodas.filter(enGrupo), ...porLetraTodas.filter((r) => !enGrupo(r))];
  const mejor = rankingFinal[0]!;
  const segundaEnGrupo = porLetra[1] && enGrupo(porLetra[1]) ? porLetra[1] : undefined;
  const margenLetra = segundaEnGrupo ? mejor.puntaje - segundaEnGrupo.puntaje : 1;
  const confianza =
    muestras.length >= 2 && mejor.puntaje >= 0.5 && margenGrupo >= MARGEN_GRUPO && margenLetra >= 0.015 ? 'alta' : 'baja';

  const resultado: Deteccion = {
    ranking: rankingFinal,
    porLetra,
    mejor,
    grupo,
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
 * En segundo plano (después de leer la página): detecta la letra de un
 * representante por cada grupo de líneas con distinta altura de letra, en
 * momentos libres del navegador.
 */
export function precalentar(pagina: Pagina, cancelado: () => boolean): void {
  if (pagina.lineas.length === 0) return;
  // Agrupa las líneas por altura (±15 %) y toma la de más palabras de cada grupo.
  const grupos: { alto: number; lineas: Linea[] }[] = [];
  for (const l of pagina.lineas) {
    const alto = l.caja.y1 - l.caja.y0;
    const g = grupos.find((x) => Math.abs(x.alto - alto) <= x.alto * 0.15);
    if (g) g.lineas.push(l);
    else grupos.push({ alto, lineas: [l] });
  }
  grupos.sort((a, b) => b.lineas.length - a.lineas.length);
  const representantes = grupos.map((g) => [...g.lineas].sort((a, b) => b.palabras.length - a.palabras.length)[0]!);
  const siguiente = async () => {
    if (cancelado()) return;
    const l = representantes.shift();
    if (!l) return;
    const primera = pagina.palabras.find((p) => p.id === l.palabras[0]);
    if (primera && !cacheDe(pagina).has(l.id)) {
      try {
        await detectarLetra(pagina, primera, 'fondo');
      } catch (e) {
        console.error(e);
      }
    }
    void siguiente();
  };
  window.setTimeout(() => void siguiente(), 100);
}

/** Nombre para mostrar de una variante. */
export function nombreVariante(p: PuntajeLetra): string {
  const l = letraPorId(p.letra);
  return `${l.nombre}${p.negrita ? ' negrita' : ''}${p.cursiva ? ' cursiva' : ''}`;
}
