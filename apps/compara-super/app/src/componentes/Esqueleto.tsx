interface Props {
  ancho?: string | number;
  alto?: string | number;
  className?: string;
}

/** Barra gris donde irá un dato que todavía se está buscando. */
export function Esqueleto({ ancho = '100%', alto = 16, className }: Props) {
  return (
    <span
      className={className ? `esqueleto ${className}` : 'esqueleto'}
      style={{ width: ancho, height: alto }}
      aria-hidden="true"
    />
  );
}
