// Pedido en preparación (aún no enviado). Renglones compuestos como los guardará el servidor
// (docs/diseno.md, 27.6): "Pescado rojo · Talla 3", "Mar y tierra (Camarón)", precio escrito, pasadía.
import { Insignia } from '../componentes/Insignia';
import { dinero } from '../formato';
import type { LineaPedido } from '../pedidos';

interface Props {
  lineas: LineaPedido[];
  /** Productos que se agotaron o ya no están en el menú. */
  agotados: ReadonlySet<number>;
  alCambiarCantidad: (clave: string, delta: number) => void;
  alQuitar: (clave: string) => void;
  alEditarNota: (linea: LineaPedido) => void;
  alCambiarPrecio: (linea: LineaPedido) => void;
}

export function PedidoNuevo({ lineas, agotados, alCambiarCantidad, alQuitar, alEditarNota, alCambiarPrecio }: Props) {
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
            const agotada = agotados.has(l.producto_id);
            return (
              <li key={l.clave} className={agotada ? 'linea linea--agotada' : 'linea'}>
                <div className="linea__fila">
                  <span className="linea__nombre">
                    {l.nombre}
                    {l.es_pasadia && (
                      <>
                        {' '}
                        <Insignia tipo="neutra">Consumo mínimo</Insignia>
                      </>
                    )}
                    {agotada && (
                      <>
                        {' '}
                        <Insignia tipo="peligro">Se agotó</Insignia>
                      </>
                    )}
                  </span>
                  <span className="linea__importe">{dinero(l.precio * l.cantidad)}</span>
                </div>
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
