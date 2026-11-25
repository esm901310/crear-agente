import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  cargando?: boolean;
}

export default function BotonPrincipal({ cargando, children, className = '', disabled, ...resto }: Props) {
  return (
    <button
      type="button"
      className={`boton boton-principal ${className}`}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      {...resto}
    >
      {cargando ? <span className="boton-cargando" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
