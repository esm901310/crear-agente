import { useEffect, useState, type ReactNode } from 'react';
import { esSinConexion, type RespuestaComparar } from '../api/cliente';
import { unirNombres } from '../logica/tiendas';
import { EtiquetaTienda } from './EtiquetaTienda';
import { Precio } from './Precio';

interface Props {
  estado: 'inactivo' | 'cargando' | 'listo' | 'error';
  comparacion: RespuestaComparar | null;
  error: unknown;
}

/** Línea de resumen de la barra inferior de P5 ("Más barato: La Colonia · L 812.50"). */
export function ResumenLista({ estado, comparacion, error }: Props) {
  const [tardando, setTardando] = useState(false);
  useEffect(() => {
    if (estado !== 'cargando') {
      setTardando(false);
      return;
    }
    const t = window.setTimeout(() => setTardando(true), 8000);
    return () => window.clearTimeout(t);
  }, [estado]);

  let contenido: ReactNode = null;

  if (estado === 'cargando') {
    contenido = tardando
      ? 'Esto está tardando más de lo normal. Seguimos buscando.'
      : 'Buscando los precios de hoy…';
  } else if (estado === 'error' && !comparacion) {
    contenido = esSinConexion(error)
      ? 'No hay conexión. Tu lista está guardada.'
      : 'No pudimos consultar los precios.';
  } else if (comparacion) {
    const ganador = comparacion.tiendas.find((t) => t.tienda === comparacion.ganador);
    const todasFallaron = comparacion.tiendas.every((t) => t.error);
    if (todasFallaron) {
      contenido = 'No pudimos consultar los precios.';
    } else if (ganador && comparacion.empate) {
      const empatadas = comparacion.tiendas
        .filter((t) => !t.error && t.completa && Math.abs(t.total - ganador.total) < 0.005)
        .map((t) => t.tienda);
      contenido = (
        <>
          Mismo precio en {unirNombres(empatadas)} · <Precio valor={ganador.total} className="precio-fuerte" />
        </>
      );
    } else if (ganador) {
      contenido = (
        <>
          <span className="resumen-etiqueta">Más barato:</span>{' '}
          <span className="resumen-ganador">
            <EtiquetaTienda tienda={ganador.tienda} completo />
            <span aria-hidden="true"> · </span>
            <Precio valor={ganador.total} className="precio-fuerte" />
          </span>
        </>
      );
    } else {
      contenido = 'Ningún súper tiene todos tus productos.';
    }
  }

  if (!contenido) return null;
  return (
    <p className="resumen-lista" aria-live="polite">
      {contenido}
    </p>
  );
}
