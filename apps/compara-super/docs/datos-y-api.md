# Comparar Súper — Datos y API (servidor)

El servidor (`servidor/`) es un Cloudflare Worker con base de datos D1, en
TypeScript. Implementa **docs/api-contrato.md** (ese es el contrato; aquí se
documenta cómo está hecho, las tablas, las extensiones y cómo correrlo).

## Cómo correrlo

```bash
cd apps/compara-super/servidor
npm install
cp .dev.vars.example .dev.vars   # solo si tu computadora/entorno NO deja salir a internet a wrangler dev
npm run dev                      # aplica migraciones a la D1 local y levanta http://localhost:8787
```

| Script | Qué hace |
|---|---|
| `npm run dev` | `db:migrate:local` + `wrangler dev --port 8787 --local` (D1 local en `.wrangler/`) |
| `npm run db:migrate:local` | Aplica `migrations/*.sql` a la base local |
| `npm test` | Pruebas (vitest), sin internet |
| `npm run typecheck` | Revisión de tipos (tsc) |
| `npm run deploy` | Publica en Cloudflare (ver "Publicar") |

La app (`app/`, Vite) usa el proxy `/api → http://localhost:8787`, así que no hace falta CORS.

### Modo de datos de prueba (`PRECIOS_MODO=fixtures`)

`wrangler dev` corre en el motor local de Cloudflare (workerd), que **no usa el
proxy HTTPS** del entorno de desarrollo y no puede salir a internet aquí
(error "failed to lookup address information"). Para poder probar la app:

- `.dev.vars` con `PRECIOS_MODO=fixtures` hace que el servidor use las
  respuestas guardadas en `precios/test/fixtures/` (búsqueda "arroz" de La
  Colonia y Colonial, de una fecha pasada). Solo devuelve productos cuyo nombre
  contiene todas las palabras buscadas (prueba con "arroz", "arroz blanco",
  "progreso", "leche").
- **No son precios de hoy.** Las respuestas de `/api/buscar` y
  `/api/lista/comparar` llevan `"modoPrueba": true` y `"avisoPrueba"`; la app
  debe mostrar un aviso visible cuando lleguen.
- El servidor **rechaza** este modo si la petición no llega a `localhost`.
- En Cloudflare real `PRECIOS_MODO` no existe y siempre se consultan las
  tiendas en vivo (`www.lacolonia.com`, `supercolonial.com`). Si tu entorno sí
  tiene internet directo, no crees `.dev.vars` y `wrangler dev` consultará en vivo.

### Publicar (cuando la persona lo decida)

1. Cuenta gratuita de Cloudflare y `npx wrangler login`.
2. `npx wrangler d1 create comparar-super` → copiar el `database_id` a `wrangler.toml`
   (hoy tiene un marcador `00000000-...`).
3. `npx wrangler d1 migrations apply comparar-super --remote`
4. `npm run deploy`. No hay llaves ni secretos que configurar.

## Configuración (`wrangler.toml`)

| Variable | Valor | Para qué |
|---|---|---|
| `TIENDAS_ACTIVAS` | `"lacolonia,colonial"` | Tiendas que se consultan. `losandes` existe en `precios/` pero está desactivada. |
| `PRECIOS_MODO` | (no definida) | Solo en `.dev.vars` local: `fixtures`. |
| `DB` | D1 `comparar-super` | Base de datos. |

## Tablas (D1) — `servidor/migrations/0001_inicial.sql`

Fechas `*_en` en milisegundos (INTEGER).

**usuarios**

| Campo | Tipo | Nota |
|---|---|---|
| id | TEXT PK | UUID |
| correo | TEXT UNIQUE | siempre en minúsculas (CHECK) |
| hash | TEXT | PBKDF2-SHA256, 256 bits, base64 |
| sal | TEXT | 16 bytes aleatorios, base64 |
| iteraciones | INTEGER | 100 000 (máximo que admite Cloudflare Workers) |
| creado_en | INTEGER | |

**sesiones**

| Campo | Tipo | Nota |
|---|---|---|
| token_hash | TEXT PK | SHA-256 (hex) del token de la cookie; el token en claro nunca se guarda |
| usuario_id | TEXT FK → usuarios | |
| creado_en / vence_en | INTEGER | vence a los 30 días |

**items_lista** (una lista por persona)

| Campo | Tipo | Nota |
|---|---|---|
| id | TEXT PK | UUID (es el `ItemLista.id`) |
| usuario_id | TEXT FK | |
| clave | TEXT | `Grupo.clave`; UNIQUE (usuario_id, clave) |
| cantidad | INTEGER | 1..99 (CHECK) |
| grupo_json | TEXT | `Grupo` con los últimos precios consultados |
| sustitutos_json | TEXT | `Partial<Record<Tienda, PrecioTienda>>` |
| creado_en / actualizado_en | INTEGER | |

**cache_busquedas** (30 min)

| Campo | Tipo | Nota |
|---|---|---|
| clave | TEXT PK | `<modo>:<tienda>:<texto normalizado>`, p. ej. `vivo:colonial:arroz progreso` |
| resultado_json | TEXT | `Producto[]` de esa tienda |
| guardado_en | INTEGER | se ignora pasados 30 min; limpieza ocasional |

Una fila por tienda (si una tienda falla, la otra sigue en caché; los errores no se guardan).
El modo va en la clave para que los datos de prueba nunca se mezclen con los reales.

**limites** (contadores simples)

| clave | Regla |
|---|---|
| `entrar:<correo>` | más de 5 contraseñas incorrectas en 15 min → bloqueo 15 min (429 + `Retry-After`) |
| `registro:<ip>` | 10 registros por hora por IP |
| `buscar:<usuario_id>` | 40 búsquedas cada 10 min |
| `comparar:<usuario_id>` | 10 comparaciones cada 10 min |

## Direcciones

Todas según el contrato. Errores: `{ "error": { "codigo", "mensaje" } }`.
Los cuerpos deben enviarse con `Content-Type: application/json` (máx. 32 KB).

| Método | Ruta | Notas de implementación |
|---|---|---|
| POST | `/api/auth/registro` | 201 + cookie. 400 si correo inválido o contraseña < 8 (máx. 128). 409 si ya existe. |
| POST | `/api/auth/entrar` | 200 + cookie. 401 `credenciales_invalidas`. 429 tras más de 5 fallos. |
| POST | `/api/auth/salir` | 204, borra la sesión y la cookie. |
| GET | `/api/auth/yo` | 200 `{ usuario }` o 401 `sin_sesion`. |
| DELETE | `/api/cuenta` | 204. Borra usuario, lista, sesiones y sus contadores. |
| GET | `/api/buscar?q=` | q 2–60. Máx. 20 grupos; primero los que están en más tiendas. `errores` por tienda con mensaje claro. |
| GET | `/api/lista` | `actualizadoEn` = último cambio de la lista (incluye la última actualización de precios); `null` si está vacía. |
| POST | `/api/lista/items` | 201. Si la clave ya existe suma cantidad (tope 99) y guarda los precios recibidos. Máx. 40 productos (400 `lista_llena`). |
| PATCH | `/api/lista/items/:id` | `{ cantidad?, sustitutos? }`; `null` quita el sustituto. 404 si no es tuyo o no existe. |
| DELETE | `/api/lista/items/:id` | 204; 404 si no es tuyo. |
| POST | `/api/lista/comparar` | Ver abajo. |

Cookie: `sesion=<token>; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`.

### Ejemplo rápido (curl)

```bash
B=http://localhost:8787/api; J='Content-Type: application/json'
curl -c c.txt -H "$J" -d '{"correo":"ana@ejemplo.com","contrasena":"clave-segura-1"}' $B/auth/registro
curl -b c.txt "$B/buscar?q=arroz"
curl -b c.txt -H "$J" -d '{"grupo": <un grupo de /buscar>, "cantidad": 2}' $B/lista/items
curl -b c.txt -X PATCH -H "$J" -d '{"sustitutos":{"colonial": <PrecioTienda>}}' $B/lista/items/<id>
curl -b c.txt -X POST $B/lista/comparar
curl -b c.txt -X DELETE $B/cuenta
```

### Validación de lo que manda la app

- `grupo.clave`: `ean:<13 dígitos con verificador válido>` o `<tienda>:<productoId>` coherente con sus precios.
- Solo tiendas activas. Precios > 0 y ≤ 100 000; `precioOferta` solo si es menor que `precio`.
- `url` debe ser `https://` y del dominio de esa tienda (`www.lacolonia.com`, `supercolonial.com`); `imagen` debe ser `https://`.
- Textos con largo máximo (nombre 200, marca 80, presentación 40). `desactualizado` lo pone solo el servidor.

## Emparejamiento (grupos)

- Código de barras normalizado a **EAN-13** (`servidor/src/ean.ts`): 12 dígitos (UPC-A) → se antepone 0;
  14 con 0 inicial → se quita; 8 (EAN-8) → ceros a la izquierda; 11 (UPC sin verificador) → `completarGtin`
  de `precios/src/normalizar.ts`. Si el dígito verificador no cuadra, se ignora el código.
- Mismo EAN en varias tiendas → un grupo `ean:0707517002083`. Sin código → grupo de una tienda `colonial:10783533728036`.
- Nombre del grupo: el de La Colonia si está (más limpio), luego Los Andes, luego Colonial.

## Comparar (`POST /api/lista/comparar`)

1. Por cada producto de la lista busca `grupo.nombre` en las tiendas activas (con caché de 30 min; textos
   repetidos se buscan una vez). En cada tienda lo **re-identifica** por `productoId` y, si no, por EAN
   (así también descubre el producto en una tienda donde antes no estaba).
2. Si no lo encuentra (o la tienda falla) **conserva el precio guardado** y lo marca con
   `"desactualizado": true` en ese `PrecioTienda`.
3. Sustitutos: solo se vuelven a consultar los que se usan (el original falta en esa tienda), buscando el
   nombre del sustituto solo en esa tienda.
4. Cortesía con las tiendas: máx. 3 búsquedas a la vez, pausa de 300 ms tras cada consulta real, y como
   máximo 40 consultas reales por comparación (el resto usa el precio guardado, marcado `desactualizado`).
5. Guarda los precios nuevos en la lista y calcula:
   - Precio efectivo = `precioOferta ?? precio`; total = suma de precio × cantidad (en centavos, sin errores de redondeo).
   - **faltantes**: productos sin precio ni sustituto en esa tienda. Un producto con `disponible: false` cuenta como faltante (salvo que tenga sustituto).
   - **error**: texto si fallaron *todas* las consultas a esa tienda. Esa tienda no compite (se muestra su total con precios guardados, pero la app debe mostrar el error).
   - **ganador**: la completa (sin error) más barata. **ahorro**: contra la completa más cara; `null` si solo hay una completa o si empatan.
   - **empate**: `true` si las dos completas más baratas tienen el mismo total al centavo; en ese caso `ganador` es la primera según el orden de `TIENDAS_ACTIVAS`.
   - **comparacionParcial**: si ninguna está completa, totales solo con los productos que tienen todas las tiendas sin error (`itemsComparados` puede ser 0).

## Extensiones al contrato (opcionales, no rompen nada)

- `PrecioTienda.desactualizado?: true` — precio guardado de una consulta anterior.
- `modoPrueba: true` y `avisoPrueba` en `/api/buscar` y `/api/lista/comparar` — solo en desarrollo local con datos de prueba.

## Archivos

- `servidor/src/index.ts` — rutas y respuestas
- `servidor/src/seguridad.ts` — contraseñas, sesiones, límites
- `servidor/src/validar.ts` — validación de entradas
- `servidor/src/busqueda.ts` — búsqueda con caché D1, lista de dominios permitidos, modo de prueba
- `servidor/src/grupos.ts`, `servidor/src/ean.ts` — emparejamiento
- `servidor/src/refrescar.ts` — re-consulta de precios para comparar
- `servidor/src/comparar.ts` — totales, faltantes, ganador
- `servidor/test/*.test.ts` — 35 pruebas
