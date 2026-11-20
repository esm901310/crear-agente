// Pedido en preparación (aún no enviado a cocina).
import { dinero } from '../formato';
import type { LineaPedido } from '../pedidos';

interface Props {
  lineas: LineaPedido[];
  alCambiarCantidad: (clave: string, delta: number) => void;
  alEditarNota: (linea: LineaPedido) => void;
}

export function PedidoNuevo({ lineas, alCambiarCantidad, alEditarNota }: Props) {
  return (
    <section className="pedido" aria-labelledby="titulo-pedido-nuevo">
      <h2 id="titulo-pedido-nuevo" className="titulo-seccion">
        Pedido nuevo
      </h2>
      {lineas.length === 0 ? (
        <p className="texto-2">Toca un platillo del menú para agregarlo.</p>
      ) : (
        <ul className="pedido__lineas">
          {lineas.map((l) => (
            <li key={l.clave} className="linea">
              <div className="linea__fila">
                <span className="linea__nombre">{l.nombre}</span>
                <span className="linea__importe">{dinero(l.precio * l.cantidad)}</span>
              </div>
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
                    <button
                      type="button"
                      className="cantidad__boton"
                      aria-label="Menos"
                      onClick={() => alCambiarCantidad(l.clave, -1)}
                    >
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
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
