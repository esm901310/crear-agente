// ============================================================================
//  DATOS DE EJEMPLO — SOLO PARA EL MODO SIMULADO (VITE_API_SIMULADA=1)
//  Estos precios son INVENTADOS. No son precios reales de ningún supermercado.
// ============================================================================
import type { Grupo, PrecioTienda } from './cliente';

function p(tienda: string, id: string, nombre: string, precio: number, precioOferta?: number): PrecioTienda {
  return {
    productoId: id,
    nombre: `${nombre} (EJEMPLO)`,
    precio,
    precioOferta,
    url: `https://ejemplo.invalid/${tienda}/${id}`,
    disponible: true,
  };
}

const CATALOGO_BASE: Grupo[] = [
  {
    clave: 'ean:0000000000011',
    nombre: 'Arroz Progreso',
    marca: 'Progreso',
    presentacion: 'Bolsa 5 lb',
    precios: {
      lacolonia: p('lacolonia', '1011', 'ARROZ PROGRESO 5LB', 92.5),
      colonial: p('colonial', '2011', 'Arroz Progreso Bolsa 5 Lb', 89.9),
    },
  },
  {
    // Sin código de barras común: el servidor lo empareja por marca + tamaño + tipo.
    clave: 'lacolonia:1012',
    nombre: 'Arroz Progreso',
    coincidencia: 'probable',
    marca: 'Progreso',
    presentacion: 'Bolsa 2 lb',
    precios: {
      lacolonia: p('lacolonia', '1012', 'ARROZ PROGRESO 2LB', 38.5),
      colonial: p('colonial', '2012', 'PROGRESO Arroz Blanco GranoLargo 907g', 39.9),
    },
  },
  {
    clave: 'lacolonia:1013',
    nombre: 'Arroz Gallo Dorado',
    marca: 'Gallo Dorado',
    presentacion: 'Bolsa 4 lb',
    precios: { lacolonia: p('lacolonia', '1013', 'ARROZ GALLO DORADO 4LB', 81.75) },
  },
  {
    clave: 'colonial:2014',
    nombre: 'Arroz precocido Gallo Dorado',
    marca: 'Gallo Dorado',
    presentacion: 'Bolsa 2 lb',
    precios: { colonial: p('colonial', '2014', 'Arroz Precocido Gallo Dorado 2 Lb', 44) },
  },
  {
    clave: 'lacolonia:1021',
    nombre: "Frijoles rojos Kern's",
    marca: "Kern's",
    presentacion: 'Bolsa 2 lb',
    precios: { lacolonia: p('lacolonia', '1021', "FRIJOL ROJO KERN'S 2LB", 58.5) },
  },
  {
    // Sin código de barras común: el servidor lo empareja por marca + tamaño + tipo.
    clave: 'lacolonia:1022',
    nombre: 'Frijoles rojos Ducal',
    coincidencia: 'probable',
    marca: 'Ducal',
    presentacion: 'Bolsa 2 lb',
    precios: {
      lacolonia: p('lacolonia', '1022', 'FRIJOL ROJO DUCAL 2LB', 57.25),
      colonial: p('colonial', '2022', 'DUCAL Frijoles RojosEnteros2Lb', 55),
    },
  },
  {
    clave: 'colonial:2023',
    nombre: 'Frijoles rojos Don Julio',
    marca: 'Don Julio',
    presentacion: 'Bolsa 1.5 lb',
    precios: { colonial: p('colonial', '2023', 'Frijol Rojo Don Julio 1.5 Lb', 41.9) },
  },
  {
    clave: 'ean:0000000000031',
    nombre: 'Leche entera Sula',
    marca: 'Sula',
    presentacion: 'Galón',
    precios: {
      lacolonia: p('lacolonia', '1031', 'LECHE ENTERA SULA GALON', 98),
      colonial: p('colonial', '2031', 'Leche Entera Sula Galón', 99.5),
    },
  },
  {
    clave: 'ean:0000000000032',
    nombre: 'Leche semidescremada Sula',
    marca: 'Sula',
    presentacion: '946 ml',
    precios: {
      lacolonia: p('lacolonia', '1032', 'LECHE SEMIDESCREMADA SULA 946ML', 32.9),
      colonial: p('colonial', '2032', 'Leche Semidescremada Sula 946 ml', 31.5, 29.9),
    },
  },
  {
    clave: 'ean:0000000000041',
    nombre: 'Café molido Maya',
    marca: 'Maya',
    presentacion: '400 g',
    precios: {
      lacolonia: p('lacolonia', '1041', 'CAFE MOLIDO MAYA 400G', 115),
      colonial: p('colonial', '2041', 'Café Molido Maya 400 g', 112.5),
    },
  },
  {
    clave: 'ean:0000000000051',
    nombre: 'Azúcar blanca Caña Real',
    marca: 'Caña Real',
    presentacion: 'Bolsa 5 lb',
    precios: {
      lacolonia: p('lacolonia', '1051', 'AZUCAR BLANCA CANA REAL 5LB', 62),
      colonial: p('colonial', '2051', 'Azúcar Blanca Caña Real 5 Lb', 60.75),
    },
  },
  {
    clave: 'ean:0000000000061',
    nombre: 'Huevos rojos',
    presentacion: 'Cartón de 30',
    precios: {
      lacolonia: p('lacolonia', '1061', 'HUEVO ROJO CARTON 30', 145),
      colonial: p('colonial', '2061', 'Huevos Rojos Cartón 30 Unidades', 139.9),
    },
  },
  {
    clave: 'ean:0000000000071',
    nombre: 'Aceite vegetal Clover',
    marca: 'Clover',
    presentacion: '900 ml',
    precios: {
      lacolonia: p('lacolonia', '1071', 'ACEITE VEGETAL CLOVER 900ML', 74.9),
      colonial: p('colonial', '2071', 'Aceite Vegetal Clover 900 ml', 76.25),
    },
  },
  {
    clave: 'ean:0000000000081',
    nombre: 'Pan blanco grande',
    presentacion: '680 g',
    precios: {
      lacolonia: p('lacolonia', '1081', 'PAN BLANCO GRANDE 680G', 52),
      colonial: p('colonial', '2081', 'Pan Blanco Grande 680 g', 52),
    },
  },
  // ---- Carnes por libra (coincidencia 'corte'): cada súper llama distinto al corte. ----
  // Precios POR LIBRA; la cantidad en la lista son libras (de media en media).
  {
    clave: 'corte:lacolonia:1101',
    nombre: 'Chuleta de cerdo',
    corte: 'Chuleta de cerdo',
    coincidencia: 'corte',
    presentacion: 'por libra',
    precios: {
      lacolonia: p('lacolonia', '1101', 'Chuleta de Cerdo x Lb', 64.9),
      colonial: p('colonial', '2101', 'Chuleta de Cerdo Popular x Lb', 59.95),
    },
  },
  {
    clave: 'corte:lacolonia:1102',
    nombre: 'Pechuga de pollo deshuesada',
    corte: 'Pechuga de pollo deshuesada',
    coincidencia: 'corte',
    presentacion: 'por libra',
    precios: {
      lacolonia: p('lacolonia', '1102', 'PECHUGA DE POLLO DESHUESADA X LB', 62.5),
      colonial: p('colonial', '2102', 'Pechuga Deshuesada de Pollo x Lb', 63.9, 58.9),
    },
  },
  // Cortes en una sola tienda: sirven como "otro corte" en P9.
  {
    clave: 'colonial:2103',
    nombre: 'Chuleta de cerdo ahumada',
    corte: 'Chuleta de cerdo ahumada',
    presentacion: 'por libra',
    precios: { colonial: p('colonial', '2103', 'Chuleta de Cerdo Ahumada x Lb', 72.5) },
  },
  {
    clave: 'colonial:2104',
    nombre: 'Costilla de cerdo',
    corte: 'Costilla de cerdo',
    presentacion: 'por libra',
    precios: { colonial: p('colonial', '2104', 'Costilla de Cerdo x Lb', 55.99) },
  },
  {
    // Empacado (no por libra): no debe salir al elegir otro corte.
    clave: 'colonial:2105',
    nombre: 'Chuleta de cerdo ahumada Delicia',
    marca: 'Delicia',
    presentacion: 'Paquete 1 lb',
    precios: { colonial: p('colonial', '2105', 'DELICIA Chuleta de Cerdo Ahumada 1 Lb', 89) },
  },
];

/** Los grupos de 2+ tiendas que no son 'probable' coinciden por código de barras. */
export const CATALOGO_EJEMPLO: Grupo[] = CATALOGO_BASE.map((g) =>
  Object.keys(g.precios).length > 1 && !g.coincidencia ? { ...g, coincidencia: 'codigo' } : g,
);
