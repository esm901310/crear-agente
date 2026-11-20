// Nombre de un platillo en pantalla: el producto (con su opción) y, abajo y en gris, el tamaño
// o talla ("Piscina" / "adultos"), para que no se confunda con parte del nombre.
// El nombre guardado por el servidor no cambia ("Piscina · adultos"); solo cómo se muestra.
import type { ReactNode } from 'react';

interface Props {
  /** Ya compuesto: "Pescado rojo · Talla 3 (Frito)". */
  nombre: string;
  variante: string | null;
  /** Insignias u otros agregados que van junto al nombre (antes del tamaño). */
  children?: ReactNode;
}

export function NombrePlatillo({ nombre, variante, children }: Props) {
  const marca = variante ? ` · ${variante}` : '';
  const i = marca ? nombre.lastIndexOf(marca) : -1;
  if (i < 0) {
    return (
      <>
        {nombre}
        {children}
      </>
    );
  }
  const base = nombre.slice(0, i) + nombre.slice(i + marca.length);
  return (
    <>
      {base}
      {children}
      <span className="nombre-variante">
        <span className="solo-lectores">, </span>
        {variante}
      </span>
    </>
  );
}
