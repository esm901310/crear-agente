import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../api';
import {
  ErrorApi,
  esDemasiadasConsultas,
  type Grupo,
  type ItemLista,
  type PrecioTienda,
  type RespuestaComparar,
  type Tienda,
} from '../api/cliente';
import { calcularComparacion, recalcular } from '../logica/comparar';
import { ordenarTiendas, TIENDAS_ANUNCIADAS } from '../logica/tiendas';
import { CLAVE_TIENDAS, guardarEspera, leerEspera } from './datosLocales';
import { useSesion } from './sesion';

/** Precios consultados hace menos de esto se consideran "de ahora" y no se vuelven a pedir solos. */
export const VIGENCIA_PRECIOS_MS = 30 * 60_000;
/** Tras un cambio en la lista, esperamos esto antes de volver a comparar (si hace falta). */
const ESPERA_TRAS_CAMBIO_MS = 1500;

function esReciente(iso: string | null | undefined, ahora = Date.now()): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return !Number.isNaN(t) && ahora - t < VIGENCIA_PRECIOS_MS && t - ahora < 5 * 60_000;
}

type Carga = 'inicial' | 'cargando' | 'lista' | 'error';
type EstadoComparacion = 'inactivo' | 'cargando' | 'listo' | 'error';

interface Estado {
  items: ItemLista[];
  carga: Carga;
  errorCarga: unknown;
  comparacion: RespuestaComparar | null;
  estadoComparacion: EstadoComparacion;
  errorComparacion: unknown;
  /** Tras un 429: momento (ms) antes del cual no se vuelve a consultar. */
  esperarHasta: number | null;
}

const INICIAL: Estado = {
  items: [],
  carga: 'inicial',
  errorCarga: null,
  comparacion: null,
  estadoComparacion: 'inactivo',
  errorComparacion: null,
  esperarHasta: null,
};

/** Estado de arranque. Si en esta pestaña quedó una espera por 429 sin cumplir, arranca en ese error. */
function estadoInicial(): Estado {
  const esperarHasta = leerEspera();
  if (!esperarHasta) return INICIAL;
  return {
    ...INICIAL,
    estadoComparacion: 'error',
    errorComparacion: new ErrorApi(429, 'demasiadas_consultas', 'Demasiadas consultas.', esperarHasta),
    esperarHasta,
  };
}

/** Tiendas que devolvió la última comparación del servidor en este aparato ([] si no hay). */
function tiendasGuardadas(): Tienda[] {
  try {
    const valor: unknown = JSON.parse(localStorage.getItem(CLAVE_TIENDAS) ?? '[]');
    return Array.isArray(valor) ? ordenarTiendas(valor.filter((t): t is Tienda => typeof t === 'string' && t !== '')) : [];
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
  /** Consulta los precios ya ("Actualizar precios", "Reintentar"). */
  comparar(): Promise<void>;
  /**
   * Consulta solo si hace falta: no hay precios de los últimos 30 min, la última vez falló o
   * (al abrir el resultado) hay productos agregados desde una búsqueda que el servidor aún no comparó.
   */
  compararSiHaceFalta(motivo: 'abrir-resultado' | 'cambio-lista'): Promise<void>;
  agregar(grupo: Grupo, contexto: ContextoBusqueda): Promise<ItemLista>;
  cambiarCantidad(id: string, cantidad: number): Promise<void>;
  quitar(id: string): Promise<ItemLista | undefined>;
  restaurar(item: ItemLista): Promise<void>;
  elegirSustituto(id: string, tienda: Tienda, precio: PrecioTienda | null): Promise<void>;
}

const ContextoLista = createContext<ValorLista | null>(null);

/**
 * La lista es de una persona: al cambiar de persona (entrar, salir, borrar la cuenta) se monta un
 * estado nuevo desde cero con `key`. Así las pantallas nunca ven, ni piden cargar, la lista de otra
 * sesión, y no hace falta "reiniciar" el estado con un efecto (ver ListaDeUsuario).
 */
export function ProveedorLista({ children }: { children: ReactNode }) {
  const { usuario } = useSesion();
  return <ListaDeUsuario key={usuario?.id ?? 'sin-sesion'}>{children}</ListaDeUsuario>;
}

/*
 * Antes el estado se reiniciaba con un useEffect([usuario?.id]) que subía una "generación". Los
 * efectos del padre corren DESPUÉS de los de los hijos: si una pantalla se montaba en el mismo render
 * en que cambiaba la persona (p. ej. recargar en /lista: llega la sesión y se muestra MiLista a la
 * vez), la pantalla pedía cargar con la generación vieja, el reinicio descartaba esa respuesta y
 * devolvía `carga` a 'inicial'. Como `carga` ya valía 'inicial' en el render anterior, el efecto de
 * la pantalla no volvía a correr y se quedaba en "Cargando tu lista…" para siempre.
 */
function ListaDeUsuario({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(estadoInicial);
  const [tiendasConocidas, setTiendasConocidas] = useState<Tienda[]>(tiendasGuardadas);
  const ref = useRef(estado);
  ref.current = estado;
  const tiendasConocidasRef = useRef(tiendasConocidas);
  tiendasConocidasRef.current = tiendasConocidas;
  /** Petición de comparar en curso: si otra pantalla pide comparar a la vez, se reutiliza. */
  const comparando = useRef<Promise<void> | null>(null);
  const cargando = useRef<Promise<void> | null>(null);
  const temporizador = useRef<number | undefined>(undefined);
  /** false cuando esta sesión ya terminó: sus respuestas tardías no deben guardar nada en el aparato. */
  const vigente = useRef(true);
  /** Hay productos agregados desde una búsqueda (sus precios pueden venir incompletos) sin comparar en el servidor. */
  const sinConfirmar = useRef(false);

  useEffect(() => {
    vigente.current = true;
    return () => {
      vigente.current = false;
      window.clearTimeout(temporizador.current);
    };
  }, []);

  /** Cambia los productos y recalcula los totales con los últimos precios. */
  const conItems = useCallback((items: ItemLista[]) => {
    setEstado((e) => ({
      ...e,
      items,
      comparacion: e.comparacion ? recalcular(e.comparacion, items) : null,
    }));
  }, []);

  const comparar = useCallback((): Promise<void> => {
    if (comparando.current) return comparando.current;
    const { esperarHasta } = ref.current;
    // Después de un 429 no insistimos hasta que pase el tiempo que pidió el servidor.
    if (esperarHasta && esperarHasta > Date.now()) return Promise.resolve();

    setEstado((e) => ({ ...e, estadoComparacion: 'cargando', errorComparacion: null, esperarHasta: null }));
    const promesa = (async () => {
      try {
        const r = await api.comparar();
        if (!vigente.current) return;
        sinConfirmar.current = false;
        guardarEspera(null);
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
        if (!vigente.current) return;
        const esperarHasta = esDemasiadasConsultas(error) ? error.esperarHasta : null;
        guardarEspera(esperarHasta);
        setEstado((e) => ({ ...e, estadoComparacion: 'error', errorComparacion: error, esperarHasta }));
      }
    })().finally(() => {
      if (comparando.current === promesa) comparando.current = null;
    });
    comparando.current = promesa;
    return promesa;
  }, []);

  const compararSiHaceFalta = useCallback((motivo: 'abrir-resultado' | 'cambio-lista'): Promise<void> => {
    if (comparando.current) return comparando.current;
    const e = ref.current;
    if (e.carga !== 'lista' || e.items.length === 0) return Promise.resolve();
    const haceFalta =
      !e.comparacion ||
      e.estadoComparacion === 'error' ||
      !esReciente(e.comparacion.consultadoEn) ||
      (motivo === 'abrir-resultado' && sinConfirmar.current);
    return haceFalta ? comparar() : Promise.resolve();
  }, [comparar]);

  /** Tras un cambio en la lista: compara (si hace falta) cuando la persona deja de tocar un momento. */
  const programarComparacion = useCallback(() => {
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => void compararSiHaceFalta('cambio-lista'), ESPERA_TRAS_CAMBIO_MS);
  }, [compararSiHaceFalta]);

  const cargar = useCallback((): Promise<void> => {
    if (cargando.current) return cargando.current;
    setEstado((e) => ({ ...e, carga: 'cargando', errorCarga: null }));
    const promesa = (async () => {
      try {
        const r = await api.obtenerLista();
        if (!vigente.current) return;
        // preciosConsultadosEn = consulta de precios más antigua de la lista (null = viejos).
        // Para calcular aquí hace falta saber qué tiendas compara el servidor. Eso NO se deduce de los
        // productos (si todos son de una sola tienda, las demás desaparecerían del resultado): solo se
        // usan las que devolvió la última comparación del servidor. Si no las conocemos, se compara allá.
        const tiendas = tiendasGuardadas();
        const recientes = r.items.length > 0 && esReciente(r.preciosConsultadosEn) && tiendas.length > 0;
        let comparacion: RespuestaComparar | null = null;
        if (recientes) {
          // Los precios guardados son de hace menos de 30 min: calculamos aquí sin volver a consultar.
          comparacion = calcularComparacion(r.items, tiendas, {}, r.preciosConsultadosEn!);
        }
        setEstado((e) => ({
          ...e,
          items: r.items,
          carga: 'lista',
          ...(comparacion ? { comparacion, estadoComparacion: 'listo' as const, errorComparacion: null } : {}),
        }));
        if (!recientes && r.items.length > 0 && !esReciente(ref.current.comparacion?.consultadoEn)) {
          await comparar();
        }
      } catch (error) {
        if (!vigente.current) return;
        setEstado((e) => ({ ...e, carga: 'error', errorCarga: error }));
      }
    })().finally(() => {
      if (cargando.current === promesa) cargando.current = null;
    });
    cargando.current = promesa;
    return promesa;
  }, [comparar]);

  const agregar = useCallback(async (grupo: Grupo, contexto: ContextoBusqueda) => {
    const item = await api.agregarItem(grupo, 1, contexto.consultadoEn);
    sinConfirmar.current = true;
    setEstado((e) => {
      const existe = e.items.some((i) => i.id === item.id);
      const items = existe ? e.items.map((i) => (i.id === item.id ? item : i)) : [...e.items, item];
      // Sin comparación previa solo calculamos aquí si todos los precios vienen de esta búsqueda.
      // Las tiendas no se deducen solo de la búsqueda: se suman las conocidas o, si no hay, las anunciadas.
      // (Al abrir el resultado se confirma igual con el servidor.)
      const tiendas = ordenarTiendas([
        ...contexto.tiendas,
        ...(tiendasConocidasRef.current.length > 0 ? tiendasConocidasRef.current : TIENDAS_ANUNCIADAS),
      ]);
      const comparacion = e.comparacion
        ? recalcular(e.comparacion, items)
        : e.items.length === 0
          ? calcularComparacion(items, tiendas, {}, contexto.consultadoEn)
          : null;
      // Si la lista no se pudo cargar, este producto no es "toda la lista": se vuelve a pedir al servidor
      // ('inicial' hace que la pantalla la cargue). Si está cargando, esa carga termina sola.
      return { ...e, items, comparacion, carga: e.carga === 'error' ? 'inicial' : e.carga };
    });
    programarComparacion();
    return item;
  }, [programarComparacion]);

  const cambiarCantidad = useCallback(
    async (id: string, cantidad: number) => {
      const antes = ref.current.items;
      conItems(antes.map((i) => (i.id === id ? { ...i, cantidad } : i)));
      try {
        await api.actualizarItem(id, { cantidad });
        programarComparacion();
      } catch (error) {
        conItems(ref.current.items.map((i) => (i.id === id ? antes.find((a) => a.id === id) ?? i : i)));
        throw error;
      }
    },
    [conItems, programarComparacion],
  );

  const quitar = useCallback(
    async (id: string) => {
      const item = ref.current.items.find((i) => i.id === id);
      if (!item) return undefined;
      await api.quitarItem(id);
      conItems(ref.current.items.filter((i) => i.id !== id));
      programarComparacion();
      return item;
    },
    [conItems, programarComparacion],
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
      programarComparacion();
    },
    [conItems, programarComparacion],
  );

  const elegirSustituto = useCallback(
    async (id: string, tienda: Tienda, precio: PrecioTienda | null) => {
      const actualizado = await api.actualizarItem(id, { sustitutos: { [tienda]: precio } });
      conItems(
        ref.current.items.map((i) =>
          i.id === id ? { ...i, cantidad: actualizado.cantidad, sustitutos: actualizado.sustitutos ?? {} } : i,
        ),
      );
      programarComparacion();
    },
    [conItems, programarComparacion],
  );

  const tiendas = useMemo(
    () =>
      estado.comparacion ? ordenarTiendas(estado.comparacion.tiendas.map((t) => t.tienda)) : tiendasConocidas,
    [estado.comparacion, tiendasConocidas],
  );

  const valor = useMemo<ValorLista>(
    () => ({
      ...estado,
      tiendas,
      cargar,
      comparar,
      compararSiHaceFalta,
      agregar,
      cambiarCantidad,
      quitar,
      restaurar,
      elegirSustituto,
    }),
    [estado, tiendas, cargar, comparar, compararSiHaceFalta, agregar, cambiarCantidad, quitar, restaurar, elegirSustituto],
  );

  return <ContextoLista.Provider value={valor}>{children}</ContextoLista.Provider>;
}

export function useLista(): ValorLista {
  const v = useContext(ContextoLista);
  if (!v) throw new Error('useLista debe usarse dentro de ProveedorLista');
  return v;
}
