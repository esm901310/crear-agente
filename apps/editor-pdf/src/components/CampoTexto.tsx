import { forwardRef, type InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  ayuda?: string;
  aviso?: string;
  id: string;
}

const CampoTexto = forwardRef<HTMLInputElement, Props>(function CampoTexto(
  { etiqueta, ayuda, aviso, id, ...resto },
  ref,
) {
  const descripcion = [ayuda ? `${id}-ayuda` : '', aviso ? `${id}-aviso` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className="campo">
      <label htmlFor={id} className="campo-etiqueta">
        {etiqueta}
      </label>
      <input ref={ref} id={id} className="campo-entrada" type="text" autoComplete="off" aria-describedby={descripcion} {...resto} />
      {ayuda ? (
        <p id={`${id}-ayuda`} className="campo-ayuda">
          {ayuda}
        </p>
      ) : null}
      {aviso ? (
        <p id={`${id}-aviso`} className="campo-aviso">
          {aviso}
        </p>
      ) : null}
    </div>
  );
});

export default CampoTexto;
