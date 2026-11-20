// Caja — detalle de la cuenta como ticket (centro).
import { EstadoComanda, marcarNoVaACocina, pendienteEnCocina } from '../componentes/EstadoComanda';
import { Insignia } from '../componentes/Insignia';
import { ResumenPasadia } from '../componentes/ResumenPasadia';
import { dinero, hora, minutosDesde, transcurrido } from '../formato';
import type { Orden } from '../tipos';

export function DetalleCuenta({ orden, ahora }: { orden: Orden; ahora: number }) {
  const hayEnCocina = orden.estado === 'abierta' && orden.comandas.some(pendienteEnCocina);
  return (
    <section className="caja__detalle" aria-labelledby="titulo-detalle">
      <div className="caja__detalle-cabeza">
        <h2 id="titulo-detalle" className="titulo-xl">
          {orden.mesa_nombre} · {orden.mesero_nombre}
        </h2>
        <p className="texto-2">
          Abierta {hora(orden.creada)}
          {orden.estado === 'abierta'
            ? ` · hace ${transcurrido(minutosDesde(orden.creada, ahora))}`
            : orden.pagada_en
              ? ` · Cobrada ${hora(orden.pagada_en)}`
              : ''}
        </p>
      </div>
      <div className="caja__detalle-scroll">
        {orden.comandas.length === 0 ? (
          <p className="texto-2">Esta cuenta aún no tiene platillos.</p>
        ) : (
          <ul className="ticket">
            {orden.comandas.map((c) => (
              <li key={c.id} className="ticket__comanda">
                <div className="ticket__cabeza">
                  <span>{hora(c.creada)}</span>
                  <EstadoComanda comanda={c} />
                </div>
                <ul>
                  {c.items.map((i) => (
                    <li key={i.id} className="ticket__item">
                      <div className="ticket__fila">
                        <span>
                          {i.cantidad}× {i.nombre}
                          {i.es_pasadia && (
                            <>
                              {' '}
                              <Insignia tipo="neutra">Consumo mínimo</Insignia>
                            </>
                          )}
                          {marcarNoVaACocina(i, c) && (
                            <>
                              {' '}
                              <Insignia tipo="neutra">No va a cocina</Insignia>
                            </>
                          )}
                        </span>
                        <span className="ticket__puntos" aria-hidden="true" />
                        <span className="numeros">{dinero(i.precio * i.cantidad)}</span>
                      </div>
                      {i.nota && <p className="nota-italica">{i.nota}</p>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
      {hayEnCocina && <p className="aviso aviso--alerta">Hay platillos que aún están en cocina.</p>}
      <ResumenPasadia orden={orden} claseMonto="monto-xl" className="caja__detalle-pie" />
    </section>
  );
}
