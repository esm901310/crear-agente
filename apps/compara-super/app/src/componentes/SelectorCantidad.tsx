import { librasHablado, librasTexto } from '../logica/corte';
import { Icono } from './Icono';

interface Props {
  cantidad: number;
  nombre: string;
  alCambiar: (cantidad: number) => void;
  /** Se llama al tocar "−" con cantidad 1 (se pregunta si quitar el producto). */
  alBajarDeUno: () => void;
  /** Corte por libra: la cantidad son libras ("2 lb"). */
  enLibras?: boolean;
}

// El servidor acepta enteros de 1 a 99, así que las libras van de 1 en 1.
export function SelectorCantidad({ cantidad, nombre, alCambiar, alBajarDeUno, enLibras }: Props) {
  const menos = enLibras ? `Una libra menos de ${nombre}` : `Uno menos de ${nombre}`;
  const mas = enLibras ? `Una libra más de ${nombre}` : `Uno más de ${nombre}`;
  return (
    <div
      className="selector-cantidad"
      role="group"
      aria-label={enLibras ? `Libras de ${nombre}` : `Cantidad de ${nombre}`}
    >
      <button
        type="button"
        className="selector-cantidad-boton"
        aria-label={cantidad <= 1 ? `Quitar ${nombre}` : menos}
        onClick={() => (cantidad <= 1 ? alBajarDeUno() : alCambiar(cantidad - 1))}
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
        disabled={cantidad >= 99}
        onClick={() => alCambiar(cantidad + 1)}
      >
        <Icono nombre="mas" />
      </button>
    </div>
  );
}
