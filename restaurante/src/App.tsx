// Raíz de la app: revisa la sesión guardada, decide qué pantalla mostrar
// según la ruta y el rol, y maneja "Salir".
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, borrarToken, configurarManejadores, guardarToken, leerToken } from './api';
import { Cargando } from './componentes/Cargando';
import { Dialogo } from './componentes/Dialogo';
import { conexion } from './conexion';
import { cancelarCuentasVacias } from './cuentasVacias';
import { useRuta, navegar } from './hooks/useRuta';
import { borrarTodosLosPedidos, mesasConPedido } from './pedidos';
import { Caja } from './pantallas/Caja';
import { CerrarDia } from './pantallas/CerrarDia';
import { CorteCaja } from './pantallas/CorteCaja';
import { CorteDuenio } from './pantallas/CorteDuenio';
import { Historial } from './pantallas/Historial';
import { Propinas } from './pantallas/Propinas';
import { Cocina } from './pantallas/Cocina';
import { ElegirVista } from './pantallas/ElegirVista';
import { Entrada } from './pantallas/Entrada';
import { Mesa } from './pantallas/Mesa';
import { Mesas } from './pantallas/Mesas';
import { ContextoSesion, rutaInicial, type Sesion } from './sesion';
import type { Rol, Usuario } from './tipos';

type EstadoInicio = 'verificando' | 'sin-conexion' | 'listo';

/** Cada cuánto se reintenta sola la conexión al arrancar sin servidor (milisegundos). */
const REINTENTO_INICIO_MS = 4000;

/** Lista de nombres en español: "Mesa 1", "Mesa 1 y Mesa 2", "Mesa 1, Mesa 2 y Mesa 3". */
function unirNombres(nombres: string[]): string {
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

export function App() {
  const ruta = useRuta();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [inicio, setInicio] = useState<EstadoInicio>(() => (leerToken() ? 'verificando' : 'listo'));
  const [sesionVencida, setSesionVencida] = useState(false);
  const [pendientesAlSalir, setPendientesAlSalir] = useState<string[] | null>(null);
  const usuarioRef = useRef(usuario);
  usuarioRef.current = usuario;

  useEffect(() => {
    configurarManejadores({
      sesionVencida: () => {
        setUsuario(null);
        setSesionVencida(true);
        setInicio('listo');
        conexion.reiniciar();
        navegar('/entrar', true);
      },
      sinPermiso: () => {
        const u = usuarioRef.current;
        if (u) navegar(rutaInicial(u.rol), true);
      },
    });
  }, []);

  const verificando = useRef(false);
  /** `silencioso`: reintento automático, sin cambiar a la pantalla de "Cargando". */
  const verificarToken = useCallback((silencioso = false) => {
    if (!leerToken()) {
      setInicio('listo');
      return;
    }
    if (verificando.current) return;
    verificando.current = true;
    if (!silencioso) setInicio('verificando');
    api
      .yo()
      .then((u) => {
        setUsuario(u);
        setInicio('listo');
      })
      .catch((e: unknown) => {
        // 401 ya lo atendió el manejador de sesión vencida.
        if (e instanceof Error && 'status' in e && (e as { status: number }).status === 0) setInicio('sin-conexion');
        else setInicio('listo');
      })
      .finally(() => {
        verificando.current = false;
      });
  }, []);

  useEffect(() => verificarToken(), [verificarToken]);

  // Sin servidor al arrancar: reintentar solo cada pocos segundos (el botón sigue disponible).
  useEffect(() => {
    if (inicio !== 'sin-conexion') return;
    const t = setInterval(() => verificarToken(true), REINTENTO_INICIO_MS);
    return () => clearInterval(t);
  }, [inicio, verificarToken]);

  const cerrarSesion = useCallback(async () => {
    // Antes de soltar la sesión, borrar las cuentas que esta tablet dejó abiertas sin platillos.
    await Promise.race([cancelarCuentasVacias(), new Promise((r) => setTimeout(r, 2500))]);
    api.logout().catch(() => {}); // aunque falle, salimos
    borrarToken();
    setUsuario(null);
    setSesionVencida(false);
    setPendientesAlSalir(null);
    conexion.reiniciar();
    navegar('/entrar');
  }, []);

  const sesion = useMemo<Sesion | null>(() => {
    if (!usuario) return null;
    return {
      usuario,
      salir: () => {
        const pendientes = [...mesasConPedido().values()];
        if (pendientes.length > 0) setPendientesAlSalir(pendientes);
        else void cerrarSesion();
      },
      cambiarVista: () => navegar('/inicio'),
    };
  }, [usuario, cerrarSesion]);

  // Qué pantalla corresponde a la ruta actual (o a dónde hay que mandar al usuario).
  const destino = useMemo(() => elegirPantalla(ruta, usuario?.rol ?? null), [ruta, usuario]);

  useEffect(() => {
    if (inicio !== 'listo') return;
    if (destino.redirigir) navegar(destino.redirigir, true);
  }, [destino, inicio]);

  if (inicio === 'verificando') return <Cargando />;
  if (inicio === 'sin-conexion') {
    return (
      <main className="centro-pantalla">
        <p className="texto-grande">No hay conexión con el servidor.</p>
        <p className="texto-2" aria-live="polite">
          Lo intentamos de nuevo cada pocos segundos.
        </p>
        <button type="button" className="boton boton--primario" onClick={() => verificarToken()}>
          Reintentar
        </button>
      </main>
    );
  }

  if (!usuario || !sesion) {
    return (
      <Entrada
        sesionVencida={sesionVencida}
        alEntrar={(token, u) => {
          guardarToken(token);
          setSesionVencida(false);
          setUsuario(u);
          navegar(rutaInicial(u.rol), true);
        }}
      />
    );
  }

  let pantalla: ReactNode = <Cargando />;
  switch (destino.pantalla) {
    case 'inicio':
      pantalla = <ElegirVista />;
      break;
    case 'mesas':
      pantalla = <Mesas />;
      break;
    case 'mesa':
      pantalla = <Mesa key={destino.id} mesaId={destino.id!} />;
      break;
    case 'cocina':
      pantalla = <Cocina />;
      break;
    case 'caja':
      pantalla = <Caja ordenIdRuta={destino.id ?? null} />;
      break;
    case 'cerrar':
      pantalla = <CerrarDia />;
      break;
    case 'corte':
      pantalla = <CorteCaja />;
      break;
    case 'cortes':
      pantalla = <Historial />;
      break;
    case 'corte-duenio':
      pantalla = <CorteDuenio key={destino.id} jornadaId={destino.id!} />;
      break;
    case 'propinas':
      pantalla = <Propinas />;
      break;
  }

  return (
    <ContextoSesion.Provider value={sesion}>
      {pantalla}
      {pendientesAlSalir && (
        <Dialogo titulo="Tienes pedidos sin enviar" alCerrar={() => setPendientesAlSalir(null)}>
          <h2 className="dialogo__titulo">Tienes pedidos sin enviar</h2>
          <p>
            {unirNombres(pendientesAlSalir)} {pendientesAlSalir.length === 1 ? 'tiene' : 'tienen'} platillos que no se
            han mandado a cocina. Si sales, se borran.
          </p>
          <div className="dialogo__botones">
            <button
              type="button"
              className="boton boton--secundario boton--peligro-texto"
              onClick={() => {
                borrarTodosLosPedidos();
                void cerrarSesion();
              }}
            >
              Salir y borrar
            </button>
            <button type="button" className="boton boton--primario" autoFocus onClick={() => setPendientesAlSalir(null)}>
              Quedarme
            </button>
          </div>
        </Dialogo>
      )}
    </ContextoSesion.Provider>
  );
}

type Pantalla =
  | 'entrar'
  | 'inicio'
  | 'mesas'
  | 'mesa'
  | 'cocina'
  | 'caja'
  | 'cerrar'
  | 'corte'
  | 'cortes'
  | 'corte-duenio'
  | 'propinas';
interface Destino {
  pantalla: Pantalla | null;
  id?: number;
  redirigir?: string;
}

const PERMISOS: Record<Exclude<Pantalla, 'entrar'>, Rol[]> = {
  inicio: ['dueno'],
  mesas: ['mesero', 'dueno'],
  mesa: ['mesero', 'dueno'],
  cocina: ['cocina', 'dueno'],
  caja: ['caja', 'dueno'],
  cerrar: ['caja', 'dueno'],
  corte: ['caja', 'dueno'],
  cortes: ['dueno'],
  'corte-duenio': ['dueno'],
  propinas: ['dueno'],
};

function elegirPantalla(ruta: string, rol: Rol | null): Destino {
  if (!rol) return ruta === '/entrar' ? { pantalla: 'entrar' } : { pantalla: 'entrar', redirigir: '/entrar' };

  const partes = ruta.split('/').filter(Boolean);
  let pantalla: Exclude<Pantalla, 'entrar'> | null = null;
  let id: number | undefined;
  const numero = (t: string | undefined) => (t && /^\d{1,9}$/.test(t) ? Number(t) : undefined);

  if (partes.length === 1 && partes[0] === 'inicio') pantalla = 'inicio';
  else if (partes[0] === 'mesas' && partes.length === 1) pantalla = 'mesas';
  else if (partes[0] === 'mesas' && partes.length === 2 && numero(partes[1])) {
    pantalla = 'mesa';
    id = numero(partes[1]);
  } else if (partes.length === 1 && partes[0] === 'cocina') pantalla = 'cocina';
  else if (partes[0] === 'caja' && partes.length === 1) pantalla = 'caja';
  else if (partes[0] === 'caja' && partes.length === 2 && partes[1] === 'cerrar') pantalla = 'cerrar';
  else if (partes[0] === 'caja' && partes.length === 2 && partes[1] === 'corte') pantalla = 'corte';
  else if (partes[0] === 'caja' && partes.length === 2 && numero(partes[1])) {
    pantalla = 'caja';
    id = numero(partes[1]);
  } else if (partes[0] === 'cortes' && partes.length === 1) pantalla = 'cortes';
  else if (partes[0] === 'cortes' && partes.length === 2 && numero(partes[1])) {
    pantalla = 'corte-duenio';
    id = numero(partes[1]);
  } else if (partes.length === 1 && partes[0] === 'propinas') pantalla = 'propinas';

  if (!pantalla || !PERMISOS[pantalla].includes(rol)) {
    return { pantalla: null, redirigir: rutaInicial(rol) };
  }
  return { pantalla, id };
}
