import type { ButtonHTMLAttributes } from 'react';
import Icono, { type NombreIcono } from './Icono';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  icono: NombreIcono;
  /** Nombre para el lector de pantalla. */
  etiqueta: string;
}

export default function BotonIcono({ icono, etiqueta, className = '', ...resto }: Props) {
  return (
    <button type="button" className={`boton-icono ${className}`} aria-label={etiqueta} title={etiqueta} {...resto}>
      <Icono nombre={icono} />
    </button>
  );
}
