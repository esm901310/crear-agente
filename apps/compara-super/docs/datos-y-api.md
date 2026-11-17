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
| `npm run db:migrate:remote` | Aplica las migraciones a la base de Cloudflare (al publicar) |
| `npm run build:app` | Construye la app (`../app/dist`) |
| `npm run deploy` | Construye la app y publica app + API en Cloudflare (ver `docs/publicar.md`) |

En desarrollo la app (`app/`, Vite) usa el proxy `/api → http://localhost:8787`, así que no hace falta CORS.
En Cloudflare, el mismo Worker sirve la app (archivos de `app/dist`) y la API en el mismo dominio
(ver "Publicar"). `wrangler dev` también sirve `app/dist` si existe (abre http://localhost:8787/).

### Modo de datos de prueba (`PRECIOS_MODO=fixtures`)

`wrangler dev` corre en el motor local de Cloudflare (workerd), que **no usa el
proxy HTTPS** del entorno de desarrollo y no puede salir a internet aquí
(error "failed to lookup address information"). Para poder probar la app:

- `.dev.vars` con `PRECIOS_MODO=fixtures` hace que el servidor use las
  respuestas guardadas en `precios/test/fixtures/` (búsqueda "arroz" de La
  Colonia y Colonial, de una fecha pasada). Solo devuelve productos cuyo nombre
  contiene todas las palabras buscadas (prueba con "arroz", "arroz blanco",
  "progreso", "leche").
- Esas respuestas guardadas **no tienen ningún producto con el mismo código de
  barras en las dos tiendas** (La Colonia trae Tia Emely `707517002045`, Mr. Dieck,
  Ahorro Max y Elmigo; Colonial trae Progreso `707517002083`, Manhattan y Vigo).
  Por eso se agrega `servidor/datos-prueba/emparejables.json`: un registro de La
  Colonia **hecho a mano** del Arroz Progreso 1.75 kg con el código real
  `707517002083` y **precio inventado** (L 66.50). Así "arroz" o "progreso" traen
  un producto en las dos tiendas y la comparación tiene ganador sin sustitutos
  (Colonial, L 62.49).
- Las búsquedas se guardan 30 min en la D1 local. Si cambias los datos de prueba,
  bórralas: `npx wrangler d1 execute comparar-super --local --command "DELETE FROM cache_busquedas"`.
- **No son precios de hoy.** Las respuestas de `/api/buscar` y
  `/api/lista/comparar` llevan `"modoPrueba": true` y `"avisoPrueba"`; la app
  debe mostrar un aviso visible cuando lleguen.
- El servidor **rechaza** este modo si la petición no llega a `localhost`.
- En Cloudflare real `PRECIOS_MODO` no existe y siempre se consultan las
  tiendas en vivo (`www.lacolonia.com`, `supercolonial.com`). Si tu entorno sí
  tiene internet directo, no crees `.dev.vars` y `wrangler dev` consultará en vivo.

### Publicar (cuando la persona lo decida)

Paso a paso en lenguaje sencillo: **`docs/publicar.md`**. Resumen: cuenta de Cloudflare →
`npx wrangler login` → `npx wrangler d1 create comparar-super` → pegar el `database_id` en
`wrangler.toml` → `npm run db:migrate:remote` → `npm run deploy`. No hay llaves ni secretos.

`wrangler.toml` → `[assets]`: `directory = "../app/dist"`, `not_found_handling = "single-page-application"`
(rutas como `/lista` devuelven `index.html`) y `run_worker_first = ["/api/*"]` (la API siempre la
atiende el Worker; una ruta `/api/...` desconocida responde 404 JSON, nunca la app).

## Configuración (`wrangler.toml`)

| Variable | Valor | Para qué |
|---|---|---|
| `TIENDAS_ACTIVAS` | `"lacolonia,colonial"` | Tiendas que se consultan. `losandes` existe en `precios/` pero está desactivada. |
| `PRECIOS_MODO` | (no definida) | Solo en `.dev.vars` local: `fixtures`. |
| `LIMITE_ENTRAR_CORREO_IP` | `"5"` | Sin dispositivo de confianza: contraseñas incorrectas por correo + IP en 15 min. |
| `LIMITE_ENTRAR_IP` | `"100"` | Sin dispositivo de confianza: contraseñas incorrectas por IP (todos los correos) en 15 min. Alto por CGNAT. |
| `LIMITE_ENTRAR_CORREO` | `"10"` | Sin dispositivo de confianza: contraseñas incorrectas por correo (todas las IP) en 1 hora. |
| `LIMITE_ENTRAR_DISPOSITIVO` | `"10"` | Con dispositivo de confianza: contraseñas incorrectas desde ese dispositivo en 15 min. |
| `LIMITE_REGISTROS_IP` | `"30"` | Cuentas nuevas por IP en 1 hora. |
| `LIMITE_BUSQUEDAS` | `"60"` | Búsquedas por persona en 10 min. |
| `LIMITE_COMPARACIONES` | `"30"` | Comparaciones por persona en 10 min. |
| `DB` | D1 `comparar-super` | Base de datos. |

Los límites aceptan enteros de 1 a 100 000; un valor inválido usa el valor por defecto (el de la tabla).
Las ventanas de tiempo y las esperas son fijas (`servidor/src/seguridad.ts` → `LIMITES_POR_DEFECTO`).

## Tablas (D1) — `servidor/migrations/0001_inicial.sql`, `0002_precios_consultados_en.sql` y `0003_dispositivos.sql`

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

**dispositivos** (migración 0003) — navegadores de confianza para entrar (ver "Entrar: límites")

| Campo | Tipo | Nota |
|---|---|---|
| token_hash | TEXT | SHA-256 (hex) del token de la cookie `dispositivo`; el token en claro nunca se guarda |
| usuario_id | TEXT FK → usuarios | PK = (token_hash, usuario_id): un teléfono compartido puede ser de confianza para varias cuentas |
| creado_en / usado_en | INTEGER | `usado_en` = último inicio de sesión correcto con él |
| vence_en | INTEGER | `usado_en` + 1 año (se renueva cada vez que se entra bien) |

Máximo 20 por cuenta: al agregar uno se borran los vencidos y los usados hace más tiempo.

**items_lista** (una lista por persona)

| Campo | Tipo | Nota |
|---|---|---|
| id | TEXT PK | UUID (es el `ItemLista.id`) |
| usuario_id | TEXT FK | |
| clave | TEXT | `Grupo.clave`; UNIQUE (usuario_id, clave) |
| cantidad | INTEGER | 1..99 (CHECK) |
| grupo_json | TEXT | `Grupo` con los últimos precios consultados |
| sustitutos_json | TEXT | `Partial<Record<Tienda, PrecioTienda>>` |
| creado_en / actualizado_en | INTEGER | `actualizado_en`: cualquier cambio del producto |
| precios_consultados_en | INTEGER NULL | (migración 0002) cuándo se consultaron los precios de `grupo_json`. NULL = desconocido (productos anteriores a la migración o agregados sin `consultadoEn`). Editar cantidad/sustitutos no la cambia; comparar la pone en la hora de la comparación. |

**cache_busquedas** (30 min)

| Campo | Tipo | Nota |
|---|---|---|
| clave | TEXT PK | `<modo>:<tienda>:<texto normalizado>`, p. ej. `vivo:colonial:arroz progreso` |
| resultado_json | TEXT | `Producto[]` de esa tienda |
| guardado_en | INTEGER | se ignora pasados 30 min; limpieza ocasional |

Una fila por tienda (si una tienda falla, la otra sigue en caché; los errores no se guardan).
El modo va en la clave para que los datos de prueba nunca se mezclen con los reales.

**limites** (contadores simples)

`<ip>` es la cabecera `CF-Connecting-IP` (la pone Cloudflare; no se puede falsificar desde fuera).
Las IPv6 se agrupan por red `/64`. Sin cabecera (desarrollo local) vale `local`.
Al superar el máximo responde 429 `demasiados_intentos` con `Retry-After` (segundos).

| clave | Regla (valores por defecto) |
|---|---|
| `entrar-ci:<correo>\|<ip>` | sin dispositivo de confianza: más de 5 contraseñas incorrectas en 15 min para ese correo **desde esa IP** → espera 15 min solo en esa IP. Se reinicia al entrar bien. |
| `entrar-ip:<ip>` | sin dispositivo de confianza: más de 100 contraseñas incorrectas en 15 min desde esa IP, sumando todos los correos → espera 15 min |
| `entrar-correo:<correo>` | sin dispositivo de confianza: más de 10 contraseñas incorrectas en 1 hora para ese correo desde cualquier IP → durante 1 hora ese correo solo entra desde sus dispositivos de confianza |
| `entrar-disp:<usuario_id>\|<hash del dispositivo>` | con dispositivo de confianza: más de 10 contraseñas incorrectas en 15 min desde ese dispositivo → espera 15 min solo en ese dispositivo. Se reinicia al entrar bien. |
| `registro:<ip>` | más de 30 registros por hora por IP → espera 30 min |
| `buscar:<usuario_id>` | más de 60 búsquedas cada 10 min → espera 5 min |
| `comparar:<usuario_id>` | más de 30 comparaciones cada 10 min → espera 5 min |

### Entrar: límites y dispositivo de confianza

Objetivo: la dueña de la cuenta casi nunca queda bloqueada y adivinar contraseñas sigue siendo impráctico.

- **Dispositivo de confianza.** Al registrarse o entrar bien, el navegador recibe la cookie
  `dispositivo` (token aleatorio de 256 bits, 1 año, solo viaja a `/api/auth`). En `dispositivos` se
  guarda su hash ligado a la cuenta. Si el navegador ya tenía un token conocido, se reutiliza (teléfono
  compartido); si no, se crea uno nuevo. Salir (`/api/auth/salir`) **no** la borra: el teléfono sigue
  siendo de confianza. Borrar la cuenta sí.
- **Intento CON dispositivo de confianza de esa cuenta**: solo cuenta `entrar-disp` (10 fallos / 15 min).
  No le afectan los contadores por IP ni por correo, que son los que un atacante puede llenar. Así la
  dueña entra desde su celular aunque haya un ataque repartido en muchas IP o comparta IP (CGNAT de
  Tigo/Claro) con alguien que prueba contraseñas. La cookie de **otra** cuenta no sirve.
- **Intento SIN dispositivo de confianza** (teléfono nuevo, cookies borradas, atacante): cuentan
  `entrar-ci` (5 / 15 min), `entrar-ip` (100 / 15 min, alto para tolerar CGNAT) y `entrar-correo`
  (10 / hora). Este último limita a unos 10 intentos por hora para una cuenta **sin importar cuántas IP
  use el atacante** (antes eran 50/hora).
- Si algún contador aplicable está bloqueado se responde 429 **sin revisar la contraseña**: un 429 es
  igual con contraseña correcta o incorrecta y nunca trae cookies.
- Costo aceptado: durante un ataque a su correo, la dueña desde un navegador **nuevo** espera hasta
  1 hora; desde cualquier navegador donde ya entró antes, entra normal.

## Direcciones

Todas según el contrato. Errores: `{ "error": { "codigo", "mensaje" } }`.
Los cuerpos deben enviarse con `Content-Type: application/json` (máx. 32 KB).

| Método | Ruta | Notas de implementación |
|---|---|---|
| POST | `/api/auth/registro` | 201 + cookies `sesion` y `dispositivo`. 429 tras 30 por hora desde la misma IP. 400 si correo inválido o contraseña < 8 (máx. 128). 409 si ya existe. |
| POST | `/api/auth/entrar` | 200 + cookies `sesion` y `dispositivo`. 401 `credenciales_invalidas`. 429 según "Entrar: límites" (no revela si la contraseña era correcta). |
| POST | `/api/auth/salir` | 204, borra la sesión y la cookie `sesion` (la de `dispositivo` se queda). |
| GET | `/api/auth/yo` | 200 `{ usuario }` o 401 `sin_sesion`. |
| DELETE | `/api/cuenta` | 204. Borra usuario, lista, sesiones, dispositivos de confianza y sus contadores; borra las dos cookies. |
| GET | `/api/buscar?q=` | q 2–60. Máx. 20 grupos; primero los que están en más tiendas. `errores` por tienda con mensaje claro. |
| GET | `/api/lista` | `actualizadoEn` = último cambio de la lista (incluye la última actualización de precios); `null` si está vacía. `preciosConsultadosEn` = la `precios_consultados_en` **más antigua** de los productos; `null` si está vacía o alguno no tiene fecha. La app decide "precios viejos" (>30 min o `null`) con `preciosConsultadosEn`. |
| POST | `/api/lista/items` | 201. `{ grupo, cantidad?, consultadoEn? }`: `consultadoEn` es el de la respuesta de `/api/buscar` (ISO; opcional, sin él el producto queda sin fecha; una fecha futura se recorta a ahora; texto que no sea fecha ISO → 400 `validacion`). Si la clave ya existe suma cantidad (tope 99) y guarda los precios y la fecha recibidos. Máx. 40 productos (400 `lista_llena`). |
| PATCH | `/api/lista/items/:id` | `{ cantidad?, sustitutos? }`; `null` quita el sustituto. 404 si no es tuyo o no existe. |
| DELETE | `/api/lista/items/:id` | 204; 404 si no es tuyo. |
| POST | `/api/lista/comparar` | Ver abajo. |

Cookies:
- `sesion=<token>; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` (30 días).
- `dispositivo=<token>; Path=/api/auth; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000` (1 año).
  La app no tiene que hacer nada: el navegador la guarda y la manda sola en `/api/auth/*`.

### Ejemplo rápido (curl)

```bash
B=http://localhost:8787/api; J='Content-Type: application/json'
curl -c c.txt -H "$J" -d '{"correo":"ana@ejemplo.com","contrasena":"clave-segura-1"}' $B/auth/registro
curl -b c.txt "$B/buscar?q=arroz"
curl -b c.txt -H "$J" -d '{"grupo": <un grupo de /buscar>, "cantidad": 2, "consultadoEn": "<consultadoEn de /buscar>"}' $B/lista/items
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
- Nombre del grupo (`Grupo.nombre`): se toma el de La Colonia si está, luego Los Andes, luego Colonial, y
  se **limpia para mostrar** (`nombreParaMostrar` en `precios/src/normalizar.ts`): separa palabras pegadas
  por mayúscula o número, pasa a formato Título la marca en MAYÚSCULAS y quita la presentación si es la
  misma que va en `Grupo.presentacion`. Ej.: `PROGRESO Arroz BlancoGranoLar1.75Kg` →
  `nombre: "Progreso Arroz Blanco Grano Lar"`, `presentacion: "1.75 kg"`. Las abreviaturas de la tienda
  ("Lar") no se adivinan.
- El nombre **original** de cada tienda se conserva en `precios[tienda].nombre`.

## Comparar (`POST /api/lista/comparar`)

1. Por cada producto de la lista busca en cada tienda activa con el **nombre original de esa tienda**
   (`precios[tienda].nombre`; si el producto aún no está en esa tienda, con `grupo.nombre`). Caché de
   30 min; textos repetidos se buscan una vez y las tiendas con el mismo texto van juntas. En cada tienda lo **re-identifica** por `productoId` y, si no, por EAN
   (así también descubre el producto en una tienda donde antes no estaba).
2. Si no lo encuentra (o la tienda falla) **conserva el precio guardado** y lo marca con
   `"desactualizado": true` en ese `PrecioTienda`.
3. Sustitutos: solo se vuelven a consultar los que se usan (el original falta en esa tienda), buscando el
   nombre del sustituto solo en esa tienda.
4. Cortesía con las tiendas: máx. 3 búsquedas a la vez, pausa de 300 ms tras cada consulta real, y como
   máximo 40 consultas reales por comparación (el resto usa el precio guardado, marcado `desactualizado`).
5. Guarda los precios nuevos en la lista, pone `precios_consultados_en` = hora de la comparación en todos
   sus productos (también los que quedaron `desactualizado`: se intentó consultarlos; el aviso por precio
   lo da esa marca) y responde `preciosConsultadosEn` (misma regla que `GET /api/lista`, leída tras guardar). Calcula:
   - Precio efectivo = `precioOferta ?? precio`; total = suma de precio × cantidad (en centavos, sin errores de redondeo).
   - **faltantes**: productos sin precio ni sustituto en esa tienda. Un producto con `disponible: false` cuenta como faltante (salvo que tenga sustituto).
   - **error**: texto si fallaron *todas* las consultas a esa tienda. Esa tienda no compite (se muestra su total con precios guardados, pero la app debe mostrar el error).
   - **ganador**: la completa (sin error) más barata. **ahorro**: contra la completa más cara; `null` si solo hay una completa o si empatan.
   - **empate**: `true` si las dos completas más baratas tienen el mismo total al centavo; en ese caso `ganador` es la primera según el orden de `TIENDAS_ACTIVAS`.
   - **comparacionParcial**: si ninguna está completa, totales solo con los productos que tienen todas las tiendas sin error (`itemsComparados` puede ser 0).

## Extensiones al contrato (opcionales, no rompen nada)

- `PrecioTienda.desactualizado?: true` — precio guardado de una consulta anterior.
- `preciosConsultadosEn` en `GET /api/lista` y `POST /api/lista/comparar`, y `consultadoEn` opcional al agregar un producto.
- `modoPrueba: true` y `avisoPrueba` en `/api/buscar` y `/api/lista/comparar` — solo en desarrollo local con datos de prueba.

## Archivos

- `servidor/src/index.ts` — rutas y respuestas
- `servidor/src/seguridad.ts` — contraseñas, sesiones, dispositivos de confianza, límites
- `servidor/src/validar.ts` — validación de entradas
- `servidor/src/busqueda.ts` — búsqueda con caché D1, lista de dominios permitidos, modo de prueba
- `servidor/src/grupos.ts`, `servidor/src/ean.ts` — emparejamiento
- `servidor/src/refrescar.ts` — re-consulta de precios para comparar
- `servidor/src/comparar.ts` — totales, faltantes, ganador
- `servidor/datos-prueba/emparejables.json` — registro hecho a mano para el modo prueba (ver arriba)
- `servidor/test/*.test.ts` — 60 pruebas (`api.test.ts` prueba el Worker completo con una D1 en memoria,
  `test/d1-falsa.ts`, sobre `node:sqlite`)
