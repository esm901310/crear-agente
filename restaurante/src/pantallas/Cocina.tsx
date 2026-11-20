// K1 — Cocina: comandas por preparar (más antigua primero) y listas recientes.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api';
import { BotonAgotados } from '../componentes/BotonAgotados';
import { Cargando } from '../componentes/Cargando';
import { Encabezado } from '../componentes/Encabezado';
import { useToast } from '../componentes/Toast';
import { DESHACER_COCINA_MS } from '../config';
import { useAhora } from '../hooks/useAhora';
import { usePolling } from '../hooks/usePolling';
import type { Comanda } from '../tipos';
import { TarjetaComanda } from './TarjetaComanda';
import { TarjetaLista } from './TarjetaLista';

type Estado = Comanda['estado'];

/** Mantiene la pantalla encendida si el navegador lo permite. */
function useWakeLock() {
  useEffect(() => {
    let candado: { release: () => Promise<void> } | null = null;
    const pedir = async () => {
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<typeof candado> } })
          .wakeLock;
        if (wl && !document.hidden) candado = await wl.request('screen');
      } catch {
        // Si no se puede, se ignora sin mensaje.
      }
    };
    void pedir();
    const alVolver = () => {
      if (!document.hidden) void pedir();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      void candado?.release().catch(() => {});
    };
  }, []);
}

export function Cocina() {
  const toast = useToast();
  // Se guarda cuándo empezó cada consulta para saber si ya refleja las últimas acciones.
  const consulta = useCallback(async () => {
    const inicio = Date.now();
    return { inicio, comandas: await api.cocina() };
  }, []);
  const { datos: respuesta, error, cargando, recargar } = usePolling(consulta);
  const datos = respuesta?.comandas;
  const ahora = useAhora(30000);
  useWakeLock();

  // Cambios que la pantalla ya muestra pero el servidor aún no confirma (id → estado deseado).
  const [cambios, setCambios] = useState<Map<number, Estado>>(new Map());
  const [verListas, setVerListas] = useState(false);

  // Las acciones de una misma comanda van en fila (una petición a la vez, en el orden
  // en que se tocaron). Así "Listo" y luego "Deshacer" llegan al servidor en ese orden.
  const colas = useRef(new Map<number, Promise<void>>());
  /** Peticiones aún sin respuesta por comanda. */
  const enVuelo = useRef(new Map<number, number>());
  /** Cuándo terminó la última petición de cada comanda. */
  const terminada = useRef(new Map<number, number>());

  // El servidor manda: si una comanda ya no tiene peticiones en curso y llega una
  // consulta que empezó después de la última respuesta, se olvida el cambio local.
  useEffect(() => {
    if (!respuesta) return;
    setCambios((actual) => {
      if (actual.size === 0) return actual;
      const copia = new Map(actual);
      for (const [id, estado] of actual) {
        if (enVuelo.current.has(id)) continue;
        const c = respuesta.comandas.find((x) => x.id === id);
        const coincide = (c && c.estado === estado) || (!c && estado === 'listo');
        if (coincide || respuesta.inicio >= (terminada.current.get(id) ?? 0)) copia.delete(id);
      }
      return copia.size === actual.size ? actual : copia;
    });
  }, [respuesta]);

  // Destello de 1 s en las comandas que acaban de llegar.
  const vistas = useRef<Set<number> | null>(null);
  const [nuevas, setNuevas] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (!datos) return;
    const ids = datos.filter((c) => c.estado === 'pendiente').map((c) => c.id);
    if (vistas.current === null) {
      vistas.current = new Set(datos.map((c) => c.id));
      return;
    }
    const llegaron = ids.filter((id) => !vistas.current!.has(id));
    datos.forEach((c) => vistas.current!.add(c.id));
    if (llegaron.length === 0) return;
    setNuevas((s) => new Set([...s, ...llegaron]));
    setTimeout(() => {
      setNuevas((s) => {
        const copia = new Set(s);
        llegaron.forEach((id) => copia.delete(id));
        return copia;
      });
    }, 1100);
  }, [datos]);

  const conCambios = (datos ?? []).map((c) => (cambios.has(c.id) ? { ...c, estado: cambios.get(c.id)! } : c));
  const pendientes = conCambios
    .filter((c) => c.estado === 'pendiente')
    .sort((a, b) => a.creada.localeCompare(b.creada) || a.id - b.id);
  const listas = conCambios
    .filter((c) => c.estado === 'listo')
    .sort((a, b) => (b.listo_en ?? '9').localeCompare(a.listo_en ?? '9'));

  const cambiarEstado = (c: Comanda, estado: Estado) => {
    const id = c.id;
    setCambios((m) => new Map(m).set(id, estado));
    enVuelo.current.set(id, (enVuelo.current.get(id) ?? 0) + 1);
    const anterior = colas.current.get(id) ?? Promise.resolve();
    const paso = anterior.then(async () => {
      try {
        if (estado === 'listo') await api.marcarListo(id);
        else await api.marcarPendiente(id);
      } catch (e) {
        // Si después de esta acción hay otra en fila, esa decide cómo se ve la comanda.
        if (enVuelo.current.get(id) === 1) {
          setCambios((m) => {
            const copia = new Map(m);
            copia.delete(id);
            return copia;
          });
        }
        toast({ texto: mensajeDeError(e), tipo: 'error' });
      } finally {
        const quedan = (enVuelo.current.get(id) ?? 1) - 1;
        if (quedan > 0) {
          enVuelo.current.set(id, quedan);
        } else {
          enVuelo.current.delete(id);
          colas.current.delete(id);
          terminada.current.set(id, Date.now());
          recargar();
        }
      }
    });
    colas.current.set(id, paso);
  };

  const marcarListo = (c: Comanda) => {
    // La tarjeta sale de inmediato; si el servidor falla, regresa y el toast de error reemplaza a este.
    toast({
      texto: `${c.mesa_nombre} lista ✓`,
      tipo: 'ok',
      ms: DESHACER_COCINA_MS,
      accion: { texto: 'Deshacer', alTocar: () => cambiarEstado(c, 'pendiente') },
    });
    cambiarEstado(c, 'listo');
  };

  const titulo = (
    <>
      Cocina — {pendientes.length} {pendientes.length === 1 ? 'pendiente' : 'pendientes'}
    </>
  );

  return (
    <>
      <Encabezado vista={datos ? titulo : 'Cocina'} acciones={<BotonAgotados grande />} />
      <main className="contenido cocina">
        {cargando ? (
          <Cargando />
        ) : !datos ? (
          <div className="vacio">
            <p>{error?.message ?? 'Algo salió mal. Intenta de nuevo.'}</p>
            <button type="button" className="boton boton--primario" onClick={recargar}>
              Reintentar
            </button>
          </div>
        ) : (
          <>
            <h2 className="solo-lectores">Por preparar</h2>
            {pendientes.length === 0 ? (
              <div className="cocina__vacia">
                <p className="cocina__vacia-titulo">Todo al día ✓</p>
                <p className="texto-2">Las comandas nuevas aparecerán aquí.</p>
              </div>
            ) : (
              <ul className="cocina__pendientes">
                {pendientes.map((c) => (
                  <li key={c.id}>
                    <TarjetaComanda comanda={c} ahora={ahora} nueva={nuevas.has(c.id)} alListo={() => marcarListo(c)} />
                  </li>
                ))}
              </ul>
            )}

            <section className="cocina__listas" aria-labelledby="titulo-listas">
              <h2 id="titulo-listas" className="titulo-seccion">
                Listas (últimos 30 min)
              </h2>
              <button
                type="button"
                className="boton boton--secundario"
                aria-expanded={verListas}
                aria-controls="lista-listas"
                onClick={() => setVerListas((v) => !v)}
              >
                {verListas ? `Ocultar listas (${listas.length}) ▴` : `Ver listas (${listas.length}) ▾`}
              </button>
              {verListas && (
                <ul id="lista-listas" className="cocina__listas-cuadricula">
                  {listas.length === 0 && <li className="texto-2">No hay comandas listas recientes.</li>}
                  {listas.map((c) => (
                    <li key={c.id}>
                      <TarjetaLista comanda={c} alRegresar={() => cambiarEstado(c, 'pendiente')} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
