// Consulta al servidor cada POLLING_MS:
// - no encima peticiones (espera a que termine una antes de programar la siguiente),
// - se pausa cuando la pestaña no está visible y consulta al volver,
// - conserva los últimos datos si falla y avisa al indicador de conexión.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api';
import { POLLING_MS } from '../config';
import { conexion } from '../conexion';

export interface Polling<T> {
  datos: T | undefined;
  /** Error de la última consulta (se borra cuando una sale bien). */
  error: ApiError | null;
  /** true solo mientras no ha llegado la primera respuesta. */
  cargando: boolean;
  /** Pide una consulta inmediata (si hay una en curso, se repite al terminar). */
  recargar: () => void;
}

export function usePolling<T>(consulta: () => Promise<T>, llave: string | number = ''): Polling<T> {
  const [datos, setDatos] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const consultaRef = useRef(consulta);
  consultaRef.current = consulta;
  const recargarRef = useRef<() => void>(() => {});

  useEffect(() => {
    let vivo = true;
    let enCurso = false;
    let repetir = false;
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    setDatos(undefined);
    setError(null);

    const programar = () => {
      clearTimeout(temporizador);
      if (!vivo || document.hidden) return;
      temporizador = setTimeout(ejecutar, POLLING_MS);
    };

    async function ejecutar() {
      if (!vivo) return;
      if (enCurso) {
        repetir = true;
        return;
      }
      clearTimeout(temporizador);
      enCurso = true;
      try {
        const r = await consultaRef.current();
        if (!vivo) return;
        setDatos(r);
        setError(null);
        conexion.exito();
      } catch (e) {
        if (!vivo) return;
        const err = e instanceof ApiError ? e : new ApiError(500, 'Algo salió mal. Intenta de nuevo.');
        setError(err);
        if (err.esRed) conexion.falloDeRed();
      } finally {
        enCurso = false;
      }
      if (!vivo) return;
      if (repetir) {
        repetir = false;
        void ejecutar();
      } else {
        programar();
      }
    }

    const alCambiarVisibilidad = () => {
      if (document.hidden) clearTimeout(temporizador);
      else void ejecutar();
    };

    recargarRef.current = () => void ejecutar();
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    void ejecutar();

    return () => {
      vivo = false;
      clearTimeout(temporizador);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, [llave]);

  const recargar = useCallback(() => recargarRef.current(), []);

  return { datos, error, cargando: datos === undefined && error === null, recargar };
}
