// Hora actual que se actualiza sola cada `cadaMs` (para "hace 5 min").
import { useEffect, useState } from 'react';

export function useAhora(cadaMs = 30000): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), cadaMs);
    return () => clearInterval(id);
  }, [cadaMs]);
  return ahora;
}
