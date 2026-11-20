// Diferencia de efectivo como insignia: "Cuadra ✓", "Sobran $50.00", "Faltan $120.00", "En curso".
// Si cuadra por menos de 50¢, debajo va la nota "(diferencia de $0.30 por centavos)".
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
