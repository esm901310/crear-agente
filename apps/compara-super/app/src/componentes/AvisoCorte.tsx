import { Icono } from './Icono';

/** Aviso discreto para cortes por libra emparejados entre súper (coincidencia 'corte'). */
export function AvisoCorte() {
  return (
    <p className="aviso-corte linea-icono">
      <Icono nombre="info" tamano={18} />
      Corte similar, puede variar la calidad.
    </p>
  );
}
