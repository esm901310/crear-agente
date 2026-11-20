// Corte — "Ventas": cinco cifras del día.
import { dinero } from '../../formato';
import type { Corte } from '../../tipos';

export function TarjetaVentas({ ventas }: { ventas: Corte['ventas'] }) {
  const cifras = [
    { etiqueta: 'Cuentas', valor: String(ventas.cuentas) },
    { etiqueta: 'Ventas (sin propina)', valor: dinero(ventas.subtotal) },
    { etiqueta: 'Propinas', valor: dinero(ventas.propinas) },
    { etiqueta: 'Total cobrado', valor: dinero(ventas.total) },
    { etiqueta: 'Ticket promedio', valor: dinero(ventas.ticket_promedio), ayuda: 'Por cuenta, sin propina' },
  ];
  return (
    <section className="tarjeta corte__ventas" aria-labelledby="titulo-ventas">
      <h3 id="titulo-ventas" className="tarjeta__titulo">
        Ventas
      </h3>
      <dl className="cifras">
        {cifras.map((c) => (
          <div key={c.etiqueta} className="cifra">
            <dt className="cifra__etiqueta">{c.etiqueta}</dt>
            <dd className="cifra__valor">{c.valor}</dd>
            {c.ayuda && <dd className="ayuda">{c.ayuda}</dd>}
          </div>
        ))}
      </dl>
      {ventas.cuentas === 0 && <p className="texto-2">No se cobró ninguna cuenta este día.</p>}
    </section>
  );
}
