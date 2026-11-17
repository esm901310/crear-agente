import type { ReactNode } from 'react';
import { Icono } from './Icono';

interface Props {
  children: ReactNode;
  alReintentar?: () => void;
  tono?: 'error' | 'ambar';
  textoAccion?: string;
}

/** Banda suave (roja o ámbar) con texto y, si hace falta, un botón de texto. */
export function BandaError({ children, alReintentar, tono = 'error', textoAccion = 'Reintentar' }: Props) {
  return (
    <div className={`banda banda-${tono}`} role={tono === 'error' ? 'alert' : undefined}>
      <Icono nombre={tono === 'error' ? 'alerta' : 'prohibido'} tamano={20} />
      <div className="banda-contenido">
        <p>{children}</p>
        {alReintentar && (
          <button type="button" className="boton-texto boton-texto-fuerte" onClick={alReintentar}>
            {textoAccion}
          </button>
        )}
      </div>
    </div>
  );
}
