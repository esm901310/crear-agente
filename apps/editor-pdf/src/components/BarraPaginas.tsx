import BotonIcono from './BotonIcono';

interface Props {
  actual: number;
  total: number;
  alAnterior: () => void;
  alSiguiente: () => void;
  alAbrirMiniaturas: () => void;
}

export default function BarraPaginas({ actual, total, alAnterior, alSiguiente, alAbrirMiniaturas }: Props) {
  return (
    <nav className="barra-paginas" aria-label="Páginas">
      <BotonIcono icono="anterior" etiqueta="Página anterior" onClick={alAnterior} disabled={actual <= 1} />
      <button type="button" className="barra-paginas-centro" onClick={alAbrirMiniaturas} aria-label={`Página ${actual} de ${total}. Ver todas las páginas`}>
        Página {actual} de {total}
      </button>
      <BotonIcono icono="siguiente" etiqueta="Página siguiente" onClick={alSiguiente} disabled={actual >= total} />
    </nav>
  );
}
