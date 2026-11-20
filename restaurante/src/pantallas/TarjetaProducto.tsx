// M2 — Tarjeta de un producto del menú (docs/diseno.md, 27.3).
import { Insignia } from '../componentes/Insignia';
import { dinero } from '../formato';
import { sustantivoVariantes } from '../menu';
import type { Producto } from '../tipos';

interface Props {
  producto: Producto;
  /** Piezas de este producto en el pedido nuevo (todas sus tallas y opciones). */
  cantidad: number;
  /** "Opción: Imperial" cuando la búsqueda coincidió por una opción. */
  coincidencia?: string | null;
  alTocar: (p: Producto, boton: HTMLButtonElement) => void;
}

/** ¿Al tocar se abre una hoja (talla, opción o precio)? */
export function abreHoja(p: Producto): boolean {
  return p.precio_abierto || p.variantes.length > 0 || p.opciones.length > 0;
}

function pie(p: Producto): { texto: string; acento: boolean } {
  if (p.precio_abierto) return { texto: 'Precio a consultar ›', acento: true };
  if (p.variantes.length > 0) {
    const precios = p.variantes.map((v) => v.precio);
    const n = p.variantes.length;
    const desde = Math.min(...precios);
    // Con un solo precio (o un solo tamaño) no hay "Desde": se muestra ese precio.
    const precio = desde === Math.max(...precios) ? dinero(desde) : `Desde ${dinero(desde)}`;
    return { texto: `${precio} · ${n} ${sustantivoVariantes(p, n !== 1)} ›`, acento: true };
  }
  if (p.opciones.length > 0) return { texto: `${dinero(p.precio ?? 0)} · elige ›`, acento: false };
  return { texto: dinero(p.precio ?? 0), acento: false };
}

export function TarjetaProducto({ producto: p, cantidad, coincidencia, alTocar }: Props) {
  const { texto, acento } = pie(p);
  if (p.agotado) {
    return (
      <button type="button" className="platillo platillo--agotado" disabled aria-label={`${p.nombre}, agotado`} title={p.descripcion ?? undefined}>
        <span className="platillo__nombre">{p.nombre}</span>
        {p.descripcion && <span className="platillo__descripcion">{p.descripcion}</span>}
        <span className="platillo__pie">
          <Insignia tipo="peligro">Agotado</Insignia>
        </span>
      </button>
    );
  }
  const etiqueta = `${p.nombre}, ${texto.replace(' ›', '')}${cantidad > 0 ? `, ${cantidad} en el pedido` : ''}.${
    abreHoja(p) ? ' Elegir' : ' Agregar uno'
  }`;
  return (
    <button
      type="button"
      className="platillo"
      aria-label={etiqueta}
      aria-haspopup={abreHoja(p) ? 'dialog' : undefined}
      title={p.descripcion ?? undefined}
      onClick={(e) => alTocar(p, e.currentTarget)}
    >
      <span className="platillo__nombre">{p.nombre}</span>
      {p.descripcion && <span className="platillo__descripcion">{p.descripcion}</span>}
      {coincidencia && <span className="platillo__coincide">Opción: {coincidencia}</span>}
      <span className="platillo__pie">
        <span className={acento ? 'platillo__precio platillo__precio--acento' : 'platillo__precio'}>{texto}</span>
        {p.es_pasadia && <Insignia tipo="neutra">Consumo mínimo</Insignia>}
      </span>
      {cantidad > 0 && (
        <span className="platillo__cantidad" aria-hidden="true">
          {cantidad}
        </span>
      )}
    </button>
  );
}
