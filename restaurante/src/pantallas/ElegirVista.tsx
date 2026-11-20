// P3 — Solo dueño: elegir a qué vista ir.
import { Encabezado } from '../componentes/Encabezado';
import { navegar } from '../hooks/useRuta';

const VISTAS = [
  { ruta: '/mesas', titulo: 'Meseros', texto: 'Mesas y pedidos' },
  { ruta: '/cocina', titulo: 'Cocina', texto: 'Comandas por preparar' },
  { ruta: '/caja', titulo: 'Caja', texto: 'Cobrar cuentas' },
  { ruta: '/cortes', titulo: 'Cortes y propinas', texto: 'Cortes del día y reparto de propinas' },
];

export function ElegirVista() {
  return (
    <>
      <Encabezado vista="Inicio" />
      <main className="contenido elegir-vista">
        <h2 className="titulo-xl">¿A dónde quieres ir?</h2>
        <div className="elegir-vista__opciones">
          {VISTAS.map((v) => (
            <button key={v.ruta} type="button" className="vista-tarjeta" onClick={() => navegar(v.ruta)}>
              <span className="vista-tarjeta__titulo">{v.titulo}</span>
              <span className="vista-tarjeta__texto">{v.texto}</span>
            </button>
          ))}
        </div>
      </main>
    </>
  );
}
