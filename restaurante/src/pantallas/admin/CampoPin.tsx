// Campo de PIN de 4 números, oculto (●●●●) con botón "Mostrar" (docs/diseno.md, 30.4).
import { useState } from 'react';

interface Props {
  id: string;
  etiqueta: string;
  valor: string;
  alCambiar: (pin: string) => void;
  invalido?: boolean;
  autoFocus?: boolean;
  describedBy?: string;
}

/** ¿El PIN es fácil de adivinar? 4 iguales o seguidos ("1234", "4321"). */
export function pinFacil(pin: string): boolean {
  if (!/^\d{4}$/.test(pin)) return false;
  const d = [...pin].map(Number);
  const iguales = d.every((x) => x === d[0]);
  const sube = d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  const baja = d.every((x, i) => i === 0 || x === d[i - 1] - 1);
  return iguales || sube || baja;
}

export function CampoPin({ id, etiqueta, valor, alCambiar, invalido = false, autoFocus, describedBy }: Props) {
  const [mostrar, setMostrar] = useState(false);
  return (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <div className="campo-pin">
        <input
          id={id}
          className="campo__entrada campo-pin__entrada"
          type={mostrar ? 'text' : 'password'}
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={4}
          value={valor}
          autoFocus={autoFocus}
          aria-invalid={invalido}
          aria-describedby={describedBy}
          onChange={(e) => alCambiar(e.target.value.replace(/\D/g, '').slice(0, 4))}
        />
        <button type="button" className="boton boton--secundario boton--chico" aria-pressed={mostrar} onClick={() => setMostrar((m) => !m)}>
          {mostrar ? 'Ocultar' : 'Mostrar'}
          <span className="solo-lectores"> {etiqueta}</span>
        </button>
      </div>
    </div>
  );
}
