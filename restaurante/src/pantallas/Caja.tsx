// C1 — Caja: lista de cuentas abiertas, detalle y cobro.
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { Cargando } from '../componentes/Cargando';
import { Encabezado } from '../componentes/Encabezado';
import { useToast } from '../componentes/Toast';
import { useAhora } from '../hooks/useAhora';
import { usePolling } from '../hooks/usePolling';
import { navegar } from '../hooks/useRuta';
import type { Orden } from '../tipos';
import { CobroExitoso } from './CobroExitoso';
import { DetalleCuenta } from './DetalleCuenta';
import { ListaCuentas } from './ListaCuentas';
import { PanelCobro } from './PanelCobro';

export function Caja({ ordenIdRuta }: { ordenIdRuta: number | null }) {
  const toast = useToast();
  const { datos: ordenes, error, cargando, recargar } = usePolling(api.cajaOrdenes);
  const ahora = useAhora(30000);
  const [cobrada, setCobrada] = useState<{ orden: Orden; cambio: number | null } | null>(null);
  const idsAnteriores = useRef<number[]>([]);

  const elegir = (id: number | null, reemplazar = false) => {
    setCobrada(null);
    navegar(id === null ? '/caja' : `/caja/${id}`, reemplazar);
  };

  // Mantener una cuenta seleccionada (la de la URL, o la primera si no existe).
  useEffect(() => {
    if (!ordenes) return;
    const anteriores = idsAnteriores.current;
    idsAnteriores.current = ordenes.map((o) => o.id);
    if (cobrada) return; // la confirmación se queda hasta "Siguiente cuenta"
    if (ordenIdRuta !== null && ordenes.some((o) => o.id === ordenIdRuta)) return;

    if (ordenIdRuta !== null && anteriores.includes(ordenIdRuta)) {
      toast({ texto: 'Esta cuenta ya no está abierta.', tipo: 'error' });
      // La siguiente en la lista (la que quedó en su lugar), o la última.
      const i = anteriores.indexOf(ordenIdRuta);
      const siguiente = ordenes.find((o) => anteriores.indexOf(o.id) > i) ?? ordenes[ordenes.length - 1];
      navegar(siguiente ? `/caja/${siguiente.id}` : '/caja', true);
      return;
    }
    navegar(ordenes[0] ? `/caja/${ordenes[0].id}` : '/caja', true);
  }, [ordenes, ordenIdRuta, cobrada, toast]);

  const seleccionada = ordenes?.find((o) => o.id === ordenIdRuta) ?? null;

  let cuerpo;
  if (cargando) {
    cuerpo = <Cargando />;
  } else if (!ordenes) {
    cuerpo = (
      <div className="vacio">
        <p>{error?.message ?? 'Algo salió mal. Intenta de nuevo.'}</p>
        <button type="button" className="boton boton--primario" onClick={recargar}>
          Reintentar
        </button>
      </div>
    );
  } else if (ordenes.length === 0 && !cobrada) {
    cuerpo = (
      <div className="vacio vacio--pantalla">
        <p className="texto-grande">No hay cuentas abiertas.</p>
        <p className="texto-2">Cuando un mesero envíe un pedido, la cuenta aparecerá aquí.</p>
      </div>
    );
  } else {
    const detalle = cobrada?.orden ?? seleccionada;
    cuerpo = (
      <div className="caja">
        <ListaCuentas
          ordenes={ordenes}
          seleccionada={cobrada ? null : (seleccionada?.id ?? null)}
          ahora={ahora}
          alElegir={(id) => elegir(id)}
        />
        {detalle ? <DetalleCuenta orden={detalle} ahora={ahora} /> : <section className="caja__detalle" />}
        {cobrada ? (
          <CobroExitoso
            orden={cobrada.orden}
            cambio={cobrada.cambio}
            alSiguiente={() => elegir(ordenes[0]?.id ?? null, true)}
          />
        ) : seleccionada ? (
          <PanelCobro
            key={seleccionada.id}
            orden={seleccionada}
            recargar={recargar}
            alCobrar={(orden, cambio) => {
              setCobrada({ orden, cambio });
              recargar();
            }}
          />
        ) : (
          <section className="caja__cobro" />
        )}
      </div>
    );
  }

  return (
    <>
      <Encabezado vista="Caja" />
      <main className="contenido-caja">{cuerpo}</main>
    </>
  );
}
