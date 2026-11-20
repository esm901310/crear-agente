// A1 — Fila de una categoría: [↑][↓], nombre (elige), productos, "Cocina: Sí/No", "Oculta" y ✎.
import { Insignia } from '../../componentes/Insignia';
import type { CategoriaAdmin } from '../../tipos';
import { FlechasOrden } from './FlechasOrden';

interface Props {
  categoria: CategoriaAdmin;
  actual: boolean;
  primero: boolean;
  ultimo: boolean;
  alMover: (delta: -1 | 1) => void;
  alElegir: () => void;
  alEditar: () => void;
}

export function FilaCategoria({ categoria: c, actual, primero, ultimo, alMover, alElegir, alEditar }: Props) {
  const activos = c.productos.filter((p) => p.activo).length;
  return (
    <li className={`fila-admin fila-cat ${actual ? 'fila-admin--actual' : ''} ${c.activa ? '' : 'fila-admin--apagada'}`}>
      <FlechasOrden grupo="cat" id={c.id} nombre={c.nombre} primero={primero} ultimo={ultimo} alMover={alMover} />
      <button type="button" className="fila-cat__centro" aria-current={actual ? 'true' : undefined} onClick={alElegir}>
        <span className="fila-cat__nombre">{c.nombre}</span>
        <span className="fila-cat__datos">
          <span className="texto-2 texto-s sin-partir">
            {activos}
            <span className="solo-lectores"> {activos === 1 ? 'producto' : 'productos'}</span>
          </span>
          {c.activa ? (
            c.va_a_cocina ? (
              <Insignia tipo="ok">Cocina: Sí</Insignia>
            ) : (
              <Insignia tipo="neutra">Cocina: No</Insignia>
            )
          ) : (
            <Insignia tipo="neutra">Oculta</Insignia>
          )}
        </span>
      </button>
      <button type="button" className="boton-icono boton-icono--neutro" aria-label={`Editar ${c.nombre}`} onClick={alEditar}>
        ✎
      </button>
    </li>
  );
}
