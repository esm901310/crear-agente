// Diferencia de efectivo como insignia: "Cuadra ✓", "Sobran L 50.00", "Faltan L 120.00", "En curso".
// Si cuadra por menos de L1.00, debajo va la nota "(diferencia de L 0.40 por centavos)".
import { notaCentavos, textoDiferencia, tipoDiferencia } from '../dia';
import { Insignia } from './Insignia';

export function Diferencia({ valor }: { valor: number | null }) {
  const nota = notaCentavos(valor);
  return (
    <span className="diferencia">
      <Insignia tipo={tipoDiferencia(valor)}>{textoDiferencia(valor)}</Insignia>
      {nota && <span className="diferencia__nota">{nota}</span>}
    </span>
  );
}
