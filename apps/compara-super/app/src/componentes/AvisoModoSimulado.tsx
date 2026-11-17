import { modoSimulado } from '../api';

/** Franja que deja claro que se están viendo datos de ejemplo. */
export function AvisoModoSimulado() {
  if (!modoSimulado) return null;
  return <div className="aviso-simulado">Modo de prueba: precios de ejemplo, no son reales.</div>;
}
