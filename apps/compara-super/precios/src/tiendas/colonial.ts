/**
 * Supermercados Colonial (supercolonial.com) — plataforma Shopify.
 *
 * Fuente: API pública de sugerencias de búsqueda de Shopify:
 *   GET https://supercolonial.com/search/suggest.json?q=arroz&resources[type]=product&resources[limit]=10
 * No requiere JavaScript ni cookies. Máximo 10 productos por consulta (límite de Shopify).
 * El precio es único para la tienda en línea (no hay selector de sucursal en el catálogo).
 *
 * También busca por código de barras: con q=<EAN> el buscador devuelve el producto
 * cuyo SKU es ese EAN (ver `resultadoPorCodigo`). Búsquedas con varios códigos
 * unidos por "OR" NO son fiables (a veces devuelven vacío) y no se usan.
 *
 * Nota: robots.txt (revisado 2026-11-17) permite /search y /products y recomienda a
 * los agentes /llms.txt y el endpoint UCP/MCP; los términos y condiciones prohíben
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
import { confirmarMismoProducto } from '../similitud';
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
  /** Tipo de producto en Shopify ("Carnes y Refrigerados"). */
  type?: string;
  tags?: string[];
}
interface RespuestaShopify {
  resources?: { results?: { products?: ProductoShopify[] } };
}

/**
 * Muchas imágenes se llaman "Items_2f7424142400093.jpg" o "Items_2f707517002083_....jpg":
 * el número es el código de barras. (Antes solo se aceptaba la forma con "_" y se
 * perdían casi todos.)
 */
export function codigoDesdeImagen(url: string | null | undefined): string | undefined {
  const m = url?.match(/Items_2f(\d{8,14})(?=[_.?]|$)/i);
  return limpiarCodigoBarras(m?.[1]);
}

/** Texto de búsqueda que es un código de barras (8 a 14 dígitos). */
export const esCodigoBarras = (texto: string) => /^\d{8,14}$/.test(texto.trim());

/**
 * Búsqueda por código de barras: el buscador de Colonial encuentra el producto
 * cuyo SKU es ese código (su SKU es el EAN; verificado con /products/<handle>.js).
 * Se queda solo con el primer resultado y le pone el código buscado SOLO si:
 * - el nombre de su imagen trae ese mismo código, o
 * - la imagen no trae código y el producto coincide con la `referencia` (el de la
 *   otra tienda con ese código) en marca, cantidad y nombre (`confirmarMismoProducto`).
 * Si la imagen trae OTRO código, o no hay referencia que coincida, no devuelve nada.
 */
export function resultadoPorCodigo(
  productos: Producto[],
  codigo: string,
  referencia?: OpcionesBusqueda['referencia'],
): Producto[] {
  const primero = productos[0];
  const buscado = limpiarCodigoBarras(codigo);
  if (!primero || !buscado) return [];
  if (primero.codigoBarras) return primero.codigoBarras === buscado ? [primero] : [];
  if (!referencia || !confirmarMismoProducto(referencia, primero)) return [];
  return [{ ...primero, codigoBarras: buscado }];
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
    const etiquetas = Array.isArray(p.tags) ? p.tags.filter((t): t is string => typeof t === 'string') : [];
    const categoria = [p.type?.trim(), etiquetas.join(', ')].filter(Boolean).join(' | ') || undefined;
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
      ...(categoria ? { categoria } : {}),
    });
  }
  return salida;
}

export const colonial: Adaptador = {
  tienda: 'colonial',
  nombre: 'Supermercados Colonial',
  buscaPorCodigo: true,
  async buscar(texto: string, opciones: OpcionesBusqueda = {}): Promise<Producto[]> {
    const q = validarTexto('colonial', texto);
    const porCodigo = esCodigoBarras(q);
    // Shopify no da más de 10 resultados en suggest.json (se probó resources[limit]=25).
    const limite = porCodigo ? 3 : Math.min(opciones.limite ?? 10, 10);
    const url =
      `${BASE}/search/suggest.json?q=${encodeURIComponent(q)}` +
      `&resources%5Btype%5D=product&resources%5Blimit%5D=${limite}`;
    const json = await pedirJson('colonial', url, opciones);
    const productos = parsearColonial(json);
    return porCodigo ? resultadoPorCodigo(productos, q, opciones.referencia) : productos.slice(0, limite);
  },
};
