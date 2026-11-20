// A4 — Nuevo usuario (nombre, rol y PIN) o editar (nombre y rol). Docs/diseno.md, 30.4.
import { useState } from 'react';
import { api, ApiError, mensajeDeError } from '../../api';
import { BotonAccion } from '../../componentes/BotonAccion';
import { Confirmar } from '../../componentes/Confirmar';
import { Dialogo } from '../../componentes/Dialogo';
import { useToast } from '../../componentes/Toast';
import { NOMBRE_ROL, type Rol, type UsuarioAdmin } from '../../tipos';
import { CampoPin, pinFacil } from './CampoPin';

const NOMBRE_MAX = 60;

const ROLES: { rol: Rol; descripcion: string }[] = [
  { rol: 'mesero', descripcion: 'Toma pedidos en las mesas' },
  { rol: 'cocina', descripcion: 'Ve las comandas y marca agotados' },
  { rol: 'caja', descripcion: 'Cobra, corte del día y agotados' },
  { rol: 'dueno', descripcion: 'Todo, incluido este panel' },
];

/** "en 1 aparato" / "en 2 aparatos". */
export function enAparatos(n: number): string {
  return `en ${n} ${n === 1 ? 'aparato' : 'aparatos'}`;
}

interface Props {
  /** null = nuevo. */
  usuario: UsuarioAdmin | null;
  /** Razón por la que no se le puede cambiar el rol (uno mismo o último dueño), o null. */
  rolBloqueado: string | null;
  alGuardar: () => void;
  alCerrar: () => void;
}

type Errores = Partial<Record<'nombre' | 'pin' | 'pin2', string>>;

export function DialogoUsuario({ usuario, rolBloqueado, alGuardar, alCerrar }: Props) {
  const toast = useToast();
  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [rol, setRol] = useState<Rol>(usuario?.rol ?? 'mesero');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [errores, setErrores] = useState<Errores>({});
  const [guardando, setGuardando] = useState(false);
  const [confirmarRol, setConfirmarRol] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    const limpio = nombre.trim().replace(/\s+/g, ' ');
    try {
      if (usuario) {
        await api.editarUsuario(usuario.id, { nombre: limpio, ...(rol !== usuario.rol ? { rol } : {}) });
        toast({ texto: `${limpio} guardado ✓`, tipo: 'ok' });
      } else {
        await api.crearUsuario(limpio, rol, pin);
        toast({ texto: `Usuario ${limpio} creado ✓`, tipo: 'ok' });
      }
      alGuardar();
    } catch (e) {
      setGuardando(false);
      setConfirmarRol(false);
      if (e instanceof ApiError && e.status === 409 && /existe/i.test(e.message)) {
        setErrores({ nombre: 'Ya hay un usuario activo con ese nombre.' });
        document.getElementById('usuario-nombre')?.focus();
      } else toast({ texto: mensajeDeError(e), tipo: 'error' });
    }
  };

  const alEnviar = () => {
    const e: Errores = {};
    if (!nombre.trim()) e.nombre = 'Escribe el nombre.';
    if (!usuario) {
      if (!/^\d{4}$/.test(pin)) e.pin = 'El PIN debe tener 4 números.';
      else if (pin2 !== pin) e.pin2 = 'Los PIN no coinciden.';
    }
    setErrores(e);
    const primero = (['nombre', 'pin', 'pin2'] as const).find((k) => e[k]);
    if (primero) {
      document.getElementById(primero === 'nombre' ? 'usuario-nombre' : primero === 'pin' ? 'usuario-pin' : 'usuario-pin2')?.focus();
      return;
    }
    if (usuario && rol !== usuario.rol) setConfirmarRol(true);
    else void guardar();
  };

  if (confirmarRol && usuario) {
    return (
      <Confirmar
        titulo={`¿Cambiar a ${usuario.nombre} de ${NOMBRE_ROL[usuario.rol]} a ${NOMBRE_ROL[rol]}?`}
        textoConfirmar="Cambiar rol"
        ocupado={guardando}
        alConfirmar={() => void guardar()}
        alCancelar={() => setConfirmarRol(false)}
      >
        <p>
          {usuario.sesiones_abiertas > 0
            ? `Se cerrará su sesión ${enAparatos(usuario.sesiones_abiertas)} y tendrá que volver a entrar.`
            : 'La próxima vez que entre ya tendrá el rol nuevo.'}
        </p>
      </Confirmar>
    );
  }

  const titulo = usuario ? `Editar · ${usuario.nombre}` : 'Nuevo usuario';
  return (
    <Dialogo titulo={titulo} alCerrar={() => !guardando && alCerrar()} className="dialogo--medio">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          alEnviar();
        }}
      >
        <h2 className="dialogo__titulo">{titulo}</h2>
        <div className="campo">
          <label className="campo__etiqueta" htmlFor="usuario-nombre">
            Nombre
          </label>
          <input
            id="usuario-nombre"
            className="campo__entrada"
            value={nombre}
            maxLength={NOMBRE_MAX}
            autoFocus
            aria-invalid={!!errores.nombre}
            aria-describedby="usuario-nombre-pie"
            onChange={(e) => {
              setNombre(e.target.value);
              setErrores((x) => ({ ...x, nombre: undefined }));
            }}
          />
          <p id="usuario-nombre-pie" className="campo__pie">
            {errores.nombre ? (
              <span className="campo__error">{errores.nombre}</span>
            ) : (
              <span className="ayuda">Así aparecerá en la pantalla de entrada.</span>
            )}
          </p>
        </div>

        <fieldset className="campo" disabled={rolBloqueado !== null}>
          <legend className="campo__etiqueta">Rol</legend>
          <div className="roles" role="radiogroup" aria-label="Rol">
            {ROLES.map((r) => (
              <label key={r.rol} className={rol === r.rol ? 'rol-opcion rol-opcion--elegida' : 'rol-opcion'}>
                <input type="radio" name="rol" value={r.rol} checked={rol === r.rol} onChange={() => setRol(r.rol)} />
                <span className="rol-opcion__texto">
                  <span className="rol-opcion__nombre">{NOMBRE_ROL[r.rol]}</span>
                  <span className="rol-opcion__descripcion">{r.descripcion}</span>
                </span>
              </label>
            ))}
          </div>
          {rolBloqueado && <p className="razon">{rolBloqueado}</p>}
        </fieldset>

        {!usuario && (
          <>
            <CampoPin
              id="usuario-pin"
              etiqueta="PIN (4 números)"
              valor={pin}
              invalido={!!errores.pin}
              describedBy="usuario-pin-pie"
              alCambiar={(p) => {
                setPin(p);
                setErrores((x) => ({ ...x, pin: undefined }));
              }}
            />
            <div id="usuario-pin-pie">
              {errores.pin && <p className="campo__error">{errores.pin}</p>}
              {pinFacil(pin) && (
                <p className="aviso aviso--alerta" role="status">
                  Ese PIN es fácil de adivinar. Mejor usa otro.
                </p>
              )}
            </div>
            <CampoPin
              id="usuario-pin2"
              etiqueta="Repite el PIN"
              valor={pin2}
              invalido={!!errores.pin2}
              describedBy="usuario-pin2-pie"
              alCambiar={(p) => {
                setPin2(p);
                setErrores((x) => ({ ...x, pin2: undefined }));
              }}
            />
            <p id="usuario-pin2-pie" className="campo__error">
              {errores.pin2}
            </p>
          </>
        )}

        <div className="dialogo__botones">
          <button type="button" className="boton boton--secundario" onClick={alCerrar} disabled={guardando}>
            Cancelar
          </button>
          <BotonAccion type="submit" className="boton boton--primario" ocupado={guardando} textoOcupado="Guardando…">
            {usuario ? 'Guardar' : 'Crear usuario'}
          </BotonAccion>
        </div>
      </form>
    </Dialogo>
  );
}
