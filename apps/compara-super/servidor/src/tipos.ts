/** Tipos del contrato de API (docs/api-contrato.md). */
import type { TiendaId } from '../../precios/src/tipos';

export type Tienda = TiendaId;
export const TODAS_LAS_TIENDAS: readonly Tienda[] = ['lacolonia', 'colonial', 'losandes'];

export interface PrecioTienda {
  productoId: string;
  nombre: string;
  precio: number;
  precioOferta?: number;
  url: string;
  imagen?: string;
  disponible?: boolean;
  /**
   * EXTENSIÓN al contrato (opcional): true cuando en la última comparación no
   * se pudo volver a encontrar el producto en la tienda y se conservó el precio
   * guardado anteriormente.
   */
  desactualizado?: boolean;
}

export type PreciosPorTienda = Partial<Record<Tienda, PrecioTienda>>;

export interface Grupo {
  clave: string;
  nombre: string;
  marca?: string;
  presentacion?: string;
  imagen?: string;
  precios: PreciosPorTienda;
}

export interface ItemLista {
  id: string;
  cantidad: number;
  grupo: Grupo;
  sustitutos: PreciosPorTienda;
}

export interface ResumenTienda {
  tienda: Tienda;
  total: number;
  completa: boolean;
  faltantes: string[];
  error: string | null;
}

export interface ResultadoComparacion {
  tiendas: ResumenTienda[];
  ganador: Tienda | null;
  ahorro: number | null;
  empate: boolean;
  comparacionParcial: null | { tiendas: Partial<Record<Tienda, number>>; itemsComparados: number };
}

export interface Env {
  DB: D1Database;
  TIENDAS_ACTIVAS?: string;
  /** "fixtures" solo para desarrollo local (sin internet). Vacío = tiendas en vivo. */
  PRECIOS_MODO?: string;
  /** Máximos de los límites de intentos (texto con un entero). Ver seguridad.ts → VARIABLE_LIMITE. */
  LIMITE_ENTRAR_CORREO_IP?: string;
  LIMITE_ENTRAR_IP?: string;
  LIMITE_ENTRAR_CORREO?: string;
  LIMITE_REGISTROS_IP?: string;
  LIMITE_BUSQUEDAS?: string;
  LIMITE_COMPARACIONES?: string;
}

export interface Usuario {
  id: string;
  correo: string;
}
