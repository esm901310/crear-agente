// Una salida de efectivo: hora, motivo, monto y quién la registró (anuladas, tachadas).
import type { ReactNode } from 'react';
import { dinero, hora } from '../formato';
import type { Salida } from '../tipos';
import { Insignia } from './Insignia';

export function FilaSalida({ salida, accion }: { salida: Salida; accion?: ReactNode }) {
  const s = salida;
  return (
    <li className={s.anulada ? 'salida salida--anulada' : 'salida'}>
      <span className="salida__hora">{hora(s.creada)}</span>
      <span className="salida__centro">
        <span className="salida__motivo">{s.motivo}</span>
        <span className="salida__quien">
          {s.usuario_nombre}
          {s.anulada && ` · anulada${s.anulada_por_nombre ? ` por ${s.anulada_por_nombre}` : ''}`}
        </span>
      </span>
      <span className="salida__monto">
        {s.anulada && <span className="solo-lectores">Anulada: </span>}
        {dinero(s.monto)}
      </span>
      <span className="salida__accion">{s.anulada ? <Insignia tipo="neutra">Anulada</Insignia> : accion}</span>
    </li>
  );
}
