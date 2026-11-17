import { Ilustracion } from '../componentes/Ilustracion';

export function Cargando() {
  return (
    <main className="pantalla pantalla-centro" aria-busy="true">
      <Ilustracion tipo="carrito" />
      <p className="solo-lector">Cargando Comparar Súper…</p>
    </main>
  );
}
