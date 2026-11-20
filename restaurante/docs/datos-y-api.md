# Datos y API — Entregas 1 y 2

Complementa el contrato de `docs/proyecto.md` (que manda). Aquí está cómo
quedó implementado: estructura de la base de datos, cada dirección con
ejemplos, códigos de error y detalles que las pantallas deben conocer.

Código: `worker/` (Cloudflare Worker, TypeScript, sin frameworks).
Base de datos: D1, migraciones en `migrations/` (`0001_inicial.sql`, `0002_envio_id.sql`,
`0003_freno_ip.sql`, `0004_ordenes_canceladas.sql`, `0005_jornadas.sql`).
La Entrega 2 (corte de caja y propinas) está en la **sección 5**.

---

## 1. Estructura de datos

Dinero en **centavos enteros**. Fechas en texto ISO UTC (`2026-11-20T18:30:00.000Z`).

| Tabla | Campos principales | Notas |
|---|---|---|
| `usuarios` | id, nombre, rol, pin_hash, pin_sal, activo, intentos_fallidos, bloqueado_hasta | PIN = SHA-256(sal + pin). Freno: 5 PIN erróneos seguidos → bloqueado 1 min (ver login). |
| `freno_ip` | ip (llave), intentos, ventana_inicio | PIN evaluados e incorrectos por IP en una ventana de 10 min (migración 0003). Filas vencidas se borran solas de vez en cuando. |
| `sesiones` | id, token_hash, usuario_id, creada, expira | Se guarda el SHA-256 del token, no el token. Duran 16 h. |
| `mesas` | id, nombre (único), activo | |
| `productos` | id, nombre, categoria, precio, activo | |
| `ordenes` | id, mesa_id, mesero_id, estado (`abierta`/`pagada`), propina, creada, pagada_en, cobrado_por, jornada_id | **Una sola orden abierta por mesa** (índice único parcial). `mesero_id` = quien abrió la cuenta. `cobrado_por` = usuario de caja que cobró. `jornada_id` = jornada en la que se cobró (migración 0005; `NULL` en cuentas abiertas y en las cobradas antes de la Entrega 2). |
| `comandas` | id, orden_id, estado (`pendiente`/`listo`), creada, listo_en, envio_id | Cada envío a cocina. `envio_id` (opcional, único) = identificador que manda la tablet para no duplicar envíos (migración 0002). |
| `items` | id, comanda_id, producto_id, nombre, precio, cantidad, nota | nombre y precio **copiados** del menú al enviar. |
| `pagos` | id, orden_id, metodo, monto, creado | metodo: `efectivo`/`tarjeta`/`transferencia`; monto > 0. |
| `ordenes_canceladas` | id, mesa_id, mesero_id, creada, cancelada, cancelada_por | Registro de cuentas vacías canceladas (migración 0004). Conserva el id: al abrir una cuenta nueva su id es `MAX(ordenes.id, ordenes_canceladas.id) + 1`, así **nunca se reutiliza** el id de una cuenta cancelada (una tablet con la cuenta vieja en pantalla recibe 404, no manda platillos a otra mesa). |

Reglas que además protege la propia base de datos (triggers), por si dos
personas actúan al mismo tiempo:
- No se insertan comandas ni pagos en una orden que no está abierta.
- Una orden solo pasa a `pagada` si tiene platillos y la suma de pagos = subtotal + propina.
- Una orden pagada no se puede reabrir.

Subtotal de una orden = suma de `precio × cantidad` de todos sus items
(incluye comandas pendientes y listas).

---

## 2. Reglas generales de la API

- Base: `/api`. En desarrollo: `http://localhost:8787/api` (Vite redirige `/api` ahí).
- Enviar `Content-Type: application/json` en los POST con cuerpo.
- Sesión: encabezado `Authorization: Bearer <token>` (token de 64 caracteres hex).
- Todas las respuestas son JSON. Errores: `{ "error": "mensaje para mostrar" }`.

| Código | Cuándo |
|---|---|
| 200 | OK |
| 201 | Se creó algo (orden nueva, comanda nueva). Cuerpo igual que en 200. |
| 400 | Datos inválidos (el mensaje dice qué corregir) |
| 401 | Sin sesión / sesión vencida / PIN incorrecto → mandar a la pantalla de entrada (excepto en login, donde se muestra "PIN incorrecto") |
| 403 | El rol no tiene permiso |
| 404 | No existe (mesa, cuenta, comanda, ruta) |
| 405 | Método equivocado para una ruta que sí existe |
| 409 | Conflicto: la cuenta ya fue cobrada, o cambió mientras se cobraba, o no se puede cancelar; no hay día abierto / ya hay uno abierto / hay cuentas abiertas al cerrar |
| 413 | Cuerpo de más de 32 KB |
| 429 | Demasiados PIN incorrectos (esperar 1 minuto) o demasiados intentos desde la misma conexión (esperar unos minutos). Solo en login. El cuerpo trae `retry_after` (segundos) |
| 500 | Error inesperado del servidor |

El rol `dueno` puede usar todas las direcciones.

---

## 3. Direcciones

### `GET /api/usuarios-login` — público
Usuarios activos para la pantalla de entrada (ordenados por id).
```json
[{"id":1,"nombre":"Dueño","rol":"dueno"},{"id":2,"nombre":"Ana","rol":"mesero"}, ...]
```

### `POST /api/login` — público
Cuerpo: `{ "usuario_id": 2, "pin": "1111" }` — `pin` es **texto** de 4 dígitos (conserva ceros: `"0000"`).
```json
{"token":"5d74…c8e2","usuario":{"id":2,"nombre":"Ana","rol":"mesero"}}
```
Errores: 400 "El PIN debe tener 4 dígitos." · 401 "PIN incorrecto" · 429 (ver abajo). Mostrar `error` tal cual.

**Todo 429 del login** trae además `retry_after` = segundos que faltan para poder intentar de nuevo
(también en el encabezado `Retry-After`). La pantalla debe **desactivar el teclado de PIN** durante ese tiempo:
```json
{"error":"Demasiados intentos con PIN incorrecto. Espera un minuto e intenta de nuevo.","retry_after":60}
```

**Frenos contra adivinar PINs** (a prueba de peticiones simultáneas):
- *Por usuario:* antes de revisar el PIN, el servidor suma 1 al contador del usuario en **una sola sentencia
  atómica** (`UPDATE … RETURNING`) y usa el valor resultante. Solo los intentos 1 a 5 llegan a revisar el PIN:
  - intentos 1–4 incorrectos → 401 "PIN incorrecto";
  - intento 5 incorrecto → 429 "PIN incorrecto. Por seguridad, espera un minuto e intenta de nuevo." (queda bloqueado 1 min);
  - mientras está bloqueado (intento 6 en adelante) → 429 "Demasiados intentos con PIN incorrecto. Espera un minuto e intenta de nuevo."
    **sin revisar el PIN** (ni el correcto entra).
  - PIN correcto (dentro de los 5) → entra y el contador vuelve a 0. Al vencer el bloqueo se empieza a contar de nuevo.
- *Por IP* (`CF-Connecting-IP`; si falta, `local`): máximo **30 PIN evaluados e incorrectos en 10 minutos**;
  al pasar el límite → 429 "Demasiados intentos, espera unos minutos." para cualquier usuario desde esa
  conexión, con `retry_after` = lo que falta para que venza la ventana de 10 min.
  Solo cuentan los PIN **realmente evaluados e incorrectos** (cambio de la Entrega 2). **No** suman:
  un intento rechazado por el propio freno de IP (429), uno rechazado porque el usuario está bloqueado
  (429, el PIN ni se revisa) y un PIN correcto. Así, aunque todas las tablets del restaurante salgan por la
  misma IP, insistir mientras dura un bloqueo no alarga ni provoca el bloqueo de todos.
  A prueba de peticiones simultáneas: el servidor "aparta" un lugar en el contador con una sola sentencia
  atómica (`INSERT … ON CONFLICT … RETURNING`) **antes** de revisar el PIN, y lo devuelve si el intento no
  terminó siendo un PIN incorrecto evaluado. Con 60 peticiones simultáneas de PIN incorrecto desde una IP,
  exactamente 30 se evalúan (401) y 30 reciben 429; el contador queda en 30.
- Usuario inexistente: 401 "PIN incorrecto" con el mismo trabajo de cálculo (no revela si existe).

### `POST /api/logout` — todos
Borra la sesión. Respuesta `{ "ok": true }`.

### `GET /api/yo` — todos
`{"id":2,"nombre":"Ana","rol":"mesero"}` (útil al recargar la página para validar el token guardado).

### `GET /api/menu` — todos
Productos activos ordenados por categoría y nombre.
```json
[{"id":18,"nombre":"Agua de horchata","categoria":"Bebidas","precio":3500}, ...]
```
Categorías del ejemplo: Bebidas, Entradas, Platos fuertes, Postres, Tacos
(el orden alfabético es el del servidor; si las pantallas quieren otro orden de pestañas, lo deciden ellas).

### `GET /api/mesas` — mesero, caja, dueno
Mesas activas (ordenadas por id) con su cuenta abierta, si hay.
```json
[
  {"id":1,"nombre":"Mesa 1","orden_id":null,"mesero_id":null,"mesero_nombre":null,"total":0,"abierta_en":null},
  {"id":3,"nombre":"Mesa 3","orden_id":1,"mesero_id":2,"mesero_nombre":"Ana","total":32050,"abierta_en":"2026-11-20T01:37:12.519Z"}
]
```
`total` aquí es el subtotal de los platillos (aún sin propina).
`mesero_id` / `mesero_nombre`: quien abrió la cuenta (`null` si la mesa está libre).
Para "Tú" / "Mis mesas" las pantallas comparan `mesero_id` con el id del usuario en sesión (no el nombre).

### `POST /api/ordenes` — mesero, dueno
Cuerpo: `{ "mesa_id": 3 }`. Abre la cuenta de la mesa; si ya tenía una abierta,
regresa esa (201 si se creó, 200 si ya existía). Respuesta: `Orden`.
Cualquier mesero puede abrir/agregar a cualquier mesa (cubrirse entre ellos);
`mesero_nombre` es quien la abrió.
Errores: 400 "Elige una mesa." · 404 "No se encontró esa mesa."

### `GET /api/ordenes/:id` — mesero, caja, dueno
Respuesta: `Orden` (ver ejemplo abajo). 404 si no existe.

### `POST /api/ordenes/:id/comandas` — mesero, dueno
```json
{ "items": [
  { "producto_id": 6, "cantidad": 2, "nota": "sin cebolla" },
  { "producto_id": 18, "cantidad": 3 }
], "envio_id": "3f0c2a8e-6b1d-4c7a-9e55-0d2f4b8a1c33" }
```
- 1 a 50 renglones; `cantidad` entero 1–99; `nota` opcional, texto ≤ 140 caracteres
  (se recortan espacios; vacía → `null`).
- `envio_id` opcional: texto de 8 a 64 caracteres (letras, números, `-`, `_`); la tablet manda un UUID.
  Sirve para que un reintento (p. ej. se cortó la conexión y no llegó la respuesta) no duplique la comanda:
  - Si ese `envio_id` ya existe **en esta misma orden** → no se crea nada y responde **200** con la `Orden` actual
    (esto se revisa antes que el estado de la cuenta o del menú: si la cuenta se cobró entre intentos, igual responde 200).
  - Si ya existe **en otra orden** → **409** "Este envío ya se usó en otra cuenta. Vuelve a intentarlo."
  - Dos peticiones simultáneas con el mismo id: el índice único de la base de datos deja pasar solo una (201);
    la otra se deshace completa y responde 200 (o 409 si era otra orden).
  - Sin `envio_id` funciona como antes (cada petición crea una comanda).
- Responde la `Orden` actualizada (201) con la nueva comanda al final de `comandas`.
- Errores: 400 (datos, `envio_id` inválido "El identificador de envío no es válido.", o "Uno de los platillos ya no está disponible…") · 404 · 409 "Esta cuenta ya fue cobrada." · 409 envío usado en otra cuenta.

**Cómo lo usan las pantallas** (`src/pedidos.ts`, `src/pantallas/Mesa.tsx`): al tocar "Enviar a cocina" se
genera un UUID y se guarda en localStorage junto con el pedido en preparación y una "huella" del contenido
(platillo, cantidad, nota). Cada reintento del **mismo** pedido reusa ese id → nunca se duplica. El id se
descarta cuando el envío se confirma (se borra el pedido) o cuando el pedido se modifica. Consecuencia
aceptada: si el primer intento **sí** llegó a cocina pero la tablet no recibió la respuesta, y el mesero cambia
el pedido antes de reintentar, el nuevo envío lleva otro id y cocina recibe una **segunda comanda** (con el
pedido modificado). Reintentar sin cambios nunca duplica.

### `POST /api/ordenes/:id/cancelar` — mesero, caja, dueno
Sin cuerpo. Cancela una cuenta abierta **que todavía no tiene platillos** (p. ej. se abrió la mesa equivocada):
la borra, deja un registro en `ordenes_canceladas` (quién y cuándo) y la mesa queda libre al instante.
```json
{"ok":true}
```
- 404 "No se encontró esa cuenta." (no existe o ya se canceló).
- 409 "No se puede cancelar: la cuenta ya tiene platillos." (aunque estén pendientes en cocina).
- 409 "No se puede cancelar: la cuenta ya fue cobrada."
- 403 para rol cocina.
- A prueba de carreras: el borrado solo ocurre si, en ese mismo instante, la cuenta sigue abierta y sin
  comandas ni pagos. Si un mesero envía platillos al mismo tiempo, gana uno de los dos: o se cancela
  (y el envío responde 404) o llegan los platillos (y cancelar responde 409).
- El id de una cuenta cancelada no se vuelve a usar.

### `GET /api/cocina` — cocina, dueno
`Comanda[]`: primero todas las `pendiente` (más antigua primero), luego las
`listo` de los últimos 30 minutos (más reciente primero).
```json
[{"id":2,"orden_id":1,"mesa_nombre":"Mesa 3","mesero_nombre":"Ana","estado":"pendiente",
  "creada":"2026-11-20T01:37:12.602Z","listo_en":null,
  "items":[{"id":3,"producto_id":27,"nombre":"Arroz con leche","precio":4550,"cantidad":1,"nota":null}]}]
```

### `POST /api/comandas/:id/listo` — cocina, dueno
### `POST /api/comandas/:id/pendiente` — cocina, dueno
Sin cuerpo. Responden la `Comanda`. Repetirlas no hace daño (si ya estaba en ese
estado, regresa la comanda sin cambios). 404 si no existe.

### `GET /api/caja/ordenes` — caja, dueno
`Orden[]` abiertas, la más antigua primero (incluye cuentas sin platillos aún).

### `POST /api/ordenes/:id/pagar` — caja, dueno
```json
{ "propina": 5000,
  "pagos": [ { "metodo": "efectivo", "monto": 20000 }, { "metodo": "tarjeta", "monto": 17050 } ] }
```
- `propina` entero ≥ 0 (si se omite, 0). `pagos`: 1 a 10; `metodo` válido; `monto` entero > 0.
- La suma de montos debe ser **exactamente** `subtotal + propina`.
- Efectivo: se registra lo que se cobra, no lo que entregó el cliente.
- Se guarda todo junto o nada (transacción). La mesa queda libre al instante.
- Respuesta: `Orden` con `estado: "pagada"`, `pagada_en`, `propina`, `total` y `pagos`.
- Errores:
  - 400 "Los pagos suman $100.00 pero el total con propina es $370.50. Deben ser iguales."
  - 400 "No se puede cobrar una cuenta sin platillos."
  - 400 propina/método/monto inválidos
  - 409 "Esta cuenta ya fue cobrada."
  - 409 "La cuenta cambió mientras se cobraba…" (un mesero agregó platillos justo en ese momento: recargar la cuenta)
  - 409 "Primero abre el día capturando el fondo de caja." (Entrega 2: no hay jornada abierta)
- Entrega 2: el cobro queda ligado a la jornada abierta (`ordenes.jornada_id`), dentro de la misma
  transacción. La jornada se toma en el mismo `UPDATE` que cierra la cuenta y un trigger
  (`trg_ordenes_pago_requiere_jornada`) rechaza el cobro completo si en ese instante no hay jornada abierta;
  además el día no puede cerrarse mientras la cuenta siga abierta. Resultado: un cobro nunca queda ligado a
  una jornada ya cerrada.

### Ejemplo de `Orden` (pagada)
```json
{"id":1,"mesa_id":3,"mesa_nombre":"Mesa 3","mesero_id":2,"mesero_nombre":"Ana",
 "estado":"pagada","creada":"2026-11-20T01:37:12.519Z","pagada_en":"2026-11-20T01:37:12.881Z",
 "comandas":[
   {"id":1,"orden_id":1,"mesa_nombre":"Mesa 3","mesero_nombre":"Ana","estado":"listo",
    "creada":"2026-11-20T01:37:12.585Z","listo_en":"2026-11-20T01:37:12.744Z",
    "items":[
      {"id":1,"producto_id":6,"nombre":"Tacos al pastor (orden de 4)","precio":8500,"cantidad":2,"nota":"sin cebolla"},
      {"id":2,"producto_id":18,"nombre":"Agua de horchata","precio":3500,"cantidad":3,"nota":null}]},
   {"id":2,"orden_id":1,"mesa_nombre":"Mesa 3","mesero_nombre":"Ana","estado":"pendiente",
    "creada":"2026-11-20T01:37:12.602Z","listo_en":null,
    "items":[{"id":3,"producto_id":27,"nombre":"Arroz con leche","precio":4550,"cantidad":1,"nota":null}]}],
 "subtotal":32050,"propina":5000,"total":37050,
 "pagos":[{"id":1,"metodo":"efectivo","monto":20000,"creado":"2026-11-20T01:37:12.881Z"},
          {"id":2,"metodo":"tarjeta","monto":17050,"creado":"2026-11-20T01:37:12.881Z"}]}
```

---

## 4. Datos de ejemplo (`npm run db:seed`)

- Usuarios: Dueño 0000 · Ana 1111 · Luis 2222 · Cocina 3333 · Caja 4444.
- Mesas: Mesa 1 … Mesa 10, Barra 1, Barra 2 (ids 1–12).
- 27 productos en Entradas, Tacos, Platos fuertes, Bebidas y Postres.
- **Entrega 2:** 3 jornadas **cerradas** de los 3 días anteriores (fechas relativas a cuando se corre el seed,
  abiertas a las 12:30 y cerradas a las 23:00 hora de México), con 12 cuentas cobradas en efectivo, tarjeta,
  transferencia y pagos divididos (incluida una propina de 1¢ repartida entre dos formas), salidas
  (una anulada) y:
  - hace 3 días: fondo $1,500, **cuadra** (diferencia $0);
  - hace 2 días: fondo $1,500, **faltan $50** (diferencia −5000);
  - ayer: fondo $2,000 (lo abrió el Dueño), **sobran $20** (diferencia +2000).
- **Hoy queda sin jornada abierta** y sin cuentas: para probar el flujo de "abrir el día".
- `db:seed` **borra** todas las cuentas, jornadas, salidas, sesiones, frenos de login y datos y vuelve a cargar
  el ejemplo (`npm run db:reset` además borra la base y reaplica las migraciones).


---

## 5. Entrega 2 — Jornada, corte de caja y propinas

Contrato: `docs/proyecto.md`, sección "Contrato de la API (Entrega 2…)". Código: `worker/jornadas.ts`
(endpoints), `worker/reparto.ts` (reparto de propina, función pura), migración `migrations/0005_jornadas.sql`.

### 5.1 Tablas nuevas

| Tabla | Campos | Notas |
|---|---|---|
| `jornadas` | id, estado (`abierta`/`cerrada`), fondo, abierta_por, abierta_en, cerrada_por, cerrada_en, conteo (JSON), contado | **Solo una abierta** (índice único parcial `WHERE estado = 'abierta'`). Abierta: sin datos de cierre; cerrada: con todos (CHECK). `contado` lo calcula el servidor a partir de `conteo`. |
| `salidas` | id, jornada_id, monto (> 0), motivo (1–80), usuario_id, creada, anulada_por, anulada_en | No se borran: se anulan (quién y cuándo). |
| `ordenes.jornada_id` | columna nueva (nullable) | Jornada en la que se cobró. |

Reglas que protege la base de datos (triggers), aunque dos personas actúen al mismo tiempo:
- Una cuenta solo pasa a `pagada` ligada a una jornada **abierta** (`JORNADA_NO_ABIERTA`); la jornada de una cuenta cobrada no cambia.
- Una jornada **cerrada no se modifica ni se reabre**, y tampoco las cuentas cobradas en ella (`JORNADA_CERRADA`).
- Una jornada no se cierra si existe **cualquier** cuenta abierta (`CUENTAS_ABIERTAS`).
- Solo se insertan salidas en una jornada abierta; una salida solo puede cambiar para **anularse, una vez**, con su jornada abierta (monto, motivo, etc. son inmutables).

Esperado en caja = `fondo + efectivo cobrado − salidas no anuladas`. "Efectivo cobrado" = suma de pagos en
efectivo de las cuentas de la jornada (incluye la propina pagada en efectivo).

### 5.2 Corte a ciegas (qué ve cada rol)

| | Jornada abierta | Última jornada cerrada | Otras jornadas cerradas |
|---|---|---|---|
| **caja** | Solo `JornadaActual`: fondo, salidas, cuántas cuentas faltan. **Ningún total.** `GET /jornadas/:id/corte` → 403 | `Corte` completo (por id o con `/jornadas/ultima-cerrada`) | 403 |
| **dueno** | `Corte` parcial (`contado`, `diferencia`, `conteo` = `null`) | `Corte` | `Corte` |

Los errores tampoco revelan totales (p. ej. el 409 de "hay cuentas abiertas" solo lista esas cuentas, que la
caja ya ve en su pantalla). Mesero y cocina: 403 en todo lo de esta sección (siguen trabajando normal sin jornada).

### 5.3 Direcciones

#### `GET /api/jornada/actual` — caja, dueno
```json
{"jornada":null}
```
o
```json
{"jornada":{"id":4,"abierta_en":"2026-11-20T18:31:02.114Z","abierta_por_nombre":"Caja","fondo":100000,
  "salidas":[
    {"id":4,"monto":30000,"motivo":"Compra de hielo","usuario_nombre":"Caja","creada":"2026-11-20T18:40:00.000Z",
     "anulada":false,"anulada_por_nombre":null},
    {"id":5,"monto":5000,"motivo":"Error","usuario_nombre":"Dueño","creada":"2026-11-20T18:41:00.000Z",
     "anulada":true,"anulada_por_nombre":"Caja"}],
  "cuentas_abiertas":2}}
```
`salidas` en orden de captura (más antigua primero), incluye las anuladas. `cuentas_abiertas` = todas las cuentas abiertas (también las vacías).

#### `POST /api/jornada/abrir` — caja, dueno
Cuerpo `{ "fondo": 100000 }` (entero en centavos, 0 a 100,000,000). Responde **201** con `JornadaActual`.
- 400 "El fondo de caja debe ser una cantidad válida (0 o más)."
- 409 "El día ya está abierto." (también si dos cajas lo abren al mismo tiempo: solo una gana).
- Se puede abrir otra jornada el mismo día después de cerrar una (el servidor no lo impide; "un corte al día" es una práctica, no una regla de la base).

#### `POST /api/jornada/salidas` — caja, dueno
Cuerpo `{ "monto": 30000, "motivo": "Compra de hielo" }`. `monto` entero 1–100,000,000; `motivo` texto
(se limpian espacios repetidos y caracteres de control) de 1 a 80 caracteres. Responde **201** con `JornadaActual`.
- 400 "El monto de la salida debe ser mayor a cero." · "Escribe el motivo de la salida." · "El motivo no puede tener más de 80 caracteres."
- 409 "No hay un día abierto. Abre el día capturando el fondo de caja."

#### `POST /api/jornada/salidas/:id/anular` — caja, dueno
Sin cuerpo. Responde 200 con `JornadaActual` (la salida queda con `anulada: true` y quién la anuló).
Repetirla no hace daño (si ya estaba anulada y el día sigue abierto, responde igual).
- 404 "No se encontró esa salida."
- 409 "No se puede anular: ese día ya se cerró."

#### `POST /api/jornada/cerrar` — caja, dueno
```json
{ "conteo": { "50000": 2, "20000": 1, "1000": 2, "500": 1, "200": 2 } }
```
- Denominaciones permitidas (centavos, como texto): `"100000" "50000" "20000" "10000" "5000" "2000"` (billetes) y
  `"1000" "500" "200" "100" "50"` (monedas). Cantidades enteras 0–10000. Las que falten cuentan como 0.
- El servidor calcula `contado` (en el ejemplo: 2×500 + 200 + 2×10 + 5 + 2×2 = **$1,229.00** = 122900) y
  guarda el conteo normalizado (las 11 denominaciones).
- Responde 200 con el `Corte` ya cerrado (ver ejemplo abajo). Desde ese momento la caja puede verlo.
- Errores:
  - 400 "Captura el conteo del efectivo." (falta o no es objeto) · `La denominación "123" no es válida.` ·
    "La cantidad de cada denominación debe ser un número entero de 0 a 10000."
  - 409 "No hay un día abierto para cerrar."
  - 409 con lista de cuentas abiertas (cobrarlas o cancelarlas primero):
    ```json
    {"error":"No se puede cerrar el día: hay 2 cuentas abiertas. Cóbralas o cancélalas primero.",
     "cuentas_abiertas":[{"orden_id":17,"mesa_nombre":"Mesa 5","total":0},
                         {"orden_id":18,"mesa_nombre":"Mesa 6","total":3000}]}
    ```
    (`total` = subtotal de platillos, igual que en `/api/mesas`).
  - 409 "Este día ya fue cerrado por otra persona." (dos cierres al mismo tiempo: solo uno produce corte; el
    otro recibe este 409 o "No hay un día abierto para cerrar." según quién llegue después).
- Atómico: el cierre es una sola sentencia condicionada a que la jornada siga abierta, y el trigger revisa en
  ese mismo instante que no haya cuentas abiertas (aunque un mesero abra una mesa al mismo tiempo).

#### `GET /api/jornadas` — dueno
Historial (máx. 90), el más reciente primero (por `abierta_en`):
```json
[{"id":3,"abierta_en":"2026-11-19T18:30:00.000Z","cerrada_en":"2026-11-20T05:00:00.000Z",
  "cerrada_por_nombre":"Caja","cuentas":3,"total":119500,"propinas":15000,"diferencia":2000}, ...]
```
`total` = ventas + propinas (= todo lo cobrado). `diferencia` = contado − esperado (`null` si sigue abierta).

#### `GET /api/jornadas/ultima-cerrada` — caja, dueno
`Corte` de la jornada cerrada más reciente (por `cerrada_en`). Sirve para que la caja vea el último corte aunque se
haya cerrado desde otra computadora. 404 "Todavía no hay cortes." si no hay ninguna.
(Ruta fija; no choca con `/api/jornadas/:id/corte`, que siempre termina en `/corte`.)

#### `GET /api/jornadas/:id/corte` — dueno (cualquiera); caja (solo la última cerrada)
`Corte`. Dueño: 404 "No se encontró ese día." si no existe; la abierta da un corte parcial.
Caja: cualquier jornada que no sea la última cerrada (incluida la abierta o un id inexistente) → 403
"Solo puedes ver el corte del último día cerrado.".

Ejemplo (jornada cerrada de las pruebas, recortado):
```json
{"jornada":{"id":4,"estado":"cerrada","abierta_en":"2026-11-20T18:31:02.114Z","abierta_por_nombre":"Caja",
            "cerrada_en":"2026-11-20T19:05:10.002Z","cerrada_por_nombre":"Caja","fondo":100000},
 "ventas":{"cuentas":5,"subtotal":90450,"propinas":8501,"total":98951,"ticket_promedio":18090},
 "por_metodo":{"efectivo":53000,"tarjeta":22050,"transferencia":23901},
 "salidas":[ …Salida… ], "total_salidas":30000,
 "efectivo":{"fondo":100000,"cobrado":53000,"salidas":30000,"esperado":123000,
             "contado":122900,"diferencia":-100,
             "conteo":{"100000":0,"50000":2,"20000":1,"10000":0,"5000":0,"2000":0,"1000":2,"500":1,"200":2,"100":0,"50":0}},
 "propinas_por_mesero":[
   {"mesero_id":2,"nombre":"Ana","cuentas":3,"total":8500,"efectivo":3199,"tarjeta":2301,"transferencia":3000},
   {"mesero_id":3,"nombre":"Luis","cuentas":1,"total":1,"efectivo":0,"tarjeta":0,"transferencia":1}],
 "propinas_por_mesa":[{"mesa_id":1,"nombre":"Mesa 1","cuentas":2,"total":8000}, …],
 "cuentas":[{"orden_id":18,"mesa_nombre":"Mesa 6","mesero_nombre":"Ana","pagada_en":"…","cobrado_por_nombre":"Caja",
             "subtotal":3000,"propina":500,"total":3500,"pagos":[{"metodo":"efectivo","monto":3500}]}, …]}
```
Detalles:
- `ticket_promedio` = subtotal / cuentas redondeado (sin propina); 0 si no hay cuentas.
- `por_metodo` = montos cobrados por forma de pago (incluyen propina). Suma = `ventas.total`.
- `cuentas` más reciente primero; `pagos` de cada cuenta en el orden en que se registraron.
- `propinas_por_mesero` / `propinas_por_mesa`: aparece todo mesero/mesa con **al menos una cuenta cobrada**
  en la jornada (aunque su propina sea 0); `cuentas` = cuántas de esas tuvieron propina > 0. Mayor total
  primero (empate: nombre / id de mesa). La propina se atribuye al mesero que **abrió** la cuenta.
- La suma de `efectivo + tarjeta + transferencia` de cada mesero es exactamente su `total`, y la suma de
  todos los meseros = suma de todas las mesas = `ventas.propinas`.

#### Reparto de la propina por forma de pago (`worker/reparto.ts`)
Cuando una cuenta se pagó con varias formas, su propina se reparte en proporción a lo cobrado con cada forma
(varios pagos con la misma forma se suman primero). Redondeo por **residuo mayor**: cada forma recibe la parte
entera de su cuota y los centavos sobrantes van, uno por uno, a las de mayor residuo. Empate: mayor monto; luego
efectivo → tarjeta → transferencia. Ejemplos:
- Propina $50.00 con $200.00 efectivo + $170.50 tarjeta → efectivo 2699, tarjeta 2301.
- Propina 1¢ con 3 formas iguales → todo a efectivo; con $50 / $50 / $59.01 → a la de $59.01.
- Propina 0 → 0 en todas; una sola forma → toda a esa forma.
Pruebas: `npm run test:reparto`.

#### `GET /api/reportes/propinas?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` — dueno
```json
{"desde":"2026-11-17","hasta":"2026-11-19","jornadas":3,
 "por_mesero":[{"mesero_id":3,"nombre":"Luis","cuentas":5,"total":27500,"efectivo":8000,"tarjeta":17500,"transferencia":2000}, …],
 "por_mesa":[{"mesa_id":4,"nombre":"Mesa 4","cuentas":1,"total":9000}, …]}
```
- Incluye las jornadas (abiertas o cerradas) cuya `abierta_en`, en **hora de México**, cae entre `desde` y
  `hasta` (ambos incluidos). Se usa **UTC−6 fijo**: México eliminó el horario de verano en 2022, así que
  `America/Mexico_City` es UTC−6 todo el año (si eso cambiara, ajustar `DESFASE_MEXICO_MS` en `worker/jornadas.ts`).
  Ej.: `desde=2026-11-20` empieza en `2026-11-20T06:00:00.000Z`.
- Mismas reglas de propinas que el corte (reparto por forma de pago, quién aparece, orden).
- 400 "Indica las fechas "desde" y "hasta" con el formato AAAA-MM-DD." (faltan, formato o fecha inexistente como 2026-02-30) ·
  "La fecha "desde" no puede ser posterior a "hasta"." · "El rango máximo es de 93 días." (contando ambos extremos).

### 5.4 Cómo probar (local)
```bash
npm run db:reset          # migraciones + datos de ejemplo (3 jornadas cerradas, hoy sin jornada)
npm run dev:api           # http://localhost:8787
npm run test:reparto      # pruebas del reparto de propinas
TOKEN=$(curl -s -XPOST localhost:8787/api/login -H 'content-type: application/json' \
  -d '{"usuario_id":5,"pin":"4444"}' | sed 's/.*"token":"\([0-9a-f]*\)".*/\1/')
curl -s localhost:8787/api/jornada/actual -H "authorization: Bearer $TOKEN"              # {"jornada":null}
curl -s -XPOST localhost:8787/api/jornada/abrir -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"fondo":100000}'
curl -s localhost:8787/api/jornadas/ultima-cerrada -H "authorization: Bearer $TOKEN"      # corte de ayer
```
