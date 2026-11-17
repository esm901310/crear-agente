/**
 * Supermercados La Colonia (www.lacolonia.com) — plataforma VTEX IO.
 *
 * Fuente: API JSON "Intelligent Search" que usa la propia caja de búsqueda del sitio:
 *   GET https://www.lacolonia.com/_v/api/intelligent-search/product_search/?query=arroz&count=20&page=1&locale=es-HN
 * No requiere JavaScript ni cookies. Sin tienda elegida devuelve el precio del canal
 * de venta 1 (precio web general); `AvailableQuantity` viene en 0 porque el
 * inventario depende de la sucursal elegida, así que `disponible` queda sin definir.
 *
 * Nota robots.txt: prohíbe /api* y /busca* (la API clásica /api/catalog_system/...).
 * Esta ruta (/_v/api/...) no está listada, pero es interna; ver informe.
 */
import { pedirJson, validarTexto } from '../http';
import { aPrecio, armarPrecios, interpretarPresentacion, limpiarCodigoBarras } from '../normalizar';
import { ErrorTienda, type Adaptador, type OpcionesBusqueda, type Producto } from '../tipos';

const BASE = 'https://www.lacolonia.com';

interface OfertaVtex {
  Price?: number;
  ListPrice?: number;
  PriceWithoutDiscount?: number;
  AvailableQuantity?: number;
}
interface ProductoVtex {
  productId: string;
  productName: string;
  brand?: string;
  link?: string;
  linkText?: string;
  categories?: string[];
  items?: Array<{
    itemId: string;
    ean?: string;
    measurementUnit?: string;
    unitMultiplier?: number;
    images?: Array<{ imageUrl: string }>;
    sellers?: Array<{ commertialOffer?: OfertaVtex }>;
  }>;
}
interface RespuestaVtex {
  products?: ProductoVtex[];
}

export function parsearLaColonia(json: unknown): Producto[] {
  const datos = json as RespuestaVtex;
  if (!datos || !Array.isArray(datos.products)) {
    throw new ErrorTienda('lacolonia', 'formato', 'Respuesta sin lista "products"');
  }
  const salida: Producto[] = [];
  for (const p of datos.products) {
    const item = p.items?.[0];
    const oferta = item?.sellers?.[0]?.commertialOffer;
    const actual = aPrecio(oferta?.Price);
    const normal = aPrecio(oferta?.ListPrice) ?? aPrecio(oferta?.PriceWithoutDiscount);
    const precios = armarPrecios(normal, actual);
    if (!precios) continue; // sin precio: no sirve para comparar
    const ruta = p.link ?? (p.linkText ? `/${p.linkText}/p` : '');
    // Casi todo viene como "un" (incluso la carne por libra); a veces "lb" (p. ej. piernitas a granel).
    const unidad = item?.measurementUnit?.trim().toLowerCase();
    const multiplicador = Number(item?.unitMultiplier ?? 1);
    const unidadVenta =
      (unidad === 'lb' || unidad === 'kg') && Number.isFinite(multiplicador) && multiplicador > 0
        ? { unidad: unidad as 'lb' | 'kg', multiplicador }
        : undefined;
    const categoria = Array.isArray(p.categories) && typeof p.categories[0] === 'string' ? p.categories[0] : undefined;
    salida.push({
      tienda: 'lacolonia',
      id: p.productId,
      nombre: p.productName.trim(),
      marca: p.brand?.trim() || undefined,
      presentacion: interpretarPresentacion(p.productName)?.texto,
      ...precios,
      imagen: item?.images?.[0]?.imageUrl,
      url: ruta.startsWith('http') ? ruta : BASE + ruta,
      // AvailableQuantity > 0 sí indica stock; 0 sin sucursal elegida no significa "agotado".
      disponible: (oferta?.AvailableQuantity ?? 0) > 0 ? true : undefined,
      codigoBarras: limpiarCodigoBarras(item?.ean),
      ...(categoria ? { categoria } : {}),
      ...(unidadVenta ? { unidadVenta } : {}),
    });
  }
  return salida;
}

export const laColonia: Adaptador = {
  tienda: 'lacolonia',
  nombre: 'Supermercados La Colonia',
  async buscar(texto: string, opciones: OpcionesBusqueda = {}): Promise<Producto[]> {
    const q = validarTexto('lacolonia', texto);
    const limite = Math.min(opciones.limite ?? 20, 50);
    const url =
      `${BASE}/_v/api/intelligent-search/product_search/` +
      `?query=${encodeURIComponent(q)}&count=${limite}&page=1&locale=es-HN`;
    const json = await pedirJson('lacolonia', url, opciones);
    return parsearLaColonia(json).slice(0, limite);
  },
};
