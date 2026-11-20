// "① Cuentas por cobrar ─── ② Contar efectivo ─── ③ Corte" (no son clicables).
const PASOS = ['Cuentas por cobrar', 'Contar efectivo', 'Corte'];

/** `actual`: índice del paso en curso (0, 1 o 2). Los anteriores se ven hechos (✓). */
export function IndicadorPasos({ actual }: { actual: number }) {
  return (
    <ol className="pasos no-imprimir" aria-label="Pasos para cerrar el día">
      {PASOS.map((p, i) => {
        const estado = i < actual ? 'hecho' : i === actual ? 'actual' : 'pendiente';
        return (
          <li key={p} className={`pasos__paso pasos__paso--${estado}`} aria-current={estado === 'actual' ? 'step' : undefined}>
            <span className="pasos__circulo" aria-hidden="true">
              {estado === 'hecho' ? '✓' : i + 1}
            </span>
            <span>
              {p}
              {estado === 'hecho' && <span className="solo-lectores"> (hecho)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
