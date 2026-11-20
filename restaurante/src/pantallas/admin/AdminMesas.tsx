// A3 — Administrar · Mesas: agregar, renombrar, desactivar/activar y cambiar el orden
// (con POST /api/admin/mesas/orden, extra del servidor). Docs/diseno.md, 30.3.
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, mensajeDeError } from '../../api';
import { Cargando } from '../../componentes/Cargando';
import { Confirmar } from '../../componentes/Confirmar';
import { Encabezado } from '../../componentes/Encabezado';
import { Insignia } from '../../componentes/Insignia';
import { useToast } from '../../componentes/Toast';
import type { MesaAdmin } from '../../tipos';
import { DialogoNombre } from './DialogoNombre';
import { FlechasOrden, enfocarFlecha, mover } from './FlechasOrden';
import { PestanasAdmin } from './PestanasAdmin';

type DialogoAbierto = { tipo: 'agregar' } | { tipo: 'renombrar'; mesa: MesaAdmin } | { tipo: 'desactivar'; mesa: MesaAdmin } | null;

/** Siguiente nombre sugerido: "Mesa 16" si la más alta es "Mesa 15". */
function siguienteNombre(mesas: MesaAdmin[]): string {
  const numeros = mesas
    .filter((m) => m.activa)
    .map((m) => /^mesa\s+(\d+)$/i.exec(m.nombre.trim())?.[1])
    .filter((n): n is string => !!n)
    .map(Number);
  return `Mesa ${numeros.length > 0 ? Math.max(...numeros) + 1 : mesas.length + 1}`;
}

/** Activas en su orden y desactivadas al final. */
function ordenar(mesas: MesaAdmin[]): MesaAdmin[] {
  return [...mesas.filter((m) => m.activa), ...mesas.filter((m) => !m.activa)];
}

export function AdminMesas() {
  const toast = useToast();
  const [mesas, setMesas] = useState<MesaAdmin[] | null>(null);
  const [error, setError] = useState(false);
  const [dialogo, setDialogo] = useState<DialogoAbierto>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setMesas(ordenar(await api.adminMesas()));
      setError(false);
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => void cargar(), [cargar]);

  const activas = mesas?.filter((m) => m.activa) ?? [];

  const moverMesa = (i: number, delta: -1 | 1) => {
    if (!mesas) return;
    const antes = mesas;
    const nuevasActivas = mover(activas, i, delta);
    const nuevas = [...nuevasActivas, ...mesas.filter((m) => !m.activa)];
    setMesas(nuevas);
    enfocarFlecha('mesa', activas[i].id, delta);
    api.ordenMesas(nuevas.map((m) => m.id)).catch(() => {
      setMesas(antes);
      toast({ texto: 'No se pudo cambiar el orden. Intenta de nuevo.', tipo: 'error' });
    });
  };

  const desactivar = async (m: MesaAdmin) => {
    setOcupado(true);
    try {
      await api.editarMesa(m.id, { activa: false });
      toast({ texto: `${m.nombre} desactivada`, tipo: 'ok' });
    } catch (e) {
      toast({ texto: mensajeDeError(e), tipo: 'error' });
    } finally {
      setOcupado(false);
      setDialogo(null);
      void cargar();
    }
  };

  const activar = async (m: MesaAdmin) => {
    try {
      await api.editarMesa(m.id, { activa: true });
      toast({ texto: `${m.nombre} activa otra vez ✓`, tipo: 'ok' });
    } catch (e) {
      toast({ texto: e instanceof ApiError && e.status === 409 && /existe/i.test(e.message) ? 'Ya existe una mesa con ese nombre.' : mensajeDeError(e), tipo: 'error' });
    }
    void cargar();
  };

  return (
    <>
      <Encabezado vista="Administrar" />
      <main className="contenido admin">
        <PestanasAdmin actual="mesas" />
        {!mesas ? (
          error ? (
            <div className="vacio">
              <p>No pudimos cargar las mesas. Revisa la conexión.</p>
              <button type="button" className="boton boton--primario" onClick={() => void cargar()}>
                Reintentar
              </button>
            </div>
          ) : (
            <Cargando />
          )
        ) : (
          <section className="admin-mesas" aria-labelledby="titulo-mesas">
            <div className="admin-menu__cabeza">
              <h2 id="titulo-mesas" className="admin-menu__titulo">
                Mesas · {activas.length} {activas.length === 1 ? 'activa' : 'activas'}
              </h2>
              <button type="button" className="boton boton--primario boton--chico" onClick={() => setDialogo({ tipo: 'agregar' })}>
                + Agregar mesa
              </button>
            </div>
            <ul className="lista-admin">
              {mesas.map((m) => {
                const i = activas.indexOf(m);
                return (
                  <li key={m.id} className={`fila-admin fila-mesa ${m.activa ? '' : 'fila-admin--apagada'}`}>
                    {m.activa ? (
                      <FlechasOrden
                        grupo="mesa"
                        id={m.id}
                        nombre={m.nombre}
                        primero={i === 0}
                        ultimo={i === activas.length - 1}
                        alMover={(d) => moverMesa(i, d)}
                      />
                    ) : (
                      <span className="flechas flechas--vacias" aria-hidden="true" />
                    )}
                    <div className="fila-mesa__centro">
                      <span className="fila-mesa__nombre">{m.nombre}</span>
                      {!m.activa ? (
                        <Insignia tipo="neutra">Desactivada</Insignia>
                      ) : m.tiene_cuenta_abierta ? (
                        <Insignia tipo="alerta">Cuenta abierta</Insignia>
                      ) : (
                        <Insignia tipo="ok">Libre</Insignia>
                      )}
                    </div>
                    <div className="fila-mesa__acciones">
                      <span className="fila-mesa__botones">
                        <button type="button" className="boton boton--secundario boton--chico" onClick={() => setDialogo({ tipo: 'renombrar', mesa: m })}>
                          Renombrar<span className="solo-lectores"> {m.nombre}</span>
                        </button>
                        {m.activa ? (
                          <button
                            type="button"
                            className="boton boton--secundario boton--chico boton--peligro-texto"
                            disabled={m.tiene_cuenta_abierta}
                            aria-describedby={m.tiene_cuenta_abierta ? `mesa-razon-${m.id}` : undefined}
                            onClick={() => setDialogo({ tipo: 'desactivar', mesa: m })}
                          >
                            Desactivar<span className="solo-lectores"> {m.nombre}</span>
                          </button>
                        ) : (
                          <button type="button" className="boton boton--secundario boton--chico" onClick={() => void activar(m)}>
                            Activar<span className="solo-lectores"> {m.nombre}</span>
                          </button>
                        )}
                      </span>
                      {m.activa && m.tiene_cuenta_abierta && (
                        <p id={`mesa-razon-${m.id}`} className="razon">
                          Tiene una cuenta abierta. Cóbrala primero.
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>

      {dialogo?.tipo === 'agregar' && mesas && (
        <DialogoNombre
          titulo="Agregar mesa"
          etiqueta="Nombre"
          inicial={siguienteNombre(mesas)}
          textoGuardar="Agregar mesa"
          errorVacio="Escribe el nombre de la mesa."
          errorRepetido="Ya existe una mesa con ese nombre."
          alCerrar={() => setDialogo(null)}
          alGuardar={async (nombre) => {
            const m = await api.crearMesa(nombre);
            setDialogo(null);
            toast({ texto: `${m.nombre} agregada ✓`, tipo: 'ok' });
            void cargar();
          }}
        />
      )}
      {dialogo?.tipo === 'renombrar' && (
        <DialogoNombre
          titulo="Renombrar mesa"
          etiqueta="Nombre de la mesa"
          inicial={dialogo.mesa.nombre}
          textoGuardar="Guardar"
          errorVacio="Escribe el nombre de la mesa."
          errorRepetido="Ya existe una mesa con ese nombre."
          alCerrar={() => setDialogo(null)}
          alGuardar={async (nombre) => {
            await api.editarMesa(dialogo.mesa.id, { nombre });
            setDialogo(null);
            toast({ texto: 'Mesa guardada ✓', tipo: 'ok' });
            void cargar();
          }}
        />
      )}
      {dialogo?.tipo === 'desactivar' && (
        <Confirmar
          titulo={`¿Desactivar ${dialogo.mesa.nombre}?`}
          textoConfirmar="Desactivar"
          peligro
          ocupado={ocupado}
          alConfirmar={() => void desactivar(dialogo.mesa)}
          alCancelar={() => setDialogo(null)}
        >
          <p>Ya no aparecerá en la pantalla de Mesas. Puedes activarla de nuevo cuando quieras.</p>
        </Confirmar>
      )}
    </>
  );
}
