import { useId, useState, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { Icono } from './Icono';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'id'> {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  error?: ReactNode;
  ayuda?: ReactNode;
  /** Agrega el botón "Mostrar / Ocultar" (para contraseñas). */
  conMostrar?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/** Campo con etiqueta arriba, ayuda y mensaje de error con ícono debajo. */
export function CampoTexto({ etiqueta, valor, alCambiar, error, ayuda, conMostrar, type, ref, ...resto }: Props) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const describe = [error ? idError : null, ayuda ? idAyuda : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="campo">
      <label className="campo-etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <div className={error ? 'campo-caja campo-caja-error' : 'campo-caja'}>
        <input
          ref={ref}
          id={id}
          className="campo-entrada"
          type={conMostrar ? (visible ? 'text' : 'password') : type}
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describe}
          {...resto}
        />
        {conMostrar && (
          <button
            type="button"
            className="campo-mostrar"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {visible ? 'Ocultar' : 'Mostrar'}
          </button>
        )}
      </div>
      {error && (
        <p className="campo-error" id={idError}>
          <Icono nombre="alerta" tamano={18} />
          <span>{error}</span>
        </p>
      )}
      {ayuda && (
        <p className="campo-ayuda" id={idAyuda}>
          {ayuda}
        </p>
      )}
    </div>
  );
}
