import { useEffect } from 'react';
import { useLista } from '../estado/lista';

/** Pide la lista al servidor la primera vez que una pantalla la necesita. */
export function useListaCargada() {
  const lista = useLista();
  const { carga, cargar } = lista;
  useEffect(() => {
    if (carga === 'inicial') void cargar();
  }, [carga, cargar]);
  return lista;
}
