import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  etiqueta: string;
  alCerrar?: () => void;
  /** Avisa la altura visible del panel (para que la página deje espacio). */
  alCambiarAltura?: (px: number) => void;
  children: ReactNode;
  className?: string;
}

/** Panel que sube desde abajo, se ajusta al teclado y se cierra deslizando hacia abajo. */
export default function PanelInferior({ etiqueta, alCerrar, alCambiarAltura, children, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [teclado, setTeclado] = useState(0);
  const [arrastre, setArrastre] = useState(0);
  const inicio = useRef<number | null>(null);

  // Sube con el teclado del celular.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const ajustar = () => setTeclado(Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)));
    ajustar();
    vv.addEventListener('resize', ajustar);
    vv.addEventListener('scroll', ajustar);
    return () => {
      vv.removeEventListener('resize', ajustar);
      vv.removeEventListener('scroll', ajustar);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !alCambiarAltura) return;
    const obs = new ResizeObserver(() => alCambiarAltura(el.offsetHeight + teclado));
    obs.observe(el);
    alCambiarAltura(el.offsetHeight + teclado);
    return () => obs.disconnect();
  }, [alCambiarAltura, teclado]);

  useEffect(() => () => alCambiarAltura?.(0), [alCambiarAltura]);

  return (
    <div
      ref={ref}
      className={`panel-inferior ${className}`}
      role="dialog"
      aria-label={etiqueta}
      style={{ bottom: teclado, transform: arrastre ? `translateY(${arrastre}px)` : undefined }}
    >
      <div
        className="panel-agarradera-zona"
        onPointerDown={(e) => {
          if (!alCerrar) return;
          inicio.current = e.clientY;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (inicio.current === null) return;
          setArrastre(Math.max(0, e.clientY - inicio.current));
        }}
        onPointerUp={() => {
          if (inicio.current === null) return;
          const cerrar = arrastre > 80;
          inicio.current = null;
          setArrastre(0);
          if (cerrar) alCerrar?.();
        }}
        onPointerCancel={() => {
          inicio.current = null;
          setArrastre(0);
        }}
      >
        <div className="panel-agarradera" aria-hidden="true" />
      </div>
      <div className="panel-contenido">{children}</div>
    </div>
  );
}
