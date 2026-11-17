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
  "progreso", "leche"). También están las carnes por libra
  (`lacolonia-carnes.json` / `colonial-carnes.json`, respuestas reales del 2026-11-17
  recortadas): prueba "chuleta", "costilla", "pechuga", "molida", "tilapia", "bistec" para
  ver grupos `coincidencia: "corte"`.
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

## Tablas (D1) — `servidor/migrations/0001_inicial.sql`, `0002_precios_consultados_en.sql`, `0003_dispositivos.sql` y `0004_cantidad_media_libra.sql`

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
| token_hash | TEXT | SHA-256 (hex) de un token de la cookie `__Secure-dispositivo`; el token en claro nunca se guarda |
| usuario_id | TEXT FK → usuarios | PK = (token_hash, usuario_id). Los tokens nuevos son siempre de UNA cuenta (un teléfono compartido guarda un token por cuenta en la misma cookie) |
| creado_en / usado_en | INTEGER | `usado_en` = último inicio de sesión correcto con él |
| vence_en | INTEGER | `usado_en` + 1 año (se renueva cada vez que se entra bien) |

Máximo 20 por cuenta: al agregar uno se borran los vencidos y los usados hace más tiempo.

**items_lista** (una lista por persona)

| Campo | Tipo | Nota |
|---|---|---|
| id | TEXT PK | UUID (es el `ItemLista.id`) |
| usuario_id | TEXT FK | |
| clave | TEXT | `Grupo.clave`; UNIQUE (usuario_id, clave) |
| cantidad | REAL | 0.5..99 en pasos de 0.5 (CHECK, desde `0004`, que rehace la tabla conservando los datos). El servidor exige entero 1..99 salvo en grupos `corte` (libras) |
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

**Cómo se cuenta (sin carreras).** Cada intento se **reserva antes** de hacer el trabajo (revisar la
contraseña, registrar, buscar, comparar) con una sola sentencia atómica de D1
(`INSERT ... ON CONFLICT(clave) DO UPDATE SET contador = contador + 1 ... RETURNING`). Si con esa
suma el contador pasa del máximo, la misma sentencia deja la clave bloqueada; el 429 se decide con
ese resultado, **sin mirar la contraseña**. Así, aunque lleguen 50 peticiones a la vez, nunca se
revisan más contraseñas que el máximo. Las claves de un intento (p. ej. las 3 de entrar sin
dispositivo) se reservan en un solo lote (transacción): si alguna ya está bloqueada no se suma a
ninguna (una ráfaga desde una IP bloqueada no llena el contador global del correo); si este intento
es el que provoca un bloqueo, a las demás claves se les devuelve el intento.

| clave | Regla (valores por defecto) |
|---|---|
| `entrar-ci:<correo>\|<ip>` | sin dispositivo de confianza: más de 5 intentos en 15 min para ese correo **desde esa IP** → espera 15 min solo en esa IP. Se reinicia (borra) al entrar bien. |
| `entrar-ip:<ip>` | sin dispositivo de confianza: más de 100 intentos en 15 min desde esa IP, sumando todos los correos → espera 15 min. Entrar bien solo devuelve ese intento (no borra el contador). |
| `entrar-correo:<correo>` | sin dispositivo de confianza: más de 10 intentos en 1 hora para ese correo desde cualquier IP → durante 1 hora ese correo solo entra desde sus dispositivos de confianza. Entrar bien solo devuelve ese intento (no borra el contador). |
| `entrar-disp:<usuario_id>\|<hash del dispositivo>` | con dispositivo de confianza: más de 10 intentos en 15 min desde ese dispositivo → espera 15 min solo en ese dispositivo. Se reinicia (borra) al entrar bien. |
| `registro:<ip>` | más de 30 registros por hora por IP → espera 30 min |
| `buscar:<usuario_id>` | más de 60 búsquedas cada 10 min → espera 5 min |
| `comparar:<usuario_id>` | más de 30 comparaciones cada 10 min → espera 5 min |

### Entrar: límites y dispositivo de confianza

Objetivo: la dueña de la cuenta casi nunca queda bloqueada y adivinar contraseñas sigue siendo impráctico.

- **Dispositivo de confianza.** Al registrarse o entrar bien, el navegador recibe la cookie
  `__Secure-dispositivo` (token aleatorio de 256 bits por cuenta, 1 año, solo viaja a `/api/auth`).
  En `dispositivos` se guarda el hash del token ligado a la cuenta.
  - Solo se reutiliza un token que **ya pertenece a esa cuenta**. Un token de otra cuenta nunca se
    adopta ni da confianza: si alguien "planta" su token en el navegador de otra persona, al entrar
    ella recibe un token nuevo propio y el plantado sigue valiendo solo para la cuenta de quien lo
    plantó.
  - Teléfono compartido: el valor guarda varios tokens separados por punto (`tokAna.tokBeto`),
    máximo 5; el de la cuenta que acaba de entrar va primero y se descartan los que ya no existen.
  - Si el navegador manda la cookie repetida (mismo nombre, varias veces), se revisan **todos** los
    valores (máx. 20 tokens) y solo cuenta el que pertenece a la cuenta que entra.
  - El prefijo `__Secure-` impide que una página HTTP la coloque. La cookie vieja `dispositivo=`
    (sin prefijo) ya no se lee.
  - Salir (`/api/auth/salir`) **no** la borra: el teléfono sigue siendo de confianza. Borrar la cuenta
    borra sus filas en `dispositivos` (su token deja de valer), pero no la cookie, porque puede llevar
    tokens de otras cuentas.
- **Intento CON dispositivo de confianza de esa cuenta**: solo cuenta `entrar-disp` (10 fallos / 15 min).
  No le afectan los contadores por IP ni por correo, que son los que un atacante puede llenar. Así la
  dueña entra desde su celular aunque haya un ataque repartido en muchas IP o comparta IP (CGNAT de
  Tigo/Claro) con alguien que prueba contraseñas. La cookie de **otra** cuenta no sirve.
- **Intento SIN dispositivo de confianza** (teléfono nuevo, cookies borradas, atacante): cuentan
  `entrar-ci` (5 / 15 min), `entrar-ip` (100 / 15 min, alto para tolerar CGNAT) y `entrar-correo`
  (10 / hora). Este último limita a unos 10 intentos por hora para una cuenta **sin importar cuántas IP
  use el atacante** (antes eran 50/hora).
- El intento se reserva en los contadores **antes** de revisar la contraseña (ver "Cómo se cuenta").
  Si algún contador aplicable está bloqueado (o este intento lo bloquea) se responde 429 **sin revisar
  la contraseña**: un 429 es igual con contraseña correcta o incorrecta y nunca trae cookies.
- Al entrar bien: el contador propio (`entrar-ci` o `entrar-disp`) se borra; a `entrar-ip` y
  `entrar-correo` solo se les devuelve este intento (los éxitos no suman, pero tampoco "limpian" lo
  que sumaron los fallos: si no, alguien con cuenta propia podría limpiar su IP entrando a ella).
- Costo aceptado: durante un ataque a su correo, la dueña desde un navegador **nuevo** espera hasta
  1 hora; desde cualquier navegador donde ya entró antes, entra normal.

## Direcciones

Todas según el contrato. Errores: `{ "error": { "codigo", "mensaje" } }`.
Los cuerpos deben enviarse con `Content-Type: application/json` (máx. 32 KB).

| Método | Ruta | Notas de implementación |
|---|---|---|
| POST | `/api/auth/registro` | 201 + cookies `sesion` y `__Secure-dispositivo`. 429 tras 30 por hora desde la misma IP. 400 si correo inválido o contraseña < 8 (máx. 128). 409 si ya existe. |
| POST | `/api/auth/entrar` | 200 + cookies `sesion` y `__Secure-dispositivo`. 401 `credenciales_invalidas`. 429 según "Entrar: límites" (no revela si la contraseña era correcta). |
| POST | `/api/auth/salir` | 204, borra la sesión y la cookie `sesion` (la de `__Secure-dispositivo` se queda). |
| GET | `/api/auth/yo` | 200 `{ usuario }` o 401 `sin_sesion`. |
| DELETE | `/api/cuenta` | 204. Borra usuario, lista, sesiones, dispositivos de confianza y sus contadores; borra la cookie `sesion` (la de dispositivo se queda: puede tener tokens de otras cuentas). |
| GET | `/api/buscar?q=` | q 2–60. Máx. 20 grupos; primero los que están en más tiendas. `errores` por tienda con mensaje claro. |
| GET | `/api/lista` | `actualizadoEn` = último cambio de la lista (incluye la última actualización de precios); `null` si está vacía. `preciosConsultadosEn` = la `precios_consultados_en` **más antigua** de los productos; `null` si está vacía o alguno no tiene fecha. La app decide "precios viejos" (>30 min o `null`) con `preciosConsultadosEn`. |
| POST | `/api/lista/items` | 201. `{ grupo, cantidad?, consultadoEn? }`: `consultadoEn` es el de la respuesta de `/api/buscar` (ISO; opcional, sin él el producto queda sin fecha; una fecha futura se recorta a ahora; texto que no sea fecha ISO → 400 `validacion`). Si la clave ya existe suma cantidad (tope 99) y guarda los precios y la fecha recibidos. Máx. 40 productos (400 `lista_llena`). |
| PATCH | `/api/lista/items/:id` | `{ cantidad?, sustitutos? }`; `null` quita el sustituto. 404 si no es tuyo o no existe. |
| DELETE | `/api/lista/items/:id` | 204; 404 si no es tuyo. |
| POST | `/api/lista/comparar` | Ver abajo. |

Cookies:
- `sesion=<token>; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` (30 días).
- `__Secure-dispositivo=<token>[.<token>...]; Path=/api/auth; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`
  (1 año; hasta 5 tokens, uno por cuenta). La app no tiene que hacer nada: el navegador la guarda y la
  manda sola en `/api/auth/*`.

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

- `grupo.clave`: `ean:<13 dígitos con verificador válido>`, `<tienda>:<productoId>` (una tienda) o
  `corte:<tienda>:<productoId>` (2+ tiendas, `coincidencia: "corte"` obligatoria, y esa tienda con ese
  `productoId` en `precios`). `coincidencia: "corte"` con otra clave se ignora. `corte`: texto ≤ 80.
- `cantidad`: entero 1..99; en grupos por libra (`esGrupoCorte`) 0.5..99 en pasos de 0.5.
- `corte` solo se guarda en grupos por libra.
- Solo tiendas activas. Precios > 0 y ≤ 100 000; `precioOferta` solo si es menor que `precio`.
- `url` debe ser `https://` y del dominio de esa tienda (`www.lacolonia.com`, `supercolonial.com`); `imagen` debe ser `https://`.
- Textos con largo máximo (nombre 200, marca 80, presentación 40). `desactualizado` lo pone solo el servidor.

## Emparejamiento (grupos)

- Código de barras normalizado a **EAN-13** (`servidor/src/ean.ts`): 12 dígitos (UPC-A) → se antepone 0;
  14 con 0 inicial → se quita; 8 (EAN-8) → ceros a la izquierda; 11 (UPC sin verificador) → `completarGtin`
  de `precios/src/normalizar.ts`. Si el dígito verificador no cuadra, se ignora el código.
- Mismo EAN en varias tiendas → un grupo `ean:0707517002083` con `coincidencia: "codigo"`. Sin pareja →
  grupo de una tienda `colonial:10783533728036` (sin `coincidencia`).
- **De dónde sale el EAN en Colonial** (Shopify): su búsqueda `suggest.json` no lo trae. Se obtiene de dos
  formas: (a) del nombre de la imagen (`Items_2f7424142400093.jpg` o `Items_2f707517002083_….jpg`);
  (b) buscando el código en su buscador (`suggest.json?q=<EAN>`), que encuentra el producto cuyo **SKU es
  el EAN** (verificado con `/products/<handle>.js`, campo `variants[].sku`; `barcode` viene vacío). Varios
  códigos unidos con `OR` no son fiables (a veces devuelve vacío) y no se usan. La Colonia (VTEX) siempre
  trae el EAN pero su búsqueda por código responde error 500, así que solo se busca por código en Colonial.
- **Búsqueda dirigida por código** (`servidor/src/busqueda.ts`, `completarPorCodigo`): en `/api/buscar`,
  después de la búsqueda normal, los productos de La Colonia que quedaron **sin pareja** (en orden de
  relevancia) se buscan por su código en Colonial: **máx. 6 consultas extra** por búsqueda (2 a la vez,
  250 ms de pausa), con la misma caché de D1 de 30 min (clave `vivo:colonial:<código>`). Lo encontrado se
  agrega a los resultados de Colonial con su código, y se une por código. Total por búsqueda sin caché:
  2 + 6 = 8 peticiones (Workers gratis permite 50). Subir el límite de 10 resultados de Colonial no es
  posible (`resources[limit]` > 10 se ignora). Al comparar la lista esto se apaga.
- **Confirmación de lo hallado por código**: si la imagen del producto de Colonial trae el mismo
  código, basta. Si no trae código, el adaptador solo lo acepta si coincide con la `referencia` (el
  producto de La Colonia con ese código) según `confirmarMismoProducto`: las MISMAS reglas que el
  respaldo por parecido (abajo) — cantidad presente en los dos e igual ±3 %, paquete, otros números,
  color, talla, variantes (light, deslactosada, sin azúcar, vainilla…), precio — con puntuación ≥ 0.7.
  Solo se relaja en dos cosas: tolera palabras distintas que no son variantes conocidas ("Glacial
  Almendra" / "Almonette") y, si una tienda no dice la marca, basta que no la contradiga. Sin
  referencia que coincida no devuelve nada (`resultadoPorCodigo`).
- **Respaldo por parecido** (`precios/src/similitud.ts`): los grupos que siguen sin pareja se unen si son
  "probablemente el mismo producto" → `coincidencia: "probable"`. Reglas (conservadoras: una app de
  precios no puede decir "más barato" comparando productos distintos; ante la duda no se une):
  1. **Marca**: si las dos tiendas la dicen, idéntica normalizada (sin tildes ni espacios, con alias:
     "MC CORMICK" = "McCormick"; "PINOS" ≠ "Dos Pinos"; La Colonia "Leyde" ≠ Colonial "Sula"). Si solo
     una la dice, debe aparecer completa (palabras enteras) en el nombre del otro.
  2. **Cantidad** igual con tolerancia de 3 % (946 ml = 0.946 l; 12 oz = 340 g o 355 ml; `30u` = `30 un`;
     `Ltrs`, `onz`, `Libr`, `Rollos`, `12R` reconocidos) y mismo número por paquete (`6 pack`, `12 x`).
     Si a un producto le falta la cantidad, no se une.
  3. **Otros números** del nombre (no la cantidad ni el paquete) deben ser iguales en los dos: "Etapa 3",
     "2%", "70%", "2en1"/"2 en 1", "Talla 4", "3 capas", "1000 hojas". Si un lado tiene uno que el otro
     no, no se une.
  4. **Palabras**: todas las que describen el producto deben tener pareja (quitando marca, cantidades y
     ruido como "refresco", "uht", "sabor"). Se aceptan: abreviaturas (prefijo de ≥ 4 letras que no
     termina en vocal, p. ej. "desl", "volt", "frijol"; o de una lista blanca: "hig", "ext", "semid"…) y
     una letra de diferencia solo en palabras de ≥ 6 letras con la misma primera y última letra
     ("Ridemax" = "Rindemax"). Nunca entre dos palabras conocidas distintas (fresa/fresca, coco/cocoa,
     sal/salsa, pan/panqueques, descremada/deslactosada). Implícitas: "Ketchup" = "Salsa Ketchup".
     Se perdona que un lado no diga: una palabra leve ("entera", "original" = "regular", "vitaminada"),
     el tamaño del huevo, el envase (lata, botella…), hoja doble/triple, frijol volteado/entero, o el
     color "blanco/a" (se toma como valor por defecto). **No** se perdona si solo un lado dice: un color
     distinto de blanco (morena, rubia, negro, rojo…), una talla (S, M, G, XG, XXG… en pañales/ropa),
     "integral", "sin azúcar", "light", "deslactosada", "fortificada", "bolsa", "picante"…
     Si los dos dicen algo del mismo grupo (color, talla, tamaño, envase…), debe coincidir.
  5. **Precio**: si uno cuesta más de 1.5 veces el otro, no se une.
  Puntuación 0–1 (cantidad, palabras, marca y precio); se une solo con ≥ 0.8, uno a uno, el mejor par
  primero. Nunca se unen dos productos con códigos de barras **distintos**, ni dos sin ningún código (la
  clave de un grupo de varias tiendas debe ser `ean:...`; la de un grupo probable es el EAN de La Colonia).
- **Agregar a la lista un grupo cuya clave ya está** (`POST /api/lista/items`): se suma la cantidad y se
  **fusionan** los precios (`fusionarGrupos`): las tiendas que trae el grupo nuevo se actualizan y las que
  solo tenía el guardado se conservan (antes, agregar `ean:X` solo de La Colonia borraba el precio de
  Colonial de un par probable `ean:X`). Si quedan precios guardados de antes, `precios_consultados_en`
  toma la fecha más antigua. `coincidencia` se guarda (solo si el grupo tiene 2 o más tiendas).
- Medición en vivo (2026-11-17, 8 búsquedas: leche sula, aceite, frijoles, azucar, cafe, huevos, papel
  higienico, coca cola; máx. 20 grupos c/u): grupos en las dos tiendas **antes 1 → 39** (23 por código,
  16 probables). Las reglas estrictas descartan, a propósito: el par "Leyde"/"Sula" (marcas distintas)
  y 3 hallados por código sin código en la imagen que no se pueden confirmar (2 leches Sula sin tamaño
  en Colonial y un helado "Vainilla Sin Azúcar" / "Vanilla").
- Paquetes: "12 x 355 ml" = "12 Pack 355ml" = "Pack de 12 355ml"; el número del paquete no cuenta como
  "otro número". Paquete contra unidad, o paquetes de distinto número, no se unen.
- Nombre del grupo (`Grupo.nombre`): se toma el de La Colonia si está, luego Los Andes, luego Colonial, y
  se **limpia para mostrar** (`nombreParaMostrar` en `precios/src/normalizar.ts`): separa palabras pegadas
  por mayúscula o número, pasa a formato Título la marca en MAYÚSCULAS y quita la presentación si es la
  misma que va en `Grupo.presentacion`. Ej.: `PROGRESO Arroz BlancoGranoLar1.75Kg` →
  `nombre: "Progreso Arroz Blanco Grano Lar"`, `presentacion: "1.75 kg"`. Las abreviaturas de la tienda
  ("Lar") no se adivinan.
- El nombre **original** de cada tienda se conserva en `precios[tienda].nombre`.
- **Códigos de balanza**: los EAN de circulación restringida (EAN-13 que empieza con `2`, UPC `02…`)
  se ignoran (`normalizarEan13`). Son los códigos internos con que cada súper pesa carne y pescado
  ("Chuleta De Cerdo X Lb" = `2025169000000` en La Colonia; Colonial los pone en el nombre de la
  imagen, `Items_2f2053270000000.jpg`): el mismo número puede ser otro producto en la otra tienda.
  Así esos productos quedan con clave `<tienda>:<id>` y tampoco se buscan "por código" en Colonial.

### Carnes por libra (`coincidencia: "corte"`) — `precios/src/cortes.ts`

Las carnes, aves y pescados frescos que se venden por peso casi nunca tienen el mismo nombre ni
código en las dos tiendas. Después del emparejamiento por código y por parecido (sin tocar esos
grupos), los productos que siguen **solos en su tienda** y se venden por peso se clasifican en una
**clase de corte** y se unen uno a uno con los de otra tienda de la misma clase.

1. **¿Se vende por peso?** (`ventaPorPeso`, en este orden)
   - Por unidad sin número delante ("x unidad", "c/u", "cu", "ud", "und", "unid", "pza", "pz",
     "pieza") → no, **aunque tenga código de balanza y categoría de carne**. "En piezas" no es por
     unidad ("Pollo en Piezas x Lb" sí entra, como corte "en piezas"). Procesados (salchicha, jamón, chorizo,
     rostizado, mezquite, pasta, emparedado, nuggets…) → no. Categoría de la tienda que no es de
     carne (Embutidos, Deli, Comidas Listas, "Productos Colonial", Abarrotes, Mascotas) → no.
   - Cantidad fija en el nombre ("454 g", "2.27 kg", "5 oz") → no: empacado, sigue con el
     emparejamiento normal. Excepción: "1 Lb" con código de balanza (bandeja pesada en la tienda).
   - La tienda dice la unidad: La Colonia `measurementUnit` "lb"/"kg" (con `unitMultiplier`).
     **Casi siempre dice "un" aunque sea por libra**, por eso hay más reglas:
   - Nombre con "x lb", "lb", "libra", "por libra", "xlb", "XLB" pegado, "Lbr", "Libr" (sin número
     delante) → por libra; "x kg"/"kilo" → por kilo (precio ÷ 2.20462 = por libra).
   - Código de balanza (`2…`, 13 dígitos) + categoría de carne + sin cantidad en el nombre → por
     libra ("Pechuga de Pollo Deshuesada fresca" L83.95; en Colonial "x LB" L86.99–92.99).
   - Categoría: La Colonia `categories[0]` ("/Supermercado/Carnes y Aves/Cerdo/", "/Pescados y
     Mariscos/"); Colonial `type` + `tags` ("Carnes y Refrigerados | carne, Cerdo"). Se guardan en
     `Producto.categoria` y `Producto.unidadVenta` (campos nuevos de `precios/`, opcionales).
2. **Clase de corte** = animal + corte + atributos que deben coincidir (`clasificarCorte`):
   - **Animal**: res (novillo, beef), cerdo (puerco), pollo, gallina, pavo, ternera, cordero, y
     especies de pescado/marisco (tilapia, pargo, corvina, salmón, róbalo, bagre, camarón…). Si el
     nombre no lo dice, se toma de la categoría (Res/Cerdo/Pollo) solo si nombra **un** animal; si
     nombra varios ("Res, Cerdo") queda sin animal y no entra al modo carnes. Dos animales = mezcla
     ("res+pollo"), que solo se une con la misma mezcla.
   - **Corte** (si dice varios, manda el primero de esta lista y los demás pasan a atributos):
     molida, chuleta, costilla, pechuga, muslo, piernita, pierna, ala, tender, filete, bistec,
     lomo de aguja, lomo, lomito (≠ lomo), posta, punta de anca, mano de piedra, rib eye, new york, t-bone, picaña,
     arrachera, entraña, churrasco, tajo, falda, milanesa, carpaccio, pulpa, paleta, cecina, lengua,
     hígado, mondongo, pata, oreja, cola, hueso, menudo, molleja, pescuezo, cabeza, chicharrón,
     albóndiga, tocino, trocitos, en piezas (troceado, partido), entero. Un pescado sin corte =
     entero; un marisco sin corte = el marisco ("Camarón"). Sin corte reconocido (y no
     es pescado) → no entra al modo carnes.
   - **Atributos que deben coincidir** (ambos lados el mismo conjunto; si uno lo dice y el otro no,
     no se une): deshuesada (desh, deshuesad, sin hueso) / con hueso; ahumada; empanizada; marinada;
     adobada; condimentada; preparada (prep); cocida; BBQ; picante; congelada (congel, IQF, frozen,
     frz); con ala / sin ala
     ("Pechuga-Ala" = con ala); sin piel / con piel; corta; en mariposa; color del pescado (roja,
     gris, negra); tamaño de mariscos (jumbo, extragrande, grande, mediano, pequeño, colossal,
     "U-15"/"U15", conteos "16/20", "21-25", "31/40"…; "31/40 Lb" no se lee como 0.775 lb, pero
     "1/2 Lb" sí es cantidad fija); y los cortes secundarios ("Chuleta **de lomo**" ≠ "Chuleta":
     **decidido así** porque la chuleta de lomo cuesta casi el doble; "Tajo Molido" ≠ "Molida";
     "Filete Trocito" ≠ "Filete").
   - **No impiden emparejar**: calidad (popular, económica < normal < especial, super, extra <
     premium, prime, angus), marca, "fresca", "bandeja", "MAP", "granel", "nacional", "criolla" y
     cualquier palabra fuera del vocabulario.
3. **Elegir la opción más parecida** (`puntajePar`, voraz, el mejor par primero, cada producto una
   vez): 1) calidad más parecida, 2) misma marca (sin contar las del súper: La Colonia, Selecta
   Fresh, Colonial), 3) precio por libra más cercano. **Seguro**: si uno cuesta más del doble por
   libra que el otro, no se unen.
4. **Grupo**: `clave: "corte:<tienda>:<productoId>"` (La Colonia si está), `coincidencia: "corte"`,
   `corte: "Chuleta de cerdo"` (nombre legible), `presentacion: "por libra"`, `nombre` = nombre
   limpio de La Colonia sin "x Lb", `marca` solo si todas dicen la misma, y en `precios[tienda]`
   **precio y oferta en lempiras por libra** (para que `cantidad` = libras).
5. **Sin par**: el producto queda solo en su tienda (clave `<tienda>:<id>`, sin `coincidencia`).
   Si **su nombre** confirma que es carne por libra (`corteConfirmadoPorNombre`: "x lb"/"libra"/"x kg"
   y corte en el nombre; el animal puede venir del `corte`), lleva `corte`, `presentacion: "por
   libra"` y precio por libra; la app los ofrece como "otro corte". Si solo se sabe por el código
   de balanza (p. ej. "Pechuga de Pollo Fresca con Hueso"), queda como producto normal.
   **Al validar** (`POST /api/lista/items`), un grupo que no es `corte:…` y dice "por libra" se
   comprueba igual con los nombres de sus `PrecioTienda` (`porLibraConfirmado`); si no se confirma,
   se le quitan `presentacion` y `corte`, y una cantidad con decimales da 400.
6. **Regla común servidor/app** (`esGrupoCorte`): un grupo es "por libra" si `coincidencia` es
   `"corte"`, su clave empieza con `corte:` o `presentacion` es "por libra". En esos grupos:
   cantidad en medias libras, el sustituto elegido manda sobre el original, y al comparar el precio
   se vuelve a pasar a por libra.
- Medición en vivo (2026-11-17; pollo, pechuga de pollo, carne molida, chuleta de cerdo, costilla
  de res, bistec de res, tilapia; 1 consulta por tienda c/u): grupos en las dos tiendas **antes 1 →
  después 12** (11 'corte'). Ver los pares en `servidor/test/cortes.test.ts`.

## Comparar (`POST /api/lista/comparar`)

1. Por cada producto de la lista busca en cada tienda activa con el **nombre original de esa tienda**
   (`precios[tienda].nombre`; si el producto aún no está en esa tienda, con `grupo.nombre`, salvo en
   Colonial cuando el grupo tiene código: ahí se busca el código, ver "Búsqueda dirigida"). Caché de
   30 min; textos repetidos se buscan una vez y las tiendas con el mismo texto van juntas. En cada tienda lo **re-identifica** por `productoId` y, si no, por EAN
   (así también descubre el producto en una tienda donde antes no estaba). Los grupos `probable` y
   `corte` se re-identifican igual: por el `productoId` guardado de cada tienda. En los `corte` el
   precio se vuelve a pasar a lempiras por libra; si el producto ya no se reconoce como vendido por
   peso, se conserva el guardado con `desactualizado: true`.
2. Si no lo encuentra (o la tienda falla) **conserva el precio guardado** y lo marca con
   `"desactualizado": true` en ese `PrecioTienda`.
3. Sustitutos: solo se vuelven a consultar los que se usan, buscando el nombre del sustituto solo en
   esa tienda. Se usan si el original falta (o `disponible: false`); en grupos `corte` el sustituto
   elegido **siempre manda** sobre el original (la persona eligió otro corte/calidad), así que
   siempre se consulta, y su precio pasa a por libra si se vende por peso.
4. Cortesía con las tiendas: máx. 3 búsquedas a la vez, pausa de 300 ms tras cada consulta real, y como
   máximo 40 consultas reales por comparación (el resto usa el precio guardado, marcado `desactualizado`).
5. Guarda los precios nuevos en la lista, pone `precios_consultados_en` = hora de la comparación en todos
   sus productos (también los que quedaron `desactualizado`: se intentó consultarlos; el aviso por precio
   lo da esa marca) y responde `preciosConsultadosEn` (misma regla que `GET /api/lista`, leída tras guardar). Calcula:
   - Precio efectivo = `precioOferta ?? precio`; total = suma de precio × cantidad (en centavos, sin errores de redondeo;
     con medias libras cada producto se redondea al centavo, medio centavo hacia arriba: 55.99 × 1.5 = 83.99).
   - **faltantes**: productos sin precio ni sustituto en esa tienda. Un producto con `disponible: false` cuenta como faltante (salvo que tenga sustituto).
   - **error**: texto si fallaron *todas* las consultas a esa tienda. Esa tienda no compite (se muestra su total con precios guardados, pero la app debe mostrar el error).
   - **ganador**: la completa (sin error) más barata. **ahorro**: contra la completa más cara; `null` si solo hay una completa o si empatan.
   - **empate**: `true` si las dos completas más baratas tienen el mismo total al centavo; en ese caso `ganador` es la primera según el orden de `TIENDAS_ACTIVAS`.
   - **comparacionParcial**: si ninguna está completa, totales solo con los productos que tienen todas las tiendas sin error (`itemsComparados` puede ser 0).

## Extensiones al contrato (opcionales, no rompen nada)

- `PrecioTienda.desactualizado?: true` — precio guardado de una consulta anterior.
- `preciosConsultadosEn` en `GET /api/lista` y `POST /api/lista/comparar`, y `consultadoEn` opcional al agregar un producto.
- `modoPrueba: true` y `avisoPrueba` en `/api/buscar` y `/api/lista/comparar` — solo en desarrollo local con datos de prueba.
- `Grupo.coincidencia?: 'codigo' | 'probable' | 'corte'` — cómo se emparejó un grupo de 2 o más tiendas (ver "Emparejamiento").
- `Grupo.corte?: string` — en grupos `corte` y en frescos por libra de una tienda: nombre legible del corte. Con `presentacion: "por libra"` y precios por libra.
- `ItemLista.cantidad` con medias libras (0.5..99) en grupos por libra.

## Archivos

- `servidor/src/index.ts` — rutas y respuestas
- `servidor/src/seguridad.ts` — contraseñas, sesiones, dispositivos de confianza, límites
- `servidor/src/validar.ts` — validación de entradas
- `servidor/src/busqueda.ts` — búsqueda con caché D1, lista de dominios permitidos, modo de prueba
- `servidor/src/grupos.ts`, `servidor/src/ean.ts`, `precios/src/similitud.ts` — emparejamiento (código y parecido)
- `precios/src/cortes.ts` — carnes por libra: venta por peso, precio por libra, clase de corte, elegir el par
- `servidor/src/refrescar.ts` — re-consulta de precios para comparar
- `servidor/src/comparar.ts` — totales, faltantes, ganador
- `servidor/datos-prueba/emparejables.json` — registro hecho a mano para el modo prueba (ver arriba)
- `servidor/src/estaticos.ts` — sirve la app; `index.html` con Content-Security-Policy
  (`default-src 'self'`, `img-src 'self' https: data:` para las fotos de las tiendas, sin scripts ni
  estilos en línea, `frame-ancestors 'none'`), Permissions-Policy (sin cámara, micrófono, ubicación,
  pagos ni USB), X-Frame-Options y Referrer-Policy; el 404 lleva `nosniff`
- `servidor/test/*.test.ts` — 106 pruebas (`cortes.test.ts`: carnes por libra con respuestas reales) (`api.test.ts` prueba el Worker completo con una D1 en memoria,
  `test/d1-falsa.ts`, sobre `node:sqlite`)
