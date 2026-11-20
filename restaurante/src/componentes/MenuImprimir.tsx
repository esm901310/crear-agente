// Botón "Imprimir ▾" con dos opciones: hoja carta o ticket de 80 mm (docs/diseno.md, 19.10).
// Antes de imprimir pone en <body> la clase imprimir-carta / imprimir-ticket y la quita al terminar.
import { useEffect, useRef, useState } from 'react';

export type FormatoImpresion = 'carta' | 'ticket';
const LLAVE = 'formato-impresion';

function leerFormato(): FormatoImpresion {
  return localStorage.getItem(LLAVE) === 'ticket' ? 'ticket' : 'carta';
}

interface Props {
  /** Se llama justo antes de abrir el diálogo de impresión (p. ej. para anotar la hora). */
  antesDeImprimir?: () => void;
}

export function MenuImprimir({ antesDeImprimir }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [ultimo, setUltimo] = useState<FormatoImpresion>(leerFormato);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', esc);
    };
  }, [abierto]);

  const imprimir = (formato: FormatoImpresion) => {
    setAbierto(false);
    setUltimo(formato);
    localStorage.setItem(LLAVE, formato);
    antesDeImprimir?.();
    const clase = `imprimir-${formato}`;
    document.body.classList.remove('imprimir-carta', 'imprimir-ticket');
    document.body.classList.add(clase);
    const quitar = () => {
      document.body.classList.remove(clase);
      window.removeEventListener('afterprint', quitar);
    };
    window.addEventListener('afterprint', quitar);
    // Un instante para que React pinte la hora de impresión antes de abrir el diálogo.
    setTimeout(() => window.print(), 50);
  };

  return (
    <div className="menu-imprimir no-imprimir" ref={caja}>
      <button
        type="button"
        className="boton boton--secundario boton--chico"
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
      >
        Imprimir ▾
      </button>
      {abierto && (
        <div className="menu-imprimir__opciones" role="menu">
          {(['carta', 'ticket'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="menuitem"
              className="menu-imprimir__opcion"
              autoFocus={f === ultimo}
              onClick={() => imprimir(f)}
            >
              {f === 'carta' ? 'Hoja carta' : 'Ticket (80 mm)'}
              {f === ultimo && <span className="texto-2"> · última usada</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
