import { useCallback, useState } from 'react';
import type { Edicion } from '../lib/types';

const MAX_PASOS = 100;

interface Estado {
  pasos: Edicion[][];
  indice: number;
}

/** Historial de cambios de todo el documento (deshacer / rehacer). */
export function useHistorial() {
  const [estado, setEstado] = useState<Estado>({ pasos: [[]], indice: 0 });

  const ediciones = estado.pasos[estado.indice] ?? [];

  const registrar = useCallback((nuevas: Edicion[]) => {
    setEstado((e) => {
      const pasos = [...e.pasos.slice(0, e.indice + 1), nuevas];
      const sobran = Math.max(0, pasos.length - MAX_PASOS);
      return { pasos: pasos.slice(sobran), indice: pasos.length - 1 - sobran };
    });
  }, []);

  const deshacer = useCallback(() => setEstado((e) => ({ ...e, indice: Math.max(0, e.indice - 1) })), []);
  const rehacer = useCallback(
    () => setEstado((e) => ({ ...e, indice: Math.min(e.pasos.length - 1, e.indice + 1) })),
    [],
  );
  const reiniciar = useCallback(() => setEstado({ pasos: [[]], indice: 0 }), []);

  return {
    ediciones,
    registrar,
    deshacer,
    rehacer,
    reiniciar,
    puedeDeshacer: estado.indice > 0,
    puedeRehacer: estado.indice < estado.pasos.length - 1,
  };
}

export type Historial = ReturnType<typeof useHistorial>;
