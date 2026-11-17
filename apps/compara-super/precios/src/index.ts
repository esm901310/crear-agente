import { colonial } from './tiendas/colonial';
import { laColonia } from './tiendas/lacolonia';
import { losAndes } from './tiendas/losandes';
import { normalizarTexto } from './normalizar';
import { ErrorTienda, type Adaptador, type OpcionesBusqueda, type Producto, type TiendaId } from './tipos';

export * from './tipos';
export * from './normalizar';
export * from './similitud';
export * from './cortes';
export { laColonia, parsearLaColonia } from './tiendas/lacolonia';
export { colonial, parsearColonial, codigoDesdeImagen, esCodigoBarras } from './tiendas/colonial';
export { losAndes, parsearLosAndes } from './tiendas/losandes';

export const ADAPTADORES: Record<TiendaId, Adaptador> = {
  lacolonia: laColonia,
  colonial,
  losandes: losAndes,
};

export interface ResultadoTienda {
  tienda: TiendaId;
  nombreTienda: string;
  ok: boolean;
  productos: Producto[];
  /** Mensaje claro si la tienda falló (los demás resultados siguen sirviendo). */
  error?: { tipo: string; mensaje: string };
  ms: number;
}

export interface OpcionesTodas extends OpcionesBusqueda {
  /** Limitar a ciertas tiendas. Por defecto las 3. */
  tiendas?: TiendaId[];
  /** Caché opcional (p. ej. en memoria, o una envoltura de Cache API / D1 en el Worker). */
  cache?: CacheResultados;
}

export interface CacheResultados {
  obtener(clave: string): Producto[] | undefined;
  guardar(clave: string, productos: Producto[]): void;
}

/** Caché sencilla en memoria con vencimiento (por defecto 30 min). */
export function crearCacheMemoria(ttlMs = 30 * 60_000): CacheResultados {
  const mapa = new Map<string, { vence: number; productos: Producto[] }>();
  return {
    obtener(clave) {
      const e = mapa.get(clave);
      if (!e) return undefined;
      if (Date.now() > e.vence) {
        mapa.delete(clave);
        return undefined;
      }
      return e.productos;
    },
    guardar(clave, productos) {
      mapa.set(clave, { vence: Date.now() + ttlMs, productos });
    },
  };
}

/** Busca en las tiendas en paralelo. Nunca lanza error: cada tienda reporta el suyo. */
export async function buscarEnTodas(texto: string, opciones: OpcionesTodas = {}): Promise<ResultadoTienda[]> {
  const ids = opciones.tiendas ?? (Object.keys(ADAPTADORES) as TiendaId[]);
  return Promise.all(
    ids.map(async (id): Promise<ResultadoTienda> => {
      const adaptador = ADAPTADORES[id];
      const inicio = Date.now();
      const clave = `${id}:${normalizarTexto(texto)}`;
      try {
        const enCache = opciones.cache?.obtener(clave);
        const productos = enCache ?? (await adaptador.buscar(texto, opciones));
        if (!enCache) opciones.cache?.guardar(clave, productos);
        return { tienda: id, nombreTienda: adaptador.nombre, ok: true, productos, ms: Date.now() - inicio };
      } catch (e) {
        const error =
          e instanceof ErrorTienda
            ? { tipo: e.tipo, mensaje: e.message }
            : { tipo: 'desconocido', mensaje: `[${id}] ${(e as Error)?.message ?? String(e)}` };
        return { tienda: id, nombreTienda: adaptador.nombre, ok: false, productos: [], error, ms: Date.now() - inicio };
      }
    }),
  );
}
