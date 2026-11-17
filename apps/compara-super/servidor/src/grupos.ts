/** Emparejamiento de productos de varias tiendas en "grupos" (mismo producto). */
import type { Producto } from '../../precios/src/tipos';
import { normalizarEan13 } from './ean';
import type { Grupo, PrecioTienda, Tienda } from './tipos';

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

interface Acumulado {
  clave: string;
  productos: Partial<Record<Tienda, Producto>>;
  /** Mejor posición del producto en los resultados de su tienda (relevancia). */
  rango: number;
  orden: number;
}

export interface ResultadoParaEmparejar {
  tienda: Tienda;
  productos: Producto[];
}

/**
 * Agrupa los productos por código de barras (EAN-13). Si un producto no tiene
 * código válido queda en un grupo de una sola tienda. Ordena primero los grupos
 * que están en más tiendas y luego por relevancia. Devuelve como máximo `maximo`.
 */
export function emparejar(resultados: ResultadoParaEmparejar[], maximo = 20): Grupo[] {
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
  const tiendasDe = (a: Acumulado) => Object.keys(a.productos).length;
  lista.sort((a, b) => tiendasDe(b) - tiendasDe(a) || a.rango - b.rango || a.orden - b.orden);
  return lista.slice(0, maximo).map(armarGrupo);
}

function armarGrupo(acc: Acumulado): Grupo {
  const ordenados = PREFERENCIA_NOMBRE.map((t) => acc.productos[t]).filter((p): p is Producto => !!p);
  const principal = ordenados[0];
  const grupo: Grupo = { clave: acc.clave, nombre: principal.nombre, precios: {} };
  const marca = ordenados.find((p) => p.marca)?.marca;
  const presentacion = ordenados.find((p) => p.presentacion)?.presentacion;
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
