// M2 — Menú de la mesa: columna de categorías, buscador sin acentos y tarjetas de productos
// (docs/diseno.md, 27.1–27.3). En teléfono las categorías vuelven a ser una fila de chips.
import { useMemo, useState, type ReactNode } from 'react';
import { sinAcentos } from '../formato';
import { useMedia } from '../hooks/useMedia';
import { opcionQueCoincide, textoBusqueda } from '../menu';
import type { CategoriaMenu, Producto } from '../tipos';
import { TarjetaProducto } from './TarjetaProducto';

interface Props {
  mesaId: number;
  categorias: CategoriaMenu[];
  /** Piezas del pedido nuevo por producto. */
  cantidades: Map<number, number>;
  /** Piezas del pedido nuevo por categoría. */
  porCategoria: Map<number, number>;
  alTocar: (p: Producto, categoria: CategoriaMenu, boton: HTMLButtonElement) => void;
  /** Aviso que va arriba de los productos (p. ej. "Esta cuenta ya se cobró"). */
  aviso?: ReactNode;
}

/** Última categoría vista por mesa, mientras la tablet no se recargue. */
const categoriaPorMesa = new Map<number, number>();

const reducirMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function MenuPlatillos({ mesaId, categorias, cantidades, porCategoria, alTocar, aviso }: Props) {
  const telefono = useMedia('(max-width: 599px)');
  const [elegida, setElegidaEstado] = useState<number | null>(() => categoriaPorMesa.get(mesaId) ?? null);
  const [busqueda, setBusqueda] = useState('');
  const b = sinAcentos(busqueda);

  const activa = categorias.find((c) => c.id === elegida) ?? categorias[0] ?? null;
  const elegir = (id: number) => {
    setElegidaEstado(id);
    categoriaPorMesa.set(mesaId, id);
    setBusqueda('');
  };

  const resultados = useMemo(() => {
    if (!b) return null;
    return categorias
      .map((c) => ({ categoria: c, productos: c.productos.filter((p) => textoBusqueda(p, c.nombre).includes(b)) }))
      .filter((g) => g.productos.length > 0);
  }, [categorias, b]);

  if (categorias.length === 0) {
    return <p className="vacio">El menú está vacío. Pide al dueño que agregue productos.</p>;
  }

  const tarjetas = (productos: Producto[], c: CategoriaMenu) => (
    <ul className="menu__platillos">
      {productos.map((p) => (
        <li key={p.id}>
          <TarjetaProducto
            producto={p}
            cantidad={cantidades.get(p.id) ?? 0}
            coincidencia={b ? opcionQueCoincide(p, busqueda) : null}
            alTocar={(prod, boton) => alTocar(prod, c, boton)}
          />
        </li>
      ))}
    </ul>
  );

  const categoriasNav = (
    <nav className={telefono ? 'menu__chips' : 'menu__cats'} aria-label="Categorías">
      <ul>
        {categorias.map((c) => {
          const n = porCategoria.get(c.id) ?? 0;
          const actual = !b && activa?.id === c.id;
          return (
            <li key={c.id}>
              <button
                type="button"
                className={telefono ? 'chip chip--grande' : 'menu__cat'}
                aria-pressed={actual}
                onClick={(e) => {
                  elegir(c.id);
                  e.currentTarget.scrollIntoView({
                    inline: 'nearest',
                    block: 'nearest',
                    behavior: reducirMovimiento() ? 'auto' : 'smooth',
                  });
                }}
              >
                <span className="menu__cat-nombre">{c.nombre}</span>
                {n > 0 && (
                  <span className="menu__cat-cantidad">
                    <span className="solo-lectores">, </span>
                    {n}
                    <span className="solo-lectores"> en el pedido</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <section className={telefono ? 'menu menu--telefono' : 'menu menu--columna'} aria-label="Menú">
      {!telefono && categoriasNav}
      <div className="menu__derecha">
        {aviso}
        <div className="buscador">
          <span className="buscador__icono" aria-hidden="true">
            🔍
          </span>
          <input
            className="buscador__entrada"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar: camarón, tajadas, Imperial…"
            aria-label="Buscar en el menú"
            autoComplete="off"
            enterKeyHint="search"
          />
          {busqueda && (
            <button type="button" className="buscador__borrar" aria-label="Borrar búsqueda" onClick={() => setBusqueda('')}>
              ✕
            </button>
          )}
        </div>
        {telefono && categoriasNav}
        {resultados ? (
          resultados.length === 0 ? (
            <p className="vacio menu__sin-resultados" role="status">
              No encontramos «{busqueda.trim()}». Revisa cómo se escribe.
            </p>
          ) : (
            <div className="menu__resultados" role="status" aria-live="polite">
              <span className="solo-lectores">
                {resultados.reduce((s, g) => s + g.productos.length, 0)} resultados
              </span>
              {resultados.map((g) => (
                <section key={g.categoria.id} aria-label={g.categoria.nombre}>
                  <h3 className="menu__grupo">{g.categoria.nombre}</h3>
                  {tarjetas(g.productos, g.categoria)}
                </section>
              ))}
            </div>
          )
        ) : activa && activa.productos.length === 0 ? (
          <p className="vacio">Esta categoría no tiene productos.</p>
        ) : (
          activa && tarjetas(activa.productos, activa)
        )}
      </div>
    </section>
  );
}
