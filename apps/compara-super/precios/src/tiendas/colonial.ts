/**
 * Supermercados Colonial (supercolonial.com) — plataforma Shopify.
 *
 * Fuente: API pública de sugerencias de búsqueda de Shopify:
 *   GET https://supercolonial.com/search/suggest.json?q=arroz&resources[type]=product&resources[limit]=10
 * No requiere JavaScript ni cookies. Máximo 10 productos por consulta (límite de Shopify).
 * El precio es único para la tienda en línea (no hay selector de sucursal en el catálogo).
 *
 * Nota: robots.txt permite /search, pero los términos y condiciones prohíben
 * herramientas automatizadas para extraer información. Ver informe.
 */
import { pedirJson, validarTexto } from '../http';
import {
  aPrecio,
  armarPrecios,
  interpretarPresentacion,
  limpiarCodigoBarras,
  marcaEnMayusculas,
} from '../normalizar';
import { ErrorTienda, type Adaptador, type OpcionesBusqueda, type Producto } from '../tipos';

const BASE = 'https://supercolonial.com';

interface ProductoShopify {
  id: number | string;
  title: string;
  handle: string;
  url?: string;
  price?: string;
  compare_at_price_max?: string;
  available?: boolean;
  image?: string | null;
  vendor?: string;
}
interface RespuestaShopify {
  resources?: { results?: { products?: ProductoShopify[] } };
}

/** Las imágenes se llaman "Items_2f707517002083_....jpg": el número es el código de barras. */
function codigoDesdeImagen(url: string | null | undefined): string | undefined {
  const m = url?.match(/Items_2f(\d{8,14})_/i);
  return limpiarCodigoBarras(m?.[1]);
}

export function parsearColonial(json: unknown): Producto[] {
  const productos = (json as RespuestaShopify)?.resources?.results?.products;
  if (!Array.isArray(productos)) {
    throw new ErrorTienda('colonial', 'formato', 'Respuesta sin "resources.results.products"');
  }
  const salida: Producto[] = [];
  for (const p of productos) {
    const precios = armarPrecios(aPrecio(p.compare_at_price_max), aPrecio(p.price));
    if (!precios) continue;
    const nombre = p.title.trim();
    salida.push({
      tienda: 'colonial',
      id: String(p.id),
      nombre,
      // "vendor" viene como "RMS" (su sistema), no es la marca; la marca va en mayúsculas al inicio del título.
      marca: marcaEnMayusculas(nombre),
      presentacion: interpretarPresentacion(nombre)?.texto,
      ...precios,
      imagen: p.image ?? undefined,
      url: `${BASE}/products/${p.handle}`,
      disponible: typeof p.available === 'boolean' ? p.available : undefined,
      codigoBarras: codigoDesdeImagen(p.image),
    });
  }
  return salida;
}

export const colonial: Adaptador = {
  tienda: 'colonial',
  nombre: 'Supermercados Colonial',
  async buscar(texto: string, opciones: OpcionesBusqueda = {}): Promise<Producto[]> {
    const q = validarTexto('colonial', texto);
    const limite = Math.min(opciones.limite ?? 10, 10);
    const url =
      `${BASE}/search/suggest.json?q=${encodeURIComponent(q)}` +
      `&resources%5Btype%5D=product&resources%5Blimit%5D=${limite}`;
    const json = await pedirJson('colonial', url, opciones);
    return parsearColonial(json).slice(0, limite);
  },
};
