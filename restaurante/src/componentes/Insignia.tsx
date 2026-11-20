import type { ReactNode } from 'react';

export function Insignia({ tipo, children }: { tipo: 'ok' | 'alerta' | 'peligro' | 'primario'; children: ReactNode }) {
  return <span className={`insignia insignia--${tipo}`}>{children}</span>;
}
