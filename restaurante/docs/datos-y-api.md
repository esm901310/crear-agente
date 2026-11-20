# Datos y API — Entregas 1, 2 y 3

**El Lechón Playero** (Omoa, Cortés, Honduras). Dinero en **lempiras**, siempre en centavos enteros
(formato en mensajes: `L 1,234.50`). Hora: **`America/Tegucigalpa`** (UTC−6 fijo, sin horario de verano).

Complementa el contrato de `docs/proyecto.md` (que manda). Aquí está cómo
quedó implementado: estructura de la base de datos, cada dirección con
ejemplos, códigos de error y detalles que las pantallas deben conocer.

Código: `worker/` (Cloudflare Worker, TypeScript, sin frameworks).
Base de datos: D1, migraciones en `migrations/` (`0001_inicial.sql`, `0002_envio_id.sql`,
`0003_freno_ip.sql`, `0004_ordenes_canceladas.sql`, `0005_jornadas.sql`, `0006_freno_ip_bloqueo.sql`,
`0007_menu_real_y_panel.sql`).
La Entrega 2 (corte de caja y propinas) está en la **sección 5**; la Entrega 3 (menú real, pasadía y panel
del dueño) en la **sección 6**. Donde una sección anterior y la 6 no coincidan, manda la 6.

---

## 1. Estructura de datos

Dinero en **centavos enteros**. Fechas en texto ISO UTC (`2026-11-20T18:30:00.000Z`).

| Tabla | Campos principales | Notas |
|---|---|---|
| `usuarios` | id, nombre, nombre_clave, rol, pin_hash, pin_sal, activo, intentos_fallidos, bloqueado_hasta | PIN = SHA-256(sal + pin). Freno: 5 PIN erróneos seguidos → bloqueado 1 min (ver login). `nombre_clave`: ver 6.1. |
| `freno_ip` | ip (llave), intentos, ventana_inicio, bloqueado_hasta | PIN evaluados e incorrectos por IP en una ventana de 10 min (migración 0003). `bloqueado_hasta` = fin del bloqueo de 3 min al llegar a 50 (migración 0006). Filas vencidas se borran solas de vez en cuando. |
| `sesiones` | id, token_hash, usuario_id, creada, expira | Se guarda el SHA-256 del token, no el token. Duran 16 h. |
| `mesas` | id, nombre, nombre_clave, activo, orden | Nombre único **entre las activas** (Entrega 3). |
| `categorias` | id, nombre, nombre_clave, orden, va_a_cocina, activa | Entrega 3 (ver 6.1). |
| `productos` | id, categoria_id, nombre, nombre_clave, descripcion, precio (nullable), precio_abierto, agotado, activo, orden, es_pasadia, opciones (JSON) | Entrega 3 (ver 6.1). |
| `variantes` | id, producto_id, nombre, nombre_clave, precio, orden, activa | Entrega 3 (ver 6.1). |
| `ordenes` | id, mesa_id, mesero_id, estado (`abierta`/`pagada`), propina, creada, pagada_en, cobrado_por, jornada_id | **Una sola orden abierta por mesa** (índice único parcial). `mesero_id` = quien abrió la cuenta. `cobrado_por` = usuario de caja que cobró. `jornada_id` = jornada en la que se cobró (migración 0005; `NULL` en cuentas abiertas y en las cobradas antes de la Entrega 2). |
| `comandas` | id, orden_id, estado (`pendiente`/`listo`), creada, listo_en, envio_id | Cada envío a cocina. `envio_id` (opcional, único) = identificador que manda la tablet para no duplicar envíos (migración 0002). |
| `items` | id, comanda_id, producto_id, nombre, variante, opcion, precio, cantidad, nota, va_a_cocina, es_pasadia | nombre (ya compuesto), variante, opción, precio, va_a_cocina y es_pasadia **copiados** del menú al enviar. |
| `pagos` | id, orden_id, metodo, monto, creado | metodo: `efectivo`/`tarjeta`/`transferencia`; monto > 0. |
| `ordenes_canceladas` | id, mesa_id, mesero_id, creada, cancelada, cancelada_por | Registro de cuentas vacías canceladas (migración 0004). Conserva el id: al abrir una cuenta nueva su id es `MAX(ordenes.id, ordenes_canceladas.id) + 1`, así **nunca se reutiliza** el id de una cuenta cancelada (una tablet con la cuenta vieja en pantalla recibe 404, no manda platillos a otra mesa). |

Reglas que además protege la propia base de datos (triggers), por si dos
personas actúan al mismo tiempo:
- No se insertan comandas ni pagos en una orden que no está abierta.
- Una orden solo pasa a `pagada` si tiene platillos y la suma de pagos = subtotal + propina
  (subtotal = `max(consumo, pasadía)`, Entrega 3).
- Una orden pagada no se puede reabrir.

**Montos de una orden (Entrega 3)** — definidos en un solo lugar: `worker/montos.ts` (y la misma regla en el
trigger `trg_ordenes_cierre_cuadra`):
- `consumo` = suma de `precio × cantidad` de los items con `es_pasadia = 0`;
- `pasadia` = suma de `precio × cantidad` de los items con `es_pasadia = 1`;
- `subtotal = max(consumo, pasadia)`; `total = subtotal + propina`.
Incluye comandas pendientes y listas. Se usa igual en órdenes, mesas, caja, cobro, corte, historial y propinas.

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
| 429 | Demasiados PIN incorrectos (esperar 1 minuto) o demasiados intentos desde la misma conexión (bloqueo de 3 minutos). Solo en login. El cuerpo trae `retry_after` (segundos) |
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
- *Por IP* (`CF-Connecting-IP`; si falta, `local`) — todas las tablets del restaurante suelen salir por la
  misma IP, por eso es tolerante (ajuste Entrega 2.1, migración 0006):
  - máximo **50 PIN evaluados e incorrectos en una ventana de 10 minutos**;
  - el fallo número 50 bloquea la IP **3 minutos** (desde ese momento); mientras dura → 429
    "Demasiados intentos, espera unos minutos." para cualquier usuario desde esa conexión, con
    `retry_after` = segundos que faltan para que termine el bloqueo (≈ 180 al empezar);
  - al terminar el bloqueo el contador **baja a la mitad** (50 → 25) y empieza una ventana nueva de 10 min:
    un atacante insistente vuelve a bloquearse tras otros 25 fallos. Si el bloqueo terminó hace más de
    10 min, o la ventana venció sin bloqueo, el contador vuelve a 0.
  Solo cuentan los PIN **realmente evaluados e incorrectos**. **No** suman: un intento rechazado por el
  propio freno de IP (429), uno con usuario **inexistente o inactivo** (401 "PIN incorrecto", ver abajo),
  uno rechazado porque el usuario está bloqueado (429, el PIN ni se revisa) y un PIN correcto.
  A prueba de peticiones simultáneas: el servidor "aparta" un lugar en el contador con una sola sentencia
  atómica (`INSERT … ON CONFLICT … RETURNING`, que también aplica vencimientos y fija el bloqueo) **antes**
  de revisar el PIN, y lo devuelve si el intento no terminó siendo un PIN incorrecto evaluado. Nunca se
  evalúan más de 50 PIN incorrectos por IP en la ventana (probado: contador en 45 + 24 peticiones
  simultáneas → 5 evaluadas, 19 reciben 429).
- Usuario inexistente o inactivo: 401 "PIN incorrecto" con el mismo trabajo de cálculo (hash ficticio), pero
  **no** cuenta para el freno por IP (la lista de usuarios ya es pública en `/usuarios-login`; contarlo solo
  serviría para que alguien bloqueara a todo el restaurante).

### `POST /api/logout` — todos
Borra la sesión. Respuesta `{ "ok": true }`.

### `GET /api/yo` — todos
`{"id":2,"nombre":"Ana","rol":"mesero"}` (útil al recargar la página para validar el token guardado).

### `GET /api/menu` — todos
**Cambió en la Entrega 3:** ahora responde `{ categorias: CategoriaMenu[] }`. Ver **6.3**.

### `GET /api/mesas` — mesero, caja, dueno
Mesas activas (ordenadas por `orden` y luego id) con su cuenta abierta, si hay.
```json
[
  {"id":1,"nombre":"Mesa 1","orden_id":null,"mesero_id":null,"mesero_nombre":null,"total":0,"abierta_en":null},
  {"id":3,"nombre":"Mesa 3","orden_id":1,"mesero_id":2,"mesero_nombre":"Ana","total":32050,"abierta_en":"2026-11-20T01:37:12.519Z"}
]
```
`total` aquí es el `subtotal` de la cuenta (ya con la regla del pasadía, aún sin propina).
`mesero_id` / `mesero_nombre`: quien abrió la cuenta (`null` si la mesa está libre).
Para "Tú" / "Mis mesas" las pantallas comparan `mesero_id` con el id del usuario en sesión (no el nombre).

### `POST /api/ordenes` — mesero, dueno
Cuerpo: `{ "mesa_id": 3 }`. Abre la cuenta de la mesa; si ya tenía una abierta,
regresa esa (201 si se creó, 200 si ya existía). Respuesta: `Orden`.
Cualquier mesero puede abrir/agregar a cualquier mesa (cubrirse entre ellos);
`mesero_nombre` es quien la abrió.
Errores: 400 "Elige una mesa." · 404 "No se encontró esa mesa."

### `GET /api/ordenes/:id` — mesero, caja, dueno
Respuesta: `Orden` (ver ejemplo abajo). 404 "No se encontró esa cuenta." si no existe.

**Corte a ciegas:** mesero y caja solo pueden ver cuentas **abiertas** o **cobradas hace ≤ 10 minutos**
(lo necesita la pantalla de "Cuenta cobrada ✓" / "Esta cuenta ya se cobró"). Una cuenta cobrada hace más de
10 min responde el mismo 404 "No se encontró esa cuenta." (no se revela que existe). Así la caja no puede
pedir las cuentas por id (son consecutivos) y sumar el efectivo del día antes de contar. El dueño ve todas.

Otras direcciones que regresan `Orden`, revisadas con la misma regla:
- `POST /api/ordenes` y `GET /api/caja/ordenes`: solo cuentas abiertas (sin cambio).
- `POST /api/ordenes/:id/pagar`: responde la cuenta recién cobrada; si ya estaba cobrada → 409 sin datos.
- `POST /api/ordenes/:id/comandas` con `envio_id` repetido: si la cuenta se cobró hace más de 10 min
  (mesero) responde 409 "Esta cuenta ya fue cobrada." en lugar de la `Orden` (la tablet ya trata ese 409).
- `POST /api/ordenes/:id/comandas` sin reintento, `pagar` y `cancelar` sobre una cuenta cobrada siguen
  respondiendo 409 "…ya fue cobrada." (revela que existe, pero ningún monto, pago ni propina).

### `POST /api/ordenes/:id/comandas` — mesero, dueno
**Entrega 3:** cada item acepta además `variante_id`, `opcion` y `precio` (precio abierto), con sus reglas y
errores en **6.4**. Lo de abajo (envio_id, límites, nota) sigue igual.
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
    (esto se revisa antes que el estado de la cuenta o del menú: si la cuenta se cobró entre intentos, igual responde 200;
    excepción: si se cobró hace **más de 10 min** y no es el dueño → 409 "Esta cuenta ya fue cobrada.", sin pagos ni propina).
  - Si ya existe **en otra orden** → **409** "Este envío ya se usó en otra cuenta. Vuelve a intentarlo."
  - Dos peticiones simultáneas con el mismo id: el índice único de la base de datos deja pasar solo una (201);
    la otra se deshace completa y responde 200 (o 409 si era otra orden).
  - Sin `envio_id` funciona como antes (cada petición crea una comanda).
- Responde la `Orden` actualizada (201) con la nueva comanda al final de `comandas`.
- Errores: 400 (datos, `envio_id` inválido "El identificador de envío no es válido.", platillo agotado / inactivo / sin variante… ver 6.4) · 404 · 409 "Esta cuenta ya fue cobrada." · 409 envío usado en otra cuenta · 409 "Uno de los platillos se agotó o cambió en este momento…" (carrera, ver 6.4).

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
**Entrega 3:** solo comandas con al menos un item `va_a_cocina`, y de cada una **solo esos items** (ver 6.5).
```json
[{"id":2,"orden_id":1,"mesa_nombre":"Mesa 3","mesero_nombre":"Ana","estado":"pendiente",
  "creada":"2026-11-20T01:37:12.602Z","listo_en":null,
  "items":[{"id":3,"producto_id":27,"nombre":"Arroz con leche","precio":4550,"cantidad":1,"nota":null}]}]
```

### `POST /api/comandas/:id/listo` — cocina, dueno
### `POST /api/comandas/:id/pendiente` — cocina, dueno
Sin cuerpo. Responden la `Comanda` (solo con sus items de cocina). Repetirlas no hace daño (si ya estaba en ese
estado, regresa la comanda sin cambios). 404 si no existe **o si no tiene ningún item de cocina** (Entrega 3).

### `GET /api/caja/ordenes` — caja, dueno
`Orden[]` abiertas, la más antigua primero (incluye cuentas sin platillos aún).

### `POST /api/ordenes/:id/pagar` — caja, dueno
```json
{ "propina": 5000,
  "pagos": [ { "metodo": "efectivo", "monto": 20000 }, { "metodo": "tarjeta", "monto": 17050 } ] }
```
- `propina` entero ≥ 0 (si se omite, 0). `pagos`: 1 a 10; `metodo` válido; `monto` entero > 0.
- La suma de montos debe ser **exactamente** `subtotal + propina` (subtotal = `max(consumo, pasadia)`).
- Efectivo: se registra lo que se cobra, no lo que entregó el cliente.
- Se guarda todo junto o nada (transacción). La mesa queda libre al instante.
- Respuesta: `Orden` con `estado: "pagada"`, `pagada_en`, `propina`, `total` y `pagos`.
- Errores:
  - 400 "Los pagos suman L 1,020.00 pero el total con propina es L 1,320.00. Deben ser iguales."
  - 400 "No se puede cobrar una cuenta sin platillos."
  - 400 propina/método/monto inválidos · "El monto es demasiado grande. El máximo es L 1,000,000.00." (propina o pago > 100,000,000)
  - 409 "Esta cuenta ya fue cobrada."
  - 409 "La cuenta cambió mientras se cobraba…" (un mesero agregó platillos justo en ese momento: recargar la cuenta)
  - 409 "Primero abre el día capturando el fondo de caja." (Entrega 2: no hay jornada abierta)
- Entrega 2: el cobro queda ligado a la jornada abierta (`ordenes.jornada_id`), dentro de la misma
  transacción. La jornada se toma en el mismo `UPDATE` que cierra la cuenta y un trigger
  (`trg_ordenes_pago_requiere_jornada`) rechaza el cobro completo si en ese instante no hay jornada abierta;
  además el día no puede cerrarse mientras la cuenta siga abierta. Resultado: un cobro nunca queda ligado a
  una jornada ya cerrada.

### Ejemplo de `Orden` (pagada)
(Ejemplo de la Entrega 1; desde la Entrega 3 cada item trae además `variante`, `opcion`, `va_a_cocina`,
`es_pasadia`, y la orden trae `consumo` y `pasadia`. Ver el ejemplo de 6.4.)
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

Generados por `seed/generar.mjs` (Entrega 3):
- Usuarios: Dueño 0000 · Ana 1111 · Luis 2222 · Cocina 3333 · Caja 4444 (ids 1–5).
- Mesas: "Mesa 1" … "Mesa 15" (ids 1–15, `orden` 1–15).
- **Menú real** desde `seed/menu-lechon-playero.json` (fuente de verdad): 13 categorías en el orden del archivo
  (Entradas … Adicionales van a cocina; **Bebidas, Bar y Actividades no**), 80 productos en su orden, con
  descripción, variantes (Mariscada, Pescado rojo, Pescado al vapor), opciones (Mar y tierra, Mar y campo,
  Langosta, Cerveza nacional, Cerveza importada), precio abierto (Langosta) y pasadía (Pasadía L 300).
- 3 jornadas **cerradas** de los 3 días anteriores (fechas relativas a cuando se corre el seed, abiertas a las
  8:30 y cerradas a las 18:30 hora de Honduras), con 10 cuentas del menú real cobradas en efectivo, tarjeta,
  transferencia y pagos divididos (incluida una propina de 1 centavo repartida entre dos formas), salidas
  (una anulada), conteos en las denominaciones nuevas y:
  - hace 3 días: fondo L 2,000, **cuadra** (diferencia 0). Incluye la Mesa 4 con **4 pasadías (L 1,200) y
    consumo L 924.80 → se cobró L 1,200**, y la Mesa 10 con una comanda **solo de bar**;
  - hace 2 días: fondo L 2,000, **faltan L 50** (diferencia −5000). Incluye la Mesa 5 con **2 pasadías (L 600) y
    consumo L 1,120 → se cobró L 1,120**, y una Langosta de precio abierto (L 1,200, "Al ajillo");
  - ayer: fondo L 2,500 (lo abrió el Dueño), **sobran L 20** (diferencia +2000).
- **Hoy queda sin jornada abierta** y sin cuentas: para probar el flujo de "abrir el día".
- `db:seed` **borra** todas las cuentas, jornadas, salidas, sesiones, frenos de login, menú, mesas y usuarios
  y vuelve a cargar el ejemplo (`npm run db:reset` además borra la base y reaplica las migraciones).


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
- 400 "El fondo de caja debe ser una cantidad válida (0 o más)." · "El monto es demasiado grande. El máximo es L 1,000,000.00."
- 409 "El día ya está abierto." (también si dos cajas lo abren al mismo tiempo: solo una gana).
- Se puede abrir otra jornada el mismo día después de cerrar una (el servidor no lo impide; "un corte al día" es una práctica, no una regla de la base).

#### `POST /api/jornada/salidas` — caja, dueno
Cuerpo `{ "monto": 30000, "motivo": "Compra de hielo" }`. `monto` entero 1–100,000,000; `motivo` texto
(se limpian espacios repetidos y caracteres de control) de 1 a 80 caracteres. Responde **201** con `JornadaActual`.
- 400 "El monto de la salida debe ser mayor a cero." · "El monto es demasiado grande. El máximo es L 1,000,000.00." · "Escribe el motivo de la salida." · "El motivo no puede tener más de 80 caracteres."
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
- **Denominaciones en lempiras (Entrega 3)** (centavos, como texto): billetes
  `"50000" "20000" "10000" "5000" "2000" "1000" "500" "200" "100"` (L500, L200, L100, L50, L20, L10, L5, L2, L1) y
  monedas `"50" "20" "10"` (50, 20 y 10 centavos). **`"100000"` ya no existe** (400). Cantidades enteras 0–10000.
  Las que falten cuentan como 0.
- El servidor calcula `contado` (en el ejemplo: 2×L500 + L200 + 2×L10 + L5 + 2×L2 = **L 1,229.00** = 122900) y
  guarda el conteo normalizado (las 12 denominaciones).
- Las jornadas cerradas antes de la Entrega 3 conservan su conteo viejo (con `"100000"`, `"50"`…) tal como se guardó.
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
    (`total` = `subtotal` de la cuenta, igual que en `/api/mesas`).
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
             "conteo":{"50000":2,"20000":1,"10000":0,"5000":0,"2000":0,"1000":2,"500":1,"200":2,"100":0,"50":0,"20":0,"10":0}},
 "propinas_por_mesero":[
   {"mesero_id":2,"nombre":"Ana","cuentas":3,"total":8500,"efectivo":3199,"tarjeta":2301,"transferencia":3000},
   {"mesero_id":3,"nombre":"Luis","cuentas":1,"total":1,"efectivo":0,"tarjeta":0,"transferencia":1}],
 "propinas_por_mesa":[{"mesa_id":1,"nombre":"Mesa 1","cuentas":2,"total":8000}, …],
 "cuentas":[{"orden_id":18,"mesa_nombre":"Mesa 6","mesero_nombre":"Ana","pagada_en":"…","cobrado_por_nombre":"Caja",
             "consumo":3000,"pasadia":0,"subtotal":3000,"propina":500,"total":3500,"pagos":[{"metodo":"efectivo","monto":3500}]}, …]}
```
Detalles:
- `ventas.subtotal` = suma del `subtotal` de cada cuenta (con la regla del pasadía).
- `cuentas[]` trae además `consumo` y `pasadia` (Entrega 3, campos extra) para mostrar "(pasadía)" cuando
  `pasadia > consumo`.
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
- Propina L 50.00 con L 200.00 efectivo + L 170.50 tarjeta → efectivo 2699, tarjeta 2301.
- Propina 1 centavo con 3 formas iguales → todo a efectivo; con L 50 / L 50 / L 59.01 → a la de L 59.01.
- Propina 0 → 0 en todas; una sola forma → toda a esa forma.
Pruebas: `npm run test:reparto`.

#### `GET /api/reportes/propinas?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` — dueno
```json
{"desde":"2026-11-17","hasta":"2026-11-19","jornadas":3,"dias":3,"abiertas":0,
 "por_mesero":[{"mesero_id":3,"nombre":"Luis","cuentas":5,"total":27500,"efectivo":8000,"tarjeta":17500,"transferencia":2000}, …],
 "por_mesa":[{"mesa_id":4,"nombre":"Mesa 4","cuentas":1,"total":9000}, …]}
```
- Incluye las jornadas (abiertas o cerradas) cuya `abierta_en`, en **hora de Honduras** (`America/Tegucigalpa`),
  cae entre `desde` y `hasta` (ambos incluidos). Se usa **UTC−6 fijo**: Honduras no tiene horario de verano
  (constante `DESFASE_HONDURAS_MS` en `worker/jornadas.ts`).
  Ej.: `desde=2026-11-20` empieza en `2026-11-20T06:00:00.000Z`.
- `jornadas` = jornadas incluidas · `dias` = días **distintos** con corte (fecha de `abierta_en` en hora de
  Honduras; dos jornadas el mismo día cuentan 1) · `abiertas` = cuántas de esas jornadas siguen abiertas (sus
  propinas son parciales; la pantalla puede avisarlo).
- Mismas reglas de propinas que el corte (reparto por forma de pago, quién aparece, orden).
- 400 "Indica las fechas "desde" y "hasta" con el formato AAAA-MM-DD." (faltan, formato o fecha inexistente como 2026-02-30) ·
  "La fecha "desde" no puede ser posterior a "hasta"." · "El rango máximo es de 93 días." (contando ambos extremos).

### 5.4 Cómo probar (local)
```bash
npm run db:reset          # migraciones + datos de ejemplo (3 jornadas cerradas, hoy sin jornada). Con wrangler APAGADO.
npm run dev:api           # http://localhost:8787
npm run test:reparto      # pruebas del reparto de propinas
TOKEN=$(curl -s -XPOST localhost:8787/api/login -H 'content-type: application/json' \
  -d '{"usuario_id":5,"pin":"4444"}' | sed 's/.*"token":"\([0-9a-f]*\)".*/\1/')
curl -s localhost:8787/api/jornada/actual -H "authorization: Bearer $TOKEN"              # {"jornada":null}
curl -s -XPOST localhost:8787/api/jornada/abrir -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"fondo":100000}'
curl -s localhost:8787/api/jornadas/ultima-cerrada -H "authorization: Bearer $TOKEN"      # corte de ayer
```

---

## 6. Entrega 3 — Menú real, pasadía y panel del dueño

Contrato: `docs/proyecto.md`, sección "Entrega 3: el restaurante real y el panel del dueño". Código:
`worker/menu.ts` (menú, categorías, productos, agotado), `worker/admin.ts` (mesas y usuarios),
`worker/montos.ts` (consumo / pasadía / subtotal, **único lugar**), `worker/texto.ts` (limpieza de textos y
`claveNombre`), cambios en `worker/restaurante.ts` y `worker/jornadas.ts`. Migración
`migrations/0007_menu_real_y_panel.sql`.

### 6.1 Estructura de datos (migración 0007)

| Tabla | Campos | Notas |
|---|---|---|
| `categorias` (nueva) | id, nombre, nombre_clave, orden, va_a_cocina (0/1), activa (0/1) | Nombre único entre las **activas**. |
| `productos` (reconstruida) | id, categoria_id → categorias, nombre, nombre_clave, descripcion (≤ 140), precio (**nullable**), precio_abierto (0/1), agotado (0/1), activo (0/1), orden, es_pasadia (0/1), opciones (JSON, lista de textos) | Ya no tiene el texto `categoria` (sale de `categorias`). CHECK: con `precio_abierto = 1` el `precio` es NULL; `opciones` debe ser un arreglo JSON. Nombre único entre los productos **activos de la misma categoría**. |
| `variantes` (nueva) | id, producto_id → productos, nombre, nombre_clave, precio (≥ 1), orden, activa (0/1) | Quitar una variante desde el panel la desactiva. Nombre único entre las activas del mismo producto. |
| `mesas` (reconstruida) | id, nombre, nombre_clave, activo, orden | Antes el nombre era único en toda la tabla; ahora solo entre las **activas** (así se puede crear "Mesa 15" aunque exista una "Mesa 15" desactivada). |
| `usuarios` | + nombre_clave | Nombre único entre los **activos**. |
| `items` | + variante, opcion, va_a_cocina (0/1, por omisión 1), es_pasadia (0/1, por omisión 0) | Se copian del menú al enviar, como el nombre y el precio. |

- **Forma de precio** de un producto (exactamente una): precio fijo (`precio`), variantes (`precio` NULL y al
  menos una variante activa) o precio abierto (`precio_abierto = 1`, `precio` NULL). La base protege la
  combinación precio + precio abierto; que haya variantes lo revisa el Worker.
- **`nombre_clave`** = nombre sin mayúsculas, sin acentos (también ü, ñ, ç) y con espacios simples
  ("Dueño" → "dueno", "Mesa  1" → "mesa 1"). La calcula el Worker (`claveNombre` en `worker/texto.ts`) y la base
  impide claves repetidas entre los activos con índices únicos parciales (`... WHERE activo = 1`), a prueba de
  dos dueños guardando a la vez.
- **Migración sobre datos viejos** (probada con la base de la Entrega 2 + una cuenta abierta con platillos):
  crea una categoría por cada texto distinto de `productos.categoria` (orden alfabético; `Bebidas`, `Bar` y
  `Actividades` con `va_a_cocina = 0`, las demás 1), conserva ids de productos y mesas (`orden` de mesas = id,
  de productos = alfabético dentro de su categoría), calcula `nombre_clave` en SQL y deja los items viejos con
  `va_a_cocina = 1` (sí fueron a cocina) y `es_pasadia = 0`. `PRAGMA foreign_key_check` queda limpio y la
  cuenta abierta se cobró después con el código nuevo.

Triggers nuevos o cambiados (reglas que protege la base aunque dos personas actúen a la vez):

| Trigger | Regla | Error que traduce el Worker |
|---|---|---|
| `trg_ordenes_cierre_cuadra` (cambiado) | Al cobrar: pagos = **max(consumo, pasadía)** + propina | 409 "La cuenta cambió mientras se cobraba…" |
| `trg_items_producto_disponible` | Solo se insertan items de productos activos, no agotados y de categoría activa | 409 "Uno de los platillos se agotó o cambió en este momento. Actualiza el menú e intenta de nuevo." |
| `trg_ordenes_mesa_activa` | No se abren cuentas en mesas desactivadas | 404 "No se encontró esa mesa." |
| `trg_mesas_no_desactivar_con_cuenta` | No se desactiva una mesa con cuenta abierta | 409 (ver 6.7) |
| `trg_usuarios_ultimo_dueno` | Siempre queda al menos un dueño activo | 409 (ver 6.8) |

### 6.2 Tipos (como en el contrato)

```ts
interface Variante { id: number; nombre: string; precio: number }
interface Producto {
  id: number; categoria_id: number; categoria: string;   // nombre de la categoría
  nombre: string; descripcion: string | null;
  precio: number | null;        // null si tiene variantes o precio abierto
  precio_abierto: boolean; variantes: Variante[]; opciones: string[];
  agotado: boolean; es_pasadia: boolean;
}
interface CategoriaMenu { id: number; nombre: string; orden: number; va_a_cocina: boolean; productos: Producto[] }
interface ItemComanda {
  id: number; producto_id: number; nombre: string;   // ya compuesto
  variante: string | null; opcion: string | null;
  precio: number; cantidad: number; nota: string | null;
  va_a_cocina: boolean; es_pasadia: boolean;
}
// Orden: + consumo, pasadia; subtotal = max(consumo, pasadia); total = subtotal + propina.
// CuentaCorte (corte): + consumo, pasadia (extra).
```

### 6.3 `GET /api/menu` — todos

Categorías **activas** en su `orden` (también las que no tienen productos: `productos: []`); en cada una sus
productos **activos** en su `orden`, **incluidos los agotados** (`agotado: true`); variantes activas en su orden.
No incluye productos inactivos ni categorías inactivas.

```json
{"categorias":[
  {"id":6,"nombre":"Pescado","orden":6,"va_a_cocina":true,"productos":[
    {"id":25,"categoria_id":6,"categoria":"Pescado","nombre":"Pescado rojo","descripcion":"Según tamaño",
     "precio":null,"precio_abierto":false,
     "variantes":[{"id":5,"nombre":"Talla 1","precio":34500},{"id":6,"nombre":"Talla 2","precio":40250}, …],
     "opciones":[],"agotado":false,"es_pasadia":false}, …]},
  {"id":13,"nombre":"Actividades","orden":13,"va_a_cocina":false,"productos":[
    {"id":75,"categoria_id":13,"categoria":"Actividades","nombre":"Pasadía",
     "descripcion":"Por persona. Consumible: consumo mínimo de la cuenta","precio":30000,"precio_abierto":false,
     "variantes":[],"opciones":[],"agotado":false,"es_pasadia":true}, …]}]}
```
Langosta: `"precio":null,"precio_abierto":true,"opciones":["En mantequilla","Al ajillo"]`.

### 6.4 `POST /api/ordenes/:id/comandas` — mesero, dueno (cambios)

Cada item: `{ producto_id, variante_id?, opcion?, precio?, cantidad, nota? }` (`null` = no mandado; `opcion`
se limpia de espacios y `""` cuenta como no mandada).

```json
{ "envio_id": "3f0c2a8e-6b1d-4c7a-9e55-0d2f4b8a1c33", "items": [
  { "producto_id": 25, "variante_id": 7, "cantidad": 2, "nota": "bien dorado" },
  { "producto_id": 11, "opcion": "Camarón", "cantidad": 1 },
  { "producto_id": 17, "opcion": "Al ajillo", "precio": 150000, "cantidad": 1 },
  { "producto_id": 65, "opcion": "Salvavida", "cantidad": 3 } ] }
```
Items guardados (en la respuesta `Orden`):
```json
{"nombre":"Pescado rojo · Talla 3","variante":"Talla 3","opcion":null,"precio":46000,"va_a_cocina":true,"es_pasadia":false, …}
{"nombre":"Mar y tierra (Camarón)","variante":null,"opcion":"Camarón","precio":57500,"va_a_cocina":true, …}
{"nombre":"Langosta (Al ajillo)","variante":null,"opcion":"Al ajillo","precio":150000,"va_a_cocina":true, …}
{"nombre":"Cerveza nacional (Salvavida)","variante":null,"opcion":"Salvavida","precio":4720,"va_a_cocina":false, …}
```
- **Nombre compuesto:** `producto` + `" · " + variante` (si hay) + `" (" + opción + ")"` (si hay).
- **Precio del item:** el de la variante; o el escrito (precio abierto); o el precio fijo del producto.
- `va_a_cocina` se copia de la **categoría**; `es_pasadia` del producto.

Errores 400 (el primer renglón con problema; `X` = nombre del producto en el menú):

| Caso | Mensaje |
|---|---|
| Producto inexistente | "Uno de los platillos ya no está en el menú. Actualiza el menú." |
| Producto inactivo o de categoría inactiva | "Ya no está disponible: X. Quítalo del pedido." |
| Agotado | "Se agotó: X. Quítalo del pedido." (ej. "Se agotó: King crab. Quítalo del pedido.") |
| Tiene variantes y no se mandó `variante_id` | "Elige la porción o tamaño de: X." |
| `variante_id` que no es (activa) de ese producto | "Esa porción ya no existe para: X. Actualiza el menú y elige otra." |
| `variante_id` en un producto sin variantes | "X no tiene porciones. Quita la porción elegida." |
| Tiene opciones y no se mandó `opcion` | "Elige una opción para: X (Carne, Camarón, Caracol)." |
| `opcion` que no está en la lista (comparación exacta) | `La opción "Pulpo" no existe para: X. Elige: Carne, Camarón, Caracol.` |
| `opcion` en un producto sin opciones | "X no lleva opciones. Quita la opción elegida." |
| Precio abierto sin `precio` | "Escribe el precio de: X." |
| `precio` no entero, ≤ 0 | "El precio debe ser un número entero de centavos mayor a cero." (> 100,000,000: "El monto es demasiado grande. El máximo es L 1,000,000.00.") |
| `precio` en un producto que no es de precio abierto | "El precio de X lo pone el menú. No mandes precio para este platillo." |

- Si el producto se agota o se desactiva **justo** entre la revisión y el guardado, el trigger
  `trg_items_producto_disponible` deshace todo el envío → **409** "Uno de los platillos se agotó o cambió en este
  momento. Actualiza el menú e intenta de nuevo."
- Un reintento con el mismo `envio_id` sigue respondiendo 200 con la orden **antes** de revisar el menú (aunque
  el producto se haya agotado entre intentos).

**Comandas sin platillos de cocina (decisión):** si ningún item del envío va a cocina (solo Bebidas, Bar,
Actividades…), la comanda se crea **ya como `listo`** con `listo_en = creada`. Así no queda nada "pendiente" que
estorbe y Cocina nunca la ve (ver 6.5). En la `Orden` del mesero aparece igual que las demás; la pantalla debe
mostrar los items con `va_a_cocina: false` como **"No va a cocina"** (sin mirar el estado de la comanda). En una
comanda mixta, `estado` se refiere solo a sus items de cocina.

### 6.5 Cocina

- `GET /api/cocina`: solo comandas con al menos un item `va_a_cocina = true`; de cada una, `items` trae **solo**
  los de cocina. Mismo orden y ventana de 30 min que antes.
- `POST /api/comandas/:id/listo|pendiente`: responden la comanda con solo sus items de cocina. Una comanda sin
  items de cocina → **404** "No se encontró esa comanda." (para Cocina no existe; su estado nunca cambia).

### 6.6 Pasadía (consumo mínimo)

`consumo` = items no pasadía; `pasadia` = items de pasadía; **`subtotal = max(consumo, pasadia)`**; la propina
se calcula (en pantalla) sobre `subtotal`; el cobro exige `pagos = subtotal + propina`.

| Cuenta | consumo | pasadia | subtotal |
|---|---|---|---|
| 4 × Pasadía (L 300) + 4 × Piscina adultos + 3 × Kayak | 90000 | 120000 | **120000** ("Pasadía L 1,200.00 · Consumo L 900.00 → se cobra L 1,200.00") |
| 4 × Pasadía + Langosta L 1,500 | 150000 | 120000 | **150000** ("Consumo L 1,500.00 (incluye pasadía de L 1,200.00)") |

`MesaResumen.total`, la lista de caja, `cuentas_abiertas[].total` del cierre, el corte (`ventas.subtotal`,
`cuentas[].subtotal`), el historial y el reporte de propinas usan este `subtotal`.

### 6.7 Panel del dueño — menú

Todas las direcciones `/api/admin/*` son **solo `dueno`** (mesero, cocina y caja → 403). Textos: se limpian
caracteres de control y espacios repetidos. Nombres 1–60 caracteres; descripción hasta 140 (vacía → `null`);
precios enteros 1–100,000,000; 0–12 variantes y 0–12 opciones (textos 1–60, sin repetir sin distinguir
mayúsculas/acentos). Campos booleanos deben ser `true`/`false` (si no, 400). Campos desconocidos se ignoran.
Crear responde **201**; editar 200.

#### `GET /api/admin/menu`
`{ categorias: (CategoriaMenu & { activa; productos: (Producto & { activo; orden })[] })[] }`: **todas** las
categorías (activas e inactivas) en su orden, cada una con **todos** sus productos (también inactivos) en su orden.
Variantes: solo las activas.

#### `POST /api/admin/categorias` — `{ nombre, va_a_cocina? }`
`va_a_cocina` por omisión `true`. Queda activa, **al final** del orden. Responde la categoría con la forma de
`GET /api/admin/menu` (`{ id, nombre, orden, va_a_cocina, activa, productos: [] }`).
- 400 "Escribe el nombre de la categoría." · "El nombre de la categoría no puede tener más de 60 caracteres." ·
  "Indica si la categoría va a cocina (sí o no)."
- 409 "Ya existe una categoría con ese nombre." (entre las activas, sin distinguir mayúsculas/acentos)

#### `PUT /api/admin/categorias/:id` — `{ nombre?, va_a_cocina?, activa? }`
Responde la categoría (con sus productos). 404 "No se encontró esa categoría." · 409 nombre repetido (también al
**reactivar** si ya hay otra activa con ese nombre). Desactivar una categoría la quita de `GET /api/menu` y sus
productos ya no se pueden pedir (los productos conservan su propio `activo`). Cambiar `va_a_cocina` solo afecta
a los envíos siguientes.

#### `POST /api/admin/categorias/orden` — `{ ids: number[] }`
**Todas** las categorías (también inactivas), cada una una vez, en el nuevo orden (`orden` = 1, 2, 3…).
`{ "ok": true }`. 400 "Manda todas las categorías (también las inactivas), cada una una sola vez, en el nuevo orden."

#### `POST /api/admin/productos`
```json
{ "categoria_id": 14, "nombre": "Pastel", "descripcion": "Casero",
  "variantes": [{ "nombre": "Porción", "precio": 8000 }, { "nombre": "Entero", "precio": 60000 }] }
{ "categoria_id": 14, "nombre": "Flan de coco", "precio": 9000 }
{ "categoria_id": 14, "nombre": "Postre del día", "precio_abierto": true, "opciones": ["Chocolate", "Vainilla"] }
```
Queda activo, no agotado, al final de su categoría. Responde el producto (forma admin, con `activo` y `orden`).
- Exactamente **una** forma de precio:
  - ninguna → 400 "Indica el precio del producto, sus porciones (variantes) o márcalo como precio abierto."
  - más de una → 400 "Un producto lleva una sola forma de precio: precio fijo, porciones (variantes) o precio abierto. Quita las otras."
- 400 "Elige la categoría del producto." · "Esa categoría no existe. Recarga el menú." · "Escribe el nombre del producto." ·
  "La descripción no puede tener más de 140 caracteres." · "El precio debe ser un número entero de centavos mayor a cero." ·
  "Un producto puede tener máximo 12 porciones (variantes)." · "Un producto puede tener máximo 12 opciones." ·
  "Hay dos porciones con el mismo nombre: X." · "Hay dos opciones iguales: X." · `El precio de la porción "X" debe ser…`
- 409 "Ya existe un producto activo con ese nombre en esa categoría."
- `opciones: null` = `[]`; `variantes: null` = `[]`; `es_pasadia` por omisión `false`.

#### `PUT /api/admin/productos/:id`
Mismos campos, todos opcionales, más `activo`. Lo que no viene **se conserva**; la regla de "una sola forma de
precio" se revisa sobre el resultado. Para cambiar de forma hay que quitar la anterior en la misma petición:
- a precio fijo: `{ "precio": 5000, "variantes": [], "precio_abierto": false }` (lo que aplique);
- a precio abierto: `{ "precio": null, "precio_abierto": true }`;
- a variantes: `{ "precio": null, "variantes": [ … ] }`.

`variantes` **reemplaza la lista completa**: las que traen `id` (de este producto) se actualizan (nombre, precio,
orden = posición en la lista); las que no traen `id` se crean; las que no vienen se **desactivan**. Un `id` que
no es de este producto → 400 `La porción "X" no corresponde a este producto. Recarga el menú.`
Cambiar `categoria_id` lo mueve **al final** de la otra categoría. `activo: false` = "eliminar" (nunca se borra;
desaparece de `GET /api/menu`, sigue en `GET /api/admin/menu`). 404 "No se encontró ese producto." · 409 nombre
repetido (también al reactivar). `agotado` **no** se cambia aquí (ver abajo).

#### `POST /api/admin/productos/orden` — `{ categoria_id, ids }`
Todos los productos de esa categoría (también inactivos), en el nuevo orden. `{ "ok": true }`.
404 "No se encontró esa categoría." · 400 "Manda todos los productos de la categoría (también los inactivos), cada uno una sola vez, en el nuevo orden."

#### `POST /api/productos/:id/agotado` — dueno, cocina, caja
`{ "agotado": true | false }` → responde el `Producto` (forma pública). Repetible. 400 "Indica si el producto
está agotado (sí o no)." · 404 "No se encontró ese producto." · mesero → 403. Un producto agotado sigue en
`GET /api/menu` con `agotado: true` y no se puede pedir.

**Cambiar nombres o precios no altera cuentas ni cortes existentes** (los items guardan su copia). Nota: el
nombre de **mesa** y de **mesero** que se ve en cuentas y cortes viejos sí es el actual (se leen de `mesas` y
`usuarios`); renombrar "Mesa 3" cambia cómo aparece en el historial.

### 6.8 Panel del dueño — mesas y usuarios

#### `GET /api/admin/mesas`
`[{ "id":1, "nombre":"Mesa 1", "activa":true, "orden":1, "tiene_cuenta_abierta":false }, …]` — todas, por `orden`
y id. (Las pantallas ordenan "desactivadas al final" si lo desean.)

#### `POST /api/admin/mesas` — `{ nombre }`
Activa, al final del orden. **201** con la mesa (forma de arriba). 400 "Escribe el nombre de la mesa." ·
409 "Ya existe una mesa activa con ese nombre." (sin distinguir mayúsculas/acentos/espacios: "mesa  1" = "Mesa 1").

#### `PUT /api/admin/mesas/:id` — `{ nombre?, activa? }`
Responde la mesa. 404 "No se encontró esa mesa." · 409 nombre repetido (también al reactivar) ·
**409 "No se puede desactivar: la mesa tiene una cuenta abierta. Cóbrala o cancélala primero."** (lo vuelve a
revisar el trigger en el mismo instante). Una mesa desactivada desaparece de `GET /api/mesas` y no se le pueden
abrir cuentas (404).

#### `POST /api/admin/mesas/orden` — `{ ids }` (extra, no está en el contrato)
Todas las mesas en el nuevo orden; `{ "ok": true }`. `GET /api/mesas` usa ese orden.

#### `GET /api/admin/usuarios`
`[{ "id":1, "nombre":"Dueño", "rol":"dueno", "activo":true, "sesiones_abiertas":1 }, …]` — todos, por id.
`sesiones_abiertas` = sesiones no vencidas (aparatos donde está conectado).

#### `POST /api/admin/usuarios` — `{ nombre, rol, pin }`
`pin` = texto de 4 dígitos (se guarda como hasta ahora: SHA-256(sal + pin) con sal aleatoria de 16 bytes).
**201** con el usuario (forma de arriba). 400 "Escribe el nombre de la persona." · "El rol debe ser mesero,
cocina, caja o dueno." · "El PIN debe tener 4 dígitos." · 409 "Ya existe un usuario activo con ese nombre."

#### `PUT /api/admin/usuarios/:id` — `{ nombre?, rol?, activo? }`
Responde el usuario. Reglas:
- **Uno mismo:** 409 "No puedes cambiar tu propio rol." · 409 "No puedes desactivarte a ti mismo." (renombrarse sí).
- **Último dueño activo:** 409 "Debe quedar al menos un dueño activo. No se le puede quitar el rol ni desactivar
  al último." (trigger `trg_usuarios_ultimo_dueno`). Por la API solo puede pasar en carreras, porque quien hace la
  petición siempre es un dueño activo; en el caso normal sale antes el 409 de "uno mismo".
- **Cambiar el rol** (a uno distinto) **o desactivar** cierra todas sus sesiones (en la misma transacción); su
  siguiente petición recibe 401. Cambiar solo el nombre no cierra sesiones.
- 404 "No se encontró ese usuario." · 409 nombre repetido (también al reactivar).

#### `POST /api/admin/usuarios/:id/pin` — `{ pin }`
Cambia el PIN, quita el bloqueo por PIN incorrecto y **cierra todas las sesiones** de ese usuario — también la
del dueño que lo cambia si es su propio PIN (debe volver a entrar con el nuevo). `{ "ok": true }`.
400 "El PIN debe tener 4 dígitos." · 404 "No se encontró ese usuario."

### 6.9 Lempiras y Honduras

- Mensajes con dinero: `L 1,234.50` (función `lempiras` en `worker/http.ts`). Máximo por precio, pago, propina,
  fondo o salida: L 1,000,000.00.
- Denominaciones del cierre: ver 5.3 (`POST /api/jornada/cerrar`). La tolerancia "Cuadra ✓" (< L 1.00) es de
  pantallas; el servidor sigue mandando la `diferencia` exacta.
- Reporte de propinas: días en hora de Honduras (`America/Tegucigalpa`, UTC−6 fijo).

### 6.10 Cómo probar (local)

```bash
npm run typecheck && npm run test:reparto
npm run db:reset          # con wrangler APAGADO
npm run dev:api           # http://localhost:8787
B=localhost:8787/api
TOK=$(curl -s -XPOST $B/login -H 'content-type: application/json' -d '{"usuario_id":2,"pin":"1111"}' | sed 's/.*"token":"\([0-9a-f]*\)".*/\1/')
curl -s $B/menu -H "authorization: Bearer $TOK"
ORD=$(curl -s -XPOST $B/ordenes -H "authorization: Bearer $TOK" -H 'content-type: application/json' -d '{"mesa_id":5}' | sed 's/^{"id":\([0-9]*\).*/\1/')
# 4 pasadías + Langosta de L 1,500 → consumo 150000, pasadia 120000, subtotal 150000
curl -s -XPOST $B/ordenes/$ORD/comandas -H "authorization: Bearer $TOK" -H 'content-type: application/json' \
  -d '{"items":[{"producto_id":75,"cantidad":4},{"producto_id":17,"opcion":"Al ajillo","precio":150000,"cantidad":1}]}'
```
(Ids del seed: Pasadía 75, Langosta 17, Pescado rojo 25 con variantes 5–9, Mar y tierra 11, King crab 16.)
