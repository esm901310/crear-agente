import { librasHablado, librasTexto, PASO_LIBRAS } from '../logica/corte';
import { Icono } from './Icono';

interface Props {
  cantidad: number;
  nombre: string;
  alCambiar: (cantidad: number) => void;
  /** Se llama al tocar "−" con la cantidad mínima (se pregunta si quitar el producto). */
  alBajarDeUno: () => void;
  /** Corte por libra: la cantidad son libras ("1.5 lb"), de media en media (mínimo 0.5). */
  enLibras?: boolean;
}

export function SelectorCantidad({ cantidad, nombre, alCambiar, alBajarDeUno, enLibras }: Props) {
  const paso = enLibras ? PASO_LIBRAS : 1;
  const minimo = paso;
  const menos = enLibras ? `Media libra menos de ${nombre}` : `Uno menos de ${nombre}`;
  const mas = enLibras ? `Media libra más de ${nombre}` : `Uno más de ${nombre}`;
  // Sumar en medios evita errores de coma flotante (1.5 + 0.5 = 2 exacto).
  const sumar = (delta: number) => Math.round((cantidad + delta) * 2) / 2;
  return (
    <div
      className="selector-cantidad"
      role="group"
      aria-label={enLibras ? `Libras de ${nombre}` : `Cantidad de ${nombre}`}
    >
      <button
        type="button"
        className="selector-cantidad-boton"
        aria-label={cantidad <= minimo ? `Quitar ${nombre}` : menos}
        onClick={() => (cantidad <= minimo ? alBajarDeUno() : alCambiar(Math.max(minimo, sumar(-paso))))}
      >
        <Icono nombre="menos" />
      </button>
      <span className="selector-cantidad-numero" aria-live="polite">
        {enLibras ? (
          <>
            <span aria-hidden="true">{librasTexto(cantidad)}</span>
            <span className="solo-lector">{librasHablado(cantidad)}</span>
          </>
        ) : (
          cantidad
        )}
      </span>
      <button
        type="button"
        className="selector-cantidad-boton"
        aria-label={mas}
        disabled={cantidad + paso > 99}
        onClick={() => alCambiar(Math.min(99, sumar(paso)))}
      >
        <Icono nombre="mas" />
      </button>
    </div>
  );
}
