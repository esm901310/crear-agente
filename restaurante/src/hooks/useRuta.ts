// Navegación por "hash" (#/mesas/3). Sin librerías: cabe en pocas líneas
// y funciona igual en desarrollo y publicado.
import { useSyncExternalStore } from 'react';

function suscribir(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

function leer(): string {
  const h = window.location.hash.replace(/^#/, '');
  return h.startsWith('/') ? h : '/';
}

export function useRuta(): string {
  return useSyncExternalStore(suscribir, leer);
}

/** Cambia de pantalla. Con `reemplazar` no deja la ruta anterior en el historial. */
export function navegar(ruta: string, reemplazar = false): void {
  if (leer() === ruta) return;
  if (reemplazar) {
    history.replaceState(null, '', `#${ruta}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = ruta;
  }
}
