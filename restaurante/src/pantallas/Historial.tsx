// D1 — Historial de cortes (/cortes), solo dueño. docs/diseno.md, 20.3.
import { api } from '../api';
import { Cargando } from '../componentes/Cargando';
import { Diferencia } from '../componentes/Diferencia';
import { Encabezado } from '../componentes/Encabezado';
import { RECARGA_CORTES_MS } from '../config';
import { useMedia } from '../hooks/useMedia';
import { usePolling } from '../hooks/usePolling';
import { navegar } from '../hooks/useRuta';
import { dinero, fechaCorta, hora, plural } from '../formato';
import type { JornadaResumen } from '../tipos';
import { PestanasDuenio } from './PestanasDuenio';

function horario(j: JornadaResumen): string {
  return `${hora(j.abierta_en)} – ${j.cerrada_en ? hora(j.cerrada_en) : '…'}`;
}

export function Historial() {
  const { datos, error, recargar } = usePolling(api.jornadas, '', RECARGA_CORTES_MS);
  const ancha = useMedia('(min-width: 1024px)');
  const abrir = (id: number) => navegar(`/cortes/${id}`);

  let cuerpo;
  if (!datos) {
    cuerpo = error ? (
      <div className="vacio">
        <p className="texto-grande">No pudimos cargar el historial.</p>
        <button type="button" className="boton boton--primario" onClick={recargar}>
          Reintentar
        </button>
      </div>
    ) : (
      <Cargando />
    );
  } else if (datos.length === 0) {
    cuerpo = (
      <div className="vacio">
        <p className="texto-grande">Todavía no hay cortes.</p>
        <p>El primero aparecerá cuando la caja abra el día.</p>
      </div>
    );
  } else if (ancha) {
    cuerpo = (
      <div className="tarjeta tarjeta--sin-relleno">
        <table className="tabla tabla--filas historial">
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Horario</th>
              <th scope="col">Cerró</th>
              <th scope="col" className="num">
                Cuentas
              </th>
              <th scope="col" className="num">
                Total
              </th>
              <th scope="col" className="num">
                Propinas
              </th>
              <th scope="col">Efectivo</th>
              <th scope="col">
                <span className="solo-lectores">Abrir</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {datos.map((j) => (
              <tr
                key={j.id}
                className={j.cerrada_en ? 'fila-clic' : 'fila-clic fila-clic--en-curso'}
                tabIndex={0}
                role="link"
                aria-label={`Corte del ${fechaCorta(j.abierta_en)}`}
                onClick={() => abrir(j.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    abrir(j.id);
                  }
                }}
              >
                <td className="fuerte-ligero">{fechaCorta(j.abierta_en)}</td>
                <td>{horario(j)}</td>
                <td>{j.cerrada_por_nombre ?? '—'}</td>
                <td className="num">{j.cuentas}</td>
                <td className="num">{dinero(j.total)}</td>
                <td className="num">{dinero(j.propinas)}</td>
                <td>
                  <Diferencia valor={j.cerrada_en ? j.diferencia : null} />
                </td>
                <td className="fila-clic__flecha" aria-hidden="true">
                  ›
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } else {
    cuerpo = (
      <ul className="historial-tarjetas">
        {datos.map((j) => (
          <li key={j.id}>
            <button
              type="button"
              className={j.cerrada_en ? 'historial-tarjeta' : 'historial-tarjeta historial-tarjeta--en-curso'}
              onClick={() => abrir(j.id)}
            >
              <span className="historial-tarjeta__linea">
                <span className="fuerte-ligero">
                  {fechaCorta(j.abierta_en)} · {horario(j)}
                </span>
                <Diferencia valor={j.cerrada_en ? j.diferencia : null} />
              </span>
              <span className="historial-tarjeta__linea texto-2">
                {plural(j.cuentas, 'cuenta')} · Total {dinero(j.total)} · Propinas {dinero(j.propinas)}
                <span aria-hidden="true"> ›</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <Encabezado vista="Cortes" />
      <main className="contenido contenido--duenio">
        <PestanasDuenio actual="cortes" />
        {cuerpo}
        {datos && datos.length > 0 && <p className="ayuda historial__pie">Se muestran los últimos 90 días.</p>}
      </main>
    </>
  );
}
