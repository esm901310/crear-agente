import { Insignia } from './Insignia';

export function EstadoComanda({ estado }: { estado: 'pendiente' | 'listo' }) {
  return estado === 'listo' ? <Insignia tipo="ok">Listo ✓</Insignia> : <Insignia tipo="alerta">En preparación</Insignia>;
}
