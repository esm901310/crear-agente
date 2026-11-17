import type { ReactNode } from 'react';
import { Icono } from './Icono';

interface Props {
  children: ReactNode;
  alReintentar?: () => void;
  tono?: 'error' | 'ambar';
  textoAccion?: string;
  /** Muestra la acción pero sin poder tocarla (p. ej. mientras hay que esperar tras un 429). */
  accionDeshabilitada?: boolean;
}

/** Banda suave (roja o ámbar) con texto y, si hace falta, un botón de texto. */
export function BandaError({
  children,
  alReintentar,
  tono = 'error',
  textoAccion = 'Reintentar',
  accionDeshabilitada = false,
}: Props) {
  return (
    <div className={`banda banda-${tono}`} role={tono === 'error' ? 'alert' : undefined}>
      <Icono nombre={tono === 'error' ? 'alerta' : 'prohibido'} tamano={20} />
      <div className="banda-contenido">
        <p>{children}</p>
        {alReintentar && (
          <button
            type="button"
            className="boton-texto boton-texto-fuerte"
            onClick={alReintentar}
            disabled={accionDeshabilitada}
          >
            {textoAccion}
          </button>
        )}
      </div>
    </div>
  );
}
