import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

interface Aviso {
  id: number;
  mensaje: string;
  accion?: { texto: string; alTocar: () => void };
}

interface ValorAvisos {
  mostrar(mensaje: string, accion?: Aviso['accion']): void;
}

const ContextoAvisos = createContext<ValorAvisos | null>(null);
const DURACION_MS = 4000;

/** Mensajes breves (toast) que aparecen abajo, encima del botón fijo. */
export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const temporizador = useRef<number | undefined>(undefined);
  const pausado = useRef(false);

  const cerrar = useCallback(() => setAviso(null), []);

  const programarCierre = useCallback(() => {
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => {
      if (!pausado.current) cerrar();
    }, DURACION_MS);
  }, [cerrar]);

  const mostrar = useCallback(
    (mensaje: string, accion?: Aviso['accion']) => {
      setAviso({ id: Date.now(), mensaje, accion });
      programarCierre();
    },
    [programarCierre],
  );

  useEffect(() => () => window.clearTimeout(temporizador.current), []);

  const valor = useMemo(() => ({ mostrar }), [mostrar]);

  return (
    <ContextoAvisos.Provider value={valor}>
      {children}
      <div className="zona-aviso" role="status" aria-live="polite">
        {aviso && (
          <div
            className="aviso-breve"
            key={aviso.id}
            onFocus={() => (pausado.current = true)}
            onBlur={() => {
              pausado.current = false;
              programarCierre();
            }}
          >
            <span>{aviso.mensaje}</span>
            {aviso.accion && (
              <button
                type="button"
                className="aviso-breve-accion"
                onClick={() => {
                  aviso.accion?.alTocar();
                  cerrar();
                }}
              >
                {aviso.accion.texto}
              </button>
            )}
          </div>
        )}
      </div>
    </ContextoAvisos.Provider>
  );
}

export function useAvisos(): ValorAvisos {
  const v = useContext(ContextoAvisos);
  if (!v) throw new Error('useAvisos debe usarse dentro de ProveedorAvisos');
  return v;
}
