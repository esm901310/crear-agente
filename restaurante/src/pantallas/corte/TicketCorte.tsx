// Versión del corte para ticket de 80 mm: solo aparece al imprimir con la opción "Ticket".
// Una columna, tablas convertidas en renglones; sin propinas por mesa ni lista de cuentas.
import { DENOMINACIONES } from '../../config';
import { textoDiferencia } from '../../dia';
import { dinero, dineroConSigno, etiquetaDenominacion, hora } from '../../formato';
import type { Corte } from '../../tipos';
import { Renglon } from './Renglon';

export function TicketCorte({ corte, titulo, horario }: { corte: Corte; titulo: string; horario: string }) {
  const { efectivo: e, ventas, por_metodo: pm } = corte;
  const conteo = e.conteo
    ? DENOMINACIONES.map((d) => ({ ...d, n: e.conteo?.[String(d.valor)] ?? 0 })).filter((d) => d.n > 0)
    : [];
  return (
    <div className="ticket-impreso">
      <p className="ticket-impreso__titulo">{titulo}</p>
      <p>{horario}</p>

      <p className="ticket-impreso__seccion">EFECTIVO EN CAJA</p>
      <p className="ticket-impreso__resultado">
        {e.diferencia === null ? 'SIN CONTAR TODAVÍA' : textoDiferencia(e.diferencia).replace(' ✓', '').toUpperCase()}
      </p>
      <Renglon nombre="Debía haber" valor={dinero(e.esperado)} />
      <Renglon nombre="Contaste" valor={e.contado === null ? '—' : dinero(e.contado)} />
      <Renglon nombre="Diferencia" valor={e.diferencia === null ? '—' : dineroConSigno(e.diferencia)} fuerte />
      <Renglon nombre="Fondo inicial" valor={`+ ${dinero(e.fondo)}`} />
      <Renglon nombre="Cobrado en efectivo" valor={`+ ${dinero(e.cobrado)}`} />
      <Renglon nombre="Salidas" valor={`− ${dinero(e.salidas)}`} />
      <Renglon nombre="Debía haber" valor={`= ${dinero(e.esperado)}`} fuerte />
      {conteo.length > 0 && (
        <>
          <p className="ticket-impreso__sub">Conteo</p>
          {conteo.map((d) => (
            <Renglon key={d.valor} nombre={`${d.n} × ${etiquetaDenominacion(d.valor)}`} valor={dinero(d.valor * d.n)} />
          ))}
        </>
      )}

      <p className="ticket-impreso__seccion">OTRAS FORMAS DE PAGO</p>
      <Renglon nombre="Tarjeta" valor={dinero(pm.tarjeta)} />
      <Renglon nombre="Transferencia" valor={dinero(pm.transferencia)} />

      <p className="ticket-impreso__seccion">VENTAS</p>
      <Renglon nombre="Cuentas" valor={ventas.cuentas} />
      <Renglon nombre="Ventas (sin propina)" valor={dinero(ventas.subtotal)} />
      <Renglon nombre="Propinas" valor={dinero(ventas.propinas)} />
      <Renglon nombre="Total cobrado" valor={dinero(ventas.total)} fuerte />
      <Renglon nombre="Ticket promedio" valor={dinero(ventas.ticket_promedio)} />

      <p className="ticket-impreso__seccion">SALIDAS</p>
      {corte.salidas.length === 0 ? (
        <p>No hubo salidas de efectivo.</p>
      ) : (
        [...corte.salidas].reverse().map((s) => (
          <Renglon
            key={s.id}
            nombre={`${hora(s.creada)} ${s.motivo}${s.anulada ? ' (ANULADA)' : ''}`}
            valor={s.anulada ? <s>{dinero(s.monto)}</s> : dinero(s.monto)}
          />
        ))
      )}
      <Renglon nombre="Total de salidas" valor={dinero(corte.total_salidas)} fuerte />

      <p className="ticket-impreso__seccion">PROPINAS POR MESERO</p>
      {corte.propinas_por_mesero.length === 0 ? (
        <p>No hubo propinas este día.</p>
      ) : (
        corte.propinas_por_mesero.map((m) => (
          <div key={m.mesero_id} className="ticket-impreso__mesero">
            <Renglon nombre={m.nombre} valor={dinero(m.total)} fuerte />
            <p>
              Ef {dinero(m.efectivo)} · Tj {dinero(m.tarjeta)} · Tr {dinero(m.transferencia)}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
