import { createWorker, type Worker, type Block } from 'tesseract.js';
import type { Caja, Linea, Palabra } from './types';

/** Rutas locales (copiadas a public/tesseract en `npm install`): no se usa internet. */
function rutaLocal(relativa: string): string {
  return new URL(`${import.meta.env.BASE_URL}tesseract/${relativa}`, window.location.href).href;
}

export interface ResultadoLectura {
  palabras: Palabra[];
  lineas: Linea[];
}

export interface Lector {
  leer(imagen: HTMLCanvasElement, pagina: number, alAvanzar: (fraccion: number) => void): Promise<ResultadoLectura>;
  cerrar(): Promise<void>;
}

/** Palabras con muy poca confianza suelen ser manchas del escaneo. */
const CONFIANZA_MINIMA = 25;

export async function crearLector(): Promise<Lector> {
  let alAvanzarActual: ((f: number) => void) | null = null;
  const worker: Worker = await createWorker('spa', 1, {
    workerPath: rutaLocal('worker.min.js'),
    corePath: rutaLocal('core'),
    langPath: rutaLocal('lang'),
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text' && alAvanzarActual) alAvanzarActual(m.progress);
    },
  });

  return {
    async leer(imagen, pagina, alAvanzar) {
      alAvanzarActual = alAvanzar;
      try {
        const { data } = await worker.recognize(imagen, {}, { blocks: true, text: false });
        return convertir(data.blocks ?? [], pagina);
      } finally {
        alAvanzarActual = null;
      }
    },
    async cerrar() {
      await worker.terminate();
    },
  };
}

function cajaDe(b: { x0: number; y0: number; x1: number; y1: number }): Caja {
  return { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 };
}

function esRuido(texto: string, confianza: number): boolean {
  if (confianza < CONFIANZA_MINIMA) return true;
  // Signos sueltos con lectura dudosa: casi siempre son manchas.
  if (!/[\p{L}\p{N}]/u.test(texto) && confianza < 60) return true;
  return false;
}

function convertir(bloques: Block[], pagina: number): ResultadoLectura {
  const palabras: Palabra[] = [];
  const lineas: Linea[] = [];
  let nLinea = 0;
  for (const bloque of bloques) {
    for (const parrafo of bloque.paragraphs) {
      for (const linea of parrafo.lines) {
        const lineaId = `p${pagina}-l${nLinea++}`;
        const ids: string[] = [];
        for (const w of linea.words) {
          const texto = w.text.trim();
          if (!texto || esRuido(texto, w.confidence)) continue;
          if (w.bbox.x1 - w.bbox.x0 < 2 || w.bbox.y1 - w.bbox.y0 < 2) continue;
          const id = `${lineaId}-w${ids.length}`;
          palabras.push({
            id,
            texto,
            caja: cajaDe(w.bbox),
            confianza: w.confidence,
            lineaId,
            posEnLinea: ids.length,
          });
          ids.push(id);
        }
        if (ids.length === 0) continue;
        const b = linea.baseline;
        lineas.push({
          id: lineaId,
          palabras: ids,
          caja: cajaDe(linea.bbox),
          base: b && b.has_baseline !== false && b.x1 !== b.x0 ? { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 } : null,
        });
      }
    }
  }
  return { palabras, lineas };
}
