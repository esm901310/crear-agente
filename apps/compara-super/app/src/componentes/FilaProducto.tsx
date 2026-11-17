import { useRef, useState, type PointerEvent } from 'react';
import type { ItemLista, Tienda } from '../api/cliente';
import { precioMinimo, tiendasSinProducto } from '../logica/comparar';
import { detalleGrupo } from '../logica/formato';
import { unirNombres } from '../logica/tiendas';
import { Esqueleto } from './Esqueleto';
import { Icono } from './Icono';
import { Precio } from './Precio';
import { SelectorCantidad } from './SelectorCantidad';

interface Props {
  item: ItemLista;
  tiendas: Tienda[];
  buscandoPrecios: boolean;
  alCambiarCantidad: (cantidad: number) => void;
  /** Al bajar de 1: se pregunta antes de quitar. */
  alPedirQuitar: () => void;
  /** "Quitar" al deslizar o mantener presionado: quita directo (con Deshacer). */
  alQuitar: () => void;
}

const ANCHO_QUITAR = 96;

/** Fila de producto de P5. Deslizar a la izquierda o mantener presionado muestra "Quitar". */
export function FilaProducto({ item, tiendas, buscandoPrecios, alCambiarCantidad, alPedirQuitar, alQuitar }: Props) {
  const [desplazamiento, setDesplazamiento] = useState(0);
  const [abierta, setAbierta] = useState(false);
  const inicio = useRef<{ x: number; y: number; base: number; arrastrando: boolean } | null>(null);
  const presion = useRef<number | undefined>(undefined);

  const minimo = precioMinimo(item.grupo, tiendas.length ? tiendas : undefined);
  const faltan = tiendas.length > 1 ? tiendasSinProducto(item, tiendas) : [];
  const detalle = detalleGrupo(item.grupo);

  function abrir(si: boolean) {
    setAbierta(si);
    setDesplazamiento(si ? -ANCHO_QUITAR : 0);
  }

  function alBajar(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    inicio.current = { x: e.clientX, y: e.clientY, base: abierta ? -ANCHO_QUITAR : 0, arrastrando: false };
    window.clearTimeout(presion.current);
    presion.current = window.setTimeout(() => {
      if (inicio.current && !inicio.current.arrastrando) abrir(true);
    }, 550);
  }

  function alMover(e: PointerEvent) {
    const i = inicio.current;
    if (!i) return;
    const dx = e.clientX - i.x;
    const dy = e.clientY - i.y;
    if (!i.arrastrando) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        inicio.current = null; // es desplazamiento vertical
        window.clearTimeout(presion.current);
        return;
      }
      if (Math.abs(dx) < 10) return;
      i.arrastrando = true;
      window.clearTimeout(presion.current);
    }
    setDesplazamiento(Math.max(-ANCHO_QUITAR - 24, Math.min(0, i.base + dx)));
  }

  function alSoltar() {
    window.clearTimeout(presion.current);
    const i = inicio.current;
    inicio.current = null;
    if (!i?.arrastrando) return;
    abrir(desplazamiento < -ANCHO_QUITAR / 2);
  }

  return (
    <li className="fila-producto">
      <button
        type="button"
        className="fila-quitar"
        onClick={alQuitar}
        tabIndex={abierta ? 0 : -1}
        aria-hidden={!abierta}
      >
        Quitar
      </button>
      <div
        className="fila-producto-contenido"
        style={{ transform: `translateX(${desplazamiento}px)` }}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onContextMenu={(e) => e.preventDefault()}
        onClickCapture={(e) => {
          if (abierta) {
            e.stopPropagation();
            e.preventDefault();
            abrir(false);
          }
        }}
      >
        <div className="fila-producto-cabeza">
          <div className="fila-producto-textos">
            <p className="fila-producto-nombre">{item.grupo.nombre}</p>
            {detalle && <p className="texto-secundario">{detalle}</p>}
          </div>
          <div className="fila-producto-precio texto-secundario">
            {buscandoPrecios ? (
              <Esqueleto ancho={96} alto={18} />
            ) : minimo ? (
              <Precio valor={minimo.valor} prefijo="desde" />
            ) : null}
          </div>
        </div>
        {!buscandoPrecios && faltan.length > 0 && (
          <p className="texto-ambar linea-icono">
            <Icono nombre="prohibido" tamano={18} />
            <span>No disponible en {unirNombres(faltan, 'y')}</span>
          </p>
        )}
        <SelectorCantidad
          cantidad={item.cantidad}
          nombre={item.grupo.nombre}
          alCambiar={alCambiarCantidad}
          alBajarDeUno={alPedirQuitar}
        />
      </div>
    </li>
  );
}
