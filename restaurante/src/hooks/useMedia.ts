// true si la pantalla cumple la consulta CSS (p. ej. '(min-width: 1024px)').
import { useSyncExternalStore } from 'react';

export function useMedia(consulta: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(consulta);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(consulta).matches,
  );
}
