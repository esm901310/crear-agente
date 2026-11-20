import { Insignia } from '../componentes/Insignia';
import { dinero, minutosDesde, transcurrido } from '../formato';
import type { MesaResumen } from '../tipos';

interface Props {
  mesa: MesaResumen;
  mia: boolean;
  sinEnviar: boolean;
  ahora: number;
  alTocar: () => void;
}

export function TarjetaMesa({ mesa, mia, sinEnviar, ahora, alTocar }: Props) {
  const libre = mesa.orden_id === null;
  const clase = libre ? 'mesa-tarjeta mesa-tarjeta--libre' : `mesa-tarjeta ${mia ? 'mesa-tarjeta--mia' : ''}`;
  return (
    <button type="button" className={clase} onClick={alTocar}>
      <span className="mesa-tarjeta__fila">
        <span className="mesa-tarjeta__nombre">{mesa.nombre}</span>
        {!libre && mia && <span className="mesa-tarjeta__tu">Tú</span>}
      </span>
      {libre ? (
        <span>
          <Insignia tipo="ok">Libre</Insignia>
        </span>
      ) : (
        <>
          <span className="mesa-tarjeta__mesero">{mesa.mesero_nombre}</span>
          <span className="mesa-tarjeta__total">{dinero(mesa.total)}</span>
          {mesa.abierta_en && (
            <span className="mesa-tarjeta__tiempo">
              <span aria-hidden="true">⏱ </span>
              <span className="solo-lectores">Abierta hace </span>
              {transcurrido(minutosDesde(mesa.abierta_en, ahora))}
            </span>
          )}
        </>
      )}
      {sinEnviar && (
        <span>
          <Insignia tipo="alerta">Sin enviar</Insignia>
        </span>
      )}
    </button>
  );
}
