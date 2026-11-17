import { completarGtin } from '../../precios/src/normalizar';

/** Dígito verificador GS1 de un cuerpo de dígitos (sin el verificador). */
function calcularVerificador(cuerpo: string): number {
  let suma = 0;
  for (let i = 0; i < cuerpo.length; i++) {
    const digito = Number(cuerpo[cuerpo.length - 1 - i]);
    suma += digito * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (suma % 10)) % 10;
}

/**
 * Normaliza un código de barras a EAN-13 (13 dígitos, con dígito verificador válido).
 * - 13 dígitos: EAN-13 tal cual.
 * - 12 dígitos: UPC-A → se antepone un 0.
 * - 14 dígitos que empiezan con 0 (GTIN-14): se quita el 0.
 * - 8 dígitos (EAN-8): se rellena con ceros a la izquierda (regla GTIN).
 * - 11 dígitos: UPC sin verificador (así lo guarda Los Andes) → se completa con `completarGtin`.
 * Devuelve undefined si no es válido (verificador incorrecto, códigos internos, etc.).
 */
export function normalizarEan13(codigo: unknown): string | undefined {
  if (typeof codigo !== 'string' && typeof codigo !== 'number') return undefined;
  let limpio = String(codigo).replace(/\D/g, '');
  if (limpio.length === 11) limpio = completarGtin(limpio) ?? '';
  if (limpio.length === 14 && limpio.startsWith('0')) limpio = limpio.slice(1);
  if (![8, 12, 13].includes(limpio.length)) return undefined;
  const ean13 = limpio.padStart(13, '0');
  if (/^0+$/.test(ean13)) return undefined;
  return calcularVerificador(ean13.slice(0, 12)) === Number(ean13[12]) ? ean13 : undefined;
}
