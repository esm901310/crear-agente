import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ErrorRetoca } from './errores';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export const LIMITE_PAGINAS = 20;
export const LIMITE_BYTES = 25 * 1024 * 1024;

/** Escala de dibujo: 2x da buena resolución para leer el texto. */
const ESCALA = 2;
/** Tope de píxeles por página para no agotar la memoria del celular. */
const MAX_PIXELES = 5_000_000;

/** Revisa la firma del archivo ("%PDF-") en sus primeros bytes. */
export function pareceUnPdf(cabecera: Uint8Array): boolean {
  const firma = String.fromCharCode(...cabecera.slice(0, 1024));
  return firma.includes('%PDF-');
}

export async function abrirPdf(datos: ArrayBuffer): Promise<PDFDocumentProxy> {
  try {
    // pdf.js se queda con el búfer: le pasamos una copia.
    const tarea = pdfjs.getDocument({ data: new Uint8Array(datos.slice(0)) });
    return await tarea.promise;
  } catch (e) {
    throw new ErrorRetoca('noSeAbre', e instanceof Error ? e.message : String(e));
  }
}

export interface PaginaDibujada {
  lienzo: HTMLCanvasElement;
  anchoPt: number;
  altoPt: number;
}

export async function dibujarPagina(doc: PDFDocumentProxy, indice: number): Promise<PaginaDibujada> {
  const pagina = await doc.getPage(indice + 1);
  const base = pagina.getViewport({ scale: 1 });
  let escala = ESCALA;
  const pixeles = base.width * base.height * escala * escala;
  if (pixeles > MAX_PIXELES) escala = Math.sqrt(MAX_PIXELES / (base.width * base.height));
  const vista = pagina.getViewport({ scale: escala });
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.floor(vista.width);
  lienzo.height = Math.floor(vista.height);
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new RangeError('Sin memoria para el lienzo');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  await pagina.render({ canvas: lienzo, canvasContext: ctx, viewport: vista }).promise;
  pagina.cleanup();
  return { lienzo, anchoPt: base.width, altoPt: base.height };
}

export function crearMiniatura(lienzo: HTMLCanvasElement, ancho = 280): string {
  const m = document.createElement('canvas');
  const proporcion = ancho / lienzo.width;
  m.width = ancho;
  m.height = Math.max(1, Math.round(lienzo.height * proporcion));
  const ctx = m.getContext('2d');
  if (!ctx) return '';
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(lienzo, 0, 0, m.width, m.height);
  return m.toDataURL('image/jpeg', 0.8);
}
