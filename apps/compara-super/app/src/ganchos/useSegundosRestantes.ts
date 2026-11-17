import { useEffect, useState } from 'react';

/** Segundos que faltan para `hasta` (ms). 0 si ya pasó o no hay espera. Se actualiza cada segundo. */
export function useSegundosRestantes(hasta: number | null): number {
  const calcular = () => (hasta ? Math.max(0, Math.ceil((hasta - Date.now()) / 1000)) : 0);
  const [segundos, setSegundos] = useState(calcular);
  useEffect(() => {
    const actualizar = () => setSegundos(hasta ? Math.max(0, Math.ceil((hasta - Date.now()) / 1000)) : 0);
    actualizar();
    if (!hasta) return;
    const id = window.setInterval(actualizar, 1000);
    return () => window.clearInterval(id);
  }, [hasta]);
  return segundos;
}
