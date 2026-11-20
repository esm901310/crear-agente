import { Spinner } from './Spinner';

/** Spinner centrado con "Cargando…" (solo la primera carga de cada pantalla). */
export function Cargando() {
  return (
    <div className="cargando" role="status">
      <Spinner />
      <p>Cargando…</p>
    </div>
  );
}
