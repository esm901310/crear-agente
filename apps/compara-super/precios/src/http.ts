import { ErrorTienda, type OpcionesBusqueda, type TiendaId } from './tipos';

/** User-Agent genérico, sin datos personales. */
export const USER_AGENT = 'Mozilla/5.0 (compatible; ComparaSuper/0.1; +comparador de precios)';

export const TIMEOUT_POR_DEFECTO = 10_000;

interface PeticionJson {
  method?: 'GET' | 'POST';
  body?: unknown;
}

/**
 * Hace una petición y devuelve el JSON. Usa solo `fetch` y `AbortController`
 * (disponibles en Cloudflare Workers). Convierte cada falla en ErrorTienda.
 */
export async function pedirJson<T = unknown>(
  tienda: TiendaId,
  url: string,
  opciones: OpcionesBusqueda = {},
  peticion: PeticionJson = {},
): Promise<T> {
  const f = opciones.fetch ?? fetch;
  const timeoutMs = opciones.timeoutMs ?? TIMEOUT_POR_DEFECTO;
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), timeoutMs);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': USER_AGENT,
  };
  let body: string | undefined;
  if (peticion.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(peticion.body);
  }

  let resp: Response;
  try {
    resp = await f(url, { method: peticion.method ?? 'GET', headers, body, signal: control.signal });
  } catch (e) {
    if (control.signal.aborted) {
      throw new ErrorTienda(tienda, 'timeout', `La tienda no respondió en ${timeoutMs} ms`);
    }
    throw new ErrorTienda(tienda, 'red', `No se pudo conectar: ${(e as Error).message}`);
  } finally {
    clearTimeout(reloj);
  }

  if (!resp.ok) {
    throw new ErrorTienda(tienda, 'http', `La tienda respondió con estado ${resp.status}`, resp.status);
  }
  try {
    return (await resp.json()) as T;
  } catch {
    throw new ErrorTienda(tienda, 'formato', 'La respuesta no es JSON válido (¿cambió la tienda?)');
  }
}

export function validarTexto(tienda: TiendaId, texto: string): string {
  const limpio = (texto ?? '').trim();
  if (limpio.length < 2) {
    throw new ErrorTienda(tienda, 'entrada', 'Escribe al menos 2 letras para buscar');
  }
  return limpio.slice(0, 100);
}
