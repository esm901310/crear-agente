// Panel lateral "Agotados" para Cocina y Caja (docs/diseno.md, 29.2). Entra desde la derecha,
// sin capa oscura: las comandas siguen visibles y actualizándose detrás.
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api';
import { sinAcentos } from '../formato';
import { ponerProducto, textoBusqueda } from '../menu';
import type { CategoriaMenu, Producto } from '../tipos';
import { Interruptor } from './Interruptor';
import { useToast } from './Toast';

interface Props {
  categorias: CategoriaMenu[] | null;
  error: boolean;
  alReintentar: () => void;
  alCerrar: () => void;
}

interface Fila {
  producto: Producto;
  categoria: string;
}

/** Marca un producto como agotado o disponible, con toast y "Deshacer". */
export function useCambiarAgotado() {
  const toast = useToast();
  // Cambios que la pantalla ya muestra pero el servidor no ha confirmado (id → agotado).
  const [pendientes, setPendientes] = useState<ReadonlyMap<number, boolean>>(new Map());

  const cambiar = (p: Producto, agotado: boolean, conDeshacer = true) => {
    setPendientes((m) => new Map(m).set(p.id, agotado));
    api
      .agotado(p.id, agotado)
      .then((nuevo) => {
        ponerProducto(nuevo);
        toast(
          agotado
            ? {
                texto: `${p.nombre}: agotado`,
                accion: conDeshacer ? { texto: 'Deshacer', alTocar: () => cambiar(p, false, false) } : undefined,
                ms: 5000,
              }
            : { texto: `${p.nombre}: disponible otra vez ✓`, tipo: 'ok', ms: 5000 },
        );
      })
      .catch((e: unknown) => toast({ texto: mensajeDeError(e), tipo: 'error' }))
      .finally(() =>
        setPendientes((m) => {
          const copia = new Map(m);
          copia.delete(p.id);
          return copia;
        }),
      );
  };

  const estaAgotado = (p: Producto) => pendientes.get(p.id) ?? p.agotado;
  return { cambiar, estaAgotado };
}

export function PanelAgotados({ categorias, error, alReintentar, alCerrar }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [soloAgotados, setSoloAgotados] = useState(false);
  const { cambiar, estaAgotado } = useCambiarAgotado();
  const ref = useRef<HTMLElement>(null);
  const b = sinAcentos(busqueda);

  // Esc cierra; el foco entra al panel al abrir.
  useEffect(() => {
    ref.current?.querySelector<HTMLInputElement>('input')?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [alCerrar]);

  const todas: Fila[] = useMemo(
    () => (categorias ?? []).flatMap((c) => c.productos.map((p) => ({ producto: p, categoria: c.nombre }))),
    [categorias],
  );
  const agotadosAhora = todas.filter((f) => estaAgotado(f.producto));
  const coincide = (f: Fila) => !b || textoBusqueda(f.producto, f.categoria).includes(b);

  const fila = (f: Fila, conCategoria: boolean) => {
    const agotado = estaAgotado(f.producto);
    return (
      <li key={f.producto.id} className="agotados__fila">
        <span className="agotados__nombre">
          <span className={agotado ? 'agotados__producto agotados__producto--agotado' : 'agotados__producto'}>{f.producto.nombre}</span>
          {conCategoria && <span className="agotados__categoria">{f.categoria}</span>}
        </span>
        <Interruptor
          encendido={!agotado}
          etiqueta={`${f.producto.nombre} disponible`}
          alCambiar={(disponible) => cambiar(f.producto, !disponible)}
        />
      </li>
    );
  };

  const grupos = (categorias ?? [])
    .map((c) => ({
      categoria: c,
      filas: c.productos
        .map((p) => ({ producto: p, categoria: c.nombre }))
        .filter((f) => coincide(f) && (!soloAgotados || estaAgotado(f.producto))),
    }))
    .filter((g) => g.filas.length > 0);
  const agotadosVisibles = agotadosAhora.filter(coincide);

  return (
    <aside ref={ref} className="panel-lateral" aria-labelledby="titulo-agotados" role="complementary">
      <div className="panel-lateral__cabeza">
        <div className="panel-lateral__fila">
          <h2 id="titulo-agotados" className="titulo-xl">
            Agotados
          </h2>
          <button type="button" className="boton boton--secundario boton--chico" onClick={alCerrar}>
            ✕ Cerrar
          </button>
        </div>
        <p className="texto-2 texto-s">Lo que marques aquí no lo podrán pedir los meseros.</p>
        <div className="buscador buscador--chico">
          <span className="buscador__icono" aria-hidden="true">
            🔍
          </span>
          <input
            className="buscador__entrada"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto"
            aria-label="Buscar producto"
            autoComplete="off"
          />
          {busqueda && (
            <button type="button" className="buscador__borrar" aria-label="Borrar búsqueda" onClick={() => setBusqueda('')}>
              ✕
            </button>
          )}
        </div>
        <div className="chips" role="group" aria-label="Filtro">
          <button type="button" className="chip" aria-pressed={!soloAgotados} onClick={() => setSoloAgotados(false)}>
            Todos
          </button>
          <button type="button" className="chip" aria-pressed={soloAgotados} onClick={() => setSoloAgotados(true)}>
            Solo agotados ({agotadosAhora.length})
          </button>
        </div>
      </div>
      <div className="panel-lateral__scroll">
        {!categorias ? (
          error ? (
            <div className="vacio">
              <p>No pudimos cargar el menú. Revisa la conexión.</p>
              <button type="button" className="boton boton--primario" onClick={alReintentar}>
                Reintentar
              </button>
            </div>
          ) : (
            <p className="texto-2">Cargando…</p>
          )
        ) : (
          <>
            {!soloAgotados && agotadosVisibles.length > 0 && (
              <section aria-labelledby="titulo-agotados-ahora">
                <h3 id="titulo-agotados-ahora" className="agotados__grupo">
                  Agotados ahora
                </h3>
                <ul>{agotadosVisibles.map((f) => fila(f, true))}</ul>
              </section>
            )}
            {grupos.length === 0 ? (
              <p className="texto-2 agotados__vacio">
                {soloAgotados && !b ? 'No hay productos agotados.' : `No encontramos «${busqueda.trim()}».`}
              </p>
            ) : (
              grupos.map((g) => (
                <section key={g.categoria.id} aria-label={g.categoria.nombre}>
                  <h3 className="agotados__grupo">{g.categoria.nombre}</h3>
                  <ul>{g.filas.map((f) => fila(f, false))}</ul>
                </section>
              ))
            )}
          </>
        )}
      </div>
    </aside>
  );
}
