export type TipoError =
  | 'noEsPdf'
  | 'muyGrande'
  | 'sinTexto'
  | 'noSeAbre'
  | 'falloDescarga'
  | 'memoria';

export class ErrorRetoca extends Error {
  tipo: TipoError;
  constructor(tipo: TipoError, mensaje?: string) {
    super(mensaje ?? tipo);
    this.tipo = tipo;
  }
}

/** Detecta si un error viene de falta de memoria del navegador. */
export function esErrorDeMemoria(e: unknown): boolean {
  if (e instanceof RangeError) return true;
  const texto = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /out of memory|memory|allocation/i.test(texto);
}
