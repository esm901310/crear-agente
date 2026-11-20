// M1 — Mesas: libres y ocupadas de un vistazo.
import { useState } from 'react';
import { api } from '../api';
import { Cargando } from '../componentes/Cargando';
import { Encabezado } from '../componentes/Encabezado';
import { useAhora } from '../hooks/useAhora';
import { usePolling } from '../hooks/usePolling';
import { navegar } from '../hooks/useRuta';
import { mesasConPedido } from '../pedidos';
import { useSesion } from '../sesion';
import { TarjetaMesa } from './TarjetaMesa';

const LLAVE_FILTRO = 'mesas-filtro';
type Filtro = 'todas' | 'mias';

export function Mesas() {
  const { usuario } = useSesion();
  const { datos: mesas, error, cargando, recargar } = usePolling(api.mesas);
  const ahora = useAhora();
  const [filtro, setFiltroEstado] = useState<Filtro>(() =>
    localStorage.getItem(LLAVE_FILTRO) === 'mias' ? 'mias' : 'todas',
  );
  const sinEnviar = mesasConPedido();

  const setFiltro = (f: Filtro) => {
    setFiltroEstado(f);
    localStorage.setItem(LLAVE_FILTRO, f);
  };

  const esMia = (meseroId: number | null) => meseroId !== null && meseroId === usuario.id;
  const libres = mesas?.filter((m) => m.orden_id === null).length ?? 0;
  const ocupadas = (mesas?.length ?? 0) - libres;
  const visibles = mesas?.filter((m) => filtro === 'todas' || (m.orden_id !== null && esMia(m.mesero_id))) ?? [];

  return (
    <>
      <Encabezado vista="Mesas" />
      <main className="contenido">
        {cargando ? (
          <Cargando />
        ) : !mesas ? (
          <div className="vacio">
            <p>{error?.message ?? 'Algo salió mal. Intenta de nuevo.'}</p>
            <button type="button" className="boton boton--primario" onClick={recargar}>
              Reintentar
            </button>
          </div>
        ) : mesas.length === 0 ? (
          <p className="vacio">Todavía no hay mesas registradas. Pide al dueño que las agregue.</p>
        ) : (
          <>
            <div className="mesas-barra">
              <p className="mesas-barra__resumen">
                {libres} {libres === 1 ? 'libre' : 'libres'} · {ocupadas} {ocupadas === 1 ? 'ocupada' : 'ocupadas'}
              </p>
              <div className="chips" role="group" aria-label="Filtrar mesas">
                <button
                  type="button"
                  className="chip"
                  aria-pressed={filtro === 'todas'}
                  onClick={() => setFiltro('todas')}
                >
                  Todas
                </button>
                <button
                  type="button"
                  className="chip"
                  aria-pressed={filtro === 'mias'}
                  onClick={() => setFiltro('mias')}
                >
                  Mis mesas
                </button>
              </div>
            </div>

            {visibles.length === 0 ? (
              <div className="vacio">
                <p>No tienes mesas abiertas. Toca una mesa libre para empezar.</p>
                <button type="button" className="boton boton--secundario" onClick={() => setFiltro('todas')}>
                  Ver todas
                </button>
              </div>
            ) : (
              <ul className="mesas-cuadricula">
                {visibles.map((m) => (
                  <li key={m.id}>
                    <TarjetaMesa
                      mesa={m}
                      mia={esMia(m.mesero_id)}
                      sinEnviar={sinEnviar.has(m.id)}
                      ahora={ahora}
                      alTocar={() => navegar(`/mesas/${m.id}`)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </>
  );
}
