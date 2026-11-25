import type { Pagina } from '../lib/types';

interface Props {
  paginas: Pagina[];
  actual: number;
  conCambios: Set<number>;
  alElegir: (indice: number) => void;
}

export default function TiraMiniaturas({ paginas, actual, conCambios, alElegir }: Props) {
  return (
    <ul className="tira-miniaturas" aria-label="Páginas del documento">
      {paginas.map((p) => (
        <li key={p.indice}>
          <button
            type="button"
            className={`miniatura ${p.indice === actual ? 'miniatura-actual' : ''}`}
            onClick={() => alElegir(p.indice)}
            aria-label={`Página ${p.indice + 1}${conCambios.has(p.indice) ? ', con cambios' : ''}${p.estado !== 'lista' ? ', leyendo' : ''}`}
            aria-current={p.indice === actual ? 'page' : undefined}
          >
            <img src={p.miniatura} alt="" width={72} />
            {p.estado !== 'lista' ? <span className="miniatura-leyendo">Leyendo…</span> : null}
            {conCambios.has(p.indice) ? <span className="miniatura-punto" aria-hidden="true" /> : null}
            <span className="miniatura-numero">{p.indice + 1}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
