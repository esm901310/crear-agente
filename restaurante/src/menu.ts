// Menú público (GET /api/menu) compartido por las pantallas: se guarda en memoria mientras
// la app esté abierta y se vuelve a pedir cada MENU_RECARGA_MS para enterarse de los agotados.
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { api } from './api';
import { MENU_RECARGA_MS } from './config';
import { sinAcentos } from './formato';
import type { CategoriaMenu, Producto } from './tipos';

interface EstadoMenu {
  categorias: CategoriaMenu[] | null;
  /** true si la última carga falló y no hay nada en memoria. */
  error: boolean;
}

let estado: EstadoMenu = { categorias: null, error: false };
const oyentes = new Set<() => void>();
let enCurso: Promise<void> | null = null;

function cambiar(nuevo: EstadoMenu) {
  estado = nuevo;
  oyentes.forEach((o) => o());
}

/** Pide el menú al servidor (si ya hay una petición en curso, espera esa). */
export function cargarMenu(): Promise<void> {
  if (enCurso) return enCurso;
  enCurso = api
    .menu()
    .then((r) => cambiar({ categorias: r.categorias, error: false }))
    .catch(() => {
      if (!estado.categorias) cambiar({ categorias: null, error: true });
    })
    .finally(() => {
      enCurso = null;
    });
  return enCurso;
}

/** Cambia un producto en memoria (p. ej. la respuesta de marcar agotado) sin esperar la recarga. */
export function ponerProducto(p: Producto): void {
  if (!estado.categorias) return;
  cambiar({
    ...estado,
    categorias: estado.categorias.map((c) => ({
      ...c,
      productos: c.productos.map((x) => (x.id === p.id ? { ...x, ...p } : x)),
    })),
  });
}

/** Olvida el menú guardado (al salir de la sesión). */
export function olvidarMenu(): void {
  cambiar({ categorias: null, error: false });
}

function suscribir(cb: () => void) {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}

/**
 * Menú en memoria. Con `recargar` activo, lo pide al montar y cada MENU_RECARGA_MS
 * (pausado mientras la pestaña no se ve).
 */
export function useMenu(recargar = true) {
  const e = useSyncExternalStore(suscribir, () => estado);
  useEffect(() => {
    if (!recargar) return;
    void cargarMenu();
    const t = setInterval(() => {
      if (!document.hidden) void cargarMenu();
    }, MENU_RECARGA_MS);
    const alVolver = () => {
      if (!document.hidden) void cargarMenu();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [recargar]);
  const reintentar = useCallback(() => void cargarMenu(), []);
  return { categorias: e.categorias, error: e.error, reintentar };
}

/** Texto donde se busca un producto: nombre, descripción, opciones y categoría (sin acentos). */
export function textoBusqueda(p: Producto, categoria: string): string {
  return sinAcentos([p.nombre, p.descripcion ?? '', ...p.opciones, ...p.variantes.map((v) => v.nombre), categoria].join(' | '));
}

/** Opción que coincide con la búsqueda (para mostrar "Opción: Imperial"), si el nombre no coincide. */
export function opcionQueCoincide(p: Producto, busqueda: string): string | null {
  const b = sinAcentos(busqueda);
  if (!b || sinAcentos(p.nombre).includes(b)) return null;
  return p.opciones.find((o) => sinAcentos(o).includes(b)) ?? null;
}

/** "tallas" si las variantes empiezan con "Talla"; si no, "tamaños". */
export function sustantivoVariantes(p: Producto, plural = true): string {
  const tallas = p.variantes.length > 0 && p.variantes.every((v) => /^talla/i.test(v.nombre.trim()));
  if (tallas) return plural ? 'tallas' : 'talla';
  return plural ? 'tamaños' : 'tamaño';
}
