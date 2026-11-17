import { lempiras, lempirasHablado } from '../logica/formato';

interface Props {
  valor: number;
  className?: string;
  /** Texto antes del precio, p. ej. "desde". */
  prefijo?: string;
  /** Precio por libra: se ve "L 41.86 /lb" y se lee "… por libra". */
  porLibra?: boolean;
}

/** Precio "L 1,245.00" que el lector de pantalla lee como "1245 lempiras". */
export function Precio({ valor, className, prefijo, porLibra }: Props) {
  const visible = prefijo ? `${prefijo} ${lempiras(valor)}` : lempiras(valor);
  const hablado = prefijo ? `${prefijo} ${lempirasHablado(valor)}` : lempirasHablado(valor);
  return (
    <span className={className ? `precio ${className}` : 'precio'}>
      <span aria-hidden="true">
        {visible}
        {porLibra && <span className="precio-unidad">{' /lb'}</span>}
      </span>
      <span className="solo-lector">{porLibra ? `${hablado} por libra` : hablado}</span>
    </span>
  );
}
