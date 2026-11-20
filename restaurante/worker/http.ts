// Utilidades HTTP: respuestas JSON, errores y validación de entradas.

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

export function errorJson(status: number, mensaje: string): Response {
  return json({ error: mensaje }, status);
}

const MAX_CUERPO = 32 * 1024; // 32 KB es de sobra para cualquier petición de esta app

/** Lee el cuerpo JSON y garantiza que sea un objeto. */
export async function leerCuerpo(request: Request): Promise<Record<string, unknown>> {
  const largo = Number(request.headers.get('Content-Length') ?? '0');
  if (largo > MAX_CUERPO) throw new HttpError(413, 'La información enviada es demasiado grande.');
  const texto = await request.text();
  if (texto.length > MAX_CUERPO) throw new HttpError(413, 'La información enviada es demasiado grande.');
  if (texto.trim() === '') throw new HttpError(400, 'Faltan datos en la petición.');
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new HttpError(400, 'Los datos enviados no son válidos.');
  }
  if (typeof datos !== 'object' || datos === null || Array.isArray(datos)) {
    throw new HttpError(400, 'Los datos enviados no son válidos.');
  }
  return datos as Record<string, unknown>;
}

/** Entero seguro dentro de un rango; si no, error 400 con el mensaje dado. */
export function entero(valor: unknown, min: number, max: number, mensaje: string): number {
  if (typeof valor !== 'number' || !Number.isSafeInteger(valor) || valor < min || valor > max) {
    throw new HttpError(400, mensaje);
  }
  return valor;
}

/** Id numérico que viene en la ruta (ej. /api/ordenes/12). */
export function idDeRuta(texto: string): number {
  const n = Number(texto);
  if (!/^\d{1,15}$/.test(texto) || !Number.isSafeInteger(n) || n < 1) {
    throw new HttpError(404, 'No encontrado.');
  }
  return n;
}

export function ahoraIso(): string {
  return new Date().toISOString();
}

export function pesos(centavos: number): string {
  const signo = centavos < 0 ? '-' : '';
  const abs = Math.abs(centavos);
  const enteros = Math.floor(abs / 100).toLocaleString('en-US');
  const cent = String(abs % 100).padStart(2, '0');
  return `${signo}$${enteros}.${cent}`;
}
