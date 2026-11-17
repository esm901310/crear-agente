import { cuandoSeConsulto } from '../logica/formato';
import { Icono } from './Icono';

/** "Precios consultados hoy a las 10:45 a. m. Pueden variar en tienda." */
export function AvisoPrecios({ consultadoEn }: { consultadoEn: string | null | undefined }) {
  const cuando = consultadoEn ? cuandoSeConsulto(consultadoEn) : null;
  if (!cuando) return null;
  return (
    <p className="aviso-precios">
      <Icono nombre="reloj" tamano={18} />
      <span>{`Precios consultados ${cuando}${cuando.endsWith('.') ? '' : '.'} Pueden variar en tienda.`}</span>
    </p>
  );
}
