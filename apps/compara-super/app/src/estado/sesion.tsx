import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api';
import { registrarAlPerderSesion, type Usuario } from '../api/cliente';

const CLAVE_USUARIO = 'comparasuper-usuario';

interface ValorSesion {
  usuario: Usuario | null;
  /** true mientras se pregunta al servidor si hay sesión. */
  verificando: boolean;
  iniciar(usuario: Usuario): void;
  salir(): Promise<void>;
  borrarCuenta(): Promise<void>;
}

const ContextoSesion = createContext<ValorSesion | null>(null);

function usuarioGuardado(): Usuario | null {
  try {
    const crudo = localStorage.getItem(CLAVE_USUARIO);
    return crudo ? (JSON.parse(crudo) as Usuario) : null;
  } catch {
    return null;
  }
}

function guardarUsuario(u: Usuario | null) {
  if (u) localStorage.setItem(CLAVE_USUARIO, JSON.stringify(u));
  else localStorage.removeItem(CLAVE_USUARIO);
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    let vigente = true;
    api
      .yo()
      .then((u) => {
        if (!vigente) return;
        setUsuario(u);
        guardarUsuario(u);
      })
      .catch(() => {
        // Sin conexión: usamos la última sesión conocida para mostrar la lista guardada.
        if (vigente) setUsuario(usuarioGuardado());
      })
      .finally(() => vigente && setVerificando(false));
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    registrarAlPerderSesion(() => {
      setUsuario(null);
      guardarUsuario(null);
    });
    return () => registrarAlPerderSesion(null);
  }, []);

  const iniciar = useCallback((u: Usuario) => {
    setUsuario(u);
    guardarUsuario(u);
  }, []);

  const salir = useCallback(async () => {
    await api.salir();
    setUsuario(null);
    guardarUsuario(null);
  }, []);

  const borrarCuenta = useCallback(async () => {
    await api.borrarCuenta();
    setUsuario(null);
    guardarUsuario(null);
  }, []);

  const valor = useMemo(
    () => ({ usuario, verificando, iniciar, salir, borrarCuenta }),
    [usuario, verificando, iniciar, salir, borrarCuenta],
  );
  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

export function useSesion(): ValorSesion {
  const v = useContext(ContextoSesion);
  if (!v) throw new Error('useSesion debe usarse dentro de ProveedorSesion');
  return v;
}
