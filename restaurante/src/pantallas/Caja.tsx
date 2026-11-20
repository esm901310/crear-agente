// C1 — Caja: lista de cuentas abiertas, detalle y cobro, más el día (jornada):
// abrir el día, salidas de efectivo y "Cerrar el día". Ver docs/diseno.md, secciones 11 y 17.
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { Cargando } from '../componentes/Cargando';
import { Dialogo } from '../componentes/Dialogo';
import { Encabezado } from '../componentes/Encabezado';
import { FormAbrirDia } from '../componentes/FormAbrirDia';
import { useToast } from '../componentes/Toast';
import { useAhora } from '../hooks/useAhora';
import { usePolling } from '../hooks/usePolling';
import { navegar } from '../hooks/useRuta';
import type { JornadaActual, Orden } from '../tipos';
import { AbrirDiaPantalla } from './AbrirDiaPantalla';
import { CobroExitoso } from './CobroExitoso';
import { DetalleCuenta } from './DetalleCuenta';
import { DialogoSalida } from './DialogoSalida';
import { DialogoSalidas } from './DialogoSalidas';
import { LiberarMesa } from './LiberarMesa';
import { ListaCuentas } from './ListaCuentas';
import { PanelCobro } from './PanelCobro';
import { PanelDia } from './PanelDia';

type DialogoDia = 'abrir' | 'salida' | 'salidas' | null;

export function Caja({ ordenIdRuta }: { ordenIdRuta: number | null }) {
  const toast = useToast();
  const { datos: todas, error, cargando, recargar } = usePolling(api.cajaOrdenes);
  const dia = usePolling(api.jornadaActual);
  const jornada = dia.datos?.jornada ?? null;
  // Cuentas vacías que se acaban de liberar: se ocultan sin esperar a la siguiente consulta.
  const [liberadas, setLiberadas] = useState<ReadonlySet<number>>(new Set());
  const ordenes = useMemo(() => todas?.filter((o) => !liberadas.has(o.id)), [todas, liberadas]);
  const ahora = useAhora(30000);
  const [cobrada, setCobrada] = useState<{ orden: Orden; cambio: number | null } | null>(null);
  const [dialogo, setDialogo] = useState<DialogoDia>(null);
  const [abriendo, setAbriendo] = useState(false);
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
      if (!liberadas.has(ordenIdRuta)) toast({ texto: 'Esta cuenta ya no está abierta.', tipo: 'error' });
      // La siguiente en la lista (la que quedó en su lugar), o la última.
      const i = anteriores.indexOf(ordenIdRuta);
      const siguiente = ordenes.find((o) => anteriores.indexOf(o.id) > i) ?? ordenes[ordenes.length - 1];
      navegar(siguiente ? `/caja/${siguiente.id}` : '/caja', true);
      return;
    }
    navegar(ordenes[0] ? `/caja/${ordenes[0].id}` : '/caja', true);
  }, [ordenes, ordenIdRuta, cobrada, toast, liberadas]);

  // El día cambió desde otro equipo (por el polling).
  const jornadaAnterior = useRef<number | null | undefined>(undefined);
  const callarCierre = useRef(false);
  useEffect(() => {
    if (!dia.datos) return;
    const id = dia.datos.jornada?.id ?? null;
    const antes = jornadaAnterior.current;
    jornadaAnterior.current = id;
    if (antes === undefined) return;
    if (antes !== null && id === null) {
      if (!callarCierre.current) toast({ texto: 'El día se cerró desde otro equipo.' });
      callarCierre.current = false;
      if (dialogo === 'salida' || dialogo === 'salidas') setDialogo(null);
    }
    // Se abrió desde otro equipo: el diálogo "Abrir el día" ya no hace falta.
    if (antes === null && id !== null && dialogo === 'abrir' && !abriendo) setDialogo(null);
  }, [dia.datos, dialogo, abriendo, toast]);

  /** Después de abrir el día / registrar o anular una salida: poner la respuesta o recargar. */
  const actualizarDia = (j: JornadaActual | null) => {
    if (j) dia.poner({ jornada: j });
    else dia.recargar();
  };

  const seleccionada = ordenes?.find((o) => o.id === ordenIdRuta) ?? null;

  const dialogos = (
    <>
      {dialogo === 'abrir' && (
        <Dialogo titulo="Abrir el día" alCerrar={() => !abriendo && setDialogo(null)}>
          <FormAbrirDia
            alAbrir={(j) => {
              setDialogo(null);
              actualizarDia(j);
            }}
            alCancelar={() => setDialogo(null)}
            alCambiarOcupado={setAbriendo}
          />
        </Dialogo>
      )}
      {dialogo === 'salida' && (
        <DialogoSalida
          alCerrar={() => setDialogo(null)}
          alTerminar={(j) => {
            setDialogo(null);
            actualizarDia(j);
          }}
        />
      )}
      {dialogo === 'salidas' && jornada && (
        <DialogoSalidas
          salidas={jornada.salidas}
          alCerrar={() => setDialogo(null)}
          alNuevaSalida={() => setDialogo('salida')}
          alActualizar={(j) => {
            if (!j) setDialogo(null);
            actualizarDia(j);
          }}
        />
      )}
    </>
  );

  const panelDia = (
    <PanelDia
      jornada={jornada}
      alAbrirDia={() => setDialogo('abrir')}
      alSalida={() => setDialogo('salida')}
      alVerSalidas={() => setDialogo('salidas')}
    />
  );

  let cuerpo;
  if (cargando || dia.cargando) {
    cuerpo = <Cargando />;
  } else if (!dia.datos) {
    cuerpo = (
      <div className="vacio vacio--pantalla">
        <p className="texto-grande">No pudimos revisar si el día está abierto.</p>
        <button type="button" className="boton boton--primario" onClick={dia.recargar}>
          Reintentar
        </button>
      </div>
    );
  } else if (!ordenes) {
    cuerpo = (
      <div className="vacio">
        <p>{error?.message ?? 'Algo salió mal. Intenta de nuevo.'}</p>
        <button type="button" className="boton boton--primario" onClick={recargar}>
          Reintentar
        </button>
      </div>
    );
  } else if (!jornada && ordenes.length === 0 && !cobrada) {
    // Estado A: sin día abierto y sin cuentas.
    cuerpo = <AbrirDiaPantalla alAbrir={actualizarDia} />;
  } else if (ordenes.length === 0 && !cobrada) {
    // Día abierto sin cuentas: la columna izquierda (con el panel "Día") se queda.
    cuerpo = (
      <div className="caja caja--sin-cuentas">
        <ListaCuentas ordenes={ordenes} seleccionada={null} ahora={ahora} alElegir={(id) => elegir(id)} pie={panelDia} />
        <div className="vacio caja__vacio">
          <p className="texto-grande">No hay cuentas abiertas.</p>
          <p className="texto-2">Cuando un mesero envíe un pedido, la cuenta aparecerá aquí.</p>
        </div>
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
          pie={panelDia}
        />
        {detalle ? <DetalleCuenta orden={detalle} ahora={ahora} /> : <section className="caja__detalle" />}
        {cobrada ? (
          <CobroExitoso
            orden={cobrada.orden}
            cambio={cobrada.cambio}
            alSiguiente={() => elegir(ordenes[0]?.id ?? null, true)}
          />
        ) : seleccionada && seleccionada.comandas.length === 0 ? (
          <LiberarMesa
            key={seleccionada.id}
            orden={seleccionada}
            recargar={recargar}
            alLiberar={() => {
              setLiberadas((s) => new Set(s).add(seleccionada.id));
              recargar();
            }}
          />
        ) : seleccionada ? (
          <PanelCobro
            key={seleccionada.id}
            orden={seleccionada}
            recargar={recargar}
            diaAbierto={jornada !== null}
            alAbrirDia={() => setDialogo('abrir')}
            alSinDia={() => {
              callarCierre.current = true;
              dia.recargar();
              setDialogo('abrir');
            }}
            alCobrar={(orden, cambio) => {
              setCobrada({ orden, cambio });
              recargar();
              dia.recargar();
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
      {dialogos}
    </>
  );
}
