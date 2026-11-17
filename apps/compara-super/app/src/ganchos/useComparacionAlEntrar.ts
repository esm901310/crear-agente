import { useEffect, useRef } from 'react';
import { useListaCargada } from './useListaCargada';

/**
 * Para P7 y P8: al abrir la pantalla compara una vez si hace falta
 * (no hay precios de los últimos 30 min o la última consulta falló).
 * Si ya hay una consulta en curso, se reutiliza.
 */
export function useComparacionAlEntrar() {
  const lista = useListaCargada();
  const intentado = useRef(false);
  const { carga, items, compararSiHaceFalta } = lista;
  useEffect(() => {
    if (intentado.current || carga !== 'lista') return;
    intentado.current = true;
    if (items.length > 0) void compararSiHaceFalta();
  }, [carga, items.length, compararSiHaceFalta]);
  return lista;
}
