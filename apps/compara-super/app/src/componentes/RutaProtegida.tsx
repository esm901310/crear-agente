import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useSesion } from '../estado/sesion';

/** Solo deja pasar si hay sesión; si no, manda a la bienvenida. */
export function RutaProtegida({ children }: { children: ReactNode }) {
  const { usuario } = useSesion();
  if (!usuario) return <Navigate to="/" replace />;
  return <>{children}</>;
}
