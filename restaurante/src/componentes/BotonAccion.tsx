// Botón que muestra spinner y texto en gerundio mientras la acción está en curso.
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  ocupado: boolean;
  textoOcupado: string;
  children: ReactNode;
}

export function BotonAccion({ ocupado, textoOcupado, children, disabled, className = '', ...resto }: Props) {
  return (
    <button {...resto} className={className} disabled={disabled || ocupado} aria-busy={ocupado}>
      {ocupado ? (
        <span className="boton__ocupado">
          <Spinner pequeno /> {textoOcupado}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
