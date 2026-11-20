// A4 — Administrar · Usuarios: alta con PIN, editar nombre/rol, cambiar PIN y desactivar/activar,
// con las reglas de "uno mismo" y "último dueño activo" visibles. Docs/diseno.md, 30.4.
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, mensajeDeError } from '../../api';
import { Cargando } from '../../componentes/Cargando';
import { Confirmar } from '../../componentes/Confirmar';
import { Encabezado } from '../../componentes/Encabezado';
import { Insignia } from '../../componentes/Insignia';
import { useToast } from '../../componentes/Toast';
import { useMedia } from '../../hooks/useMedia';
import { useSesion } from '../../sesion';
import { NOMBRE_ROL, type UsuarioAdmin } from '../../tipos';
import { DialogoPin } from './DialogoPin';
import { DialogoUsuario, enAparatos } from './DialogoUsuario';
import { PestanasAdmin } from './PestanasAdmin';

type DialogoAbierto =
  | { tipo: 'nuevo' }
  | { tipo: 'editar'; usuario: UsuarioAdmin }
  | { tipo: 'pin'; usuario: UsuarioAdmin }
  | { tipo: 'desactivar'; usuario: UsuarioAdmin }
  | null;

const RAZON_UNO_MISMO = 'No puedes desactivarte ni quitarte el rol de dueño a ti mismo.';
const RAZON_ULTIMO = 'Es el único dueño activo. Agrega otro dueño antes.';

export function AdminUsuarios() {
  const toast = useToast();
  const { usuario: yo, terminarSesion } = useSesion();
  const ancha = useMedia('(min-width: 1024px)');
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[] | null>(null);
  const [error, setError] = useState(false);
  const [dialogo, setDialogo] = useState<DialogoAbierto>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const lista = await api.adminUsuarios();
      setUsuarios([...lista.filter((u) => u.activo), ...lista.filter((u) => !u.activo)]);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => void cargar(), [cargar]);

  const duenosActivos = usuarios?.filter((u) => u.activo && u.rol === 'dueno').length ?? 0;
  /** Razón por la que no se puede desactivar ni cambiar el rol, o null. */
  const bloqueo = (u: UsuarioAdmin): string | null => {
    if (u.id === yo.id) return RAZON_UNO_MISMO;
    if (u.activo && u.rol === 'dueno' && duenosActivos <= 1) return RAZON_ULTIMO;
    return null;
  };

  const desactivar = async (u: UsuarioAdmin) => {
    setOcupado(true);
    try {
      await api.editarUsuario(u.id, { activo: false });
      toast({ texto: `${u.nombre} desactivado`, tipo: 'ok' });
    } catch (e) {
      toast({ texto: mensajeDeError(e), tipo: 'error' });
    } finally {
      setOcupado(false);
      setDialogo(null);
      void cargar();
    }
  };

  const activar = async (u: UsuarioAdmin) => {
    try {
      await api.editarUsuario(u.id, { activo: true });
      toast({ texto: `${u.nombre} activo otra vez ✓`, tipo: 'ok' });
    } catch (e) {
      toast({
        texto: e instanceof ApiError && e.status === 409 && /existe/i.test(e.message) ? 'Ya hay un usuario activo con ese nombre.' : mensajeDeError(e),
        tipo: 'error',
      });
    }
    void cargar();
  };

  const acciones = (u: UsuarioAdmin) => {
    const razon = bloqueo(u);
    if (!u.activo) {
      return (
        <div className="usuario-acciones">
          <button type="button" className="boton boton--secundario boton--chico" onClick={() => void activar(u)}>
            Activar<span className="solo-lectores"> a {u.nombre}</span>
          </button>
        </div>
      );
    }
    return (
      <div className="usuario-acciones">
        <span className="usuario-acciones__botones">
          <button type="button" className="boton boton--secundario boton--chico" onClick={() => setDialogo({ tipo: 'editar', usuario: u })}>
            Editar<span className="solo-lectores"> a {u.nombre}</span>
          </button>
          <button type="button" className="boton boton--secundario boton--chico" onClick={() => setDialogo({ tipo: 'pin', usuario: u })}>
            Cambiar PIN<span className="solo-lectores"> de {u.nombre}</span>
          </button>
          <button
            type="button"
            className="boton boton--secundario boton--chico boton--peligro-texto"
            disabled={razon !== null}
            aria-describedby={razon ? `usuario-razon-${u.id}` : undefined}
            onClick={() => setDialogo({ tipo: 'desactivar', usuario: u })}
          >
            Desactivar<span className="solo-lectores"> a {u.nombre}</span>
          </button>
        </span>
        {razon && (
          <p id={`usuario-razon-${u.id}`} className="razon">
            {razon}
          </p>
        )}
      </div>
    );
  };

  const nombre = (u: UsuarioAdmin) => (
    <span className="usuario-nombre">
      <span className="fuerte-ligero">{u.nombre}</span>
      {u.id === yo.id && <Insignia tipo="neutra">Tú</Insignia>}
    </span>
  );
  const estado = (u: UsuarioAdmin) => (u.activo ? <Insignia tipo="ok">Activo</Insignia> : <Insignia tipo="neutra">Desactivado</Insignia>);
  const conectado = (u: UsuarioAdmin) => (u.activo && u.sesiones_abiertas > 0 ? `En ${u.sesiones_abiertas} ${u.sesiones_abiertas === 1 ? 'aparato' : 'aparatos'}` : '—');

  return (
    <>
      <Encabezado vista="Administrar" />
      <main className="contenido admin">
        <PestanasAdmin actual="usuarios" />
        {!usuarios ? (
          error ? (
            <div className="vacio">
              <p>No pudimos cargar los usuarios. Revisa la conexión.</p>
              <button type="button" className="boton boton--primario" onClick={() => void cargar()}>
                Reintentar
              </button>
            </div>
          ) : (
            <Cargando />
          )
        ) : (
          <section className="admin-usuarios" aria-labelledby="titulo-usuarios">
            <div className="admin-menu__cabeza">
              <h2 id="titulo-usuarios" className="admin-menu__titulo">
                Usuarios
              </h2>
              <button type="button" className="boton boton--primario boton--chico" onClick={() => setDialogo({ tipo: 'nuevo' })}>
                + Nuevo usuario
              </button>
            </div>
            {ancha ? (
              <div className="tarjeta tabla-envoltura">
                <table className="tabla tabla-usuarios">
                  <thead>
                    <tr>
                      <th scope="col">Nombre</th>
                      <th scope="col">Rol</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Conectado</th>
                      <th scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((u) => (
                      <tr key={u.id} className={u.activo ? '' : 'fila-apagada'}>
                        <td>{nombre(u)}</td>
                        <td className="sin-partir">{NOMBRE_ROL[u.rol]}</td>
                        <td>{estado(u)}</td>
                        <td className="sin-partir">{conectado(u)}</td>
                        <td>{acciones(u)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className="lista-admin">
                {usuarios.map((u) => (
                  <li key={u.id} className={`fila-admin fila-usuario ${u.activo ? '' : 'fila-admin--apagada'}`}>
                    <div className="fila-usuario__arriba">
                      {nombre(u)}
                      {estado(u)}
                    </div>
                    <p className="texto-2 texto-s">
                      {NOMBRE_ROL[u.rol]} · {conectado(u) === '—' ? 'Sin conectar' : conectado(u)}
                    </p>
                    {acciones(u)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>

      {dialogo?.tipo === 'nuevo' && (
        <DialogoUsuario
          usuario={null}
          rolBloqueado={null}
          alCerrar={() => setDialogo(null)}
          alGuardar={() => {
            setDialogo(null);
            void cargar();
          }}
        />
      )}
      {dialogo?.tipo === 'editar' && (
        <DialogoUsuario
          usuario={dialogo.usuario}
          rolBloqueado={bloqueo(dialogo.usuario)}
          alCerrar={() => setDialogo(null)}
          alGuardar={() => {
            setDialogo(null);
            void cargar();
          }}
        />
      )}
      {dialogo?.tipo === 'pin' && (
        <DialogoPin
          usuario={dialogo.usuario}
          esUnoMismo={dialogo.usuario.id === yo.id}
          alCerrar={() => setDialogo(null)}
          alCambiado={() => {
            if (dialogo.usuario.id === yo.id) {
              // El servidor ya cerró esta sesión: a la entrada, con el PIN nuevo.
              terminarSesion('Tu PIN cambió. Entra de nuevo con tu PIN nuevo.');
              return;
            }
            setDialogo(null);
            void cargar();
          }}
        />
      )}
      {dialogo?.tipo === 'desactivar' && (
        <Confirmar
          titulo={`¿Desactivar a ${dialogo.usuario.nombre}?`}
          textoConfirmar="Desactivar"
          peligro
          ocupado={ocupado}
          alConfirmar={() => void desactivar(dialogo.usuario)}
          alCancelar={() => setDialogo(null)}
        >
          <p>
            Ya no aparecerá en la pantalla de entrada
            {dialogo.usuario.sesiones_abiertas > 0 ? ` y se cerrará su sesión ${enAparatos(dialogo.usuario.sesiones_abiertas)}` : ''}. Sus
            cuentas y propinas anteriores se conservan.
          </p>
        </Confirmar>
      )}
    </>
  );
}
