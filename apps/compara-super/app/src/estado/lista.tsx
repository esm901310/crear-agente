import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../api';
import type { Grupo, ItemLista, PrecioTienda, RespuestaComparar, Tienda } from '../api/cliente';
import { calcularComparacion, recalcular } from '../logica/comparar';
import { ordenarTiendas } from '../logica/tiendas';
import { useSesion } from './sesion';

type Carga = 'inicial' | 'cargando' | 'lista' | 'error';
type EstadoComparacion = 'inactivo' | 'cargando' | 'listo' | 'error';

interface Estado {
  items: ItemLista[];
  carga: Carga;
  errorCarga: unknown;
  comparacion: RespuestaComparar | null;
  estadoComparacion: EstadoComparacion;
  errorComparacion: unknown;
}

const INICIAL: Estado = {
  items: [],
  carga: 'inicial',
  errorCarga: null,
  comparacion: null,
  estadoComparacion: 'inactivo',
  errorComparacion: null,
};

const CLAVE_TIENDAS = 'comparasuper-tiendas';

function tiendasGuardadas(): Tienda[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_TIENDAS) ?? '[]') as Tienda[];
  } catch {
    return [];
  }
}

export interface ContextoBusqueda {
  consultadoEn: string;
  tiendas: Tienda[];
}

interface ValorLista extends Estado {
  /** Tiendas que el servidor devolvió en la última comparación. */
  tiendas: Tienda[];
  cargar(): Promise<void>;
  comparar(): Promise<void>;
  agregar(grupo: Grupo, contexto: ContextoBusqueda): Promise<ItemLista>;
  cambiarCantidad(id: string, cantidad: number): Promise<void>;
  quitar(id: string): Promise<ItemLista | undefined>;
  restaurar(item: ItemLista): Promise<void>;
  elegirSustituto(id: string, tienda: Tienda, precio: PrecioTienda | null): Promise<void>;
}

const ContextoLista = createContext<ValorLista | null>(null);

export function ProveedorLista({ children }: { children: ReactNode }) {
  const { usuario } = useSesion();
  const [estado, setEstado] = useState<Estado>(INICIAL);
  const [tiendasConocidas, setTiendasConocidas] = useState<Tienda[]>(tiendasGuardadas);
  const ref = useRef(estado);
  ref.current = estado;

  // Al cambiar de persona (o cerrar sesión) se olvida todo.
  useEffect(() => {
    setEstado(INICIAL);
  }, [usuario?.id]);

  /** Cambia los productos y recalcula los totales con los últimos precios. */
  const conItems = useCallback((items: ItemLista[]) => {
    setEstado((e) => ({
      ...e,
      items,
      comparacion: e.comparacion ? recalcular(e.comparacion, items) : null,
    }));
  }, []);

  const comparar = useCallback(async () => {
    setEstado((e) => ({ ...e, estadoComparacion: 'cargando', errorComparacion: null }));
    try {
      const r = await api.comparar();
      const tiendas = ordenarTiendas(r.tiendas.map((t) => t.tienda));
      setTiendasConocidas(tiendas);
      localStorage.setItem(CLAVE_TIENDAS, JSON.stringify(tiendas));
      setEstado((e) => {
        // Respeta lo que la persona cambió mientras se consultaba.
        const delServidor = new Map(r.items.map((i) => [i.id, i]));
        const items = e.items.map((local) => {
          const s = delServidor.get(local.id);
          return s ? { ...s, cantidad: local.cantidad, sustitutos: local.sustitutos } : local;
        });
        return {
          ...e,
          items,
          comparacion: recalcular(r, items),
          estadoComparacion: 'listo',
        };
      });
    } catch (error) {
      setEstado((e) => ({ ...e, estadoComparacion: 'error', errorComparacion: error }));
    }
  }, []);

  const cargar = useCallback(async () => {
    setEstado((e) => ({ ...e, carga: 'cargando', errorCarga: null }));
    try {
      const r = await api.obtenerLista();
      setEstado((e) => ({ ...e, items: r.items, carga: 'lista' }));
      if (r.items.length > 0) await comparar();
    } catch (error) {
      setEstado((e) => ({ ...e, carga: 'error', errorCarga: error }));
    }
  }, [comparar]);

  const agregar = useCallback(async (grupo: Grupo, contexto: ContextoBusqueda) => {
    const item = await api.agregarItem(grupo, 1);
    setEstado((e) => {
      const existe = e.items.some((i) => i.id === item.id);
      const items = existe ? e.items.map((i) => (i.id === item.id ? item : i)) : [...e.items, item];
      const comparacion = e.comparacion
        ? recalcular(e.comparacion, items)
        : calcularComparacion(items, contexto.tiendas, {}, contexto.consultadoEn);
      return { ...e, items, comparacion, carga: e.carga === 'inicial' ? e.carga : 'lista' };
    });
    return item;
  }, []);

  const cambiarCantidad = useCallback(
    async (id: string, cantidad: number) => {
      const antes = ref.current.items;
      conItems(antes.map((i) => (i.id === id ? { ...i, cantidad } : i)));
      try {
        await api.actualizarItem(id, { cantidad });
      } catch (error) {
        conItems(ref.current.items.map((i) => (i.id === id ? antes.find((a) => a.id === id) ?? i : i)));
        throw error;
      }
    },
    [conItems],
  );

  const quitar = useCallback(
    async (id: string) => {
      const item = ref.current.items.find((i) => i.id === id);
      if (!item) return undefined;
      await api.quitarItem(id);
      conItems(ref.current.items.filter((i) => i.id !== id));
      return item;
    },
    [conItems],
  );

  const restaurar = useCallback(
    async (item: ItemLista) => {
      let nuevo = await api.agregarItem(item.grupo, item.cantidad);
      const sustitutos = Object.keys(item.sustitutos ?? {});
      if (sustitutos.length > 0) {
        nuevo = await api.actualizarItem(nuevo.id, { sustitutos: item.sustitutos });
      }
      // Lo devolvemos a su lugar con los precios que ya conocíamos.
      const restaurado: ItemLista = { ...nuevo, grupo: item.grupo };
      const actuales = ref.current.items.filter((i) => i.id !== nuevo.id);
      conItems([...actuales, restaurado]);
    },
    [conItems],
  );

  const elegirSustituto = useCallback(
    async (id: string, tienda: Tienda, precio: PrecioTienda | null) => {
      const actualizado = await api.actualizarItem(id, { sustitutos: { [tienda]: precio } });
      conItems(
        ref.current.items.map((i) =>
          i.id === id ? { ...i, cantidad: actualizado.cantidad, sustitutos: actualizado.sustitutos ?? {} } : i,
        ),
      );
    },
    [conItems],
  );

  const tiendas = useMemo(
    () =>
      estado.comparacion ? ordenarTiendas(estado.comparacion.tiendas.map((t) => t.tienda)) : tiendasConocidas,
    [estado.comparacion, tiendasConocidas],
  );

  const valor = useMemo<ValorLista>(
    () => ({ ...estado, tiendas, cargar, comparar, agregar, cambiarCantidad, quitar, restaurar, elegirSustituto }),
    [estado, tiendas, cargar, comparar, agregar, cambiarCantidad, quitar, restaurar, elegirSustituto],
  );

  return <ContextoLista.Provider value={valor}>{children}</ContextoLista.Provider>;
}

export function useLista(): ValorLista {
  const v = useContext(ContextoLista);
  if (!v) throw new Error('useLista debe usarse dentro de ProveedorLista');
  return v;
}
