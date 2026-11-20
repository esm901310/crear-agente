// Corte — "Efectivo en caja": resultado, debía haber / contaste / diferencia, desglose y conteo.
import { useState } from 'react';
import { DENOMINACIONES } from '../../config';
import { textoDiferencia, tipoDiferencia } from '../../dia';
import { dinero, dineroConSigno, etiquetaDenominacion } from '../../formato';
import type { Corte } from '../../tipos';

export function TarjetaEfectivo({ efectivo }: { efectivo: Corte['efectivo'] }) {
  const [verConteo, setVerConteo] = useState(false);
  const { diferencia, contado, conteo } = efectivo;
  const tipo = tipoDiferencia(diferencia);
  const filasConteo = conteo
    ? DENOMINACIONES.map((d) => ({ ...d, cantidad: conteo[String(d.valor)] ?? 0 })).filter((d) => d.cantidad > 0)
    : [];

  return (
    <section className="tarjeta corte__efectivo" aria-labelledby="titulo-efectivo">
      <h3 id="titulo-efectivo" className="tarjeta__titulo">
        Efectivo en caja
      </h3>
      <div className={`resultado resultado--${tipo}`} aria-live="polite">
        {diferencia === null ? (
          <span className="resultado__pendiente">Sin contar todavía</span>
        ) : (
          <span className="resultado__texto">
            <span className="solo-pantalla">{textoDiferencia(diferencia)}</span>
            <span className="solo-impresion">{textoDiferencia(diferencia).replace(' ✓', '').toUpperCase()}</span>
          </span>
        )}
      </div>
      <dl className="renglones renglones--grandes">
        <div className="renglon">
          <dt>Debía haber</dt>
          <dd>{dinero(efectivo.esperado)}</dd>
        </div>
        <div className="renglon">
          <dt>Contaste</dt>
          <dd>{contado === null ? '—' : dinero(contado)}</dd>
        </div>
        <div className="renglon">
          <dt>Diferencia</dt>
          <dd className={`texto-${tipo}`}>{diferencia === null ? '—' : dineroConSigno(diferencia)}</dd>
        </div>
      </dl>
      <hr className="separador" />
      <h4 className="subtitulo">Cómo se calcula lo que debía haber</h4>
      <dl className="renglones">
        <div className="renglon">
          <dt>Fondo inicial</dt>
          <dd>+ {dinero(efectivo.fondo)}</dd>
        </div>
        <div className="renglon renglon--con-ayuda">
          <dt>
            Cobrado en efectivo
            <span className="ayuda">Incluye propinas pagadas en efectivo.</span>
          </dt>
          <dd>+ {dinero(efectivo.cobrado)}</dd>
        </div>
        <div className="renglon">
          <dt>Salidas</dt>
          <dd>− {dinero(efectivo.salidas)}</dd>
        </div>
        <div className="renglon renglon--total">
          <dt>Debía haber</dt>
          <dd>= {dinero(efectivo.esperado)}</dd>
        </div>
      </dl>
      {conteo && (
        <>
          <button
            type="button"
            className="boton boton--texto boton--alinear-izq no-imprimir"
            aria-expanded={verConteo}
            aria-controls="conteo-corte"
            onClick={() => setVerConteo((v) => !v)}
          >
            {verConteo ? 'Ocultar conteo por denominación ▴' : 'Ver conteo por denominación ▾'}
          </button>
          {/* Siempre en el documento: al imprimir se despliega aunque esté plegado en pantalla. */}
          <div id="conteo-corte" className={verConteo ? 'conteo-corte' : 'conteo-corte conteo-corte--plegado'}>
            <h4 className="subtitulo solo-impresion">Conteo por denominación</h4>
            {filasConteo.length === 0 ? (
              <p className="texto-2">No se capturó efectivo.</p>
            ) : (
              <table className="tabla tabla--compacta">
                <thead>
                  <tr>
                    <th scope="col">Denominación</th>
                    <th scope="col" className="num">
                      Cantidad
                    </th>
                    <th scope="col" className="num">
                      Importe
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filasConteo.map((d) => (
                    <tr key={d.valor}>
                      <td>{etiquetaDenominacion(d.valor)}</td>
                      <td className="num">{d.cantidad}</td>
                      <td className="num">{dinero(d.valor * d.cantidad)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={2}>
                      Total
                    </th>
                    <td className="num">{dinero(contado ?? 0)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </>
      )}
    </section>
  );
}
