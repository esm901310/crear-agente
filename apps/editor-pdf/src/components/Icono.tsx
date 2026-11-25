type NombreIcono =
  | 'atras'
  | 'deshacer'
  | 'rehacer'
  | 'cerrar'
  | 'anterior'
  | 'siguiente'
  | 'ojo'
  | 'ojoTachado'
  | 'mas'
  | 'menos'
  | 'exito'
  | 'error'
  | 'aviso'
  | 'pdf';

const TRAZOS: Record<NombreIcono, string> = {
  atras: 'M15 5l-7 7 7 7',
  deshacer: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  rehacer: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3',
  cerrar: 'M6 6l12 12M18 6L6 18',
  anterior: 'M15 5l-7 7 7 7',
  siguiente: 'M9 5l7 7-7 7',
  ojo: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  ojoTachado: 'M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.2M6.6 6.6A17 17 0 002 12s3.5 7 10 7a9.7 9.7 0 005.4-1.6M9.9 9.9a3 3 0 004.2 4.2',
  mas: 'M12 5v14M5 12h14',
  menos: 'M5 12h14',
  exito: 'M20 6L9 17l-5-5',
  error: 'M12 8v5M12 16.5v.5M10.3 3.9L2.4 17.5A2 2 0 004.1 20.5h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  aviso: 'M12 8v5M12 16.5v.5M12 3a9 9 0 100 18 9 9 0 000-18z',
  pdf: 'M6 2h9l5 5v15H6zM14 2v6h6',
};

interface Props {
  nombre: NombreIcono;
  tamano?: number;
}

export type { NombreIcono };

export default function Icono({ nombre, tamano = 24 }: Props) {
  return (
    <svg
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
