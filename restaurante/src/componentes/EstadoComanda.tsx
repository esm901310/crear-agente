import type { Comanda, ItemComanda } from '../tipos';
import { Insignia } from './Insignia';

/**
 * Insignia del encabezado de una comanda. El estado se refiere solo a los items de cocina;
 * una comanda sin items de cocina dice "No va a cocina" (docs/diseno.md, 27.6).
 */
export function EstadoComanda({ comanda }: { comanda: Pick<Comanda, 'estado' | 'items'> }) {
  if (!comanda.items.some((i) => i.va_a_cocina)) return <Insignia tipo="neutra">No va a cocina</Insignia>;
  return comanda.estado === 'listo' ? <Insignia tipo="ok">Listo ✓</Insignia> : <Insignia tipo="alerta">En preparación</Insignia>;
}

/** ¿Este item lleva la insignia pequeña "No va a cocina"? Solo en comandas mixtas. */
export function marcarNoVaACocina(item: ItemComanda, comanda: Pick<Comanda, 'items'>): boolean {
  return !item.va_a_cocina && comanda.items.some((i) => i.va_a_cocina);
}

/** ¿La comanda tiene platillos pendientes en cocina? */
export function pendienteEnCocina(comanda: Pick<Comanda, 'estado' | 'items'>): boolean {
  return comanda.estado === 'pendiente' && comanda.items.some((i) => i.va_a_cocina);
}
