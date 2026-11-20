// Subtotal con la regla del pasadía (consumo mínimo): se cobra max(consumo, pasadía).
// Docs/diseno.md, 28.1. Sin pasadía se ve el "Subtotal" de siempre.
import { dinero } from '../formato';
import type { Orden } from '../tipos';

interface Props {
  orden: Pick<Orden, 'consumo' | 'pasadia' | 'subtotal' | 'comandas'>;
  /** Clase del monto del subtotal normal (p. ej. "monto-2xl" en el mesero, "monto-xl" en caja). */
  claseMonto?: string;
  className?: string;
}

/** Personas con pasadía: suma de cantidades de los items de pasadía. */
export function personasPasadia(orden: Pick<Orden, 'comandas'>): number {
  return orden.comandas.reduce((s, c) => s + c.items.filter((i) => i.es_pasadia).reduce((t, i) => t + i.cantidad, 0), 0);
}

/** Línea del contrato: "Pasadía L 1,200.00 · Consumo L 900.00 → se cobra L 1,200.00" o la del caso B. */
export function lineaPasadia(o: Pick<Orden, 'consumo' | 'pasadia' | 'subtotal'>): string | null {
  if (o.pasadia <= 0) return null;
  if (o.consumo < o.pasadia) return `Pasadía ${dinero(o.pasadia)} · Consumo ${dinero(o.consumo)} → se cobra ${dinero(o.subtotal)}`;
  return `Consumo ${dinero(o.consumo)} (incluye pasadía de ${dinero(o.pasadia)})`;
}

export function ResumenPasadia({ orden, claseMonto = 'monto-2xl', className = '' }: Props) {
  const { consumo, pasadia, subtotal } = orden;
  if (pasadia <= 0) {
    return (
      <div className={`resumen-subtotal ${className}`}>
        <span>Subtotal</span>
        <span className={claseMonto}>{dinero(subtotal)}</span>
      </div>
    );
  }
  if (consumo < pasadia) {
    const personas = personasPasadia(orden);
    return (
      <div className={`pasadia-caja ${className}`}>
        <div className="pasadia-caja__renglon">
          <span>Pasadía ({personas} {personas === 1 ? 'persona' : 'personas'})</span>
          <span className="numeros">{dinero(pasadia)}</span>
        </div>
        <div className="pasadia-caja__renglon">
          <span>Consumo</span>
          <span className="numeros">{dinero(consumo)}</span>
        </div>
        <div className="pasadia-caja__renglon pasadia-caja__total">
          <span>Se cobra</span>
          <span className="numeros">{dinero(subtotal)}</span>
        </div>
        <p className="pasadia-caja__contrato">{lineaPasadia(orden)}</p>
        <p className="pasadia-caja__mas">Pueden consumir {dinero(pasadia - consumo)} más sin pagar extra.</p>
      </div>
    );
  }
  return (
    <div className={`resumen-subtotal resumen-subtotal--pasadia ${className}`}>
      <div className="resumen-subtotal__fila">
        <span>Subtotal</span>
        <span className={claseMonto}>{dinero(subtotal)}</span>
      </div>
      <p className="resumen-subtotal__linea">{lineaPasadia(orden)}</p>
      <p className="resumen-subtotal__ayuda">El pasadía ya quedó cubierto con el consumo.</p>
    </div>
  );
}
