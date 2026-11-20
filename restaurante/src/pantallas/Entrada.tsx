// P1 + P2: elegir nombre y escribir PIN.
import { useState } from 'react';
import type { Usuario } from '../tipos';
import { ElegirNombre } from './ElegirNombre';
import { TecladoPin } from './TecladoPin';

interface Props {
  sesionVencida: boolean;
  alEntrar: (token: string, usuario: Usuario) => void;
}

export function Entrada({ sesionVencida, alEntrar }: Props) {
  const [elegido, setElegido] = useState<Usuario | null>(null);
  return elegido ? (
    <TecladoPin usuario={elegido} alCambiar={() => setElegido(null)} alEntrar={alEntrar} />
  ) : (
    <ElegirNombre sesionVencida={sesionVencida} alElegir={setElegido} />
  );
}
