// Estado de la conexión con el servidor, compartido por todas las pantallas.
// Las consultas periódicas avisan aquí si fallaron por red o salieron bien.

export type EstadoConexion = 'ok' | 'sin' | 'recuperada';

let estado: EstadoConexion = 'ok';
let fallosSeguidos = 0;
let temporizador: ReturnType<typeof setTimeout> | undefined;
const oyentes = new Set<() => void>();

function cambiar(nuevo: EstadoConexion) {
  if (nuevo === estado) return;
  estado = nuevo;
  oyentes.forEach((o) => o());
}

export const conexion = {
  suscribir(oyente: () => void) {
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
    };
  },
  leer: () => estado,
  /** Una consulta llegó al servidor. */
  exito() {
    fallosSeguidos = 0;
    if (estado === 'sin') {
      cambiar('recuperada');
      clearTimeout(temporizador);
      temporizador = setTimeout(() => cambiar('ok'), 2000);
    }
  },
  /** Una consulta no pudo llegar al servidor. Con 2 seguidas se muestra el aviso. */
  falloDeRed() {
    fallosSeguidos += 1;
    if (fallosSeguidos >= 2) {
      clearTimeout(temporizador);
      cambiar('sin');
    }
  },
  reiniciar() {
    fallosSeguidos = 0;
    clearTimeout(temporizador);
    cambiar('ok');
  },
};
