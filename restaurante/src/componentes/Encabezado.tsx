import type { ReactNode } from 'react';
import { APP_NOMBRE } from '../config';
import { useSesion } from '../sesion';
import { NOMBRE_ROL } from '../tipos';
import { AvisoConexion } from './AvisoConexion';

interface Props {
  vista: ReactNode;
  regreso?: { texto: string; alTocar: () => void };
}

/** Encabezado común: regreso, nombre de la app y vista, usuario, Cambiar vista y Salir. */
export function Encabezado({ vista, regreso }: Props) {
  const { usuario, salir, cambiarVista } = useSesion();
  return (
    <>
      <header className="encabezado">
        <div className="encabezado__izq">
          {regreso && (
            <button type="button" className="boton boton--secundario boton--chico" onClick={regreso.alTocar}>
              {regreso.texto}
            </button>
          )}
          <h1 className="encabezado__titulo">
            <span className="encabezado__app">{APP_NOMBRE}</span>
            <span aria-hidden="true"> · </span>
            <span className="encabezado__vista">{vista}</span>
          </h1>
        </div>
        <div className="encabezado__der">
          <span className="encabezado__usuario">
            {usuario.nombre} · {NOMBRE_ROL[usuario.rol]}
          </span>
          {usuario.rol === 'dueno' && (
            <button type="button" className="boton boton--secundario boton--chico" onClick={cambiarVista}>
              Cambiar vista
            </button>
          )}
          <button type="button" className="boton boton--secundario boton--chico" onClick={salir}>
            Salir
          </button>
        </div>
      </header>
      <AvisoConexion />
    </>
  );
}
