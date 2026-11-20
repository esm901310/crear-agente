// Datos de la sesión disponibles en todas las pantallas.
import { createContext, useContext } from 'react';
import type { Rol, Usuario } from './tipos';

export interface Sesion {
  usuario: Usuario;
  /** Cerrar sesión (pregunta antes si hay pedidos sin enviar). */
  salir: () => void;
  /** Solo dueño: regresar a "Elegir vista". */
  cambiarVista: () => void;
}

export const ContextoSesion = createContext<Sesion | null>(null);

export function useSesion(): Sesion {
  const s = useContext(ContextoSesion);
  if (!s) throw new Error('useSesion fuera de una sesión');
  return s;
}

/** Pantalla inicial de cada rol. */
export function rutaInicial(rol: Rol): string {
  switch (rol) {
    case 'mesero':
      return '/mesas';
    case 'cocina':
      return '/cocina';
    case 'caja':
      return '/caja';
    case 'dueno':
      return '/inicio';
  }
}
