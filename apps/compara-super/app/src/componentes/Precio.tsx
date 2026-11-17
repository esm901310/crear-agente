import { lempiras, lempirasHablado } from '../logica/formato';

interface Props {
  valor: number;
  className?: string;
  /** Texto antes del precio, p. ej. "desde". */
  prefijo?: string;
}

/** Precio "L 1,245.00" que el lector de pantalla lee como "1245 lempiras". */
export function Precio({ valor, className, prefijo }: Props) {
  const visible = prefijo ? `${prefijo} ${lempiras(valor)}` : lempiras(valor);
  const hablado = prefijo ? `${prefijo} ${lempirasHablado(valor)}` : lempirasHablado(valor);
  return (
    <span className={className ? `precio ${className}` : 'precio'}>
      <span aria-hidden="true">{visible}</span>
      <span className="solo-lector">{hablado}</span>
    </span>
  );
}
