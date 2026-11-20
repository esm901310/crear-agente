// Dueño — pestañas "Historial de cortes" / "Reporte de propinas" (docs/diseno.md, 20.2).
import { navegar } from '../hooks/useRuta';

export function PestanasDuenio({ actual }: { actual: 'cortes' | 'propinas' }) {
  return (
    <nav className="pestanas no-imprimir" aria-label="Cortes y propinas">
      <button
        type="button"
        className="chip"
        aria-pressed={actual === 'cortes'}
        aria-current={actual === 'cortes' ? 'page' : undefined}
        onClick={() => navegar('/cortes')}
      >
        Historial de cortes
      </button>
      <button
        type="button"
        className="chip"
        aria-pressed={actual === 'propinas'}
        aria-current={actual === 'propinas' ? 'page' : undefined}
        onClick={() => navegar('/propinas')}
      >
        Reporte de propinas
      </button>
    </nav>
  );
}
