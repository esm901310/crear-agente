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

export function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.trim());
}
