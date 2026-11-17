// Todo lo que la app guarda en este aparato sobre la persona.
// Al cerrar sesión, borrar la cuenta o perder la sesión se borra con borrarDatosLocales().

export const CLAVE_USUARIO = 'comparasuper-usuario';
export const CLAVE_BUSQUEDAS = 'comparasuper-busquedas';
export const CLAVE_TIENDAS = 'comparasuper-tiendas';
/** En sessionStorage: tras un 429, hasta cuándo (ms) no se vuelve a comparar. Así recargar no insiste. */
export const CLAVE_ESPERA = 'comparasuper-esperar-hasta';

const CLAVES_DE_LA_PERSONA = [CLAVE_USUARIO, CLAVE_BUSQUEDAS, CLAVE_TIENDAS];

/** Momento (ms) guardado hasta el que hay que esperar tras un 429, si aún no pasó. */
export function leerEspera(ahora = Date.now()): number | null {
  try {
    const valor = Number(sessionStorage.getItem(CLAVE_ESPERA));
    // Se ignoran valores pasados o absurdos (más de 1 hora).
    return Number.isFinite(valor) && valor > ahora && valor - ahora <= 60 * 60_000 ? valor : null;
  } catch {
    return null;
  }
}

export function guardarEspera(hasta: number | null): void {
  try {
    if (hasta && hasta > Date.now()) sessionStorage.setItem(CLAVE_ESPERA, String(hasta));
    else sessionStorage.removeItem(CLAVE_ESPERA);
  } catch {
    /* almacenamiento no disponible */
  }
}

export function borrarDatosLocales(): void {
  for (const clave of CLAVES_DE_LA_PERSONA) {
    try {
      localStorage.removeItem(clave);
    } catch {
      /* almacenamiento no disponible */
    }
  }
  guardarEspera(null);
}
