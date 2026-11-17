import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Icono } from './Icono';

interface Props {
  titulo: ReactNode;
  /** A dónde ir con la flecha si no hay pantalla anterior. Sin valor = sin flecha. */
  volverA?: string;
  derecha?: ReactNode;
  children?: ReactNode;
}

export function Encabezado({ titulo, volverA, derecha, children }: Props) {
  const navegar = useNavigate();
  const volver = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navegar(-1);
    else if (volverA) navegar(volverA, { replace: true });
  };
  return (
    <header className="encabezado">
      <div className="encabezado-fila">
        {volverA !== undefined && (
          <button type="button" className="boton-icono encabezado-volver" onClick={volver} aria-label="Volver">
            <Icono nombre="atras" />
          </button>
        )}
        <h1 className="titulo-pantalla">{titulo}</h1>
        {derecha && <div className="encabezado-derecha">{derecha}</div>}
      </div>
      {children}
    </header>
  );
}
