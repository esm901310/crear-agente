// A1 — Fila de un producto: [↑][↓], nombre y descripción, precio, insignias, Disponible/Agotado,
// "Editar" y "Quitar". Los quitados se ven grises con "Volver a poner".
import { Insignia } from '../../componentes/Insignia';
import { Interruptor } from '../../componentes/Interruptor';
import { dinero, plural } from '../../formato';
import { sustantivoVariantes } from '../../menu';
import type { ProductoAdmin } from '../../tipos';
import { FlechasOrden } from './FlechasOrden';

interface Props {
  producto: ProductoAdmin;
  /** Nombre de la categoría (en resultados de búsqueda). */
  categoria: string | null;
  flechas: { primero: boolean; ultimo: boolean; alMover: (delta: -1 | 1) => void } | null;
  alAgotado: (agotado: boolean) => void;
  alEditar: () => void;
  alQuitar: () => void;
  alVolver: () => void;
}

/** "L 517.50" · "5 tallas: L 345.00 – L 575.00" · "1 tamaño: L 50.00" · "Precio a consultar". */
export function textoPrecio(p: ProductoAdmin): string {
  if (p.precio_abierto) return 'Precio a consultar';
  if (p.variantes.length > 0) {
    const precios = p.variantes.map((v) => v.precio);
    const n = p.variantes.length;
    const menor = Math.min(...precios);
    const mayor = Math.max(...precios);
    const rango = menor === mayor ? dinero(menor) : `${dinero(menor)} – ${dinero(mayor)}`;
    return `${n} ${sustantivoVariantes(p, n !== 1)}: ${rango}`;
  }
  return dinero(p.precio ?? 0);
}

export function FilaProducto({ producto: p, categoria, flechas, alAgotado, alEditar, alQuitar, alVolver }: Props) {
  return (
    <li className={`fila-admin fila-prod ${p.activo ? '' : 'fila-admin--apagada'}`}>
      {flechas ? (
        <FlechasOrden grupo="prod" id={p.id} nombre={p.nombre} primero={flechas.primero} ultimo={flechas.ultimo} alMover={flechas.alMover} />
      ) : (
        <span className="flechas flechas--vacias" aria-hidden="true" />
      )}
      <div className="fila-prod__centro">
        <div className="fila-prod__arriba">
          <span className="fila-prod__nombre">{p.nombre}</span>
          <span className="fila-prod__precio">{textoPrecio(p)}</span>
        </div>
        {(p.descripcion || categoria) && (
          <p className="fila-prod__descripcion">
            {categoria && <span className="fuerte-ligero">{categoria}</span>}
            {categoria && p.descripcion && ' · '}
            {p.descripcion}
          </p>
        )}
        <div className="fila-prod__insignias">
          {p.opciones.length > 0 && <Insignia tipo="neutra">{plural(p.opciones.length, 'opción', 'opciones')}</Insignia>}
          {p.es_pasadia && <Insignia tipo="neutra">Pasadía</Insignia>}
          {!p.activo && <Insignia tipo="neutra">Quitado</Insignia>}
        </div>
        <div className="fila-prod__acciones">
          {p.activo ? (
            <>
              <Interruptor encendido={!p.agotado} etiqueta={`${p.nombre} disponible`} alCambiar={(disponible) => alAgotado(!disponible)} />
              <span className="fila-prod__botones">
                <button type="button" className="boton boton--secundario boton--chico" onClick={alEditar}>
                  Editar<span className="solo-lectores"> {p.nombre}</span>
                </button>
                <button type="button" className="boton boton--secundario boton--chico boton--peligro-texto" onClick={alQuitar}>
                  Quitar<span className="solo-lectores"> {p.nombre}</span>
                </button>
              </span>
            </>
          ) : (
            <button type="button" className="boton boton--secundario boton--chico" onClick={alVolver}>
              Volver a poner<span className="solo-lectores"> {p.nombre}</span>
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
