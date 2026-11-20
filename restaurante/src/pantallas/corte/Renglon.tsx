// Renglón de ticket: "Nombre ........ $monto".
import type { ReactNode } from 'react';

export function Renglon({ nombre, valor, fuerte = false }: { nombre: ReactNode; valor: ReactNode; fuerte?: boolean }) {
  return (
    <p className={fuerte ? 'ticket-renglon ticket-renglon--fuerte' : 'ticket-renglon'}>
      <span className="ticket-renglon__nombre">{nombre}</span>
      <span className="ticket-renglon__puntos" aria-hidden="true" />
      <span className="ticket-renglon__valor">{valor}</span>
    </p>
  );
}
