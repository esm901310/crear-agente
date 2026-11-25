import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  peligro?: boolean;
}

export default function BotonTexto({ children, className = '', peligro, ...resto }: Props) {
  return (
    <button type="button" className={`boton-texto ${peligro ? 'boton-texto-peligro' : ''} ${className}`} {...resto}>
      {children}
    </button>
  );
}
