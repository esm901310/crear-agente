// Comanda ya lista (compacta), con opción de regresarla a pendientes.
import { hora } from '../formato';
import type { Comanda } from '../tipos';

export function TarjetaLista({ comanda, alRegresar }: { comanda: Comanda; alRegresar: () => void }) {
  return (
    <article className="lista-tarjeta">
      <h3 className="lista-tarjeta__mesa">{comanda.mesa_nombre}</h3>
      <p className="texto-2">{comanda.listo_en ? `Lista a las ${hora(comanda.listo_en)}` : 'Lista'}</p>
      <ul className="lista-tarjeta__items">
        {comanda.items.map((i) => (
          <li key={i.id}>
            {i.cantidad}× {i.nombre}
            {i.nota && <span className="nota-italica"> — {i.nota}</span>}
          </li>
        ))}
      </ul>
      <button type="button" className="boton boton--secundario" onClick={alRegresar}>
        Regresar a pendientes
      </button>
    </article>
  );
}
