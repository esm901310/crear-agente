import { Icono } from './Icono';

interface Props {
  cantidad: number;
  nombre: string;
  alCambiar: (cantidad: number) => void;
  /** Se llama al tocar "−" con cantidad 1 (se pregunta si quitar el producto). */
  alBajarDeUno: () => void;
}

export function SelectorCantidad({ cantidad, nombre, alCambiar, alBajarDeUno }: Props) {
  return (
    <div className="selector-cantidad" role="group" aria-label={`Cantidad de ${nombre}`}>
      <button
        type="button"
        className="selector-cantidad-boton"
        aria-label={cantidad <= 1 ? `Quitar ${nombre}` : `Uno menos de ${nombre}`}
        onClick={() => (cantidad <= 1 ? alBajarDeUno() : alCambiar(cantidad - 1))}
      >
        <Icono nombre="menos" />
      </button>
      <span className="selector-cantidad-numero" aria-live="polite">
        {cantidad}
      </span>
      <button
        type="button"
        className="selector-cantidad-boton"
        aria-label={`Uno más de ${nombre}`}
        disabled={cantidad >= 99}
        onClick={() => alCambiar(cantidad + 1)}
      >
        <Icono nombre="mas" />
      </button>
    </div>
  );
}
