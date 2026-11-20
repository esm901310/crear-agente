// Cliente del servidor: agrega el token, convierte errores y avisa si la sesión terminó.
import type { Comanda, MesaResumen, MetodoPago, Orden, Producto, Usuario } from './tipos';

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
  ) {
    super(message);
  }
  get esRed(): boolean {
    return this.status === 0;
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

async function pedir<T>(metodo: 'GET' | 'POST', ruta: string, cuerpo?: unknown, esLogin = false): Promise<T> {
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
  } else if (res.status === 403) {
    manejadores.sinPermiso();
  }
  // Un proxy sin servidor detrás (p. ej. Vite con el Worker apagado) responde 502/504 sin JSON.
  if ((res.status === 502 || res.status === 503 || res.status === 504) && datos === null) {
    throw new ApiError(0, 'No hay conexión. Intenta de nuevo.');
  }
  throw new ApiError(res.status, mensaje);
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
    pedir<{ token: string; usuario: Usuario }>('POST', '/login', { usuario_id, pin }, true),
  logout: () => pedir<{ ok: true }>('POST', '/logout'),
  yo: () => pedir<Usuario>('GET', '/yo'),
  menu: () => pedir<Producto[]>('GET', '/menu'),
  mesas: () => pedir<MesaResumen[]>('GET', '/mesas'),
  abrirOrden: (mesa_id: number) => pedir<Orden>('POST', '/ordenes', { mesa_id }),
  orden: (id: number) => pedir<Orden>('GET', `/ordenes/${id}`),
  /** `envio_id`: mismo valor en los reintentos del mismo pedido → el servidor no duplica la comanda. */
  enviarComanda: (ordenId: number, items: ItemNuevo[], envio_id?: string) =>
    pedir<Orden>('POST', `/ordenes/${ordenId}/comandas`, envio_id ? { items, envio_id } : { items }),
  cocina: () => pedir<Comanda[]>('GET', '/cocina'),
  marcarListo: (comandaId: number) => pedir<Comanda>('POST', `/comandas/${comandaId}/listo`),
  marcarPendiente: (comandaId: number) => pedir<Comanda>('POST', `/comandas/${comandaId}/pendiente`),
  cajaOrdenes: () => pedir<Orden[]>('GET', '/caja/ordenes'),
  pagar: (ordenId: number, propina: number, pagos: PagoNuevo[]) =>
    pedir<Orden>('POST', `/ordenes/${ordenId}/pagar`, { propina, pagos }),
};

/** Mensaje para mostrar en un toast a partir de cualquier error. */
export function mensajeDeError(e: unknown, siEsRed = 'No hay conexión. Intenta de nuevo.'): string {
  if (e instanceof ApiError) return e.esRed ? siEsRed : e.message;
  return MENSAJE_GENERICO;
}
