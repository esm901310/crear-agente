import { useCallback, useRef, useState } from 'react';
import { abrirPdf, crearMiniatura, dibujarPagina, LIMITE_BYTES, LIMITE_PAGINAS, pareceUnPdf } from '../lib/pdf';
import { crearLector, type Lector } from '../lib/ocr';
import { ErrorRetoca, esErrorDeMemoria, type TipoError } from '../lib/errores';
import type { Pagina } from '../lib/types';

export type Fase =
  | { tipo: 'inicio' }
  | { tipo: 'leyendo' }
  | { tipo: 'editor' }
  | { tipo: 'error'; error: TipoError };

export interface Progreso {
  etapa: 'preparando' | 'leyendo';
  /** Página en curso (1 a total). */
  pagina: number;
  total: number;
  /** 0 a 1, de todo el documento. */
  fraccion: number;
}

interface Tarea {
  cancelada: boolean;
  lector: Lector | null;
}

export function useCarga() {
  const [fase, setFase] = useState<Fase>({ tipo: 'inicio' });
  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const [progreso, setProgreso] = useState<Progreso>({ etapa: 'preparando', pagina: 0, total: 0, fraccion: 0 });
  const [nombre, setNombre] = useState('');
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [leyendoFondo, setLeyendoFondo] = useState(false);
  const [avisoLectura, setAvisoLectura] = useState<{ texto: string; clave: number } | null>(null);
  const archivoRef = useRef<File | null>(null);
  const tareaRef = useRef<Tarea | null>(null);

  const detener = useCallback(() => {
    const t = tareaRef.current;
    if (t) {
      t.cancelada = true;
      void t.lector?.cerrar().catch(() => undefined);
    }
    tareaRef.current = null;
    setLeyendoFondo(false);
  }, []);

  const procesar = useCallback(
    async (archivo: File, forzar: boolean) => {
      detener();
      archivoRef.current = archivo;
      setNombre(archivo.name);
      const tarea: Tarea = { cancelada: false, lector: null };
      tareaRef.current = tarea;
      const fallar = (tipo: TipoError) => {
        if (tarea.cancelada) return;
        void tarea.lector?.cerrar().catch(() => undefined);
        tarea.cancelada = true;
        setLeyendoFondo(false);
        setFase({ tipo: 'error', error: tipo });
      };

      try {
        const cabecera = new Uint8Array(await archivo.slice(0, 1024).arrayBuffer());
        if (!pareceUnPdf(cabecera)) return fallar('noEsPdf');
        if (archivo.size > LIMITE_BYTES && !forzar) return fallar('muyGrande');

        setPaginas([]);
        setProgreso({ etapa: 'preparando', pagina: 0, total: 0, fraccion: 0 });
        setFase({ tipo: 'leyendo' });

        const datos = await archivo.arrayBuffer();
        const doc = await abrirPdf(datos);
        const lista: Pagina[] = [];
        let lectorPromesa: Promise<Lector> | null = null;
        // El documento de pdf.js se libera siempre: al terminar, al cancelar o si hay error.
        try {
          if (tarea.cancelada) return;
          const total = doc.numPages;
          if (total === 0) return fallar('noSeAbre');
          if (total > LIMITE_PAGINAS && !forzar) return fallar('muyGrande');
          setBytes(datos);

          // El lector se prepara mientras dibujamos las páginas.
          lectorPromesa = crearLector().then((l) => {
            tarea.lector = l;
            if (tarea.cancelada) void l.cerrar();
            return l;
          });
          lectorPromesa.catch(() => undefined);

          for (let i = 0; i < total; i++) {
            if (tarea.cancelada) return;
            setProgreso({ etapa: 'preparando', pagina: i + 1, total, fraccion: 0 });
            const { lienzo, anchoPt, altoPt } = await dibujarPagina(doc, i);
            lista.push({
              indice: i,
              ancho: lienzo.width,
              alto: lienzo.height,
              anchoPt,
              altoPt,
              original: lienzo,
              miniatura: crearMiniatura(lienzo),
              estado: 'pendiente',
              palabras: [],
              lineas: [],
            });
            setPaginas([...lista]);
          }
        } finally {
          void doc.loadingTask.destroy().catch(() => undefined);
        }
        if (!lectorPromesa || tarea.cancelada) return;

        const total = lista.length;
        const lector = await lectorPromesa;
        let palabrasTotales = 0;
        let enEditor = false;
        let errorDeMemoria = false;
        let paginasConError = 0;
        setLeyendoFondo(true);
        for (let i = 0; i < total; i++) {
          if (tarea.cancelada) return;
          const actualizar = (cambio: Partial<Pagina>) => {
            const anterior = lista[i];
            if (!anterior) return;
            lista[i] = { ...anterior, ...cambio };
            setPaginas([...lista]);
          };
          actualizar({ estado: 'leyendo' });
          setProgreso({ etapa: 'leyendo', pagina: i + 1, total, fraccion: i / total });
          const pagina = lista[i];
          if (!pagina) continue;
          let r;
          try {
            r = await lector.leer(pagina.original, i, (f) => {
              if (!tarea.cancelada) setProgreso({ etapa: 'leyendo', pagina: i + 1, total, fraccion: (i + f) / total });
            });
          } catch (e) {
            // Falla una página: solo esa queda marcada; la persona sigue en el editor.
            if (tarea.cancelada) return;
            console.error(e);
            errorDeMemoria ||= esErrorDeMemoria(e);
            paginasConError++;
            actualizar({ estado: 'error' });
            setAvisoLectura({ texto: `No pudimos leer el texto de la página ${i + 1}.`, clave: Date.now() });
            continue;
          }
          if (tarea.cancelada) return;
          palabrasTotales += r.palabras.length;
          actualizar({ estado: 'lista', palabras: r.palabras, lineas: r.lineas });
          // Mostramos la página 1 en cuanto esté lista (y haya texto en algún lado).
          if (!enEditor && palabrasTotales > 0) {
            enEditor = true;
            setFase({ tipo: 'editor' });
          }
        }
        setProgreso({ etapa: 'leyendo', pagina: total, total, fraccion: 1 });
        setLeyendoFondo(false);
        await lector.cerrar().catch(() => undefined);
        tarea.lector = null;
        if (tareaRef.current === tarea) tareaRef.current = null;
        if (palabrasTotales === 0) fallar(paginasConError > 0 && errorDeMemoria ? 'memoria' : 'sinTexto');
      } catch (e) {
        if (tarea.cancelada) return;
        console.error(e);
        if (e instanceof ErrorRetoca) return fallar(e.tipo);
        if (esErrorDeMemoria(e)) return fallar('memoria');
        return fallar('noSeAbre');
      }
    },
    [detener],
  );

  const elegirArchivo = useCallback((archivo: File) => void procesar(archivo, false), [procesar]);

  const intentarIgual = useCallback(() => {
    if (archivoRef.current) void procesar(archivoRef.current, true);
  }, [procesar]);

  const reintentar = useCallback(() => {
    if (archivoRef.current) void procesar(archivoRef.current, false);
  }, [procesar]);

  const volverAInicio = useCallback(() => {
    detener();
    setPaginas([]);
    setBytes(null);
    setFase({ tipo: 'inicio' });
  }, [detener]);

  /** "Ver el PDF igual" cuando no se encontró texto. */
  const verIgual = useCallback(() => setFase({ tipo: 'editor' }), []);

  return {
    fase,
    paginas,
    progreso,
    nombre,
    bytes,
    leyendoFondo,
    avisoLectura,
    elegirArchivo,
    intentarIgual,
    reintentar,
    volverAInicio,
    verIgual,
  };
}

export type Carga = ReturnType<typeof useCarga>;
