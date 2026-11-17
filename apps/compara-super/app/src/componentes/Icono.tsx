// Íconos de línea de 24 px. Son decorativos (aria-hidden): siempre van con texto
// o dentro de un botón con etiqueta accesible.
export type NombreIcono =
  | 'atras'
  | 'persona'
  | 'lupa'
  | 'cerrar'
  | 'check'
  | 'prohibido'
  | 'reloj'
  | 'mas'
  | 'menos'
  | 'alerta'
  | 'info'
  | 'flecha-derecha'
  | 'sin-conexion';

const TRAZOS: Record<NombreIcono, string> = {
  atras: 'M15 5l-7 7 7 7M8 12h12',
  persona: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5',
  lupa: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L20 20',
  cerrar: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  prohibido: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8',
  reloj: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  mas: 'M12 5v14M5 12h14',
  menos: 'M5 12h14',
  alerta: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5v5.5M12 16.5v.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 7.5v.01',
  'flecha-derecha': 'M9 5l7 7-7 7',
  'sin-conexion': 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M14 10.3A10 10 0 0 1 19 13M2 9.5a15 15 0 0 1 5-3M12 5.5a15 15 0 0 1 10 4M12 20h.01',
};

interface Props {
  nombre: NombreIcono;
  tamano?: number;
  className?: string;
}

export function Icono({ nombre, tamano = 24, className }: Props) {
  return (
    <svg
      className={className ? `icono ${className}` : 'icono'}
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}
