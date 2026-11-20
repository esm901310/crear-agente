// Pedido en preparación de cada mesa, guardado en esta tablet (localStorage)
// para que no se pierda si el mesero cambia de mesa, recarga o se va la conexión.
import type { Producto } from './tipos';

export interface LineaPedido {
  clave: string; // identificador local de la línea
  producto_id: number;
  nombre: string;
  precio: number; // centavos
  cantidad: number;
  nota: string | null;
}

/**
 * Identificador del envío a cocina de este pedido (evita duplicados si se corta
 * la conexión). `huella` = contenido exacto que se intentó enviar: mientras el
 * pedido no cambie, los reintentos reusan el mismo id y el servidor no crea otra
 * comanda. Si el pedido cambia, el id se descarta y el siguiente envío usa uno nuevo.
 */
export interface EnvioPendiente {
  id: string;
  huella: string;
}

export interface PedidoGuardado {
  mesa_nombre: string;
  lineas: LineaPedido[];
  envio?: EnvioPendiente;
}

const PREFIJO = 'pedido-mesa-';

export function leerPedido(mesaId: number): PedidoGuardado | null {
  try {
    const texto = localStorage.getItem(PREFIJO + mesaId);
    if (!texto) return null;
    const p = JSON.parse(texto) as PedidoGuardado;
    if (!p || !Array.isArray(p.lineas)) return null;
    return p;
  } catch {
    return null;
  }
}

/** Contenido del pedido tal como se manda al servidor (sin claves locales). */
function huellaDe(lineas: LineaPedido[]): string {
  return JSON.stringify(lineas.map((l) => [l.producto_id, l.cantidad, l.nota ?? null]));
}

export function guardarPedido(mesaId: number, mesaNombre: string, lineas: LineaPedido[]): void {
  if (lineas.length === 0) {
    localStorage.removeItem(PREFIJO + mesaId);
    return;
  }
  // El id de envío se conserva solo si el contenido sigue siendo el mismo.
  const anterior = leerPedido(mesaId)?.envio;
  const envio = anterior && anterior.huella === huellaDe(lineas) ? anterior : undefined;
  const p: PedidoGuardado = { mesa_nombre: mesaNombre, lineas, ...(envio ? { envio } : {}) };
  localStorage.setItem(PREFIJO + mesaId, JSON.stringify(p));
}

/** UUID v4. `crypto.randomUUID` solo existe en https/localhost; en la red local por http se arma a mano. */
function nuevoUuid(): string {
  if (typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // contexto no seguro: seguimos abajo
    }
  }
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Id de envío para mandar este pedido a cocina. Reusa el guardado si el pedido
 * no cambió desde el último intento; si no, genera uno nuevo y lo guarda junto
 * con el pedido (antes de enviar, para que sobreviva a una recarga).
 * Se descarta al borrar el pedido (envío confirmado) o al modificarlo.
 */
export function prepararEnvio(mesaId: number, mesaNombre: string, lineas: LineaPedido[]): string {
  const huella = huellaDe(lineas);
  const anterior = leerPedido(mesaId)?.envio;
  if (anterior && anterior.huella === huella) return anterior.id;
  const envio: EnvioPendiente = { id: nuevoUuid(), huella };
  const p: PedidoGuardado = { mesa_nombre: mesaNombre, lineas, envio };
  localStorage.setItem(PREFIJO + mesaId, JSON.stringify(p));
  return envio.id;
}

export function borrarPedido(mesaId: number): void {
  localStorage.removeItem(PREFIJO + mesaId);
}

/** Mesas con pedido sin enviar en esta tablet: id → nombre. */
export function mesasConPedido(): Map<number, string> {
  const r = new Map<number, string>();
  for (let i = 0; i < localStorage.length; i++) {
    const llave = localStorage.key(i);
    if (!llave?.startsWith(PREFIJO)) continue;
    const id = Number(llave.slice(PREFIJO.length));
    const p = leerPedido(id);
    if (p && p.lineas.length > 0) r.set(id, p.mesa_nombre);
  }
  return r;
}

export function borrarTodosLosPedidos(): void {
  for (const id of mesasConPedido().keys()) borrarPedido(id);
}

let contador = 0;
export function nuevaClave(): string {
  contador += 1;
  return `${Date.now().toString(36)}-${contador}`;
}

/** Suma 1 a la línea sin nota de ese platillo, o crea una al final. */
export function agregarProducto(lineas: LineaPedido[], p: Producto): LineaPedido[] {
  const i = lineas.findIndex((l) => l.producto_id === p.id && l.nota === null);
  if (i >= 0) {
    return lineas.map((l, j) => (j === i ? { ...l, cantidad: Math.min(99, l.cantidad + 1) } : l));
  }
  return [
    ...lineas,
    { clave: nuevaClave(), producto_id: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1, nota: null },
  ];
}

/**
 * Pone (o quita, con nota null) la nota de una línea.
 * `soloUna`: separa una unidad en una línea nueva con la nota y deja el resto igual.
 * Si al quitar la nota ya existe una línea sin nota del mismo platillo, se juntan.
 */
export function ponerNota(lineas: LineaPedido[], clave: string, nota: string | null, soloUna: boolean): LineaPedido[] {
  const i = lineas.findIndex((l) => l.clave === clave);
  if (i < 0) return lineas;
  const linea = lineas[i];

  if (soloUna && linea.cantidad > 1 && nota !== null) {
    const copia = [...lineas];
    copia[i] = { ...linea, cantidad: linea.cantidad - 1 };
    copia.splice(i + 1, 0, { ...linea, clave: nuevaClave(), cantidad: 1, nota });
    return copia;
  }

  if (nota === null) {
    const j = lineas.findIndex((l) => l.clave !== clave && l.producto_id === linea.producto_id && l.nota === null);
    if (j >= 0) {
      return lineas
        .map((l, k) => (k === j ? { ...l, cantidad: Math.min(99, l.cantidad + linea.cantidad) } : l))
        .filter((l) => l.clave !== clave);
    }
  }
  return lineas.map((l) => (l.clave === clave ? { ...l, nota } : l));
}
