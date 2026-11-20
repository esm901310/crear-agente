// C2 — Una fila del conteo: denominación, [−] cantidad [+] y subtotal (docs/diseno.md, 18.2).
import type { KeyboardEvent, Ref } from 'react';
import { CANTIDAD_MAX } from '../config';
import { dinero, etiquetaDenominacion } from '../formato';

interface Props {
  valor: number; // centavos
  tipo: 'billete' | 'moneda';
  cantidad: number;
  alCambiar: (cantidad: number) => void;
  /** Enter: pasar al siguiente campo. */
  alSiguiente: () => void;
  entradaRef?: Ref<HTMLInputElement>;
}

const TECLAS_PERMITIDAS = new Set(['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);

export function FilaDenominacion({ valor, tipo, cantidad, alCambiar, alSiguiente, entradaRef }: Props) {
  const etiqueta = etiquetaDenominacion(valor);
  const nombre = `${tipo === 'billete' ? 'billetes' : 'monedas'} de ${etiqueta}`;
  const subtotal = valor * cantidad;
  const poner = (n: number) => alCambiar(Math.min(CANTIDAD_MAX, Math.max(0, n)));

  const alTeclear = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      alSiguiente();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      poner(cantidad + 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      poner(cantidad - 1);
    } else if (!/^\d$/.test(e.key) && !TECLAS_PERMITIDAS.has(e.key)) {
      e.preventDefault(); // solo enteros ≥ 0
    }
  };

  return (
    <li className="denominacion">
      <span className="denominacion__etiqueta" aria-hidden="true">
        {etiqueta}
      </span>
      <button
        type="button"
        className="cantidad__boton denominacion__boton"
        aria-label={`Menos ${nombre}`}
        disabled={cantidad <= 0}
        onClick={() => poner(cantidad - 1)}
      >
        −
      </button>
      <input
        ref={entradaRef}
        className="denominacion__campo"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={nombre.charAt(0).toUpperCase() + nombre.slice(1)}
        value={cantidad === 0 ? '0' : String(cantidad)}
        onFocus={(e) => e.target.select()}
        onKeyDown={alTeclear}
        onChange={(e) => {
          const solo = e.target.value.replace(/\D/g, '');
          poner(solo === '' ? 0 : Number(solo.slice(0, 5)));
        }}
      />
      <button
        type="button"
        className="cantidad__boton denominacion__boton"
        aria-label={`Más ${nombre}`}
        disabled={cantidad >= CANTIDAD_MAX}
        onClick={() => poner(cantidad + 1)}
      >
        +
      </button>
      <span className={subtotal === 0 ? 'denominacion__subtotal texto-2' : 'denominacion__subtotal'}>{dinero(subtotal)}</span>
    </li>
  );
}
