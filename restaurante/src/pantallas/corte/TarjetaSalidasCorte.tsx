// Corte — "Salidas" (solo lectura; anuladas tachadas).
import { FilaSalida } from '../../componentes/FilaSalida';
import { dinero } from '../../formato';
import type { Salida } from '../../tipos';

export function TarjetaSalidasCorte({ salidas, total }: { salidas: Salida[]; total: number }) {
  const lista = [...salidas].reverse(); // más reciente primero
  return (
    <section className="tarjeta corte__salidas" aria-labelledby="titulo-salidas">
      <h3 id="titulo-salidas" className="tarjeta__titulo">
        Salidas
      </h3>
      {lista.length === 0 ? (
        <p className="texto-2">No hubo salidas de efectivo.</p>
      ) : (
        <>
          <ul className="salidas salidas--compactas">
            {lista.map((s) => (
              <FilaSalida key={s.id} salida={s} />
            ))}
          </ul>
          <p className="salidas__total">
            <span>Total de salidas</span>
            <span className="numeros">{dinero(total)}</span>
          </p>
        </>
      )}
    </section>
  );
}
