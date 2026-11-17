import type { ReactNode } from 'react';
import { EtiquetaTienda } from './EtiquetaTienda';

interface Props {
  tienda: string;
  destacada?: boolean;
  insignia?: ReactNode;
  /** Total grande (o esqueleto) y lo que va a su derecha. */
  total?: ReactNode;
  alLado?: ReactNode;
  children?: ReactNode;
}

/** Tarjeta de un súper en P7 (la ganadora va con fondo menta y borde verde). */
export function TarjetaTienda({ tienda, destacada = false, insignia, total, alLado, children }: Props) {
  return (
    <article className={destacada ? 'tarjeta tarjeta-tienda tarjeta-ganadora' : 'tarjeta tarjeta-tienda'}>
      {insignia && <div className="tarjeta-insignia">{insignia}</div>}
      <h2 className="tarjeta-tienda-nombre">
        <EtiquetaTienda tienda={tienda} completo />
      </h2>
      {total !== undefined && (
        <div className="tarjeta-total-fila">
          <div className={destacada ? 'total-grande' : 'total-mediano'}>{total}</div>
          {alLado && <div className="texto-secundario">{alLado}</div>}
        </div>
      )}
      {children}
    </article>
  );
}
