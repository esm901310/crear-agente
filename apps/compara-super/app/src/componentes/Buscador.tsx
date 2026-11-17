import { useId, type Ref } from 'react';
import { Icono } from './Icono';

interface Props {
  valor: string;
  alCambiar: (v: string) => void;
  alEnviar?: () => void;
  etiqueta: string;
  placeholder?: string;
  autoFocus?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/** Campo de búsqueda con lupa a la izquierda y "×" para borrar a la derecha. */
export function Buscador({ valor, alCambiar, alEnviar, etiqueta, placeholder, autoFocus, ref }: Props) {
  const id = useId();
  return (
    <form
      role="search"
      className="buscador"
      onSubmit={(e) => {
        e.preventDefault();
        alEnviar?.();
      }}
    >
      <label htmlFor={id} className="solo-lector">
        {etiqueta}
      </label>
      <Icono nombre="lupa" className="buscador-lupa" />
      <input
        ref={ref}
        id={id}
        className="buscador-entrada"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder={placeholder}
        value={valor}
        autoFocus={autoFocus}
        maxLength={60}
        onChange={(e) => alCambiar(e.target.value)}
      />
      {valor && (
        <button type="button" className="boton-icono buscador-borrar" aria-label="Borrar búsqueda" onClick={() => alCambiar('')}>
          <Icono nombre="cerrar" />
        </button>
      )}
    </form>
  );
}
