// Utilidades HTTP: respuestas JSON, errores y validación de entradas.

export class HttpError extends Error {
  /**
   * @param extra  campos adicionales para el cuerpo de la respuesta, junto a `error`
   *               (ej. `retry_after`, `cuentas_abiertas`).
   * @param headers encabezados adicionales (ej. `Retry-After`).
   */
  constructor(
    public status: number,
    message: string,
    public extra: Record<string, unknown> = {},
    public headers: Record<string, string> = {},
  ) {
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

export function errorJson(
  status: number,
  mensaje: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response {
  return json({ error: mensaje, ...extra }, status, headers);
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

/** Centavos → texto en lempiras: 123450 → "L 1,234.50". */
export function lempiras(centavos: number): string {
  const signo = centavos < 0 ? '-' : '';
  const abs = Math.abs(centavos);
  const enteros = Math.floor(abs / 100).toLocaleString('en-US');
  const cent = String(abs % 100).padStart(2, '0');
  return `${signo}L ${enteros}.${cent}`;
}

/** Límite de cordura para precios, pagos, propinas, fondo y salidas: L 1,000,000.00. */
export const MAX_MONTO = 100_000_000;

/** Monto entero en centavos de 1 a MAX_MONTO; si es más grande, mensaje específico. */
export function montoPositivo(valor: unknown, mensaje: string): number {
  if (typeof valor === 'number' && Number.isFinite(valor) && valor > MAX_MONTO) {
    throw new HttpError(400, `El monto es demasiado grande. El máximo es ${lempiras(MAX_MONTO)}.`);
  }
  return entero(valor, 1, MAX_MONTO, mensaje);
}
