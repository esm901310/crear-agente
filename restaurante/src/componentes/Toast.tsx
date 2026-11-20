// Avisos cortos abajo al centro. Solo uno a la vez: el nuevo reemplaza al anterior.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export interface ToastDatos {
  texto: string;
  tipo?: 'normal' | 'ok' | 'error';
  accion?: { texto: string; alTocar: () => void };
  /** Duración en ms. Por omisión 3 s, o 5 s si trae botón. */
  ms?: number;
}

type Mostrar = (t: ToastDatos) => void;
const ContextoToast = createContext<Mostrar>(() => {});

export function useToast(): Mostrar {
  return useContext(ContextoToast);
}

export function ProveedorToast({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastDatos & { id: number }) | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const contador = useRef(0);

  const mostrar = useCallback<Mostrar>((t) => {
    contador.current += 1;
    setToast({ ...t, id: contador.current });
  }, []);

  useEffect(() => {
    clearTimeout(temporizador.current);
    if (!toast) return;
    const ms = toast.ms ?? (toast.accion ? 5000 : 3000);
    temporizador.current = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(temporizador.current);
  }, [toast]);

  const contenido = (t: ToastDatos & { id: number }) => (
    <div key={t.id} className={`toast toast--${t.tipo ?? 'normal'}`}>
      <span>{t.texto}</span>
      {t.accion && (
        <button
          type="button"
          className="toast__accion"
          onClick={() => {
            t.accion?.alTocar();
            setToast(null);
          }}
        >
          {t.accion.texto}
        </button>
      )}
    </div>
  );

  return (
    <ContextoToast.Provider value={mostrar}>
      {children}
      <div className="toast-zona" aria-live="polite">
        {toast && toast.tipo !== 'error' && contenido(toast)}
      </div>
      <div className="toast-zona" aria-live="assertive">
        {toast && toast.tipo === 'error' && contenido(toast)}
      </div>
    </ContextoToast.Provider>
  );
}
