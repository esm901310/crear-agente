import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Barra fija abajo (acciones principales al alcance del pulgar). Publica su alto
 * en la variable CSS --alto-barra para que el contenido y los mensajes breves
 * no queden tapados.
 */
export function BarraInferior({ children, gris = false }: { children: ReactNode; gris?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const raiz = document.documentElement;
    const publicar = () => raiz.style.setProperty('--alto-barra', `${el.offsetHeight}px`);
    publicar();
    const observador = new ResizeObserver(publicar);
    observador.observe(el);
    return () => {
      observador.disconnect();
      raiz.style.setProperty('--alto-barra', '0px');
    };
  }, []);
  return (
    <div ref={ref} className={gris ? 'barra-inferior barra-inferior-gris' : 'barra-inferior'}>
      {children}
    </div>
  );
}
