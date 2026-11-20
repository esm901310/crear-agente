// Campo para escribir lempiras ("300" o "300.50"). Al salir del campo se muestra formateado.
import type { KeyboardEvent, Ref } from 'react';
import { centavosATexto, textoACentavos } from '../formato';

interface Props {
  id: string;
  etiqueta: string;
  /** Si true, la etiqueta no se ve (pero los lectores de pantalla la leen). */
  etiquetaOculta?: boolean;
  valor: string;
  alCambiar: (texto: string) => void;
  /** Si true, vacío se queda vacío al salir (p. ej. "Recibido", que es opcional). */
  vacioPermitido?: boolean;
  autoFocus?: boolean;
  entradaRef?: Ref<HTMLInputElement>;
  className?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export function CampoDinero({
  id,
  etiqueta,
  etiquetaOculta = false,
  valor,
  alCambiar,
  vacioPermitido = false,
  autoFocus,
  entradaRef,
  className = '',
  onKeyDown,
}: Props) {
  const centavos = textoACentavos(valor);
  const invalido = centavos === null;
  return (
    <div className={`campo-dinero ${className}`}>
      <label htmlFor={id} className={etiquetaOculta ? 'solo-lectores' : 'campo__etiqueta'}>
        {etiqueta}
      </label>
      <div className={invalido ? 'campo-dinero__caja campo-dinero__caja--invalido' : 'campo-dinero__caja'}>
        <span className="campo-dinero__prefijo" aria-hidden="true">
          L
        </span>
        <input
          id={id}
          ref={entradaRef}
          className="campo-dinero__entrada"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={valor}
          autoFocus={autoFocus}
          aria-invalid={invalido}
          aria-describedby={invalido ? `${id}-error` : undefined}
          onChange={(e) => alCambiar(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (centavos === null) return;
            if (valor.trim() === '' && vacioPermitido) return;
            alCambiar(centavosATexto(centavos));
          }}
        />
      </div>
      {invalido && (
        <p id={`${id}-error`} className="campo-dinero__error" role="alert">
          Monto no válido
        </p>
      )}
    </div>
  );
}
