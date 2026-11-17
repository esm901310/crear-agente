// Elige el cliente: servidor real (por defecto) o modo simulado con datos de ejemplo.
import { apiReal, type ApiComparaSuper } from './cliente';

export const modoSimulado = import.meta.env.VITE_API_SIMULADA === '1';

export const api: ApiComparaSuper = modoSimulado
  ? (await import('./simulada')).apiSimulada
  : apiReal;
