import { useSyncExternalStore } from 'react';
import { conexion } from '../conexion';
import { Spinner } from './Spinner';

/** Barra "Sin conexión. Reintentando…" / "Conexión recuperada ✓" debajo del encabezado. */
export function AvisoConexion() {
  const estado = useSyncExternalStore(conexion.suscribir, conexion.leer);
  return (
    <div aria-live="polite">
      {estado === 'sin' && (
        <div className="aviso-conexion">
          <Spinner pequeno /> Sin conexión. Reintentando…
        </div>
      )}
      {estado === 'recuperada' && <div className="aviso-conexion aviso-conexion--ok">Conexión recuperada ✓</div>}
    </div>
  );
}
