/** Identificador de cada supermercado soportado. */
export type TiendaId = 'lacolonia' | 'colonial' | 'losandes';

/** Producto normalizado, igual para las 3 tiendas. Precios en lempiras (HNL). */
export interface Producto {
  tienda: TiendaId;
  /** Id del producto dentro de la tienda (no sirve para comparar entre tiendas). */
  id: string;
  nombre: string;
  marca?: string;
  /** Presentación legible, p. ej. "1.75 kg", "946 ml", "12 un". */
  presentacion?: string;
  /** Precio normal (sin oferta). */
  precio: number;
  /** Precio rebajado, solo si es menor que `precio`. */
  precioOferta?: number;
  imagen?: string;
  url: string;
  /** true/false si la tienda lo informa de forma confiable; undefined si no se sabe. */
  disponible?: boolean;
  /**
   * Código de barras (EAN/UPC) si la tienda lo expone. Es la mejor llave para
   * emparejar el mismo producto entre tiendas.
   */
  codigoBarras?: string;
}

export interface OpcionesBusqueda {
  /** fetch a usar (para pruebas o para inyectar el de Workers). Por defecto el global. */
  fetch?: typeof fetch;
  /** Tiempo máximo por petición, en ms. Por defecto 10000. */
  timeoutMs?: number;
  /** Máximo de productos a devolver. Por defecto 20. */
  limite?: number;
  /**
   * Solo al buscar por código de barras: el producto de OTRA tienda que tiene ese
   * código. Si la imagen del resultado no trae el código, la tienda lo usa para
   * confirmar que es el mismo producto (marca, cantidad y nombre); sin referencia
   * que coincida, no devuelve nada.
   */
  referencia?: { nombre: string; marca?: string };
}

export interface Adaptador {
  tienda: TiendaId;
  nombre: string;
  /**
   * true si la tienda acepta buscar por código de barras (texto = solo dígitos) y
   * devuelve el producto con `codigoBarras` puesto. Sirve para encontrar en esta tienda
   * un producto que otra tienda trae con su código.
   */
  buscaPorCodigo?: boolean;
  buscar(texto: string, opciones?: OpcionesBusqueda): Promise<Producto[]>;
}

export type TipoError = 'red' | 'timeout' | 'http' | 'formato' | 'entrada';

/** Error con la tienda y el tipo de falla, para mostrar mensajes claros. */
export class ErrorTienda extends Error {
  constructor(
    public readonly tienda: TiendaId,
    public readonly tipo: TipoError,
    mensaje: string,
    public readonly status?: number,
  ) {
    super(`[${tienda}] ${mensaje}`);
    this.name = 'ErrorTienda';
  }
}
