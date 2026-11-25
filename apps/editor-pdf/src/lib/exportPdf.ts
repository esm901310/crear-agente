import { PDFDocument } from 'pdf-lib';
import { componerPagina } from './edit';
import type { Edicion, Pagina } from './types';

const CALIDAD_JPEG = 0.92;

function aBlob(lienzo: HTMLCanvasElement): Promise<Blob> {
  return new Promise((ok, falla) =>
    lienzo.toBlob((b) => (b ? ok(b) : falla(new Error('No se pudo crear la imagen'))), 'image/jpeg', CALIDAD_JPEG),
  );
}

const pausa = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Crea el PDF final. Las páginas con cambios se reemplazan por su imagen
 * editada (al tamaño original en puntos). Las páginas sin cambios se copian
 * tal cual del PDF original para no perder calidad.
 */
export async function exportarPdf(
  bytesOriginales: ArrayBuffer,
  paginas: Pagina[],
  ediciones: Edicion[],
  alAvanzar: (pagina: number, total: number) => void,
): Promise<Uint8Array> {
  let fuente: PDFDocument | null = null;
  try {
    fuente = await PDFDocument.load(bytesOriginales.slice(0), { updateMetadata: false });
    if (fuente.getPageCount() !== paginas.length) fuente = null;
  } catch {
    fuente = null; // Si pdf-lib no lo entiende, todas las páginas van como imagen.
  }

  const salida = await PDFDocument.create();
  salida.setProducer('Retoca');
  salida.setCreator('Retoca');
  const lienzo = document.createElement('canvas');

  // Copiamos de una vez las páginas sin cambios (comparten recursos).
  const copias = new Map<number, Awaited<ReturnType<PDFDocument['copyPages']>>[number]>();
  if (fuente) {
    const sinCambios = paginas.filter((p) => !ediciones.some((e) => e.pagina === p.indice)).map((p) => p.indice);
    const copiadas = await salida.copyPages(fuente, sinCambios);
    sinCambios.forEach((indice, i) => {
      const c = copiadas[i];
      if (c) copias.set(indice, c);
    });
  }

  for (const pagina of paginas) {
    alAvanzar(pagina.indice + 1, paginas.length);
    await pausa();
    const propias = ediciones.filter((e) => e.pagina === pagina.indice);
    const copia = propias.length === 0 ? copias.get(pagina.indice) : undefined;
    if (copia) {
      salida.addPage(copia);
      continue;
    }
    componerPagina(pagina, propias, lienzo);
    const blob = await aBlob(lienzo);
    const imagen = await salida.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    const hoja = salida.addPage([pagina.anchoPt, pagina.altoPt]);
    hoja.drawImage(imagen, { x: 0, y: 0, width: pagina.anchoPt, height: pagina.altoPt });
  }
  lienzo.width = 1;
  lienzo.height = 1;
  return salida.save();
}

export function nombreDeSalida(nombreOriginal: string): string {
  const base = nombreOriginal.replace(/\.pdf$/i, '') || 'documento';
  return `${base}-retocado.pdf`;
}
