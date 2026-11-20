// Pedido en preparación (aún no enviado). Renglones compuestos como los guardará el servidor
// (docs/diseno.md, 27.6): "Pescado rojo · Talla 3", "Mar y tierra (Camarón)", precio escrito, pasadía.
import { Insignia } from '../componentes/Insignia';
import { NombrePlatillo } from '../componentes/NombrePlatillo';
import { dinero } from '../formato';
import type { CambioPrecio, EstadoLinea, LineaPedido } from '../pedidos';

interface Props {
  lineas: LineaPedido[];
  /** Líneas (por clave) que se agotaron o ya no están en el menú. */
  problemas: ReadonlyMap<string, EstadoLinea>;
  /** Líneas (por clave) cuyo precio cambió en el menú mientras el pedido no se enviaba. */
  preciosCambiados: ReadonlyMap<string, CambioPrecio>;
  alCambiarCantidad: (clave: string, delta: number) => void;
  alQuitar: (clave: string) => void;
  alEditarNota: (linea: LineaPedido) => void;
  alCambiarPrecio: (linea: LineaPedido) => void;
}

export function PedidoNuevo({ lineas, problemas, preciosCambiados, alCambiarCantidad, alQuitar, alEditarNota, alCambiarPrecio }: Props) {
  return (
    <section className="pedido" aria-labelledby="titulo-pedido-nuevo">
      <h2 id="titulo-pedido-nuevo" className="titulo-seccion">
        Pedido nuevo
      </h2>
      {lineas.length === 0 ? (
        <p className="texto-2">Toca un producto del menú para agregarlo.</p>
      ) : (
        <ul className="pedido__lineas">
          {lineas.map((l) => {
            const problema = problemas.get(l.clave);
            const agotada = problema !== undefined;
            const cambio = preciosCambiados.get(l.clave);
            return (
              <li key={l.clave} className={agotada ? 'linea linea--agotada' : 'linea'}>
                <div className="linea__fila">
                  <span className="linea__nombre">
                    <NombrePlatillo nombre={l.nombre} variante={l.variante}>
                      {l.es_pasadia && (
                        <>
                          {' '}
                          <Insignia tipo="neutra">Consumo mínimo</Insignia>
                        </>
                      )}
                      {problema && (
                        <>
                          {' '}
                          <Insignia tipo="peligro">{problema === 'agotado' ? 'Se agotó' : 'Ya no está en el menú'}</Insignia>
                        </>
                      )}
                    </NombrePlatillo>
                  </span>
                  <span className="linea__importe">{dinero(l.precio * l.cantidad)}</span>
                </div>
                {cambio && !agotada && (
                  <p className="linea__precio-cambio" role="status">
                    Precio actualizado: {dinero(cambio.antes)} → {dinero(cambio.ahora)}
                  </p>
                )}
                {l.precio_abierto && !agotada && (
                  <p className="linea__precio-escrito">
                    Precio escrito: {dinero(l.precio)} c/u ·{' '}
                    <button type="button" className="boton boton--texto boton--texto-chico boton--en-linea" onClick={() => alCambiarPrecio(l)}>
                      ✎ Cambiar<span className="solo-lectores"> el precio de {l.nombre}</span>
                    </button>
                  </p>
                )}
                {agotada ? (
                  <div className="linea__fila">
                    <button type="button" className="boton boton--secundario boton--chico boton--peligro-texto" onClick={() => alQuitar(l.clave)}>
                      ✕ Quitar<span className="solo-lectores"> {l.nombre}</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="linea__fila">
                      <div className="cantidad" role="group" aria-label={`Cantidad de ${l.nombre}`}>
                        {l.cantidad === 1 ? (
                          <button
                            type="button"
                            className="cantidad__boton cantidad__boton--quitar"
                            aria-label="Quitar"
                            onClick={() => alCambiarCantidad(l.clave, -1)}
                          >
                            ✕
                          </button>
                        ) : (
                          <button type="button" className="cantidad__boton" aria-label="Menos" onClick={() => alCambiarCantidad(l.clave, -1)}>
                            −
                          </button>
                        )}
                        <span className="cantidad__numero" aria-live="polite">
                          {l.cantidad}
                        </span>
                        <button
                          type="button"
                          className="cantidad__boton"
                          aria-label="Más"
                          disabled={l.cantidad >= 99}
                          onClick={() => alCambiarCantidad(l.clave, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={l.nota ? 'boton boton--texto linea__nota linea__nota--con' : 'boton boton--texto linea__nota'}
                      onClick={() => alEditarNota(l)}
                    >
                      {l.nota ? (
                        <>
                          <span aria-hidden="true">✎ </span>
                          <span className="solo-lectores">Editar nota: </span>
                          {l.nota}
                        </>
                      ) : (
                        '✎ Agregar nota'
                      )}
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
