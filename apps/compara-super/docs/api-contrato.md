# Comparar Súper — Contrato de API (v0, Entrega 2)

Acuerdo entre `servidor/` (Cloudflare Worker + D1) y `app/` (Vite + React PWA).
Todas las rutas cuelgan de `/api`. JSON en ambos sentidos. Errores:
`{ "error": { "codigo": string, "mensaje": string } }` con status HTTP adecuado
(400 validación, 401 sin sesión, 404, 409 correo ya registrado, 429, 500).

Dispositivo de confianza: registrarse o entrar bien también pone la cookie
`__Secure-dispositivo` (HttpOnly, Secure, SameSite=Strict, Path=/api/auth, 1 año).
El prefijo `__Secure-` hace que el navegador solo la acepte por HTTPS (nadie puede
colocarla desde una página HTTP); en `http://localhost` Chrome y Firefox también la
aceptan. La app no la lee ni la manda a mano; el navegador la envía sola. Su valor
puede llevar varios tokens separados por punto (uno por cuenta usada en ese
navegador, máx. 5: teléfono compartido); solo cuenta el token que pertenece a la
cuenta que entra. Sirve para que la dueña de la cuenta pueda entrar aunque otros
fallen contraseñas desde muchas IP o desde su misma IP. Ni `salir` ni borrar la
cuenta la borran (puede tener tokens de otras cuentas; el de una cuenta borrada
ya no vale y se descarta solo).

Sesión: cookie `sesion` HttpOnly, Secure, SameSite=Lax, 30 días. En desarrollo
la app usa el proxy de Vite (`/api` → `http://localhost:8787`), así que es el
mismo origen y no hace falta CORS.

Tiendas activas en esta entrega: `lacolonia`, `colonial`. (`losandes` existe en
`precios/` pero está desactivada por configuración: `TIENDAS_ACTIVAS`.)

## Tipos

```ts
type Tienda = 'lacolonia' | 'colonial' | 'losandes';

interface PrecioTienda {
  productoId: string;      // id del producto en esa tienda
  nombre: string;          // nombre tal como lo publica la tienda
  precio: number;          // lempiras, precio normal
  precioOferta?: number;   // si hay oferta
  url: string;
  imagen?: string;
  disponible?: boolean;
}

// Un "grupo" = el mismo producto en varias tiendas (emparejado por código de
// barras; si no hay código común, por parecido de marca + cantidad + nombre;
// carne/pescado fresco por libra, por clase de corte; si no tiene pareja,
// queda solo en su tienda).
interface Grupo {
  clave: string;           // opaca para la app: "ean:0707517002083", "lacolonia:123"
                           // o "corte:lacolonia:6382" (grupos 'corte')
  nombre: string;          // nombre limpio para mostrar
  coincidencia?: 'codigo' | 'probable' | 'corte'; // solo en grupos de 2+ tiendas:
                           //   'codigo'   = mismo código de barras (seguro)
                           //   'probable' = por parecido (misma marca, cantidad ±3 % y variante);
                           //                la app puede avisar "verifica que sea el mismo producto"
                           //   'corte'    = carne/ave/pescado fresco vendido por libra, mismo corte
                           //                (animal + corte + deshuesada/ahumada/…) pero puede ser de
                           //                otra calidad o marca en cada tienda. precios POR LIBRA.
  corte?: string;          // grupos por libra: "Chuleta de cerdo", "Pechuga de pollo deshuesada"
  marca?: string;          // en 'corte' solo si todas las tiendas dicen la misma
  presentacion?: string;   // "1.75 kg", "946 ml"; en grupos por libra siempre "por libra"
                           // (también un fresco por peso sin pareja, de UNA tienda: sin
                           // coincidencia, clave "<tienda>:<id>", con corte y precio por libra)
  imagen?: string;
  precios: Partial<Record<Tienda, PrecioTienda>>; // en 'corte': precio y precioOferta = L por libra
}

interface ItemLista {
  id: string;
  cantidad: number;        // entero 1..99; en grupos por libra son LIBRAS: 0.5..99 en pasos de 0.5
  grupo: Grupo;            // precios guardados la última vez que se consultó
  sustitutos: Partial<Record<Tienda, PrecioTienda>>; // elegido por la persona
}
```

Precio efectivo de un producto en una tienda = `precioOferta ?? precio`.

**Grupo por libra** = `coincidencia: 'corte'`, o clave que empieza con `corte:`, o
`presentacion` "por libra" (la misma regla en servidor y app).

Producto que cuenta en una tienda: el original (`grupo.precios[tienda]`) si no está
`disponible: false`; si no, el sustituto. **En grupos por libra es al revés**: si la
persona eligió un sustituto en esa tienda (otro corte/calidad) y no está `disponible: false`,
ese manda sobre el original. Un sustituto de un grupo por libra debe ser un precio por libra
(p. ej. otro `PrecioTienda` de un grupo `'corte'` o de un producto "x lb"); al comparar, el
servidor lo vuelve a consultar y lo pasa a precio por libra si se vende por peso.

## Cuenta

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| POST | `/api/auth/registro` | `{ correo, contrasena }` (contraseña ≥ 8) | 201 `{ usuario: { id, correo } }` + cookie |
| POST | `/api/auth/entrar` | `{ correo, contrasena }` | 200 `{ usuario }` + cookie |
| POST | `/api/auth/salir` | — | 204, borra cookie |
| GET | `/api/auth/yo` | — | 200 `{ usuario }` o 401 |
| DELETE | `/api/cuenta` | — | 204, borra usuario, lista y sesiones |

Recuperar contraseña: **fuera de la Entrega 2** (requiere enviar correos).

## Búsqueda

`GET /api/buscar?q=arroz` (q: 2–60 caracteres; requiere sesión)

```json
{
  "consultadoEn": "2026-11-17T16:45:00.000Z",
  "grupos": [Grupo, ...],
  "errores": { "colonial": "No respondió a tiempo" }
}
```
Resultados en caché 30 min por texto normalizado. Máx. ~20 grupos, ordenados
poniendo primero los que están en más tiendas.

## Lista (una por persona)

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/api/lista` | — | `{ items: ItemLista[], actualizadoEn: string \| null, preciosConsultadosEn: string \| null }` |
| POST | `/api/lista/items` | `{ grupo: Grupo, cantidad?: number, consultadoEn?: string \| null }` | 201 `{ item }` (si la clave ya existe, suma cantidad (máx. 99) y fusiona precios: no se pierde ninguna tienda que ya tenía) |
| PATCH | `/api/lista/items/:id` | `{ cantidad?: number, sustitutos?: Partial<Record<Tienda, PrecioTienda \| null>> }` | `{ item }` (null quita el sustituto) |

`cantidad`: entero de 1 a 99; si el grupo es por libra (ver arriba) son libras y se acepta
de 0.5 a 99 en pasos de 0.5 (0.5, 1, 1.5…). Otro valor → 400 `validacion`. Un grupo con clave
`corte:<tienda>:<id>` debe traer `coincidencia: 'corte'`, 2 o más tiendas, y `<tienda>` con ese
`productoId` en `precios`. `corte` (texto ≤ 80) se guarda en grupos por libra. `'corte'` con otra
clave se ignora.
| DELETE | `/api/lista/items/:id` | — | 204 |

Fechas de la lista (ISO 8601):

- `actualizadoEn`: último cambio de la lista (agregar, editar cantidad/sustitutos, comparar). `null` si está vacía.
- `preciosConsultadosEn`: fecha de consulta de precios **más antigua** entre los productos de la lista.
  `null` si la lista está vacía o si algún producto no tiene fecha conocida. **Usar esta para decidir si
  los precios están viejos** (`null` = viejos). Editar cantidad o sustitutos no la cambia; agregar un
  producto toma el `consultadoEn` que mande la app (el de la respuesta de `/api/buscar` de la que salió
  el grupo; sin él, ese producto queda sin fecha); comparar la pone en la hora de la comparación.

## Comparar

`POST /api/lista/comparar` — vuelve a consultar los precios de los productos
de la lista (respetando caché) y calcula totales.

```json
{
  "consultadoEn": "...",
  "preciosConsultadosEn": "..." | null,   // igual que en GET /api/lista tras guardar (normalmente = consultadoEn)
  "items": [ItemLista, ...],              // con precios actualizados
  "tiendas": [
    {
      "tienda": "lacolonia",
      "total": 812.50,                    // suma de efectivo × cantidad, redondeada al centavo por producto
                                          // (con medias libras: 55.99 × 1.5 = 83.985 → 83.99)
      "completa": true,
      "faltantes": [],                    // ids de ItemLista sin precio ni sustituto en esa tienda
      "error": null                       // texto si la tienda falló
    }
  ],
  "ganador": "lacolonia" | null,          // solo entre tiendas completas; null si ninguna
  "ahorro": 87.40 | null,                 // ganador vs. la tienda completa más cara
  "empate": false,
  "comparacionParcial": null | { "tiendas": {"lacolonia": 500.1, "colonial": 520.3}, "itemsComparados": 3 }
                                          // si ninguna está completa: totales solo con los productos que están en todas
}
```
