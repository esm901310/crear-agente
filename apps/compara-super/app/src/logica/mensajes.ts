import { ErrorApi } from '../api/cliente';

export const SIN_CONEXION = 'No hay conexión. Revisa tu internet e intenta de nuevo.';

/** Mensaje general, cálido y sin tecnicismos, para un error de la API. */
export function mensajeDeError(e: unknown): string {
  if (e instanceof ErrorApi) {
    if (e.sinConexion) return SIN_CONEXION;
    if (e.estado === 429) return 'Hiciste muchos intentos seguidos. Espera unos minutos e intenta de nuevo.';
    if (e.codigo === 'lista_llena') return 'Tu lista ya tiene 40 productos, el máximo. Quita alguno para agregar otro.';
    if (e.estado >= 500) return 'Algo falló de nuestro lado. Intenta de nuevo en un momento.';
  }
  return 'Algo salió mal. Intenta de nuevo.';
}

export const MUCHAS_CONSULTAS = 'Hiciste muchas consultas seguidas. Espera unos minutos y vuelve a intentar.';

export type TipoErrorPrecios = 'sin-conexion' | 'limite' | 'servidor';

/** Distingue por qué no pudimos traer los precios. */
export function tipoErrorPrecios(e: unknown): TipoErrorPrecios {
  if (e instanceof ErrorApi) {
    if (e.sinConexion) return 'sin-conexion';
    if (e.estado === 429) return 'limite';
  }
  return 'servidor';
}

/** Texto para cuando falló la consulta de precios (comparar). */
export function mensajeErrorPrecios(e: unknown): string {
  switch (tipoErrorPrecios(e)) {
    case 'sin-conexion':
      return 'No hay conexión. Revisa tu internet e intenta de nuevo.';
    case 'limite':
      return MUCHAS_CONSULTAS;
    default:
      return 'Algo falló de nuestro lado. Intenta de nuevo en un momento.';
  }
}

/** "Podrás intentar de nuevo en 2 minutos." */
export function textoEspera(segundos: number): string {
  if (segundos <= 0) return '';
  if (segundos < 60) return `Podrás intentar de nuevo en ${segundos} ${segundos === 1 ? 'segundo' : 'segundos'}.`;
  const minutos = Math.ceil(segundos / 60);
  return `Podrás intentar de nuevo en ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`;
}

export function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.trim());
}
