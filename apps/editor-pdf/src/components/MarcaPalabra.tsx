import type { Caja } from '../lib/types';

export type EstadoMarca = 'detectada' | 'seleccionada' | 'editada' | 'dudosa';

interface Props {
  caja: Caja;
  anchoPagina: number;
  altoPagina: number;
  estado: EstadoMarca;
  /** Nombre para lector de pantalla; si no hay, la marca no es enfocable. */
  etiqueta?: string;
  alActivar?: () => void;
}

/** Recuadro sobre una palabra. El toque lo maneja el visor (con margen de 8 px). */
export default function MarcaPalabra({ caja, anchoPagina, altoPagina, estado, etiqueta, alActivar }: Props) {
  const estilo = {
    left: `${(caja.x0 / anchoPagina) * 100}%`,
    top: `${(caja.y0 / altoPagina) * 100}%`,
    width: `${((caja.x1 - caja.x0) / anchoPagina) * 100}%`,
    height: `${((caja.y1 - caja.y0) / altoPagina) * 100}%`,
  };
  if (!etiqueta) return <span className={`marca marca-${estado}`} style={estilo} aria-hidden="true" />;
  return (
    <button
      type="button"
      className={`marca marca-${estado}`}
      style={estilo}
      aria-label={etiqueta}
      data-texto={etiqueta}
      onClick={alActivar}
    />
  );
}
