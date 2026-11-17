import type { Grupo, Tienda } from '../api/cliente';
import { estaDisponible, precioEfectivo } from '../logica/comparar';
import { detalleGrupo } from '../logica/formato';
import { EtiquetaTienda } from './EtiquetaTienda';
import { Icono } from './Icono';
import { Insignia } from './Insignia';
import { Precio } from './Precio';

interface Props {
  grupo: Grupo;
  tiendas: Tienda[];
  errores: Partial<Record<Tienda, string>>;
  enLista: boolean;
  agregando: boolean;
  alAgregar: () => void;
}

/** Tarjeta de P6: un producto exacto con su precio en cada súper. */
export function TarjetaResultado({ grupo, tiendas, errores, enLista, agregando, alAgregar }: Props) {
  const precios = tiendas
    .map((t) => grupo.precios[t])
    .filter(estaDisponible)
    .map(precioEfectivo);
  const minimo = precios.length > 1 ? Math.min(...precios) : null;
  const hayDiferencia = precios.length > 1 && precios.some((p) => p !== minimo);
  const detalle = detalleGrupo(grupo);

  return (
    <article className="tarjeta tarjeta-resultado" aria-label={`${grupo.nombre}${detalle ? `, ${detalle}` : ''}`}>
      <h3 className="tarjeta-nombre">{grupo.nombre}</h3>
      {detalle && <p className="texto-secundario">{detalle}</p>}
      <ul className="precios-tiendas">
        {tiendas.map((t) => {
          const p = grupo.precios[t];
          const disponible = estaDisponible(p);
          const valor = disponible ? precioEfectivo(p) : null;
          const esMinimo = hayDiferencia && valor !== null && valor === minimo;
          return (
            <li key={t} className="precio-tienda">
              <div className="precio-tienda-fila">
                <EtiquetaTienda tienda={t} />
                {errores[t] && !disponible ? (
                  <span className="texto-error linea-icono">
                    <Icono nombre="alerta" tamano={18} />
                    No pudimos consultar
                  </span>
                ) : disponible ? (
                  <span className="precio-tienda-valor">
                    {p.precioOferta !== undefined && p.precioOferta < p.precio && (
                      <s className="precio-tachado">
                        <Precio valor={p.precio} prefijo="antes" />
                      </s>
                    )}
                    <Precio valor={valor!} className="precio-fuerte" />
                  </span>
                ) : (
                  <span className="texto-ambar linea-icono">
                    <Icono nombre="prohibido" tamano={18} />
                    No disponible
                  </span>
                )}
              </div>
              {disponible && p.desactualizado && (
                <p className="texto-nota">Precio de la última consulta</p>
              )}
              {esMinimo && (
                <div className="precio-tienda-insignia">
                  <Insignia tipo="mas-barato" />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="boton boton-secundario"
        disabled={enLista || agregando}
        aria-busy={agregando}
        onClick={alAgregar}
      >
        {enLista ? (
          <>
            En tu lista <Icono nombre="check" tamano={20} />
          </>
        ) : agregando ? (
          'Agregando…'
        ) : (
          'Agregar'
        )}
      </button>
    </article>
  );
}
