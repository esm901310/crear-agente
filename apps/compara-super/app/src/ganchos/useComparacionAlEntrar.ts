import { useEffect, useRef } from 'react';
import { useListaCargada } from './useListaCargada';

/**
 * Para P7 y P8: si al entrar todavía no hay precios de hoy (o la última vez
 * falló), vuelve a comparar una vez.
 */
export function useComparacionAlEntrar() {
  const lista = useListaCargada();
  const intentado = useRef(false);
  const { carga, estadoComparacion, items, comparar } = lista;
  useEffect(() => {
    if (intentado.current || carga !== 'lista') return;
    intentado.current = true;
    if (items.length > 0 && (estadoComparacion === 'inactivo' || estadoComparacion === 'error')) {
      void comparar();
    }
  }, [carga, estadoComparacion, items.length, comparar]);
  return lista;
}
