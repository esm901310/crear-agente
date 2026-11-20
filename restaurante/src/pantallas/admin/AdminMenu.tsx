// A1 — Administrar · Menú: categorías (orden, va a cocina, ocultar) y productos de la categoría
// elegida (orden, agotado, editar, quitar/volver a poner). Docs/diseno.md, 30.1.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, mensajeDeError } from '../../api';
import { Cargando } from '../../componentes/Cargando';
import { Confirmar } from '../../componentes/Confirmar';
import { Encabezado } from '../../componentes/Encabezado';
import { useToast } from '../../componentes/Toast';
import { sinAcentos } from '../../formato';
import { useMedia } from '../../hooks/useMedia';
import { navegar } from '../../hooks/useRuta';
import { textoBusqueda } from '../../menu';
import type { CategoriaAdmin, ProductoAdmin } from '../../tipos';
import { DialogoCategoria } from './DialogoCategoria';
import { DialogoProducto } from './DialogoProducto';
import { enfocarFlecha, mover } from './FlechasOrden';
import { FilaCategoria } from './FilaCategoria';
import { FilaProducto } from './FilaProducto';
import { PestanasAdmin } from './PestanasAdmin';

type DialogoAbierto =
  | { tipo: 'categoria'; categoria: CategoriaAdmin | null }
  | { tipo: 'producto'; producto: ProductoAdmin | null; categoriaId: number }
  | { tipo: 'quitar'; producto: ProductoAdmin }
  | null;

export function AdminMenu({ categoriaRuta }: { categoriaRuta: number | null }) {
  const toast = useToast();
  const ancha = useMedia('(min-width: 1024px)');
  const [categorias, setCategorias] = useState<CategoriaAdmin[] | null>(null);
  const [error, setError] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [dialogo, setDialogo] = useState<DialogoAbierto>(null);
  const [verQuitados, setVerQuitados] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const b = sinAcentos(busqueda);

  const cargar = useCallback(async () => {
    try {
      const r = await api.adminMenu();
      setCategorias(r.categorias);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => void cargar(), [cargar]);

  const elegida = categorias?.find((c) => c.id === categoriaRuta) ?? (ancha ? categorias?.[0] : undefined) ?? null;

  // --- Acciones al momento ---

  const moverCategoria = (i: number, delta: -1 | 1) => {
    if (!categorias) return;
    const antes = categorias;
    const nuevas = mover(categorias, i, delta);
    setCategorias(nuevas);
    enfocarFlecha('cat', categorias[i].id, delta);
    api.ordenCategorias(nuevas.map((c) => c.id)).catch(() => {
      setCategorias(antes);
      toast({ texto: 'No se pudo cambiar el orden. Intenta de nuevo.', tipo: 'error' });
    });
  };

  const moverProducto = (categoria: CategoriaAdmin, activos: ProductoAdmin[], i: number, delta: -1 | 1) => {
    if (!categorias) return;
    const antes = categorias;
    const nuevosActivos = mover(activos, i, delta);
    const quitados = categoria.productos.filter((p) => !p.activo);
    const productos = [...nuevosActivos, ...quitados];
    setCategorias(categorias.map((c) => (c.id === categoria.id ? { ...c, productos } : c)));
    enfocarFlecha('prod', activos[i].id, delta);
    api.ordenProductos(categoria.id, productos.map((p) => p.id)).catch(() => {
      setCategorias(antes);
      toast({ texto: 'No se pudo cambiar el orden. Intenta de nuevo.', tipo: 'error' });
    });
  };

  const ponerProducto = (p: ProductoAdmin) =>
    setCategorias((cs) => cs?.map((c) => ({ ...c, productos: c.productos.map((x) => (x.id === p.id ? { ...x, ...p } : x)) })) ?? cs);

  const cambiarAgotado = (p: ProductoAdmin, agotado: boolean) => {
    ponerProducto({ ...p, agotado });
    api
      .agotado(p.id, agotado)
      .then(() =>
        toast(
          agotado
            ? { texto: `${p.nombre}: agotado`, accion: { texto: 'Deshacer', alTocar: () => cambiarAgotado({ ...p, agotado }, false) } }
            : { texto: `${p.nombre}: disponible otra vez ✓`, tipo: 'ok' },
        ),
      )
      .catch((e: unknown) => {
        ponerProducto(p);
        toast({ texto: mensajeDeError(e), tipo: 'error' });
      });
  };

  const cambiarActivo = async (p: ProductoAdmin, activo: boolean, conDeshacer = true) => {
    setOcupado(true);
    try {
      await api.editarProducto(p.id, { activo });
      await cargar();
      setDialogo(null);
      toast(
        activo
          ? { texto: `${p.nombre} está otra vez en el menú ✓`, tipo: 'ok' }
          : {
              texto: `${p.nombre} quitado del menú`,
              accion: conDeshacer ? { texto: 'Deshacer', alTocar: () => void cambiarActivo(p, true, false) } : undefined,
            },
      );
    } catch (e) {
      toast({ texto: mensajeDeError(e), tipo: 'error' });
    } finally {
      setOcupado(false);
    }
  };

  // --- Búsqueda en todo el menú ---
  const resultados = useMemo(() => {
    if (!b || !categorias) return null;
    return categorias.flatMap((c) =>
      c.productos.filter((p) => textoBusqueda(p, c.nombre).includes(b)).map((p) => ({ producto: p, categoria: c })),
    );
  }, [categorias, b]);

  // --- Vistas ---

  const listaCategorias = categorias && (
    <section className="admin-menu__categorias" aria-labelledby="titulo-categorias">
      <div className="admin-menu__cabeza">
        <h2 id="titulo-categorias" className="admin-menu__titulo">
          Categorías
        </h2>
        <button type="button" className="boton boton--secundario boton--chico" onClick={() => setDialogo({ tipo: 'categoria', categoria: null })}>
          + Nueva
        </button>
      </div>
      {categorias.length === 0 ? (
        <div className="vacio">
          <p>Todavía no hay categorías.</p>
          <button type="button" className="boton boton--primario" onClick={() => setDialogo({ tipo: 'categoria', categoria: null })}>
            + Nueva categoría
          </button>
        </div>
      ) : (
        <ul className="lista-admin">
          {categorias.map((c, i) => (
            <FilaCategoria
              key={c.id}
              categoria={c}
              actual={!b && elegida?.id === c.id}
              primero={i === 0}
              ultimo={i === categorias.length - 1}
              alMover={(d) => moverCategoria(i, d)}
              alElegir={() => {
                setBusqueda('');
                setVerQuitados(false);
                navegar(`/admin/menu/${c.id}`, ancha);
              }}
              alEditar={() => setDialogo({ tipo: 'categoria', categoria: c })}
            />
          ))}
        </ul>
      )}
    </section>
  );

  const fila = (p: ProductoAdmin, c: CategoriaAdmin, extra: { i?: number; activos?: ProductoAdmin[]; conCategoria?: boolean } = {}) => (
    <FilaProducto
      key={p.id}
      producto={p}
      categoria={extra.conCategoria ? c.nombre : null}
      flechas={
        extra.activos && extra.i !== undefined
          ? { primero: extra.i === 0, ultimo: extra.i === extra.activos.length - 1, alMover: (d) => moverProducto(c, extra.activos!, extra.i!, d) }
          : null
      }
      alAgotado={(agotado) => cambiarAgotado(p, agotado)}
      alEditar={() => setDialogo({ tipo: 'producto', producto: p, categoriaId: c.id })}
      alQuitar={() => setDialogo({ tipo: 'quitar', producto: p })}
      alVolver={() => void cambiarActivo(p, true)}
    />
  );

  let listaProductos = null;
  if (resultados) {
    listaProductos = (
      <section className="admin-menu__productos" aria-label="Resultados de la búsqueda">
        <div className="admin-menu__cabeza">
          <h2 className="admin-menu__titulo">
            {resultados.length} {resultados.length === 1 ? 'resultado' : 'resultados'}
          </h2>
        </div>
        {resultados.length === 0 ? (
          <p className="vacio">No encontramos «{busqueda.trim()}». Revisa cómo se escribe.</p>
        ) : (
          <ul className="lista-admin">{resultados.map((r) => fila(r.producto, r.categoria, { conCategoria: true }))}</ul>
        )}
      </section>
    );
  } else if (elegida) {
    const activos = elegida.productos.filter((p) => p.activo);
    const quitados = elegida.productos.filter((p) => !p.activo);
    listaProductos = (
      <section className="admin-menu__productos" aria-labelledby="titulo-productos">
        {!ancha && (
          <button type="button" className="boton boton--texto boton--alinear-izq" onClick={() => navegar('/admin/menu')}>
            ← Categorías
          </button>
        )}
        <div className="admin-menu__cabeza">
          <h2 id="titulo-productos" className="admin-menu__titulo">
            {elegida.nombre} · {activos.length} {activos.length === 1 ? 'producto' : 'productos'}
          </h2>
          <button
            type="button"
            className="boton boton--primario boton--chico"
            onClick={() => setDialogo({ tipo: 'producto', producto: null, categoriaId: elegida.id })}
          >
            + Nuevo producto
          </button>
        </div>
        {activos.length === 0 ? (
          <div className="vacio">
            <p>Esta categoría no tiene productos.</p>
            <button
              type="button"
              className="boton boton--primario"
              onClick={() => setDialogo({ tipo: 'producto', producto: null, categoriaId: elegida.id })}
            >
              + Nuevo producto
            </button>
          </div>
        ) : (
          <ul className="lista-admin">{activos.map((p, i) => fila(p, elegida, { i, activos }))}</ul>
        )}
        {quitados.length > 0 && (
          <div className="admin-menu__quitados">
            <button
              type="button"
              className="boton boton--secundario boton--chico"
              aria-expanded={verQuitados}
              onClick={() => setVerQuitados((v) => !v)}
            >
              Quitados ({quitados.length}) {verQuitados ? '▴' : '▾'}
            </button>
            {verQuitados && <ul className="lista-admin">{quitados.map((p) => fila(p, elegida))}</ul>}
          </div>
        )}
      </section>
    );
  }

  return (
    <>
      <Encabezado vista="Administrar" />
      <main className="contenido admin">
        <PestanasAdmin actual="menu" />
        {!categorias ? (
          error ? (
            <div className="vacio">
              <p>No pudimos cargar el menú. Revisa la conexión.</p>
              <button type="button" className="boton boton--primario" onClick={() => void cargar()}>
                Reintentar
              </button>
            </div>
          ) : (
            <Cargando />
          )
        ) : (
          <>
            <div className="buscador admin__buscador">
              <span className="buscador__icono" aria-hidden="true">
                🔍
              </span>
              <input
                className="buscador__entrada"
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar en todo el menú"
                aria-label="Buscar en todo el menú"
                autoComplete="off"
              />
              {busqueda && (
                <button type="button" className="buscador__borrar" aria-label="Borrar búsqueda" onClick={() => setBusqueda('')}>
                  ✕
                </button>
              )}
            </div>
            {ancha ? (
              <div className="admin-menu">
                {listaCategorias}
                {listaProductos}
              </div>
            ) : (
              <div className="admin-menu admin-menu--una">{resultados || elegida ? listaProductos : listaCategorias}</div>
            )}
          </>
        )}
      </main>

      {dialogo?.tipo === 'categoria' && (
        <DialogoCategoria
          categoria={dialogo.categoria}
          alCerrar={() => setDialogo(null)}
          alGuardar={(c) => {
            setDialogo(null);
            void cargar();
            if (!dialogo.categoria) navegar(`/admin/menu/${c.id}`, true);
          }}
        />
      )}
      {dialogo?.tipo === 'producto' && categorias && (
        <DialogoProducto
          producto={dialogo.producto}
          categorias={categorias}
          categoriaInicial={dialogo.categoriaId}
          alCerrar={() => setDialogo(null)}
          alGuardar={() => {
            setDialogo(null);
            void cargar();
          }}
          alQuitar={(p) => setDialogo({ tipo: 'quitar', producto: p })}
        />
      )}
      {dialogo?.tipo === 'quitar' && (
        <Confirmar
          titulo={`¿Quitar «${dialogo.producto.nombre}» del menú?`}
          textoConfirmar="Quitar del menú"
          peligro
          ocupado={ocupado}
          alConfirmar={() => void cambiarActivo(dialogo.producto, false)}
          alCancelar={() => setDialogo(null)}
        >
          <p>Ya no aparecerá para los meseros. Las cuentas y cortes anteriores no cambian. Puedes volver a ponerlo desde «Quitados».</p>
        </Confirmar>
      )}
    </>
  );
}
