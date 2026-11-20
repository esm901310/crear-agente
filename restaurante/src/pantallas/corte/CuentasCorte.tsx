// Corte — lista de cuentas cobradas (plegable). Solo se imprime si está desplegada.
import { useState } from 'react';
import { useMedia } from '../../hooks/useMedia';
import { dinero, hora } from '../../formato';
import { NOMBRE_METODO, type CuentaCorte } from '../../tipos';

function textoPagos(c: CuentaCorte): string {
  return c.pagos.map((p) => `${NOMBRE_METODO[p.metodo]} ${dinero(p.monto)}`).join(' · ');
}

export function CuentasCorte({ cuentas }: { cuentas: CuentaCorte[] }) {
  const [abierta, setAbierta] = useState(false);
  const ancha = useMedia('(min-width: 1024px)');
  if (cuentas.length === 0) return null;
  return (
    <section className="corte__cuentas" aria-label="Cuentas cobradas">
      <button
        type="button"
        className="boton boton--secundario boton--ancho no-imprimir"
        aria-expanded={abierta}
        onClick={() => setAbierta((a) => !a)}
      >
        {abierta ? 'Ocultar cuentas ▴' : `Ver las ${cuentas.length} cuentas ▾`}
      </button>
      {abierta && (
        <div className="tarjeta cuentas-corte">
          <h3 className="tarjeta__titulo solo-impresion">Cuentas ({cuentas.length})</h3>
          {ancha ? (
            <div className="tabla-envoltura">
              <table className="tabla tabla--cebra">
                <thead>
                  <tr>
                    <th scope="col">Hora</th>
                    <th scope="col">Mesa</th>
                    <th scope="col">Mesero</th>
                    <th scope="col">Cobró</th>
                    <th scope="col" className="num">
                      Subtotal
                    </th>
                    <th scope="col" className="num">
                      Propina
                    </th>
                    <th scope="col" className="num">
                      Total
                    </th>
                    <th scope="col">Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {cuentas.map((c) => (
                    <tr key={c.orden_id}>
                      <td>{hora(c.pagada_en)}</td>
                      <td>{c.mesa_nombre}</td>
                      <td>{c.mesero_nombre}</td>
                      <td>{c.cobrado_por_nombre}</td>
                      <td className="num">{dinero(c.subtotal)}</td>
                      <td className="num">{dinero(c.propina)}</td>
                      <td className="num fuerte">{dinero(c.total)}</td>
                      <td className="celda-pago">{textoPagos(c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="cuentas-corte__lista">
              {cuentas.map((c) => (
                <li key={c.orden_id} className="cuenta-corte">
                  <p className="fuerte-ligero">
                    {c.mesa_nombre} · {c.mesero_nombre} · {hora(c.pagada_en)}
                  </p>
                  <p className="numeros">
                    {dinero(c.subtotal)} + {dinero(c.propina)} = <strong>{dinero(c.total)}</strong>
                  </p>
                  <p className="texto-2 texto-s">{textoPagos(c)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
