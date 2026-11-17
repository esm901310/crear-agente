import { Icono } from './Icono';

/** Aviso discreto para productos emparejados por parecido entre súper (coincidencia 'probable'). */
export function AvisoCoincidencia() {
  return (
    <p className="aviso-coincidencia linea-icono">
      <Icono nombre="info" tamano={18} />
      Parece el mismo producto en ambos súper. Revisa el nombre de cada uno.
    </p>
  );
}
