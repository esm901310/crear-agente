// Diferencia de efectivo como insignia: "Cuadra ✓", "Sobran $50.00", "Faltan $120.00", "En curso".
import { textoDiferencia, tipoDiferencia } from '../dia';
import { Insignia } from './Insignia';

export function Diferencia({ valor }: { valor: number | null }) {
  return <Insignia tipo={tipoDiferencia(valor)}>{textoDiferencia(valor)}</Insignia>;
}
