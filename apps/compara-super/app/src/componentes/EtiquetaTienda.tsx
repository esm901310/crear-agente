import { infoTienda } from '../logica/tiendas';

interface Props {
  tienda: string;
  /** Usa el nombre completo ("Comisariato Los Andes") en vez del corto. */
  completo?: boolean;
  className?: string;
}

/** Círculo de 28 px con iniciales + nombre del súper. Nunca solo color. */
export function EtiquetaTienda({ tienda, completo = false, className }: Props) {
  const info = infoTienda(tienda);
  return (
    <span className={className ? `etiqueta-tienda ${className}` : 'etiqueta-tienda'}>
      <span className="etiqueta-tienda-circulo" style={{ backgroundColor: info.color }} aria-hidden="true">
        {info.iniciales}
      </span>
      <span className="etiqueta-tienda-nombre">{completo ? info.completo : info.corto}</span>
    </span>
  );
}
