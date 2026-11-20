// Menú de la mesa: pestañas de categoría y cuadrícula de platillos. Tocar = +1.
import { useMemo, useState } from 'react';
import { ORDEN_CATEGORIAS } from '../config';
import { dinero } from '../formato';
import type { Producto } from '../tipos';

interface Props {
  productos: Producto[];
  /** Cantidad total pedida (sin enviar) por producto. */
  cantidades: Map<number, number>;
  alAgregar: (p: Producto) => void;
}

function ordenarCategorias(productos: Producto[]): string[] {
  const unicas = [...new Set(productos.map((p) => p.categoria))];
  const posicion = (c: string) => {
    const i = ORDEN_CATEGORIAS.indexOf(c);
    return i < 0 ? ORDEN_CATEGORIAS.length : i;
  };
  // Las conocidas en el orden de config; las demás al final, en el orden que llegaron.
  return unicas
    .map((c, i) => ({ c, i }))
    .sort((a, b) => posicion(a.c) - posicion(b.c) || a.i - b.i)
    .map((x) => x.c);
}

const reducirMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function MenuPlatillos({ productos, cantidades, alAgregar }: Props) {
  const categorias = useMemo(() => ordenarCategorias(productos), [productos]);
  const [elegida, setElegida] = useState<string | null>(null);
  const activa = elegida && categorias.includes(elegida) ? elegida : (categorias[0] ?? null);
  const visibles = productos.filter((p) => p.categoria === activa);

  if (productos.length === 0) {
    return <p className="vacio">El menú está vacío. Pide al dueño que agregue platillos.</p>;
  }

  return (
    <section className="menu" aria-label="Menú">
      <div className="menu__categorias" role="group" aria-label="Categorías">
        {categorias.map((c) => (
          <button
            key={c}
            type="button"
            className="chip chip--grande"
            aria-pressed={c === activa}
            onClick={(e) => {
              setElegida(c);
              // Si la pestaña quedó medio oculta en la tira, se desplaza para verla completa.
              e.currentTarget.scrollIntoView({
                inline: 'nearest',
                block: 'nearest',
                behavior: reducirMovimiento() ? 'auto' : 'smooth',
              });
            }}
          >
            {c}
          </button>
        ))}
      </div>
      <ul className="menu__platillos">
        {visibles.map((p) => {
          const n = cantidades.get(p.id) ?? 0;
          return (
            <li key={p.id}>
              <button
                type="button"
                className="platillo"
                aria-label={`${p.nombre}, ${dinero(p.precio)}${n > 0 ? `, ${n} en el pedido` : ''}. Agregar uno`}
                onClick={(e) => {
                  alAgregar(p);
                  if (!reducirMovimiento()) {
                    e.currentTarget.animate([{ backgroundColor: '#FBE9E1' }, { backgroundColor: '#FFFFFF' }], {
                      duration: 300,
                      easing: 'ease-out',
                    });
                  }
                }}
              >
                <span className="platillo__nombre">{p.nombre}</span>
                <span className="platillo__precio">{dinero(p.precio)}</span>
                {n > 0 && (
                  <span className="platillo__cantidad" aria-hidden="true">
                    {n}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
