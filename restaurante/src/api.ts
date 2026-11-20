// Cliente del servidor: agrega el token, convierte errores y avisa si la sesión terminó.
import type {
  Comanda,
  Conteo,
  Corte,
  CuentaPendiente,
  JornadaActual,
  JornadaResumen,
  MesaResumen,
  MetodoPago,
  Orden,
  Producto,
  ReportePropinas,
  Usuario,
} from './tipos';

const LLAVE_TOKEN = 'comandas-token';

export function leerToken(): string | null {
  return localStorage.getItem(LLAVE_TOKEN);
}
export function guardarToken(token: string): void {
  localStorage.setItem(LLAVE_TOKEN, token);
}
export function borrarToken(): void {
  localStorage.removeItem(LLAVE_TOKEN);
}

export const MENSAJE_GENERICO = 'Algo salió mal. Intenta de nuevo.';

/** Error de una petición. `status` 0 = no hubo conexión con el servidor. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Cuerpo completo de la respuesta de error (p. ej. `retry_after`, `cuentas_abiertas`). */
    public datos: Record<string, unknown> | null = null,
  ) {
    super(message);
  }
  get esRed(): boolean {
    return this.status === 0;
  }
  /** Segundos de espera que manda el servidor en un 429 (`retry_after`), o null. */
  get esperarSegundos(): number | null {
    const v = this.datos?.retry_after;
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.ceil(v) : null;
  }
  /** Cuentas abiertas que impiden cerrar el día (409 de `POST /api/jornada/cerrar`), o null. */
  get cuentasAbiertas(): CuentaPendiente[] | null {
    const v = this.datos?.cuentas_abiertas;
    return Array.isArray(v) ? (v as CuentaPendiente[]) : null;
  }
}

/** Quién atiende una sesión vencida (401) o un permiso negado (403). Lo asigna App. */
const manejadores: { sesionVencida: () => void; sinPermiso: () => void } = {
  sesionVencida: () => {},
  sinPermiso: () => {},
};
export function configurarManejadores(m: typeof manejadores): void {
  manejadores.sesionVencida = m.sesionVencida;
  manejadores.sinPermiso = m.sinPermiso;
}

interface Opciones {
  /** El 401 es "PIN incorrecto", no sesión vencida. */
  esLogin?: boolean;
  /** Un 403 lo atiende la pantalla (no se manda al usuario a su pantalla inicial). */
  sin403?: boolean;
}

async function pedir<T>(metodo: 'GET' | 'POST', ruta: string, cuerpo?: unknown, opciones: Opciones = {}): Promise<T> {
  const { esLogin = false, sin403 = false } = opciones;
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = leerToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`/api${ruta}`, {
      method: metodo,
      headers,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'No hay conexión. Intenta de nuevo.');
  }

  let datos: unknown = null;
  try {
    datos = await res.json();
  } catch {
    datos = null;
  }

  if (res.ok) return datos as T;

  const mensaje =
    datos && typeof datos === 'object' && typeof (datos as { error?: unknown }).error === 'string'
      ? (datos as { error: string }).error
      : MENSAJE_GENERICO;

  if (res.status === 401 && !esLogin) {
    borrarToken();
    manejadores.sesionVencida();
  } else if (res.status === 403 && !sin403) {
    manejadores.sinPermiso();
  }
  // Un proxy sin servidor detrás (p. ej. Vite con el Worker apagado) responde 502/504 sin JSON.
  if ((res.status === 502 || res.status === 503 || res.status === 504) && datos === null) {
    throw new ApiError(0, 'No hay conexión. Intenta de nuevo.');
  }
  const cuerpoError = datos && typeof datos === 'object' ? (datos as Record<string, unknown>) : null;
  throw new ApiError(res.status, mensaje, cuerpoError);
}

export interface ItemNuevo {
  producto_id: number;
  cantidad: number;
  nota?: string;
}

export interface PagoNuevo {
  metodo: MetodoPago;
  monto: number;
}

export const api = {
  usuariosLogin: () => pedir<Usuario[]>('GET', '/usuarios-login'),
  login: (usuario_id: number, pin: string) =>
    pedir<{ token: string; usuario: Usuario }>('POST', '/login', { usuario_id, pin }, { esLogin: true }),
  logout: () => pedir<{ ok: true }>('POST', '/logout'),
  yo: () => pedir<Usuario>('GET', '/yo'),
  menu: () => pedir<Producto[]>('GET', '/menu'),
  mesas: () => pedir<MesaResumen[]>('GET', '/mesas'),
  abrirOrden: (mesa_id: number) => pedir<Orden>('POST', '/ordenes', { mesa_id }),
  orden: (id: number) => pedir<Orden>('GET', `/ordenes/${id}`),
  /** Borra una cuenta abierta sin platillos (409 si ya tiene platillos, 404 si no existe). */
  cancelarOrden: (id: number) => pedir<{ ok: true }>('POST', `/ordenes/${id}/cancelar`),
  /** `envio_id`: mismo valor en los reintentos del mismo pedido → el servidor no duplica la comanda. */
  enviarComanda: (ordenId: number, items: ItemNuevo[], envio_id?: string) =>
    pedir<Orden>('POST', `/ordenes/${ordenId}/comandas`, envio_id ? { items, envio_id } : { items }),
  cocina: () => pedir<Comanda[]>('GET', '/cocina'),
  marcarListo: (comandaId: number) => pedir<Comanda>('POST', `/comandas/${comandaId}/listo`),
  marcarPendiente: (comandaId: number) => pedir<Comanda>('POST', `/comandas/${comandaId}/pendiente`),
  cajaOrdenes: () => pedir<Orden[]>('GET', '/caja/ordenes'),
  pagar: (ordenId: number, propina: number, pagos: PagoNuevo[]) =>
    pedir<Orden>('POST', `/ordenes/${ordenId}/pagar`, { propina, pagos }),

  // --- Entrega 2: día (jornada), corte y propinas ---
  jornadaActual: () => pedir<{ jornada: JornadaActual | null }>('GET', '/jornada/actual'),
  abrirJornada: (fondo: number) => pedir<JornadaActual>('POST', '/jornada/abrir', { fondo }),
  registrarSalida: (monto: number, motivo: string) =>
    pedir<JornadaActual>('POST', '/jornada/salidas', { monto, motivo }),
  anularSalida: (id: number) => pedir<JornadaActual>('POST', `/jornada/salidas/${id}/anular`),
  /** 409 con `cuentas_abiertas` si hay cuentas sin cobrar (ver `ApiError.cuentasAbiertas`). */
  cerrarJornada: (conteo: Conteo) => pedir<Corte>('POST', '/jornada/cerrar', { conteo }),
  jornadas: () => pedir<JornadaResumen[]>('GET', '/jornadas'),
  /** Corte del último día cerrado (caja y dueño). 404 si todavía no hay cortes. */
  ultimoCorte: () => pedir<Corte>('GET', '/jornadas/ultima-cerrada', undefined, { sin403: true }),
  corte: (jornadaId: number) => pedir<Corte>('GET', `/jornadas/${jornadaId}/corte`, undefined, { sin403: true }),
  reportePropinas: (desde: string, hasta: string) =>
    pedir<ReportePropinas>(
      'GET',
      `/reportes/propinas?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
    ),
};

/** Mensaje para mostrar en un toast a partir de cualquier error. */
export function mensajeDeError(e: unknown, siEsRed = 'No hay conexión. Intenta de nuevo.'): string {
  if (e instanceof ApiError) return e.esRed ? siEsRed : e.message;
  return MENSAJE_GENERICO;
}
