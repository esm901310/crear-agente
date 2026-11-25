interface Props {
  /** 0 a 1 */
  valor: number;
  texto?: string;
}

export default function BarraProgreso({ valor, texto }: Props) {
  const porcentaje = Math.round(Math.min(1, Math.max(0, valor)) * 100);
  return (
    <div className="progreso">
      <div className="progreso-textos">
        <span>{texto}</span>
        <span>{porcentaje} %</span>
      </div>
      <div className="progreso-pista" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcentaje} aria-valuetext={texto ? `${texto}, ${porcentaje} %` : `${porcentaje} %`}>
        <div className="progreso-relleno" style={{ width: `${porcentaje}%` }} />
      </div>
    </div>
  );
}
