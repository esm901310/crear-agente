/** Emparejamiento de productos de varias tiendas en "grupos" (mismo producto). */
import { nombreParaMostrar } from '../../precios/src/normalizar';
import { compararFirmas, firmaDe, UMBRAL_PROBABLE, type Firma } from '../../precios/src/similitud';
import type { Producto } from '../../precios/src/tipos';
import { normalizarEan13 } from './ean';
import type { Coincidencia, Grupo, PrecioTienda, Tienda } from './tipos';

/** Preferencia para elegir el nombre/marca/imagen que se muestra del grupo. */
const PREFERENCIA_NOMBRE: Tienda[] = ['lacolonia', 'losandes', 'colonial'];

export function aPrecioTienda(p: Producto): PrecioTienda {
  const salida: PrecioTienda = { productoId: p.id, nombre: p.nombre, precio: p.precio, url: p.url };
  if (p.precioOferta !== undefined && p.precioOferta < p.precio) salida.precioOferta = p.precioOferta;
  if (p.imagen) salida.imagen = p.imagen;
  if (typeof p.disponible === 'boolean') salida.disponible = p.disponible;
  return salida;
}

/** "ean:0707517002083" si hay código de barras válido; si no, "<tienda>:<id>". */
export function claveDeProducto(p: Producto): string {
  const ean = normalizarEan13(p.codigoBarras);
  return ean ? `ean:${ean}` : `${p.tienda}:${p.id}`;
}

export interface Acumulado {
  clave: string;
  productos: Partial<Record<Tienda, Producto>>;
  /** Mejor posición del producto en los resultados de su tienda (relevancia). */
  rango: number;
  orden: number;
  /** true si se unió con otro grupo por parecido (no por código). */
  probable?: boolean;
}

export interface ResultadoParaEmparejar {
  tienda: Tienda;
  productos: Producto[];
}

export interface OpcionesEmparejar {
  /** Unir también por parecido (marca + cantidad + palabras). Por defecto true. */
  difuso?: boolean;
  /** Puntuación mínima para unir por parecido. Por defecto UMBRAL_PROBABLE (0.8). */
  umbral?: number;
}

/**
 * Agrupa los productos:
 * 1. Por código de barras (EAN-13): coincidencia 'codigo'.
 * 2. Los grupos que quedan sin pareja en otra tienda se unen por parecido
 *    (precios/src/similitud.ts), solo por encima del umbral y uno a uno, el mejor
 *    par primero: coincidencia 'probable'. Nunca se unen dos grupos con códigos de
 *    barras distintos (son productos distintos), ni si ninguno tiene código (la
 *    clave del grupo tiene que ser "ean:..." para tener 2 tiendas).
 * Ordena primero los grupos que están en más tiendas y luego por relevancia.
 * Devuelve como máximo `maximo`.
 */
export function emparejar(resultados: ResultadoParaEmparejar[], maximo = 20, opciones: OpcionesEmparejar = {}): Grupo[] {
  const lista = agrupar(resultados, opciones);
  const tiendasDe = (a: Acumulado) => Object.keys(a.productos).length;
  lista.sort((a, b) => tiendasDe(b) - tiendasDe(a) || a.rango - b.rango || a.orden - b.orden);
  return lista.slice(0, maximo).map(armarGrupo);
}

/** Agrupa sin ordenar ni recortar (lo usa también la búsqueda para ver qué quedó sin pareja). */
export function agrupar(resultados: ResultadoParaEmparejar[], opciones: OpcionesEmparejar = {}): Acumulado[] {
  const mapa = new Map<string, Acumulado>();
  let orden = 0;
  for (const r of resultados) {
    r.productos.forEach((p, i) => {
      const clave = claveDeProducto(p);
      let acc = mapa.get(clave);
      if (!acc) {
        acc = { clave, productos: {}, rango: i, orden: orden++ };
        mapa.set(clave, acc);
      }
      // Si una misma tienda trae dos productos con el mismo código, se queda el primero (más relevante).
      if (!acc.productos[r.tienda]) acc.productos[r.tienda] = p;
      acc.rango = Math.min(acc.rango, i);
    });
  }
  const lista = [...mapa.values()];
  return opciones.difuso === false ? lista : unirPorParecido(lista, opciones.umbral ?? UMBRAL_PROBABLE);
}

/** Tiendas de un grupo. */
const tiendasDeGrupo = (a: Acumulado) => Object.keys(a.productos) as Tienda[];

/**
 * Une grupos de tiendas distintas que son "probablemente el mismo producto".
 * Voraz: en cada vuelta une el mejor par que pase el umbral; un grupo unido ya
 * tiene esas tiendas ocupadas, así que cada producto se usa una sola vez.
 */
function unirPorParecido(lista: Acumulado[], umbral: number): Acumulado[] {
  const firmas = new Map<Producto, Firma>();
  const firma = (p: Producto) => firmas.get(p) ?? firmas.set(p, firmaDe(p)).get(p)!;
  const puntuaciones = new Map<string, number>();
  const puntuar = (a: Acumulado, b: Acumulado): number => {
    const k = a.orden < b.orden ? `${a.orden}|${b.orden}` : `${b.orden}|${a.orden}`;
    const guardada = puntuaciones.get(k);
    if (guardada !== undefined) return guardada;
    let minimo = 1;
    // Todos los productos de un grupo deben parecerse a todos los del otro.
    for (const pa of Object.values(a.productos)) {
      for (const pb of Object.values(b.productos)) {
        minimo = Math.min(minimo, compararFirmas(firma(pa!), firma(pb!)).puntuacion);
        if (minimo < umbral) break;
      }
      if (minimo < umbral) break;
    }
    puntuaciones.set(k, minimo);
    return minimo;
  };
  const ean = (a: Acumulado) => (a.clave.startsWith('ean:') ? a.clave : undefined);

  const activos = new Set(lista);
  for (;;) {
    let mejor: { a: Acumulado; b: Acumulado; p: number } | undefined;
    const vivos = [...activos];
    for (let i = 0; i < vivos.length; i++) {
      for (let j = i + 1; j < vivos.length; j++) {
        const a = vivos[i];
        const b = vivos[j];
        const ta = tiendasDeGrupo(a);
        if (tiendasDeGrupo(b).some((t) => ta.includes(t))) continue;
        const ea = ean(a);
        const eb = ean(b);
        if (!ea && !eb) continue; // sin código no hay clave válida para un grupo de 2 tiendas
        if (ea && eb && ea !== eb) continue; // códigos distintos = productos distintos
        const p = puntuar(a, b);
        if (p < umbral) continue;
        const desempate = (x: { a: Acumulado; b: Acumulado }) => x.a.rango + x.b.rango;
        if (!mejor || p > mejor.p || (p === mejor.p && desempate({ a, b }) < desempate(mejor))) mejor = { a, b, p };
      }
    }
    if (!mejor) break;
    const { a, b } = mejor;
    const unido: Acumulado = {
      clave: ean(a) ?? ean(b)!,
      productos: { ...a.productos, ...b.productos },
      rango: Math.min(a.rango, b.rango),
      orden: Math.min(a.orden, b.orden),
      probable: true,
    };
    activos.delete(a);
    activos.delete(b);
    activos.add(unido);
    // El grupo unido hereda el "orden" menor: borrar puntuaciones guardadas con ese orden.
    for (const k of [...puntuaciones.keys()]) {
      if (k.split('|').includes(String(unido.orden))) puntuaciones.delete(k);
    }
  }
  return [...activos];
}

function armarGrupo(acc: Acumulado): Grupo {
  const ordenados = PREFERENCIA_NOMBRE.map((t) => acc.productos[t]).filter((p): p is Producto => !!p);
  const principal = ordenados[0];
  const marca = ordenados.find((p) => p.marca)?.marca;
  const presentacion = ordenados.find((p) => p.presentacion)?.presentacion;
  // Nombre limpio para mostrar; el original de cada tienda queda en precios[tienda].nombre.
  const nombre = nombreParaMostrar(principal.nombre, { marca: principal.marca ?? marca, presentacion }).slice(0, 200);
  const grupo: Grupo = { clave: acc.clave, nombre: nombre || principal.nombre, precios: {} };
  if (ordenados.length >= 2) grupo.coincidencia = (acc.probable ? 'probable' : 'codigo') satisfies Coincidencia;
  const imagen = ordenados.find((p) => p.imagen)?.imagen;
  if (marca) grupo.marca = marca;
  if (presentacion) grupo.presentacion = presentacion;
  if (imagen) grupo.imagen = imagen;
  for (const [tienda, p] of Object.entries(acc.productos) as Array<[Tienda, Producto]>) {
    grupo.precios[tienda] = aPrecioTienda(p);
  }
  return grupo;
}

/**
 * Junta un grupo que ya estaba en la lista con uno nuevo de la MISMA clave (la
 * persona agrega otra vez "el mismo" producto). No se pierde ninguna tienda: las
 * que trae el nuevo se actualizan y las que solo tenía el guardado se conservan.
 * Ej.: en la lista está el par probable `ean:X` {La Colonia, Colonial} y luego se
 * agrega `ean:X` solo de La Colonia (Colonial falló en esa búsqueda): se actualiza
 * La Colonia y se conserva el precio de Colonial.
 * Si el nuevo ya trae 2 o más tiendas, manda el nuevo en esas tiendas.
 */
export function fusionarGrupos(guardado: Grupo, nuevo: Grupo): { grupo: Grupo; conservoTiendas: boolean } {
  const precios = { ...guardado.precios, ...nuevo.precios };
  const grupo: Grupo = { ...guardado, ...nuevo, precios };
  const n = (g: Grupo) => Object.keys(g.precios).length;
  delete grupo.coincidencia;
  if (n(grupo) >= 2) {
    // Dos grupos de una tienda con la misma clave "ean:" comparten código de barras.
    grupo.coincidencia = (n(nuevo) >= 2 ? nuevo.coincidencia : n(guardado) >= 2 ? guardado.coincidencia : undefined) ?? 'codigo';
  }
  const conservoTiendas = Object.keys(guardado.precios).some((t) => !(t in nuevo.precios));
  return { grupo, conservoTiendas };
}

/**
 * Busca en los resultados de una tienda el mismo producto de un grupo:
 * primero por id del producto en esa tienda, luego por código de barras.
 */
export function reidentificar(
  productos: Producto[],
  productoId: string | undefined,
  ean13: string | undefined,
): Producto | undefined {
  if (productoId) {
    const porId = productos.find((p) => p.id === productoId);
    if (porId) return porId;
  }
  if (ean13) return productos.find((p) => normalizarEan13(p.codigoBarras) === ean13);
  return undefined;
}

/** EAN-13 de la clave del grupo ("ean:...") o undefined. */
export function eanDeClave(clave: string): string | undefined {
  return clave.startsWith('ean:') ? normalizarEan13(clave.slice(4)) : undefined;
}
