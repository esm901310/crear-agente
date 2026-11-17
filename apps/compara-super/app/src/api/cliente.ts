// Cliente de la API de Comparar Súper, tipado según docs/api-contrato.md (v0).
// Todas las llamadas al servidor pasan por aquí.

// ---------- Tipos del contrato ----------

export type Tienda = 'lacolonia' | 'colonial' | 'losandes';

export interface PrecioTienda {
  productoId: string;
  nombre: string;
  precio: number;
  precioOferta?: number;
  url: string;
  imagen?: string;
  disponible?: boolean;
  /** El servidor no pudo actualizarlo y manda el de la última consulta. */
  desactualizado?: true;
}

export type PreciosPorTienda = Partial<Record<Tienda, PrecioTienda>>;

export interface Grupo {
  clave: string;
  nombre: string;
  /**
   * Solo en grupos de 2+ tiendas. 'codigo' = mismo código de barras (seguro);
   * 'probable' = emparejado por marca + tamaño + tipo (conviene que la persona lo verifique);
   * 'corte' = carne fresca vendida por libra, emparejada por tipo de corte aunque el nombre
   * no sea idéntico. En esos grupos los precios son POR LIBRA y la cantidad del ítem son libras.
   */
  coincidencia?: 'codigo' | 'probable' | 'corte';
  marca?: string;
  /** "1.75 kg", "946 ml"; en grupos 'corte' = "por libra". */
  presentacion?: string;
  /** Solo en grupos 'corte': nombre legible del corte ("Chuleta de cerdo"). */
  corte?: string;
  imagen?: string;
  precios: PreciosPorTienda;
}

export interface ItemLista {
  id: string;
  /** Entero 1..99. En grupos 'corte' son libras. */
  cantidad: number;
  grupo: Grupo;
  sustitutos: PreciosPorTienda;
}

export interface Usuario {
  id: string;
  correo: string;
}

export interface RespuestaBusqueda {
  consultadoEn: string;
  grupos: Grupo[];
  errores: Partial<Record<Tienda, string>>;
  modoPrueba?: true;
  avisoPrueba?: string;
}

export interface RespuestaLista {
  items: ItemLista[];
  /** Último cambio de la lista (cualquier cambio). No sirve para saber si los precios están viejos. */
  actualizadoEn: string | null;
  /**
   * Fecha de consulta de precios más antigua entre los productos. null = lista vacía o algún
   * producto sin fecha conocida (tratar como precios viejos).
   */
  preciosConsultadosEn: string | null;
}

export interface TotalTienda {
  tienda: Tienda;
  total: number;
  completa: boolean;
  faltantes: string[];
  error: string | null;
}

export interface ComparacionParcial {
  tiendas: Partial<Record<Tienda, number>>;
  itemsComparados: number;
}

export interface RespuestaComparar {
  consultadoEn: string;
  /** Igual que en RespuestaLista, tras guardar la comparación (opcional: la lógica local no lo calcula). */
  preciosConsultadosEn?: string | null;
  items: ItemLista[];
  tiendas: TotalTienda[];
  ganador: Tienda | null;
  ahorro: number | null;
  empate: boolean;
  comparacionParcial: ComparacionParcial | null;
  modoPrueba?: true;
  avisoPrueba?: string;
}

export interface CambiosItem {
  cantidad?: number;
  sustitutos?: Partial<Record<Tienda, PrecioTienda | null>>;
}

export interface ApiComparaSuper {
  registro(correo: string, contrasena: string): Promise<Usuario>;
  entrar(correo: string, contrasena: string): Promise<Usuario>;
  salir(): Promise<void>;
  /** Devuelve null si no hay sesión (401). */
  yo(): Promise<Usuario | null>;
  borrarCuenta(): Promise<void>;
  buscar(q: string, senal?: AbortSignal): Promise<RespuestaBusqueda>;
  obtenerLista(): Promise<RespuestaLista>;
  agregarItem(grupo: Grupo, cantidad?: number, consultadoEn?: string): Promise<ItemLista>;
  actualizarItem(id: string, cambios: CambiosItem): Promise<ItemLista>;
  quitarItem(id: string): Promise<void>;
  comparar(): Promise<RespuestaComparar>;
}

// ---------- Errores ----------

/** Error de la API. `estado` 0 = sin conexión. */
export class ErrorApi extends Error {
  readonly estado: number;
  readonly codigo: string;
  /** Solo en 429: momento (ms desde 1970) a partir del cual se puede volver a intentar. */
  readonly esperarHasta: number | null;

  constructor(estado: number, codigo: string, mensaje: string, esperarHasta: number | null = null) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.codigo = codigo;
    this.esperarHasta = esperarHasta;
  }

  get sinConexion(): boolean {
    return this.estado === 0;
  }

  get demasiadasConsultas(): boolean {
    return this.estado === 429;
  }
}

/** Si el servidor no dice cuánto esperar tras un 429, esperamos esto. */
export const ESPERA_429_MS = 60_000;

/** Lee el encabezado Retry-After (segundos o fecha HTTP) y devuelve el momento en ms. */
export function leerRetryAfter(valor: string | null, ahora = Date.now()): number {
  if (valor) {
    const segundos = Number(valor.trim());
    if (Number.isFinite(segundos) && segundos >= 0) return ahora + segundos * 1000;
    const fecha = Date.parse(valor);
    if (!Number.isNaN(fecha)) return Math.max(ahora, fecha);
  }
  return ahora + ESPERA_429_MS;
}

export function esSinConexion(e: unknown): boolean {
  return e instanceof ErrorApi && e.sinConexion;
}

export function esDemasiadasConsultas(e: unknown): e is ErrorApi {
  return e instanceof ErrorApi && e.demasiadasConsultas;
}

export function esSinSesion(e: unknown): boolean {
  return e instanceof ErrorApi && e.estado === 401;
}

/** Se llama cuando el servidor responde 401 en una ruta que pide sesión. */
let alPerderSesion: (() => void) | null = null;
export function registrarAlPerderSesion(fn: (() => void) | null): void {
  alPerderSesion = fn;
}
export function notificarSesionPerdida(): void {
  alPerderSesion?.();
}

// ---------- Cliente real (fetch) ----------

async function pedir<T>(
  metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  ruta: string,
  cuerpo?: unknown,
  opciones: { senal?: AbortSignal; avisar401?: boolean } = {},
): Promise<T> {
  let respuesta: Response;
  // Tiempo límite: con mala señal una petición puede quedarse colgada para siempre.
  // Comparar consulta los súper en el servidor y puede tardar más.
  const limiteMs = ruta.startsWith('/lista/comparar') ? 90_000 : 30_000;
  const porTiempo = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(limiteMs) : undefined;
  const senal =
    opciones.senal && porTiempo && typeof AbortSignal.any === 'function'
      ? AbortSignal.any([opciones.senal, porTiempo])
      : (opciones.senal ?? porTiempo);
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      credentials: 'include',
      headers: cuerpo !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      signal: senal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError' && opciones.senal?.aborted) throw e;
    throw new ErrorApi(0, 'sin_conexion', 'No hay conexión.');
  }

  if (respuesta.status === 204) return undefined as T;

  const datos: unknown = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const err = (datos as { error?: { codigo?: string; mensaje?: string } } | null)?.error;
    const error = new ErrorApi(
      respuesta.status,
      err?.codigo ?? `http_${respuesta.status}`,
      err?.mensaje ?? 'Algo salió mal. Intenta de nuevo.',
      respuesta.status === 429 ? leerRetryAfter(respuesta.headers.get('Retry-After')) : null,
    );
    if (respuesta.status === 401 && opciones.avisar401 !== false) notificarSesionPerdida();
    throw error;
  }
  return datos as T;
}

export const apiReal: ApiComparaSuper = {
  async registro(correo, contrasena) {
    const r = await pedir<{ usuario: Usuario }>('POST', '/auth/registro', { correo, contrasena }, { avisar401: false });
    return r.usuario;
  },
  async entrar(correo, contrasena) {
    const r = await pedir<{ usuario: Usuario }>('POST', '/auth/entrar', { correo, contrasena }, { avisar401: false });
    return r.usuario;
  },
  async salir() {
    await pedir<void>('POST', '/auth/salir', undefined, { avisar401: false });
  },
  async yo() {
    try {
      const r = await pedir<{ usuario: Usuario }>('GET', '/auth/yo', undefined, { avisar401: false });
      return r.usuario;
    } catch (e) {
      if (esSinSesion(e)) return null;
      throw e;
    }
  },
  async borrarCuenta() {
    await pedir<void>('DELETE', '/cuenta');
  },
  buscar(q, senal) {
    return pedir<RespuestaBusqueda>('GET', `/buscar?q=${encodeURIComponent(q)}`, undefined, { senal });
  },
  obtenerLista() {
    return pedir<RespuestaLista>('GET', '/lista');
  },
  async agregarItem(grupo, cantidad, consultadoEn) {
    const r = await pedir<{ item: ItemLista }>('POST', '/lista/items', { grupo, cantidad, consultadoEn });
    return r.item;
  },
  async actualizarItem(id, cambios) {
    const r = await pedir<{ item: ItemLista }>('PATCH', `/lista/items/${encodeURIComponent(id)}`, cambios);
    return r.item;
  },
  async quitarItem(id) {
    await pedir<void>('DELETE', `/lista/items/${encodeURIComponent(id)}`);
  },
  comparar() {
    return pedir<RespuestaComparar>('POST', '/lista/comparar');
  },
};
