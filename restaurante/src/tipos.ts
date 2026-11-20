// Tipos de datos que regresa el servidor (contrato en docs/proyecto.md).

export type Rol = 'mesero' | 'cocina' | 'caja' | 'dueno';
export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia';

export interface Usuario {
  id: number;
  nombre: string;
  rol: Rol;
}

export interface Producto {
  id: number;
  nombre: string;
  categoria: string;
  precio: number; // centavos
}

export interface MesaResumen {
  id: number;
  nombre: string;
  orden_id: number | null;
  mesero_id: number | null;
  mesero_nombre: string | null;
  total: number; // centavos, subtotal sin propina
  abierta_en: string | null;
}

export interface ItemComanda {
  id: number;
  producto_id: number;
  nombre: string;
  precio: number;
  cantidad: number;
  nota: string | null;
}

export interface Comanda {
  id: number;
  orden_id: number;
  mesa_nombre: string;
  mesero_nombre: string;
  estado: 'pendiente' | 'listo';
  creada: string;
  listo_en: string | null;
  items: ItemComanda[];
}

export interface Pago {
  id: number;
  metodo: MetodoPago;
  monto: number;
  creado: string;
}

export interface Orden {
  id: number;
  mesa_id: number;
  mesa_nombre: string;
  mesero_id: number;
  mesero_nombre: string;
  estado: 'abierta' | 'pagada';
  creada: string;
  pagada_en: string | null;
  comandas: Comanda[];
  subtotal: number;
  propina: number;
  total: number;
  pagos: Pago[];
}

export const NOMBRE_ROL: Record<Rol, string> = {
  mesero: 'Mesero',
  cocina: 'Cocina',
  caja: 'Caja',
  dueno: 'Dueño',
};

export const NOMBRE_METODO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
};
