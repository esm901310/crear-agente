// Botones [↑] [↓] para cambiar el orden sin arrastrar (docs/diseno.md, 30.1). Al mover, el foco
// se queda en la misma flecha de la fila movida para poder tocar varias veces seguidas.

interface Props {
  /** Grupo de flechas (para encontrar la fila después de moverla), p. ej. "cat" o "prod". */
  grupo: string;
  id: number;
  nombre: string;
  primero: boolean;
  ultimo: boolean;
  alMover: (delta: -1 | 1) => void;
}

/** Enfoca la flecha de la fila `id` después de que React la mueva (o la otra si quedó deshabilitada). */
export function enfocarFlecha(grupo: string, id: number, delta: -1 | 1): void {
  requestAnimationFrame(() => {
    const dir = delta < 0 ? 'subir' : 'bajar';
    const otra = delta < 0 ? 'bajar' : 'subir';
    const b = document.querySelector<HTMLButtonElement>(`[data-flecha="${grupo}-${id}-${dir}"]`);
    if (b && !b.disabled) b.focus();
    else document.querySelector<HTMLButtonElement>(`[data-flecha="${grupo}-${id}-${otra}"]`)?.focus();
  });
}

/** Copia de la lista con el elemento `i` movido una posición arriba (−1) o abajo (+1). */
export function mover<T>(lista: T[], i: number, delta: -1 | 1): T[] {
  const j = i + delta;
  if (j < 0 || j >= lista.length) return lista;
  const copia = [...lista];
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
}

export function FlechasOrden({ grupo, id, nombre, primero, ultimo, alMover }: Props) {
  return (
    <span className="flechas" role="group" aria-label={`Orden de ${nombre}`}>
      <button
        type="button"
        className="flecha"
        aria-label={`Subir ${nombre}`}
        data-flecha={`${grupo}-${id}-subir`}
        disabled={primero}
        onClick={() => alMover(-1)}
      >
        ↑
      </button>
      <button
        type="button"
        className="flecha"
        aria-label={`Bajar ${nombre}`}
        data-flecha={`${grupo}-${id}-bajar`}
        disabled={ultimo}
        onClick={() => alMover(1)}
      >
        ↓
      </button>
    </span>
  );
}
