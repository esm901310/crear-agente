/**
 * Comisariato Los Andes (comisariatolosandes.com) — app Angular propia (proveedor "AVE").
 *
 * El HTML no trae resultados de búsqueda (se arman con JavaScript). El sitio llama a su API:
 *   POST https://andes.aveapplications.com/api/em/material/paginate?skip=0&take=20
 *   body: { businessPartner: 1, storeId: null, officeCode: "0", type: "PD", search: "arroz", ... }
 * Respuesta: { data: [{ code, name, price, newPrice, oldPrice, images, materialGroupName, ... }], totalItems, ... }
 * (Existe también /api/em/material/search, pero NO trae precios.)
 *
 * `type` es la lista de precios ("PD" = la que usa el sitio por defecto) y `storeId`
 * la sucursal; con storeId null se obtiene el precio general. PENDIENTE: la forma de
 * la respuesta de /paginate está tomada del código del sitio y de productos reales
 * de su portada, pero no se pudo llamar en vivo desde este entorno.
 */
import { pedirJson, validarTexto } from '../http';
import { aPrecio, armarPrecios, completarGtin, interpretarPresentacion } from '../normalizar';
import { ErrorTienda, type Adaptador, type OpcionesBusqueda, type Producto } from '../tipos';

const API = 'https://andes.aveapplications.com/api/em/material/paginate';
const SITIO = 'https://comisariatolosandes.com';
const IMAGENES = 'https://comisariatolosandesfiles.s3.us-east-2.amazonaws.com/folder/products/500X500/';

interface MaterialAndes {
  code: string;
  codeERP?: string;
  name: string;
  price?: number | string | null;
  newPrice?: number | string | null;
  oldPrice?: number | string | null;
  availibilityCount?: number;
  brandName?: string;
  materialGroupName?: string;
  images?: Array<{ fileName: string }> | null;
}

/** Mismas reglas que usa el sitio para armar el enlace (transformToSnakeCase / transformToSlug). */
function aCategoriaSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 ]+/g, '')
    .trim()
    .replace(/ /g, '-')
    .toLowerCase();
}
function aSlug(texto: string): string {
  return texto
    .replace(/\+/g, '')
    .replace(/\s\s+/g, ' ')
    .replace(/ /g, '-')
    .replace(/\//g, '-')
    .replace(/[(),]/g, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function cuerpoBusquedaLosAndes(texto: string) {
  return {
    businessPartner: 1,
    storeId: null,
    groupCode: null,
    officeCode: '0',
    type: 'PD',
    sortBy: 'category',
    sortOption: 'ASC',
    search: texto,
    filter: { priceMin: null, priceMax: null, brand: null, supplier: null },
    source: 'WEB',
    hidden: '0',
  };
}

export function parsearLosAndes(json: unknown): Producto[] {
  const datos = (json as { data?: MaterialAndes[] })?.data;
  if (!Array.isArray(datos)) {
    throw new ErrorTienda('losandes', 'formato', 'Respuesta sin lista "data"');
  }
  const salida: Producto[] = [];
  for (const m of datos) {
    // price = precio normal; newPrice = precio vigente (menor si hay oferta).
    const precios = armarPrecios(aPrecio(m.price) ?? aPrecio(m.oldPrice), aPrecio(m.newPrice));
    if (!precios) continue;
    const nombre = m.name.replace(/\.+$/, '').trim();
    const codigoCorto = String(Number(m.code.split('-')[1] ?? m.code));
    const categoria = m.materialGroupName ? aCategoriaSlug(m.materialGroupName) : 'producto';
    const archivo = m.images?.[0]?.fileName;
    // "Marca COMANDES" es un valor genérico del sistema, no la marca real.
    const marca = m.brandName && !/comandes/i.test(m.brandName) ? m.brandName : undefined;
    salida.push({
      tienda: 'losandes',
      id: m.code,
      nombre,
      marca,
      presentacion: interpretarPresentacion(nombre)?.texto,
      ...precios,
      imagen: archivo ? IMAGENES + encodeURIComponent(archivo) : undefined,
      url: `${SITIO}/${categoria}/${aSlug(m.name)}-${codigoCorto}`,
      disponible: (m.availibilityCount ?? 0) > 0 ? true : undefined,
      codigoBarras: completarGtin(m.codeERP ?? codigoCorto),
    });
  }
  return salida;
}

export const losAndes: Adaptador = {
  tienda: 'losandes',
  nombre: 'Comisariato Los Andes',
  async buscar(texto: string, opciones: OpcionesBusqueda = {}): Promise<Producto[]> {
    const q = validarTexto('losandes', texto);
    const limite = Math.min(opciones.limite ?? 20, 50);
    const json = await pedirJson('losandes', `${API}?skip=0&take=${limite}`, opciones, {
      method: 'POST',
      body: cuerpoBusquedaLosAndes(q),
    });
    return parsearLosAndes(json).slice(0, limite);
  },
};
