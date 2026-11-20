import type { ReactNode } from 'react';
import { APP_NOMBRE } from '../config';
import { useSesion } from '../sesion';
import { NOMBRE_ROL } from '../tipos';
import { useRuta } from '../hooks/useRuta';
import { AvisoConexion } from './AvisoConexion';

/** Para comparar textos sin distinguir mayúsculas ni acentos ("Dueño" = "dueno"). */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

interface Props {
  vista: ReactNode;
  regreso?: { texto: string; alTocar: () => void };
  /** Botones extra a la izquierda de "Cambiar vista" / "Salir" (p. ej. "Agotados"). */
  acciones?: ReactNode;
}

/** Encabezado común: regreso, nombre de la app y vista, usuario, Cambiar vista y Salir. */
export function Encabezado({ vista, regreso, acciones }: Props) {
  const { usuario, salir, cambiarVista } = useSesion();
  const ruta = useRuta();
  const rol = NOMBRE_ROL[usuario.rol];
  // "Cocina · Cocina" no aporta nada: si el nombre es igual al rol, solo se muestra el nombre.
  const mostrarRol = normalizar(usuario.nombre) !== normalizar(rol);
  return (
    <>
      <header className="encabezado">
        <div className="encabezado__izq">
          {regreso && (
            <button type="button" className="boton boton--sobre-oscuro boton--chico" onClick={regreso.alTocar}>
              {regreso.texto}
            </button>
          )}
          <h1 className="encabezado__titulo">
            <span className="encabezado__app">
              {APP_NOMBRE}
              <span aria-hidden="true"> · </span>
            </span>
            <span className="encabezado__vista">{vista}</span>
          </h1>
        </div>
        <div className="encabezado__der">
          <span className="encabezado__usuario">
            {usuario.nombre}
            {mostrarRol && ` · ${rol}`}
          </span>
          {acciones}
          {usuario.rol === 'dueno' && ruta !== '/inicio' && (
            <button type="button" className="boton boton--sobre-oscuro boton--chico" onClick={cambiarVista}>
              Cambiar vista
            </button>
          )}
          <button type="button" className="boton boton--sobre-oscuro boton--chico" onClick={salir}>
            Salir
          </button>
        </div>
      </header>
      <AvisoConexion />
    </>
  );
}
