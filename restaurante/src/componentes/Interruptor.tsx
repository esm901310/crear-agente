// Interruptor con texto siempre visible (docs/diseno.md, 29.2): encendido verde / apagado rojo.
interface Props {
  encendido: boolean;
  /** Nombre accesible, p. ej. "King crab disponible". */
  etiqueta: string;
  textoEncendido?: string;
  textoApagado?: string;
  disabled?: boolean;
  alCambiar: (encendido: boolean) => void;
}

export function Interruptor({
  encendido,
  etiqueta,
  textoEncendido = 'Disponible',
  textoApagado = 'Agotado',
  disabled = false,
  alCambiar,
}: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={encendido}
      aria-label={etiqueta}
      disabled={disabled}
      className={encendido ? 'interruptor interruptor--si' : 'interruptor interruptor--no'}
      onClick={() => alCambiar(!encendido)}
    >
      <span className="interruptor__riel" aria-hidden="true">
        <span className="interruptor__bola" />
      </span>
      <span className="interruptor__texto">{encendido ? textoEncendido : textoApagado}</span>
    </button>
  );
}
