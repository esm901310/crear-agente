// M2 — Mesa: menú real (categorías, buscador, tallas, opciones, precio abierto), pedido nuevo
// guardado en la tablet y lo ya enviado con el pasadía. Docs/diseno.md, secciones 9, 27, 28 y 32.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, mensajeDeError } from '../api';
import { BotonAccion } from '../componentes/BotonAccion';
import { Cargando } from '../componentes/Cargando';
import { Dialogo } from '../componentes/Dialogo';
import { Encabezado } from '../componentes/Encabezado';
import { useToast } from '../componentes/Toast';
import { cancelarCuentasVacias, desmarcarCuentaVacia, marcarCuentaVacia } from '../cuentasVacias';
import { dinero } from '../formato';
import { useMedia } from '../hooks/useMedia';
import { usePolling } from '../hooks/usePolling';
import { navegar } from '../hooks/useRuta';
import { cargarMenu, useMenu } from '../menu';
import {
  agregarLinea,
  borrarPedido,
  cambiarEleccion,
  eleccion,
  guardarPedido,
  leerPedido,
  ponerNota,
  prepararEnvio,
  type LineaPedido,
} from '../pedidos';
import type { CategoriaMenu, MesaResumen, Orden, Producto, Variante } from '../tipos';
import { DialogoNota } from './DialogoNota';
import { HojaElegir } from './HojaElegir';
import { HojaPrecio } from './HojaPrecio';
import { MenuPlatillos } from './MenuPlatillos';
import { PedidoNuevo } from './PedidoNuevo';
import { abreHoja } from './TarjetaProducto';
import { YaEnviado } from './YaEnviado';

/** Qué pasó con la cuenta que se estaba viendo. */
type EstadoAnterior = 'pagada' | 'no-existe' | null;

interface DatosMesa {
  mesa: MesaResumen;
  orden: Orden | null;
  /** Si la cuenta que se veía ya no es la abierta de la mesa: si se cobró o si ya no existe. */
  anterior: EstadoAnterior;
  /** Momento en que empezó la consulta (para ignorar respuestas viejas tras un envío). */
  iniciada: number;
}

/** Aviso cuando la cuenta que se veía ya no está abierta (docs/diseno.md, 32.1). */
type AvisoCuenta = 'cobrada' | 'liberada' | 'cerrada' | null;

type Hoja =
  | { tipo: 'elegir'; producto: Producto; categoria: CategoriaMenu; boton: HTMLButtonElement | null }
  | { tipo: 'precio'; producto: Producto; categoria: CategoriaMenu; boton: HTMLButtonElement | null; linea?: LineaPedido };

const reducirMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Parpadeo de la tarjeta al agregar (9.2), con el color "seleccionado" de la paleta. */
function destellar(boton: HTMLButtonElement | null) {
  if (!boton || reducirMovimiento() || !boton.isConnected) return;
  const suave = getComputedStyle(document.documentElement).getPropertyValue('--c-primario-suave').trim() || '#E1F0F8';
  const superficie = getComputedStyle(document.documentElement).getPropertyValue('--c-superficie').trim() || '#FFFFFF';
  boton.animate([{ backgroundColor: suave }, { backgroundColor: superficie }], { duration: 300, easing: 'ease-out' });
}

export function Mesa({ mesaId }: { mesaId: number }) {
  const toast = useToast();
  const horizontal = useMedia('(min-width: 1024px)');

  // --- Cuenta vista (para saber si se cobró o se liberó) ---
  const ordenVista = useRef<number | null>(null);
  const vistaSinComandas = useRef(false);

  // --- Datos del servidor ---
  const consulta = useCallback(async (): Promise<DatosMesa> => {
    const iniciada = Date.now();
    const mesas = await api.mesas();
    const mesa = mesas.find((m) => m.id === mesaId);
    if (!mesa) throw new ApiError(404, 'No se encontró esa mesa.');
    let orden: Orden | null = null;
    if (mesa.orden_id) {
      try {
        orden = await api.orden(mesa.orden_id);
      } catch (e) {
        // La cuenta se cerró entre las dos consultas (o se cobró hace rato): la mesa está libre.
        if (!(e instanceof ApiError && e.status === 404)) throw e;
      }
    }
    // La cuenta que se veía ya no es la abierta: ¿se cobró o se borró (liberada)?
    let anterior: EstadoAnterior = null;
    const vista = ordenVista.current;
    if (vista !== null && (orden === null || orden.id !== vista)) {
      try {
        const o = await api.orden(vista);
        if (o.estado === 'pagada') anterior = 'pagada';
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) throw e;
        anterior = 'no-existe';
      }
    }
    return { mesa, orden, anterior, iniciada };
  }, [mesaId]);
  const { datos, error, cargando, recargar } = usePolling(consulta, mesaId);

  const { categorias, error: errorMenu, reintentar: reintentarMenu } = useMenu();

  // Productos del menú por id (con su categoría) y los que no se pueden pedir.
  const porId = useMemo(() => {
    const m = new Map<number, { producto: Producto; categoria: CategoriaMenu }>();
    for (const c of categorias ?? []) for (const p of c.productos) m.set(p.id, { producto: p, categoria: c });
    return m;
  }, [categorias]);

  // Agotados que avisó el servidor al enviar (hasta que llegue el menú nuevo).
  const [agotadosEnvio, setAgotadosEnvio] = useState<ReadonlySet<number>>(new Set());
  useEffect(() => setAgotadosEnvio(new Set()), [categorias]);

  // --- Pedido nuevo (se guarda en localStorage en cada cambio) ---
  const [lineas, setLineasEstado] = useState<LineaPedido[]>(() => leerPedido(mesaId)?.lineas ?? []);
  const nombreMesa = datos?.mesa.nombre ?? leerPedido(mesaId)?.mesa_nombre ?? `Mesa ${mesaId}`;
  const cambiarLineas = (nuevas: LineaPedido[]) => {
    setLineasEstado(nuevas);
    guardarPedido(mesaId, nombreMesa, nuevas);
  };

  /** Productos del pedido que se agotaron o ya no están en el menú. */
  const agotados = useMemo(() => {
    const s = new Set<number>();
    if (!categorias) return s;
    for (const l of lineas) {
      const x = porId.get(l.producto_id);
      if (!x || x.producto.agotado || agotadosEnvio.has(l.producto_id)) s.add(l.producto_id);
    }
    return s;
  }, [lineas, porId, categorias, agotadosEnvio]);

  // Toast una sola vez por producto que se agota con el pedido sin enviar.
  const avisados = useRef(new Set<number>());
  useEffect(() => {
    const nuevos = [...agotados].filter((id) => !avisados.current.has(id));
    for (const id of [...avisados.current]) if (!agotados.has(id)) avisados.current.delete(id);
    if (nuevos.length === 0) return;
    nuevos.forEach((id) => avisados.current.add(id));
    const nombres = nuevos.map((id) => porId.get(id)?.producto.nombre ?? lineas.find((l) => l.producto_id === id)?.nombre ?? '');
    toast({ texto: `Se agotó: ${nombres.join(', ')}.`, tipo: 'error' });
  }, [agotados, porId, lineas, toast]);

  const cantidades = useMemo(() => {
    const m = new Map<number, number>();
    for (const l of lineas) m.set(l.producto_id, (m.get(l.producto_id) ?? 0) + l.cantidad);
    return m;
  }, [lineas]);
  const porCategoria = useMemo(() => {
    const m = new Map<number, number>();
    for (const l of lineas) m.set(l.categoria_id, (m.get(l.categoria_id) ?? 0) + l.cantidad);
    return m;
  }, [lineas]);
  const piezas = lineas.reduce((s, l) => s + l.cantidad, 0);
  const montoNuevo = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
  const vaACocina = lineas.some((l) => l.va_a_cocina);
  const textoEnviar = `${vaACocina || lineas.length === 0 ? 'Enviar a cocina' : 'Enviar pedido'} (${piezas})`;
  const razonEnviar = agotados.size > 0 ? 'Quita lo agotado para enviar.' : '';

  // --- Envío y cuenta mostrada ---
  const [enviando, setEnviando] = useState(false);
  const [ordenReciente, setOrdenReciente] = useState<Orden | null>(null);
  const ultimoEnvio = useRef(0);
  const [aviso, setAviso] = useState<AvisoCuenta>(null);
  const cuentaCerrada = aviso !== null;

  const datosFrescos = datos !== undefined && datos.iniciada > ultimoEnvio.current;
  const orden: Orden | null = datosFrescos ? datos.orden : (ordenReciente ?? datos?.orden ?? null);

  // ¿La cuenta que veíamos ya no está abierta? Se cobró, la caja la liberó (estaba vacía) o no se sabe.
  useEffect(() => {
    if (!datos || datos.iniciada <= ultimoEnvio.current) return;
    const actual = datos.orden && datos.orden.estado === 'abierta' ? datos.orden : null;
    const vista = ordenVista.current;
    if (actual && (vista === null || actual.id === vista)) {
      ordenVista.current = actual.id;
      vistaSinComandas.current = actual.comandas.length === 0;
      return;
    }
    if (vista === null) return;
    setAviso(datos.anterior === 'pagada' ? 'cobrada' : datos.anterior === 'no-existe' && vistaSinComandas.current ? 'liberada' : 'cerrada');
    ordenVista.current = actual?.id ?? null;
    vistaSinComandas.current = actual ? actual.comandas.length === 0 : false;
  }, [datos]);

  // --- Cuenta abierta sin platillos ---
  // Si la cuenta quedó abierta sin platillos (p. ej. se abrió pero el envío falló),
  // al salir de la mesa se cancela para no dejar la mesa ocupada con L 0.00.
  const montado = useRef(true);
  const enviandoRef = useRef(false);
  useEffect(() => {
    if (!orden || orden.estado !== 'abierta' || cuentaCerrada || enviandoRef.current) return;
    if (orden.comandas.length === 0) marcarCuentaVacia(orden.id);
    else desmarcarCuentaVacia(orden.id);
  }, [orden, cuentaCerrada]);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      // Si hay un envío en curso, se decide cuando termine (ver `enviar`).
      if (!enviandoRef.current) void cancelarCuentasVacias();
    };
  }, []);

  const enviar = async () => {
    if (lineas.length === 0 || enviando || agotados.size > 0) return;
    setEnviando(true);
    enviandoRef.current = true;
    const textoOk = vaACocina ? 'Enviado a cocina ✓' : 'Pedido enviado ✓';
    // Mismo id en cada reintento de este mismo pedido; nuevo si el pedido cambió.
    const envioId = prepararEnvio(mesaId, nombreMesa, lineas);
    let ordenId: number | null = null;
    // ¿Se envía a una cuenta que ya veíamos abierta (y que pudo cerrarse en caja mientras tanto)?
    let eraExistente = false;
    try {
      ordenId = !cuentaCerrada ? (orden?.estado === 'abierta' ? orden.id : null) : null;
      eraExistente = ordenId !== null;
      if (ordenId === null) ordenId = (await api.abrirOrden(mesaId)).id;
      const items = lineas.map((l) => ({
        producto_id: l.producto_id,
        ...(l.variante_id !== null ? { variante_id: l.variante_id } : {}),
        ...(l.opcion !== null ? { opcion: l.opcion } : {}),
        ...(l.precio_abierto ? { precio: l.precio } : {}),
        cantidad: l.cantidad,
        ...(l.nota ? { nota: l.nota } : {}),
      }));
      let actualizada: Orden;
      let seAbrioNueva = false;
      try {
        actualizada = await api.enviarComanda(ordenId, items, envioId);
      } catch (e) {
        if (!(eraExistente && e instanceof ApiError && e.status === 404)) throw e;
        // La caja liberó la cuenta (estaba vacía, sin platillos) mientras el mesero la tenía abierta.
        // El pedido es de esta misma mesa, así que se abre una cuenta nueva y se envía UNA sola vez
        // más, con el mismo envio_id (el intento fallido no creó nada; si este se repite, no duplica).
        ordenId = (await api.abrirOrden(mesaId)).id;
        actualizada = await api.enviarComanda(ordenId, items, envioId);
        seAbrioNueva = true;
      }
      desmarcarCuentaVacia(actualizada.id);
      borrarPedido(mesaId);
      toast({
        texto: seAbrioNueva ? `La cuenta anterior ya se cerró; se abrió una nueva. ${textoOk}` : textoOk,
        tipo: 'ok',
      });
      if (!montado.current) return;
      ultimoEnvio.current = Date.now();
      ordenVista.current = actualizada.id;
      vistaSinComandas.current = false;
      setAviso(null);
      setOrdenReciente(actualizada);
      setLineasEstado([]);
      setVerPedido(false);
      recargar();
    } catch (e) {
      // La cuenta pudo quedar abierta sin platillos: se recuerda para cancelarla al salir.
      // (Si el envío sí llegó, el servidor responde 409 al cancelar y no se borra nada.)
      if (ordenId !== null && (!orden || orden.id !== ordenId || orden.comandas.length === 0)) marcarCuentaVacia(ordenId);
      const agotado = e instanceof ApiError && e.status === 400 ? /Se agot[oó]: (.+?)\. Qu[ií]talo/.exec(e.message) : null;
      if (eraExistente && e instanceof ApiError && e.status === 409 && /cobrad/i.test(e.message)) {
        // La cuenta se COBRÓ mientras tanto: no se manda solo (los clientes ya pagaron y el pedido
        // podría ser de ellos). El pedido queda guardado; si es de clientes nuevos, el siguiente
        // envío abre una cuenta nueva.
        if (montado.current) setAviso('cobrada');
        toast({
          texto: 'Esta cuenta ya se cobró. Tu pedido sigue aquí; si es de clientes nuevos, envíalo otra vez para abrir otra cuenta.',
          tipo: 'error',
        });
        recargar();
      } else if (agotado) {
        // "Se agotó: King crab. Quítalo del pedido." → se marca la línea y se actualiza el menú.
        const nombre = agotado[1];
        const ids = [...porId.values()].filter((x) => x.producto.nombre === nombre).map((x) => x.producto.id);
        if (ids.length > 0) {
          ids.forEach((id) => avisados.current.add(id));
          setAgotadosEnvio((s) => new Set([...s, ...ids]));
        }
        toast({ texto: `Se agotó: ${nombre}.`, tipo: 'error' });
        void cargarMenu();
      } else {
        toast({ texto: mensajeDeError(e, 'No se pudo enviar. Revisa la conexión e intenta de nuevo.'), tipo: 'error' });
        if (e instanceof ApiError && e.status === 409) {
          recargar();
          void cargarMenu();
        }
      }
    } finally {
      enviandoRef.current = false;
      if (montado.current) setEnviando(false);
      else void cancelarCuentasVacias();
    }
  };

  // --- Diálogos y hojas ---
  const [notaDe, setNotaDe] = useState<LineaPedido | null>(null);
  const [verPedido, setVerPedido] = useState(false);
  const [hoja, setHoja] = useState<Hoja | null>(null);

  const cambiarCantidad = (clave: string, delta: number) => {
    cambiarLineas(
      lineas
        .map((l) => (l.clave === clave ? { ...l, cantidad: Math.min(99, l.cantidad + delta) } : l))
        .filter((l) => l.cantidad > 0),
    );
  };
  const quitar = (clave: string) => cambiarLineas(lineas.filter((l) => l.clave !== clave));

  const tocarProducto = (p: Producto, c: CategoriaMenu, boton: HTMLButtonElement) => {
    if (p.agotado) return;
    if (p.precio_abierto) setHoja({ tipo: 'precio', producto: p, categoria: c, boton });
    else if (abreHoja(p)) setHoja({ tipo: 'elegir', producto: p, categoria: c, boton });
    else {
      cambiarLineas(agregarLinea(lineas, eleccion(p, c.va_a_cocina)));
      destellar(boton);
    }
  };

  const agregarDesdeHoja = (h: Hoja, extra: { variante?: Variante | null; opcion?: string | null; precio?: number }) => {
    const e = eleccion(h.producto, h.categoria.va_a_cocina, extra);
    if (h.tipo === 'precio' && h.linea) cambiarLineas(cambiarEleccion(lineas, h.linea.clave, e));
    else cambiarLineas(agregarLinea(lineas, e));
    setHoja(null);
    destellar(h.boton);
  };

  const cambiarPrecio = (l: LineaPedido) => {
    const x = porId.get(l.producto_id);
    if (!x) return;
    setHoja({ tipo: 'precio', producto: x.producto, categoria: x.categoria, boton: null, linea: l });
  };

  const regreso = { texto: '← Mesas', alTocar: () => navegar('/mesas') };

  if (cargando || (!categorias && !errorMenu)) {
    return (
      <>
        <Encabezado vista={nombreMesa} regreso={regreso} />
        <Cargando />
      </>
    );
  }

  if ((!datos && error) || (!categorias && errorMenu)) {
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
              if (errorMenu) reintentarMenu();
            }}
          >
            Reintentar
          </button>
        </div>
      </>
    );
  }

  const botonEnviar = (
    <>
      <BotonAccion
        type="button"
        className="boton boton--primario boton--enviar"
        ocupado={enviando}
        textoOcupado="Enviando…"
        disabled={lineas.length === 0 || agotados.size > 0}
        aria-describedby={razonEnviar ? 'razon-enviar' : undefined}
        onClick={enviar}
      >
        <span className="boton--enviar__texto">{textoEnviar}</span>
        <span className="boton--enviar__monto">{dinero(montoNuevo)}</span>
      </BotonAccion>
      {razonEnviar && (
        <p id="razon-enviar" className="razon razon--centro">
          {razonEnviar}
        </p>
      )}
    </>
  );

  const sufijoNueva = lineas.length > 0 ? ' Si el pedido es de clientes nuevos, al enviarlo se abre una cuenta nueva.' : '';
  const textoAviso =
    aviso === 'cobrada'
      ? `Esta cuenta ya se cobró.${sufijoNueva}`
      : aviso === 'liberada'
        ? lineas.length > 0
          ? 'La caja liberó esta cuenta porque estaba vacía. Tu pedido sigue aquí: al enviarlo se abre una cuenta nueva.'
          : 'La caja liberó esta cuenta porque estaba vacía.'
        : `Esta cuenta ya no está abierta.${sufijoNueva}`;
  const avisoCuenta = aviso && (
    <div className="aviso aviso--alerta aviso--accion" role="status">
      <span>{textoAviso}</span>
      <button type="button" className="boton boton--secundario boton--chico" onClick={() => navegar('/mesas')}>
        ← Volver a mesas
      </button>
    </div>
  );

  const ordenMostrada = cuentaCerrada ? null : orden;
  const panel = (
    <>
      <PedidoNuevo
        lineas={lineas}
        agotados={agotados}
        alCambiarCantidad={cambiarCantidad}
        alQuitar={quitar}
        alEditarNota={setNotaDe}
        alCambiarPrecio={cambiarPrecio}
      />
      <YaEnviado orden={ordenMostrada} />
    </>
  );

  const cantidadEn = (p: Producto) => ({
    variante: (id: number) => lineas.filter((l) => l.producto_id === p.id && l.variante_id === id).reduce((s, l) => s + l.cantidad, 0),
    opcion: (o: string) => lineas.filter((l) => l.producto_id === p.id && l.opcion === o).reduce((s, l) => s + l.cantidad, 0),
  });

  return (
    <>
      <Encabezado vista={nombreMesa} regreso={regreso} />
      <main className={horizontal ? 'mesa mesa--horizontal' : 'mesa mesa--vertical'}>
        <div className="mesa__menu">
          <MenuPlatillos
            mesaId={mesaId}
            categorias={categorias ?? []}
            cantidades={cantidades}
            porCategoria={porCategoria}
            alTocar={tocarProducto}
            aviso={avisoCuenta}
          />
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
                  Pedido nuevo: {piezas} {piezas === 1 ? 'producto' : 'productos'} · {dinero(montoNuevo)}
                  {razonEnviar && <span className="barra-pedido__razon"> · {razonEnviar}</span>}
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
                    disabled={agotados.size > 0}
                    onClick={enviar}
                  >
                    {textoEnviar}
                  </BotonAccion>
                </div>
              </>
            ) : (
              <div className="barra-pedido__botones">
                <p className="barra-pedido__texto">
                  {ordenMostrada && ordenMostrada.comandas.length > 0
                    ? `Ya enviado: ${dinero(ordenMostrada.subtotal)}${
                        ordenMostrada.pasadia > ordenMostrada.consumo ? ' (pasadía)' : ''
                      }`
                    : 'Toca un producto del menú para agregarlo.'}
                </p>
                {ordenMostrada && ordenMostrada.comandas.length > 0 && (
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

      {hoja?.tipo === 'elegir' && (
        <HojaElegir
          producto={hoja.producto}
          hoja={!horizontal}
          cantidadVariante={cantidadEn(hoja.producto).variante}
          cantidadOpcion={cantidadEn(hoja.producto).opcion}
          alElegir={(variante, opcion) => agregarDesdeHoja(hoja, { variante, opcion })}
          alCerrar={() => setHoja(null)}
        />
      )}
      {hoja?.tipo === 'precio' && (
        <HojaPrecio
          producto={hoja.producto}
          hoja={!horizontal}
          inicial={hoja.linea ? { opcion: hoja.linea.opcion, precio: hoja.linea.precio } : undefined}
          alAgregar={(opcion, precio) => agregarDesdeHoja(hoja, { opcion, precio })}
          alCerrar={() => setHoja(null)}
        />
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
