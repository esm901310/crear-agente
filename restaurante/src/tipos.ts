// Tipos de datos que regresa el servidor (contrato en docs/proyecto.md).

export type Rol = 'mesero' | 'cocina' | 'caja' | 'dueno';
export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia';

export interface Usuario {
  id: number;
  nombre: string;
  rol: Rol;
}

export interface Variante {
  id: number;
  nombre: string;
  precio: number; // centavos
}

export interface Producto {
  id: number;
  categoria_id: number;
  /** Nombre de la categoría (por compatibilidad). */
  categoria: string;
  nombre: string;
  descripcion: string | null;
  /** null si tiene variantes o precio abierto. */
  precio: number | null;
  precio_abierto: boolean;
  variantes: Variante[];
  opciones: string[];
  agotado: boolean;
  es_pasadia: boolean;
}

export interface CategoriaMenu {
  id: number;
  nombre: string;
  orden: number;
  va_a_cocina: boolean;
  productos: Producto[];
}

/** Producto como lo ve el panel del dueño (incluye quitados). */
export interface ProductoAdmin extends Producto {
  activo: boolean;
  orden: number;
}

export interface CategoriaAdmin extends Omit<CategoriaMenu, 'productos'> {
  activa: boolean;
  productos: ProductoAdmin[];
}

export interface MesaAdmin {
  id: number;
  nombre: string;
  activa: boolean;
  orden: number;
  tiene_cuenta_abierta: boolean;
}

export interface UsuarioAdmin {
  id: number;
  nombre: string;
  rol: Rol;
  activo: boolean;
  sesiones_abiertas: number;
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
  /** Ya compuesto: "Pescado rojo · Talla 3", "Mar y tierra (Camarón)". */
  nombre: string;
  variante: string | null;
  opcion: string | null;
  precio: number;
  cantidad: number;
  nota: string | null;
  va_a_cocina: boolean;
  es_pasadia: boolean;
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
  /** Suma de los items que no son pasadía. */
  consumo: number;
  /** Suma de los items de pasadía. */
  pasadia: number;
  /** max(consumo, pasadia): lo que se cobra sin propina. */
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

// ---------- Entrega 2: jornada (día), corte de caja y propinas ----------

/** Denominación en centavos, como texto ("50000" … "10") → cantidad (entero ≥ 0). */
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

/** Lo que ve la caja del día abierto: SIN totales (corte a ciegas). */
export interface JornadaActual {
  id: number;
  abierta_en: string;
  abierta_por_nombre: string;
  fondo: number;
  salidas: Salida[]; // más antigua primero, incluye anuladas
  cuentas_abiertas: number;
}

export interface PropinaMesero {
  mesero_id: number;
  nombre: string;
  cuentas: number; // cuentas con propina > 0
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
  /** Extra del servidor (Entrega 3); puede faltar en respuestas viejas. */
  consumo?: number;
  pasadia?: number;
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

export interface ReportePropinas {
  desde: string;
  hasta: string;
  por_mesero: PropinaMesero[];
  por_mesa: PropinaMesa[];
  jornadas: number;
  /** Días distintos con corte en el rango (servidor nuevo; si no viene, se usa `jornadas`). */
  dias?: number;
  /** Jornadas del rango que siguen abiertas (servidor nuevo). */
  abiertas?: number;
}

/** Cuenta abierta que impide cerrar el día (viene en el 409 de "cerrar"). */
export interface CuentaPendiente {
  orden_id: number;
  mesa_nombre: string;
  total: number;
}
