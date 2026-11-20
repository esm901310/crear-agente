// Cuentas abiertas sin platillos que esta tablet dejaría olvidadas (p. ej. se abrió la
// cuenta pero el envío a cocina falló). Al salir de la mesa o de la sesión se cancelan
// para que no quede una mesa ocupada con L 0.00.
import { api, leerToken } from './api';

const vacias = new Set<number>();

/** Recuerda que la cuenta `id` está abierta y sin platillos. */
export function marcarCuentaVacia(id: number): void {
  vacias.add(id);
}

/** Olvida la cuenta `id` (ya tiene platillos, se cobró o ya se canceló). */
export function desmarcarCuentaVacia(id: number): void {
  vacias.delete(id);
}

/**
 * Pide al servidor borrar las cuentas vacías recordadas. Si alguna ya tiene platillos
 * (409) o ya no existe (404), se ignora en silencio: el servidor decide.
 */
export async function cancelarCuentasVacias(): Promise<void> {
  if (vacias.size === 0 || !leerToken()) return;
  const ids = [...vacias];
  vacias.clear();
  await Promise.all(ids.map((id) => api.cancelarOrden(id).catch(() => {})));
}
