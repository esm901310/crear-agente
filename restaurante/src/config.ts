// Constantes de la app en un solo lugar (ver docs/diseno.md, sección 14).

/** Nombre de la app: se usa en la entrada, el encabezado y el título de la pestaña. */
export const APP_NOMBRE = 'Comandas';

/** Cada cuánto se pregunta al servidor por cambios (milisegundos). */
export const POLLING_MS = 3000;

/** Minutos de espera en Cocina para pintar la comanda en ámbar y en rojo. */
export const ESPERA_AMBAR_MIN = 10;
export const ESPERA_ROJO_MIN = 20;

/** Porcentajes de propina que aparecen como botones en Caja. */
export const PROPINAS_PCT = [10, 15, 20];

/** Notas rápidas que el mesero puede tocar al agregar una nota a un platillo. */
export const NOTAS_RAPIDAS = [
  'Sin cebolla',
  'Sin cilantro',
  'Sin chile',
  'Poco picante',
  'Bien picante',
  'Para llevar',
  'Bien dorado',
  'Sin queso',
];

/** Atajos de billetes en el campo "Recibido" (centavos: $200, $500, $1,000). */
export const BILLETES_RAPIDOS = [20000, 50000, 100000];

/** Orden de las pestañas del menú. Las categorías que no estén aquí van al final. */
export const ORDEN_CATEGORIAS = ['Entradas', 'Tacos', 'Platos fuertes', 'Bebidas', 'Postres'];

/** Largo máximo de una nota (lo mismo que acepta el servidor). */
export const NOTA_MAX = 140;

/** Segundos que dura el aviso "Deshacer" en Cocina. */
export const DESHACER_COCINA_MS = 8000;
