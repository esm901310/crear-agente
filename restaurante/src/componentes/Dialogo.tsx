// Diálogo modal (usa <dialog> del navegador: atrapa el foco y se cierra con Esc).
// `hoja`: en vertical aparece desde abajo.
import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  titulo: string;
  alCerrar: () => void;
  children: ReactNode;
  hoja?: boolean;
  className?: string;
}

export function Dialogo({ titulo, alCerrar, children, hoja = false, className = '' }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const alCerrarRef = useRef(alCerrar);
  alCerrarRef.current = alCerrar;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    const alCancelar = (e: Event) => {
      e.preventDefault();
      alCerrarRef.current();
    };
    d.addEventListener('cancel', alCancelar);
    return () => d.removeEventListener('cancel', alCancelar);
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dialogo ${hoja ? 'dialogo--hoja' : ''} ${className}`}
      aria-label={titulo}
      onClick={(e) => {
        // Tocar fuera (en la capa oscura) cierra.
        if (e.target === ref.current) alCerrar();
      }}
    >
      <div className="dialogo__contenido">{children}</div>
    </dialog>
  );
}
