import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Caja, Edicion, Pagina, Palabra } from '../lib/types';
import { unirCajas } from '../lib/edit';
import MarcaPalabra from './MarcaPalabra';
import BotonIcono from './BotonIcono';

interface Props {
  pagina: Pagina;
  /** Lienzo con la página ya compuesta (original + cambios). */
  lienzo: HTMLCanvasElement;
  ediciones: Edicion[];
  seleccion: string[];
  /** Caja de la selección si ya no coincide con las palabras (texto nuevo más ancho). */
  cajaSeleccion?: Caja | null;
  ocultarMarcas: boolean;
  alAlternarMarcas: () => void;
  /** Alto que tapa el panel inferior (px desde abajo de la ventana). */
  espacioInferior: number;
  /** Zona que debe quedar visible encima del panel. */
  enfocar: Caja | null;
  alTocarPalabra: (p: Palabra) => void;
  /** Selección con "mantener presionado y deslizar". */
  alSeleccionar: (ids: string[], terminada: boolean) => void;
  alCambiarPagina: (delta: number) => void;
  children?: ReactNode;
}

const ZOOM_MAX = 4;
const MOVIMIENTO_TOQUE = 10;
const TIEMPO_PRESIONAR = 400;
const MARGEN_TOQUE = 8;

interface Puntero {
  x: number;
  y: number;
}

export default function VisorPagina(props: Props) {
  const { pagina, lienzo, ediciones, seleccion, ocultarMarcas, espacioInferior, enfocar } = props;
  const contRef = useRef<HTMLDivElement>(null);
  const hojaRef = useRef<HTMLDivElement>(null);
  const lienzoRef = useRef<HTMLDivElement>(null);
  const [anchoBase, setAnchoBase] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [tapado, setTapado] = useState(0);
  const scrollPendiente = useRef<{ x: number; y: number } | null>(null);

  // Llamadas siempre actualizadas para los gestos.
  const propsRef = useRef(props);
  propsRef.current = props;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // Mostramos el lienzo compuesto directamente (sin copiarlo).
  useLayoutEffect(() => {
    const cont = lienzoRef.current;
    if (!cont) return;
    lienzo.className = 'visor-lienzo';
    lienzo.setAttribute('role', 'img');
    lienzo.setAttribute('aria-label', `Página ${pagina.indice + 1}`);
    if (cont.firstChild !== lienzo) cont.replaceChildren(lienzo);
  }, [lienzo, pagina.indice]);

  // Ancho de la página = ancho del visor menos 8 px por lado.
  useEffect(() => {
    const el = contRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setAnchoBase(Math.max(100, el.clientWidth - 16)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Al cambiar de página se vuelve al tamaño normal.
  useEffect(() => {
    setZoom(1);
    contRef.current?.scrollTo(0, 0);
  }, [pagina.indice]);

  useLayoutEffect(() => {
    const el = contRef.current;
    const s = scrollPendiente.current;
    if (el && s) {
      el.scrollLeft = s.x;
      el.scrollTop = s.y;
      scrollPendiente.current = null;
    }
  }, [zoom]);

  // Cuánto del visor queda tapado por el panel inferior.
  useLayoutEffect(() => {
    const el = contRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTapado(Math.max(0, espacioInferior - (window.innerHeight - r.bottom)));
  }, [espacioInferior]);

  // Deja la selección visible encima del panel.
  useEffect(() => {
    const el = contRef.current;
    const hoja = hojaRef.current;
    if (!el || !hoja || !enfocar || tapado <= 0) return;
    const k = hoja.clientWidth / pagina.ancho;
    const cy = hoja.offsetTop + ((enfocar.y0 + enfocar.y1) / 2) * k;
    const cx = hoja.offsetLeft + ((enfocar.x0 + enfocar.x1) / 2) * k;
    const visible = el.clientHeight - tapado;
    el.scrollTo({
      top: Math.max(0, cy - visible * 0.45),
      left: zoom > 1 ? Math.max(0, cx - el.clientWidth / 2) : el.scrollLeft,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [enfocar, tapado, pagina.ancho, zoom]);

  /** Palabra bajo el dedo (con margen de 8 px; gana la más cercana al centro). */
  const palabraEn = useCallback(
    (clientX: number, clientY: number, soloLinea?: string): Palabra | null => {
      const hoja = hojaRef.current;
      if (!hoja) return null;
      const r = hoja.getBoundingClientRect();
      const k = pagina.ancho / r.width;
      const x = (clientX - r.left) * k;
      const y = (clientY - r.top) * k;
      const m = MARGEN_TOQUE * k;
      let mejor: Palabra | null = null;
      let mejorD = Infinity;
      for (const p of pagina.palabras) {
        if (soloLinea) {
          if (p.lineaId !== soloLinea) continue;
          // En la línea inicial: solo cuenta la posición horizontal.
          const d = x < p.caja.x0 ? p.caja.x0 - x : x > p.caja.x1 ? x - p.caja.x1 : 0;
          if (d < mejorD) {
            mejorD = d;
            mejor = p;
          }
          continue;
        }
        const c = p.caja;
        if (x < c.x0 - m || x > c.x1 + m || y < c.y0 - m || y > c.y1 + m) continue;
        const d = Math.hypot(x - (c.x0 + c.x1) / 2, y - (c.y0 + c.y1) / 2);
        if (d < mejorD) {
          mejorD = d;
          mejor = p;
        }
      }
      return mejor;
    },
    [pagina],
  );

  // ----- Gestos: tocar, mantener y deslizar, mover, pellizcar, cambiar de página -----
  const punteros = useRef(new Map<number, Puntero>());
  const gesto = useRef<{
    inicio: Puntero;
    tiempo: number;
    scroll: Puntero;
    movido: boolean;
    seleccionando: { ancla: Palabra; ids: string[] } | null;
    temporizador: number | null;
    pellizco: { dist: number; zoom: number; centro: Puntero; scroll: Puntero } | null;
    huboPellizco: boolean;
  } | null>(null);

  const cancelarTemporizador = () => {
    const g = gesto.current;
    if (g?.temporizador) {
      window.clearTimeout(g.temporizador);
      g.temporizador = null;
    }
  };

  const idsEntre = (ancla: Palabra, otra: Palabra): string[] => {
    const desde = Math.min(ancla.posEnLinea, otra.posEnLinea);
    const hasta = Math.max(ancla.posEnLinea, otra.posEnLinea);
    return pagina.palabras
      .filter((p) => p.lineaId === ancla.lineaId && p.posEnLinea >= desde && p.posEnLinea <= hasta)
      .sort((a, b) => a.posEnLinea - b.posEnLinea)
      .map((p) => p.id);
  };

  const alBajar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = contRef.current;
    if (!el) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.current.size === 1) {
      const inicio = { x: e.clientX, y: e.clientY };
      gesto.current = {
        inicio,
        tiempo: performance.now(),
        scroll: { x: el.scrollLeft, y: el.scrollTop },
        movido: false,
        seleccionando: null,
        temporizador: window.setTimeout(() => {
          const g = gesto.current;
          if (!g || g.movido || g.pellizco) return;
          const ancla = palabraEn(inicio.x, inicio.y);
          if (!ancla) return;
          navigator.vibrate?.(15);
          g.seleccionando = { ancla, ids: [ancla.id] };
          propsRef.current.alSeleccionar([ancla.id], false);
        }, TIEMPO_PRESIONAR),
        pellizco: null,
        huboPellizco: false,
      };
    } else if (punteros.current.size === 2 && gesto.current) {
      cancelarTemporizador();
      const g = gesto.current;
      if (g.seleccionando) return;
      const [a, b] = [...punteros.current.values()];
      if (!a || !b) return;
      const r = el.getBoundingClientRect();
      g.pellizco = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: zoomRef.current,
        centro: { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top },
        scroll: { x: el.scrollLeft, y: el.scrollTop },
      };
      g.huboPellizco = true;
    }
  };

  const alMover = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!punteros.current.has(e.pointerId)) return;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesto.current;
    const el = contRef.current;
    if (!g || !el) return;

    if (g.pellizco && punteros.current.size >= 2) {
      const [a, b] = [...punteros.current.values()];
      if (!a || !b) return;
      const p = g.pellizco;
      const r = el.getBoundingClientRect();
      const nuevo = Math.min(ZOOM_MAX, Math.max(1, (p.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, p.dist)));
      const centro = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
      // El punto que estaba bajo los dedos sigue bajo los dedos.
      const f = nuevo / p.zoom;
      scrollPendiente.current = {
        x: (p.scroll.x + p.centro.x) * f - centro.x,
        y: (p.scroll.y + p.centro.y) * f - centro.y,
      };
      if (nuevo !== zoomRef.current) setZoom(nuevo);
      else {
        el.scrollLeft = scrollPendiente.current.x;
        el.scrollTop = scrollPendiente.current.y;
        scrollPendiente.current = null;
      }
      return;
    }

    const dx = e.clientX - g.inicio.x;
    const dy = e.clientY - g.inicio.y;
    if (g.seleccionando) {
      const otra = palabraEn(e.clientX, e.clientY, g.seleccionando.ancla.lineaId);
      if (otra) {
        const ids = idsEntre(g.seleccionando.ancla, otra);
        if (ids.join() !== g.seleccionando.ids.join()) {
          g.seleccionando.ids = ids;
          propsRef.current.alSeleccionar(ids, false);
        }
      }
      return;
    }
    if (!g.movido && Math.hypot(dx, dy) > MOVIMIENTO_TOQUE) {
      g.movido = true;
      cancelarTemporizador();
    }
    if (g.movido && !g.huboPellizco) {
      el.scrollLeft = g.scroll.x - dx;
      el.scrollTop = g.scroll.y - dy;
    }
  };

  const alSoltar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!punteros.current.has(e.pointerId)) return;
    punteros.current.delete(e.pointerId);
    const g = gesto.current;
    if (!g) return;
    if (punteros.current.size > 0) {
      // Queda un dedo tras pellizcar: no es un toque.
      g.pellizco = null;
      return;
    }
    cancelarTemporizador();
    gesto.current = null;
    if (e.type === 'pointercancel') return;

    if (g.seleccionando) {
      propsRef.current.alSeleccionar(g.seleccionando.ids, true);
      return;
    }
    if (g.huboPellizco) return;
    const dx = e.clientX - g.inicio.x;
    const dy = e.clientY - g.inicio.y;
    if (!g.movido) {
      const p = palabraEn(e.clientX, e.clientY);
      if (p) propsRef.current.alTocarPalabra(p);
      return;
    }
    // Deslizar a los lados para cambiar de página (sin zoom).
    if (zoomRef.current <= 1.01 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      propsRef.current.alCambiarPagina(dx < 0 ? 1 : -1);
    }
  };

  const cambiarZoom = (factor: number) => {
    const el = contRef.current;
    if (!el) return;
    const nuevo = Math.min(ZOOM_MAX, Math.max(1, zoom * factor));
    const f = nuevo / zoom;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    scrollPendiente.current = { x: (el.scrollLeft + cx) * f - cx, y: (el.scrollTop + cy) * f - cy };
    setZoom(nuevo);
  };

  // ----- Marcas -----
  const marcas = useMemo(() => {
    const editadas = new Set<string>();
    const propias = ediciones.filter((e) => e.pagina === pagina.indice);
    propias.forEach((e) => e.palabras.forEach((id) => editadas.add(id)));
    const sel = new Set(seleccion);
    return {
      palabras: pagina.palabras.filter((p) => !editadas.has(p.id) && !sel.has(p.id)),
      editadas: propias.filter((e) => !e.palabras.some((id) => sel.has(id))),
      cajaSeleccion: props.cajaSeleccion
        ? props.cajaSeleccion
        : seleccion.length
        ? unirCajas(pagina.palabras.filter((p) => sel.has(p.id)).map((p) => p.caja))
        : null,
    };
  }, [ediciones, pagina, seleccion, props.cajaSeleccion]);

  const ancho = anchoBase * zoom;
  const palabraPorId = (id: string) => pagina.palabras.find((p) => p.id === id);

  return (
    <div className="visor-marco">
      <div
        ref={contRef}
        className="visor"
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onContextMenu={(e) => e.preventDefault()}
        style={{ paddingBottom: 8 + tapado }}
      >
        <div
          ref={hojaRef}
          className="visor-hoja"
          style={{ width: ancho || undefined, aspectRatio: `${pagina.ancho} / ${pagina.alto}` }}
        >
          <div ref={lienzoRef} className="visor-lienzo-cont" />
          <div className="visor-marcas">
            {!ocultarMarcas
              ? marcas.palabras.map((p) => (
                  <MarcaPalabra
                    key={p.id}
                    caja={p.caja}
                    anchoPagina={pagina.ancho}
                    altoPagina={pagina.alto}
                    estado={p.confianza < 60 ? 'dudosa' : 'detectada'}
                    etiqueta={p.texto}
                    alActivar={() => props.alTocarPalabra(p)}
                  />
                ))
              : null}
            {!ocultarMarcas
              ? marcas.editadas.map((e) => {
                  const primera = e.palabras[0] ? palabraPorId(e.palabras[0]) : undefined;
                  return (
                    <MarcaPalabra
                      key={e.id}
                      caja={e.caja}
                      anchoPagina={pagina.ancho}
                      altoPagina={pagina.alto}
                      estado="editada"
                      etiqueta={`${e.textoNuevo || '(borrado)'}, cambiado`}
                      alActivar={() => primera && props.alTocarPalabra(primera)}
                    />
                  );
                })
              : null}
            {marcas.cajaSeleccion ? (
              <MarcaPalabra caja={marcas.cajaSeleccion} anchoPagina={pagina.ancho} altoPagina={pagina.alto} estado="seleccionada" />
            ) : null}
          </div>
          {props.children}
        </div>
      </div>
      <div className="visor-flotantes" style={{ bottom: 8 }} hidden={tapado > 0}>
        <BotonIcono icono="menos" etiqueta="Alejar" onClick={() => cambiarZoom(1 / 1.5)} disabled={zoom <= 1} className="flotante" />
        <BotonIcono icono="mas" etiqueta="Acercar" onClick={() => cambiarZoom(1.5)} disabled={zoom >= ZOOM_MAX} className="flotante" />
        <BotonIcono
          icono={ocultarMarcas ? 'ojo' : 'ojoTachado'}
          etiqueta={ocultarMarcas ? 'Mostrar marcas' : 'Ocultar marcas'}
          onClick={props.alAlternarMarcas}
          className="flotante"
          aria-pressed={ocultarMarcas}
        />
      </div>
    </div>
  );
}
