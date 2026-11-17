import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icono } from './Icono';

interface Props {
  abierta: boolean;
  alCerrar: () => void;
  titulo: ReactNode;
  children: ReactNode;
  /** Botones fijos abajo de la hoja. */
  pie?: ReactNode;
  /** Muestra el botón "×" (Cerrar). */
  conCerrar?: boolean;
}

/** Panel que sube desde abajo. Usa <dialog> nativo: atrapa el foco y cierra con Escape. */
export function HojaInferior({ abierta, alCerrar, titulo, children, pie, conCerrar = true }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierta && !d.open) d.showModal();
    if (!abierta && d.open) d.close();
  }, [abierta]);

  return (
    <dialog
      ref={ref}
      className="hoja"
      aria-labelledby={idTitulo}
      onCancel={(e) => {
        e.preventDefault();
        alCerrar();
      }}
      onClick={(e) => {
        if (e.target === ref.current) alCerrar();
      }}
    >
      {abierta && (
        <div className="hoja-marco">
          <div className="hoja-asa" aria-hidden="true" />
          <div className="hoja-encabezado">
            <h2 id={idTitulo} className="hoja-titulo">
              {titulo}
            </h2>
            {conCerrar && (
              <button type="button" className="boton-icono" onClick={alCerrar} aria-label="Cerrar">
                <Icono nombre="cerrar" />
              </button>
            )}
          </div>
          <div className="hoja-cuerpo">{children}</div>
          {pie && <div className="hoja-pie">{pie}</div>}
        </div>
      )}
    </dialog>
  );
}
