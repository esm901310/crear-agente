// Botón "Agotados (n)" del encabezado de Cocina y Caja, con su panel lateral (docs/diseno.md, 29.1).
import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMenu } from '../menu';
import { PanelAgotados } from './PanelAgotados';

export function BotonAgotados({ grande = false }: { grande?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const { categorias, error, reintentar } = useMenu();
  const boton = useRef<HTMLButtonElement>(null);
  const n = (categorias ?? []).reduce((s, c) => s + c.productos.filter((p) => p.agotado).length, 0);

  const cerrar = useCallback(() => {
    setAbierto(false);
    boton.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={boton}
        type="button"
        className={`boton boton--sobre-oscuro boton--chico ${grande ? 'boton--agotados-grande' : ''}`}
        aria-expanded={abierto}
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
      >
        Agotados
        {n > 0 && (
          <span className="insignia insignia--peligro insignia--contador">
            <span className="solo-lectores"> (</span>
            {n}
            <span className="solo-lectores">)</span>
          </span>
        )}
      </button>
      {/* Fuera del encabezado (que es oscuro y de texto blanco): directo en <body>. */}
      {abierto &&
        createPortal(<PanelAgotados categorias={categorias} error={error} alReintentar={reintentar} alCerrar={cerrar} />, document.body)}
    </>
  );
}
