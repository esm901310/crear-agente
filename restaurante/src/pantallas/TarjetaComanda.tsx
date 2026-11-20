// Comanda pendiente en Cocina, con color según el tiempo de espera.
import { Insignia } from '../componentes/Insignia';
import { ESPERA_AMBAR_MIN, ESPERA_ROJO_MIN } from '../config';
import { hora, minutosDesde, transcurrido } from '../formato';
import type { Comanda } from '../tipos';

interface Props {
  comanda: Comanda;
  ahora: number;
  nueva: boolean;
  alListo: () => void;
}

export function TarjetaComanda({ comanda, ahora, nueva, alListo }: Props) {
  const min = minutosDesde(comanda.creada, ahora);
  const nivel = min > ESPERA_ROJO_MIN ? 'roja' : min >= ESPERA_AMBAR_MIN ? 'ambar' : 'normal';
  return (
    <article
      className={`comanda comanda--${nivel} ${nueva ? 'destello-nuevo' : ''}`}
      aria-label={`${comanda.mesa_nombre}, lleva ${transcurrido(min)}`}
    >
      <div className="comanda__arriba">
        <h3 className="comanda__mesa">{comanda.mesa_nombre.toUpperCase()}</h3>
        <span className={min < 1 ? 'comanda__tiempo comanda__tiempo--reciente' : 'comanda__tiempo'}>{transcurrido(min)}</span>
      </div>
      <p className="comanda__mesero">
        {comanda.mesero_nombre} · {hora(comanda.creada)}
      </p>
      {nivel === 'ambar' && <Insignia tipo="alerta">Tardada</Insignia>}
      {nivel === 'roja' && <Insignia tipo="peligro">Muy tardada</Insignia>}
      <ul className="comanda__items">
        {comanda.items.map((i) => (
          <li key={i.id} className="comanda__item">
            <span>
              <strong className="comanda__cantidad">{i.cantidad}×</strong> {i.nombre}
            </span>
            {i.nota && <p className="comanda__nota">{i.nota}</p>}
          </li>
        ))}
      </ul>
      <button type="button" className="boton boton--exito boton--listo" onClick={alListo}>
        ✓ LISTO
      </button>
    </article>
  );
}
