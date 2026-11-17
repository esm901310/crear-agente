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

export const CATALOGO_EJEMPLO: Grupo[] = [
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
    clave: 'ean:0000000000012',
    nombre: 'Arroz Progreso',
    marca: 'Progreso',
    presentacion: 'Bolsa 2 lb',
    precios: {
      lacolonia: p('lacolonia', '1012', 'ARROZ PROGRESO 2LB', 38.5),
      colonial: p('colonial', '2012', 'Arroz Progreso Bolsa 2 Lb', 39.9),
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
    clave: 'ean:0000000000022',
    nombre: 'Frijoles rojos Ducal',
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
];
