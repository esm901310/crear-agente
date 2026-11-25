import type { ReactNode } from 'react';
import BotonIcono from './BotonIcono';

interface Props {
  titulo: string;
  alVolver?: () => void;
  acciones?: ReactNode;
}

export default function BarraSuperior({ titulo, alVolver, acciones }: Props) {
  return (
    <header className="barra-superior">
      <div className="barra-superior-lado">
        {alVolver ? <BotonIcono icono="atras" etiqueta="Atrás" onClick={alVolver} /> : null}
      </div>
      <h1 className="barra-superior-titulo" title={titulo}>
        {titulo}
      </h1>
      <div className="barra-superior-lado barra-superior-acciones">{acciones}</div>
    </header>
  );
}
