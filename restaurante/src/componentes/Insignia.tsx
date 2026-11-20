import type { ReactNode } from 'react';

type Tipo = 'ok' | 'alerta' | 'peligro' | 'primario' | 'neutra';

export function Insignia({ tipo, children }: { tipo: Tipo; children: ReactNode }) {
  return <span className={`insignia insignia--${tipo}`}>{children}</span>;
}
