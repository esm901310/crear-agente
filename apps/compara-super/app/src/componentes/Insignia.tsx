import { Icono } from './Icono';

type Tipo = 'mas-barato' | 'no-disponible' | 'sustituto' | 'mismo-precio';

const TEXTOS: Record<Tipo, string> = {
  'mas-barato': 'Más barato',
  'no-disponible': 'No disponible',
  sustituto: 'Sustituto',
  'mismo-precio': 'Mismo precio',
};

export function Insignia({ tipo }: { tipo: Tipo }) {
  return (
    <span className={`insignia insignia-${tipo}`}>
      {(tipo === 'mas-barato' || tipo === 'mismo-precio') && <Icono nombre="check" tamano={16} />}
      {tipo === 'no-disponible' && <Icono nombre="prohibido" tamano={16} />}
      {TEXTOS[tipo]}
    </span>
  );
}
