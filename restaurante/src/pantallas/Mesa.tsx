// M2 — Mesa: menú, pedido nuevo (guardado en la tablet) y lo ya enviado.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, mensajeDeError } from '../api';
import { BotonAccion } from '../componentes/BotonAccion';
import { Cargando } from '../componentes/Cargando';
import { Dialogo } from '../componentes/Dialogo';
import { Encabezado } from '../componentes/Encabezado';
import { useToast } from '../componentes/Toast';
import { dinero } from '../formato';
import { useMedia } from '../hooks/useMedia';
import { usePolling } from '../hooks/usePolling';
import { navegar } from '../hooks/useRuta';
import {
  agregarProducto,
  borrarPedido,
  guardarPedido,
  leerPedido,
  ponerNota,
  prepararEnvio,
  type LineaPedido,
} from '../pedidos';
import type { MesaResumen, Orden, Producto } from '../tipos';
import { DialogoNota } from './DialogoNota';
import { MenuPlatillos } from './MenuPlatillos';
import { PedidoNuevo } from './PedidoNuevo';
import { YaEnviado } from './YaEnviado';

// El menú se pide una vez y se guarda en memoria mientras la app esté abierta.
let menuEnMemoria: Producto[] | null = null;

interface DatosMesa {
  mesa: MesaResumen;
  orden: Orden | null;
  /** Momento en que empezó la consulta (para ignorar respuestas viejas tras un envío). */
  iniciada: number;
}

export function Mesa({ mesaId }: { mesaId: number }) {
  const toast = useToast();
  const horizontal = useMedia('(min-width: 1024px)');

  // --- Datos del servidor ---
  const consulta = useCallback(async (): Promise<DatosMesa> => {
    const iniciada = Date.now();
    const mesas = await api.mesas();
    const mesa = mesas.find((m) => m.id === mesaId);
    if (!mesa) throw new ApiError(404, 'No se encontró esa mesa.');
    const orden = mesa.orden_id ? await api.orden(mesa.orden_id) : null;
    return { mesa, orden, iniciada };
  }, [mesaId]);
  const { datos, error, cargando, recargar } = usePolling(consulta, mesaId);

  const [menu, setMenu] = useState<Producto[] | null>(menuEnMemoria);
  const [errorMenu, setErrorMenu] = useState(false);
  const cargarMenu = useCallback(() => {
    setErrorMenu(false);
    api
      .menu()
      .then((m) => {
        menuEnMemoria = m;
        setMenu(m);
      })
      .catch(() => {
        if (!menuEnMemoria) setErrorMenu(true);
      });
  }, []);
  useEffect(cargarMenu, [cargarMenu]);

  // --- Pedido nuevo (se guarda en localStorage en cada cambio) ---
  const [lineas, setLineasEstado] = useState<LineaPedido[]>(() => leerPedido(mesaId)?.lineas ?? []);
  const nombreMesa = datos?.mesa.nombre ?? leerPedido(mesaId)?.mesa_nombre ?? `Mesa ${mesaId}`;
  const cambiarLineas = (nuevas: LineaPedido[]) => {
    setLineasEstado(nuevas);
    guardarPedido(mesaId, nombreMesa, nuevas);
  };

  const cantidades = useMemo(() => {
    const m = new Map<number, number>();
    for (const l of lineas) m.set(l.producto_id, (m.get(l.producto_id) ?? 0) + l.cantidad);
    return m;
  }, [lineas]);
  const piezas = lineas.reduce((s, l) => s + l.cantidad, 0);
  const montoNuevo = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);

  // --- Envío y cuenta mostrada ---
  const [enviando, setEnviando] = useState(false);
  const [ordenReciente, setOrdenReciente] = useState<Orden | null>(null);
  const ultimoEnvio = useRef(0);
  const ordenVista = useRef<number | null>(null);
  const [cobrada, setCobrada] = useState(false);

  const datosFrescos = datos !== undefined && datos.iniciada > ultimoEnvio.current;
  const orden: Orden | null = datosFrescos ? datos.orden : (ordenReciente ?? datos?.orden ?? null);

  // ¿La cuenta que veíamos ya se cobró?
  useEffect(() => {
    if (!datos || datos.iniciada <= ultimoEnvio.current) return;
    const actual = datos.orden;
    if (actual && actual.estado === 'abierta') {
      if (ordenVista.current !== null && ordenVista.current !== actual.id) setCobrada(true);
      ordenVista.current = actual.id;
    } else if (ordenVista.current !== null) {
      setCobrada(true);
    }
  }, [datos]);

  const enviar = async () => {
    if (lineas.length === 0 || enviando) return;
    setEnviando(true);
    // Mismo id en cada reintento de este mismo pedido; nuevo si el pedido cambió.
    const envioId = prepararEnvio(mesaId, nombreMesa, lineas);
    try {
      let ordenId = !cobrada ? (orden?.estado === 'abierta' ? orden.id : null) : null;
      if (ordenId === null) ordenId = (await api.abrirOrden(mesaId)).id;
      const items = lineas.map((l) => ({
        producto_id: l.producto_id,
        cantidad: l.cantidad,
        ...(l.nota ? { nota: l.nota } : {}),
      }));
      const actualizada = await api.enviarComanda(ordenId, items, envioId);
      ultimoEnvio.current = Date.now();
      ordenVista.current = actualizada.id;
      setCobrada(false);
      setOrdenReciente(actualizada);
      borrarPedido(mesaId);
      setLineasEstado([]);
      setVerPedido(false);
      toast({ texto: 'Enviado a cocina ✓', tipo: 'ok' });
      recargar();
    } catch (e) {
      toast({ texto: mensajeDeError(e, 'No se pudo enviar. Revisa la conexión e intenta de nuevo.'), tipo: 'error' });
      if (e instanceof ApiError && e.status === 409) recargar();
    } finally {
      setEnviando(false);
    }
  };

  // --- Diálogos ---
  const [notaDe, setNotaDe] = useState<LineaPedido | null>(null);
  const [verPedido, setVerPedido] = useState(false);

  const cambiarCantidad = (clave: string, delta: number) => {
    cambiarLineas(
      lineas
        .map((l) => (l.clave === clave ? { ...l, cantidad: Math.min(99, l.cantidad + delta) } : l))
        .filter((l) => l.cantidad > 0),
    );
  };

  const regreso = { texto: '← Mesas', alTocar: () => navegar('/mesas') };

  if (cargando || (!menu && !errorMenu)) {
    return (
      <>
        <Encabezado vista={nombreMesa} regreso={regreso} />
        <Cargando />
      </>
    );
  }

  if ((!datos && error) || errorMenu) {
    return (
      <>
        <Encabezado vista={nombreMesa} regreso={regreso} />
        <div className="vacio">
          <p>{error?.status === 404 ? error.message : 'No pudimos cargar la mesa. Revisa la conexión.'}</p>
          <button
            type="button"
            className="boton boton--primario"
            onClick={() => {
              recargar();
              if (errorMenu) cargarMenu();
            }}
          >
            Reintentar
          </button>
        </div>
      </>
    );
  }

  const botonEnviar = (
    <BotonAccion
      type="button"
      className="boton boton--primario boton--enviar"
      ocupado={enviando}
      textoOcupado="Enviando…"
      disabled={lineas.length === 0}
      onClick={enviar}
    >
      <span className="boton--enviar__texto">Enviar a cocina ({piezas})</span>
      <span className="boton--enviar__monto">{dinero(montoNuevo)}</span>
    </BotonAccion>
  );

  const avisoCobrada = cobrada && (
    <div className="aviso aviso--alerta aviso--accion" role="status">
      <span>Esta cuenta ya se cobró.</span>
      <button type="button" className="boton boton--secundario boton--chico" onClick={() => navegar('/mesas')}>
        ← Volver a mesas
      </button>
    </div>
  );

  const panel = (
    <>
      <PedidoNuevo lineas={lineas} alCambiarCantidad={cambiarCantidad} alEditarNota={setNotaDe} />
      <YaEnviado orden={cobrada ? null : orden} />
    </>
  );

  return (
    <>
      <Encabezado vista={nombreMesa} regreso={regreso} />
      <main className={horizontal ? 'mesa mesa--horizontal' : 'mesa mesa--vertical'}>
        <div className="mesa__menu">
          {avisoCobrada}
          <MenuPlatillos productos={menu ?? []} cantidades={cantidades} alAgregar={(p) => cambiarLineas(agregarProducto(lineas, p))} />
        </div>

        {horizontal ? (
          <aside className="mesa__panel" aria-label="Pedido de la mesa">
            <div className="mesa__panel-scroll">{panel}</div>
            <div className="mesa__panel-pie">{botonEnviar}</div>
          </aside>
        ) : (
          <div className="barra-pedido">
            {lineas.length > 0 ? (
              <>
                <p className="barra-pedido__texto">
                  Pedido nuevo: {piezas} {piezas === 1 ? 'platillo' : 'platillos'} · {dinero(montoNuevo)}
                </p>
                <div className="barra-pedido__botones">
                  <button type="button" className="boton boton--secundario" onClick={() => setVerPedido(true)}>
                    Ver pedido
                  </button>
                  <BotonAccion
                    type="button"
                    className="boton boton--primario"
                    ocupado={enviando}
                    textoOcupado="Enviando…"
                    onClick={enviar}
                  >
                    Enviar a cocina ({piezas})
                  </BotonAccion>
                </div>
              </>
            ) : (
              <div className="barra-pedido__botones">
                <p className="barra-pedido__texto">
                  {orden && !cobrada && orden.comandas.length > 0
                    ? `Ya enviado: ${dinero(orden.subtotal)}`
                    : 'Toca un platillo del menú para agregarlo.'}
                </p>
                {orden && !cobrada && orden.comandas.length > 0 && (
                  <button type="button" className="boton boton--secundario" onClick={() => setVerPedido(true)}>
                    Ver cuenta
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {!horizontal && verPedido && (
        <Dialogo titulo={`Pedido de ${nombreMesa}`} alCerrar={() => setVerPedido(false)} hoja className="hoja-pedido">
          <div className="hoja-pedido__cabeza">
            <h2 className="dialogo__titulo">{nombreMesa}</h2>
            <button type="button" className="boton boton--secundario boton--chico" onClick={() => setVerPedido(false)}>
              ✕ Cerrar
            </button>
          </div>
          <div className="hoja-pedido__scroll">{panel}</div>
          {lineas.length > 0 && <div className="hoja-pedido__pie">{botonEnviar}</div>}
        </Dialogo>
      )}

      {notaDe && (
        <DialogoNota
          linea={notaDe}
          hoja={!horizontal}
          alCerrar={() => setNotaDe(null)}
          alGuardar={(nota, soloUna) => {
            cambiarLineas(ponerNota(lineas, notaDe.clave, nota, soloUna));
            setNotaDe(null);
          }}
        />
      )}
    </>
  );
}
