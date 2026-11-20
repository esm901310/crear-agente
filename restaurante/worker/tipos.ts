// Tipos compartidos (coinciden con el contrato de docs/proyecto.md).

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export type Rol = 'mesero' | 'cocina' | 'caja' | 'dueno';
export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia';
export const METODOS_PAGO: readonly MetodoPago[] = ['efectivo', 'tarjeta', 'transferencia'];

export interface Usuario {
  id: number;
  nombre: string;
  rol: Rol;
}

export interface Producto {
  id: number;
  nombre: string;
  categoria: string;
  precio: number;
}

export interface MesaResumen {
  id: number;
  nombre: string;
  orden_id: number | null;
  mesero_id: number | null;
  mesero_nombre: string | null;
  total: number;
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

// ---------------------------------------------------------------------------
// Entrega 2: jornadas, salidas y corte de caja

/** Denominación en centavos (como texto) → cantidad. */
export type Conteo = Record<string, number>;

export interface Salida {
  id: number;
  monto: number;
  motivo: string;
  usuario_nombre: string;
  creada: string;
  anulada: boolean;
  anulada_por_nombre: string | null;
}

/** Lo que ve la caja de la jornada abierta: SIN totales. */
export interface JornadaActual {
  id: number;
  abierta_en: string;
  abierta_por_nombre: string;
  fondo: number;
  salidas: Salida[];
  cuentas_abiertas: number;
}

export interface PropinaMesero {
  mesero_id: number;
  nombre: string;
  cuentas: number;
  total: number;
  efectivo: number;
  tarjeta: number;
  transferencia: number;
}

export interface PropinaMesa {
  mesa_id: number;
  nombre: string;
  cuentas: number;
  total: number;
}

export interface CuentaCorte {
  orden_id: number;
  mesa_nombre: string;
  mesero_nombre: string;
  pagada_en: string;
  cobrado_por_nombre: string;
  subtotal: number;
  propina: number;
  total: number;
  pagos: { metodo: MetodoPago; monto: number }[];
}

export interface Corte {
  jornada: {
    id: number;
    estado: 'abierta' | 'cerrada';
    abierta_en: string;
    abierta_por_nombre: string;
    cerrada_en: string | null;
    cerrada_por_nombre: string | null;
    fondo: number;
  };
  ventas: { cuentas: number; subtotal: number; propinas: number; total: number; ticket_promedio: number };
  por_metodo: { efectivo: number; tarjeta: number; transferencia: number };
  salidas: Salida[];
  total_salidas: number;
  efectivo: {
    fondo: number;
    cobrado: number;
    salidas: number;
    esperado: number;
    contado: number | null;
    diferencia: number | null;
    conteo: Conteo | null;
  };
  propinas_por_mesero: PropinaMesero[];
  propinas_por_mesa: PropinaMesa[];
  cuentas: CuentaCorte[];
}

export interface JornadaResumen {
  id: number;
  abierta_en: string;
  cerrada_en: string | null;
  cerrada_por_nombre: string | null;
  cuentas: number;
  total: number;
  propinas: number;
  diferencia: number | null;
}
