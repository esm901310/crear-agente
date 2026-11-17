// Todo lo que la app guarda en este aparato sobre la persona.
// Al cerrar sesión, borrar la cuenta o perder la sesión se borra con borrarDatosLocales().

export const CLAVE_USUARIO = 'comparasuper-usuario';
export const CLAVE_BUSQUEDAS = 'comparasuper-busquedas';
export const CLAVE_TIENDAS = 'comparasuper-tiendas';

const CLAVES_DE_LA_PERSONA = [CLAVE_USUARIO, CLAVE_BUSQUEDAS, CLAVE_TIENDAS];

export function borrarDatosLocales(): void {
  for (const clave of CLAVES_DE_LA_PERSONA) {
    try {
      localStorage.removeItem(clave);
    } catch {
      /* almacenamiento no disponible */
    }
  }
}
