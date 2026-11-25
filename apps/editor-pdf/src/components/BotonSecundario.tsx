import type { ButtonHTMLAttributes } from 'react';

export default function BotonSecundario({ children, className = '', ...resto }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`boton boton-secundario ${className}`} {...resto}>
      {children}
    </button>
  );
}
