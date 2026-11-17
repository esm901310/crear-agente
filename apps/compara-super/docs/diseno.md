# Compara Súper — Documento de diseño (v1)

> App web instalable (PWA) solo para celular. Pensada para usarse con una mano,
> de pie en el pasillo del súper. Público: personas en Honduras. Moneda: lempiras.
> Estilo: sencillo y limpio, mucho blanco, un solo color de acento, botones grandes.

---

## 0. Nombre de la app

Nombre provisional: **Compara Súper**

Alternativas propuestas:

1. **Canasta Lista** — habla de la lista y de la canasta básica; suena cercano.
2. **¿Dónde Sale?** — como se pregunta en Honduras: "¿dónde sale más barato?".
3. **Ahorrito** — cálido, corto, fácil de recordar y de escribir.

(El resto del documento usa "Compara Súper"; cambiar el nombre solo afecta la
pantalla de bienvenida, el título de la app instalada y el ícono.)

---

## 1. Principios de diseño

1. **Una mano, pulgar abajo.** Las acciones principales siempre van en la parte
   inferior de la pantalla (botón fijo abajo). Arriba solo títulos y acciones
   secundarias.
2. **Un color manda.** El verde de acento se usa solo para: botón principal,
   "más barato" y "ahorras". Así el ojo encuentra rápido la respuesta.
3. **Los números son lo importante.** Precios grandes, alineados a la derecha,
   con cifras de ancho fijo para que se puedan comparar en columna.
4. **El supermercado se reconoce por su nombre**, nunca solo por color.
   No se usan logos oficiales.
5. **Nada se rompe por un súper.** Si un supermercado falla, los otros dos se
   muestran igual y se explica qué pasó.
6. **Textos cortos, de tú, sin tecnicismos.**

---

## 2. Estilo visual

### 2.1 Colores

Todos los pares de texto/fondo cumplen como mínimo WCAG AA (4.5:1 para texto
normal). Contrastes calculados contra el fondo indicado.

| Uso | Nombre | Hex | Sobre | Contraste aprox. |
|---|---|---|---|---|
| Fondo principal | Blanco | `#FFFFFF` | — | — |
| Fondo secundario (zonas, barra inferior) | Gris nube | `#F5F7F8` | — | — |
| Bordes y divisores | Gris borde | `#D5DAE0` | — | (no es texto) |
| Texto principal | Tinta | `#1A1F24` | Blanco | 16.5:1 |
| Texto secundario (marca, presentación, avisos) | Pizarra | `#4A5560` | Blanco | 7.6:1 |
| **Acento** (botón principal, "más barato") | Verde ahorro | `#0F7A4F` | Blanco (texto blanco encima) | 5.4:1 |
| Acento presionado | Verde oscuro | `#0B5E3C` | Blanco | 7.6:1 |
| Fondo suave de acento (tarjeta ganadora, insignia) | Verde menta | `#E7F5EE` | — | — |
| Texto sobre verde menta | Verde oscuro | `#0B5E3C` | `#E7F5EE` | 7.0:1 |
| Aviso "no disponible" (texto) | Ámbar oscuro | `#8A4B00` | `#FFF4E0` | 6.3:1 |
| Aviso "no disponible" (fondo) | Ámbar claro | `#FFF4E0` | — | — |
| Error (texto) | Rojo | `#B42318` | Blanco / `#FDECEA` | 6.6:1 / 5.8:1 |
| Error (fondo) | Rojo claro | `#FDECEA` | — | — |
| Foco de teclado / accesibilidad | Azul foco | `#1D5FD1` | Blanco | 6.1:1 |

**Etiquetas de supermercado** (colores neutros, inventados, no son colores de
marca). Siempre van con el nombre escrito y unas iniciales dentro de un círculo:

| Supermercado | Iniciales | Color de la etiqueta | Texto encima |
|---|---|---|---|
| La Colonia | **LC** | Azul pizarra `#3B5B7A` | Blanco (7.1:1) |
| Colonial | **CL** | Ciruela `#6B4C7A` | Blanco (7.1:1) |
| Comisariato Los Andes | **LA** | Café tierra `#7A5A2E` | Blanco (6.3:1) |

Nombre corto para espacios estrechos: "La Colonia", "Colonial", "Los Andes".
Nombre completo en títulos y detalle: "Comisariato Los Andes".

Regla: el verde de acento **nunca** se usa como color de supermercado, para no
confundir "este súper" con "el más barato".

### 2.2 Tipografía

- Familia: **Inter** (gratuita), con respaldo del sistema:
  `Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- Números de precio con **cifras tabulares** (mismo ancho) para que se alineen.
- Tamaño base: 17 px (más grande de lo habitual: se lee de pie y con prisa).
- Debe respetar el tamaño de letra que la persona tenga configurado en su
  celular (hasta 200 % sin que se corte el contenido).

| Estilo | Tamaño / interlineado | Peso | Uso |
|---|---|---|---|
| Título de pantalla | 24 / 30 px | 700 | "Mi lista", "¿Dónde te sale más barato?" |
| Total grande | 32 / 38 px | 700 | Total del súper ganador |
| Subtítulo | 20 / 26 px | 600 | Nombre del súper en tarjetas |
| Cuerpo | 17 / 24 px | 400 | Nombres de productos, textos |
| Cuerpo fuerte | 17 / 24 px | 600 | Precios en filas |
| Secundario | 15 / 20 px | 400 | Marca, presentación, avisos |
| Mínimo permitido | 14 / 20 px | 500 | Insignias ("Más barato"), fecha de consulta |

Nunca usar texto menor a 14 px.

### 2.3 Formato de precios y fechas

- Precio: `L 45.90` (L, espacio, dos decimales, punto decimal).
  Miles con coma: `L 1,245.00`.
- Ahorro: `Ahorras L 87.40`.
- Fecha de consulta: `Precios consultados hoy a las 10:45 a. m.`;
  si no es hoy: `Precios consultados el 15 nov, 6:20 p. m.`

### 2.4 Espaciado, forma y tamaños

- Unidad base: **4 px**. Escala: 4, 8, 12, 16, 24, 32, 48.
- Margen lateral de pantalla: **16 px**.
- Separación entre tarjetas: 12 px. Relleno interno de tarjetas: 16 px.
- Esquinas: tarjetas 12 px; botones 12 px; insignias y etiquetas: totalmente
  redondeadas.
- Sombras: casi ninguna. Las tarjetas se separan con borde `#D5DAE0` de 1 px.
  La tarjeta ganadora usa borde de 2 px `#0F7A4F` y fondo `#E7F5EE`.
- **Zona táctil mínima: 48 × 48 px** en todo lo que se toca, con al menos 8 px
  entre zonas táctiles.
- Botón principal: alto 56 px, ancho completo (menos márgenes).
- Barra inferior fija: 16 px de relleno + espacio seguro del celular.

### 2.5 Tono de los textos

Cálido, directo, de tú, en español neutro. Frases cortas. Sin culpas
("No pudimos…", no "Usted cometió un error"). Ejemplos de tono:
- Sí: "Listo, agregamos Arroz Progreso 5 lb."
- No: "El ítem ha sido incorporado exitosamente a su lista."

---

## 3. Componentes

| Componente | Descripción |
|---|---|
| **Botón principal** | Fondo `#0F7A4F`, texto blanco 17 px peso 600, alto 56 px, ancho completo. Presionado: `#0B5E3C`. Deshabilitado: fondo `#D5DAE0`, texto `#4A5560`. |
| **Botón secundario** | Fondo blanco, borde 1.5 px `#0F7A4F`, texto `#0B5E3C`, alto 48–56 px. |
| **Botón de texto** | Solo texto `#0B5E3C` subrayado al tocar, zona táctil 48 px. |
| **Campo de texto** | Alto 56 px, borde `#D5DAE0`, etiqueta arriba (no dentro), foco con borde 2 px `#1D5FD1`. Error: borde `#B42318` + mensaje debajo con ícono. |
| **Buscador** | Campo de texto con ícono de lupa a la izquierda y botón "×" para borrar a la derecha. |
| **Etiqueta de súper** | Círculo de 28 px con iniciales (LC / CL / LA) en blanco + nombre al lado. |
| **Selector de cantidad** | `[ − ]  2  [ + ]`. Botones de 48 × 48 px, número 20 px peso 600 al centro. Al bajar de 1 se pregunta si quitar el producto. |
| **Insignia "Más barato"** | Fondo `#0F7A4F`, texto blanco 14 px peso 600, ícono de check. |
| **Insignia "No disponible"** | Fondo `#FFF4E0`, texto `#8A4B00` 14 px, ícono de círculo con línea. Texto: "No disponible". |
| **Insignia "Sustituto"** | Fondo `#F5F7F8`, borde `#D5DAE0`, texto `#4A5560`: "Sustituto". |
| **Tarjeta de súper** (resultado) | Etiqueta del súper, total grande, línea de estado (completa / faltan N), botón "Ver detalle". |
| **Fila de producto** | Nombre (17 px), marca y presentación (15 px gris), cantidad, precio a la derecha. |
| **Aviso de error de súper** | Banda dentro de la tarjeta, fondo `#FDECEA`, texto `#B42318`, botón "Reintentar". |
| **Esqueleto de carga** | Barras grises `#F5F7F8` con brillo suave donde irá el precio. Respeta "reducir movimiento" (sin animación). |
| **Hoja inferior** | Panel que sube desde abajo, esquinas superiores 16 px, con asa gris arriba. Para sustitutos y confirmaciones. |
| **Mensaje breve (toast)** | Aparece abajo, encima del botón fijo, 4 s. Fondo `#1A1F24`, texto blanco. Puede llevar "Deshacer". |
| **Aviso de precios** | Texto 14 px `#4A5560` con ícono de reloj: "Precios consultados hoy a las 10:45 a. m. Pueden variar en tienda." |

Íconos: trazo simple de 24 px (estilo línea), siempre acompañados de texto o con
etiqueta accesible para lectores de pantalla.

---

## 4. Lista de pantallas

| # | Pantalla | Para qué sirve |
|---|---|---|
| P1 | Bienvenida | Explicar en una frase qué hace la app y llevar a crear cuenta o entrar. |
| P2 | Crear cuenta | Registro con correo y contraseña. |
| P3 | Iniciar sesión | Entrar con correo y contraseña. |
| P4 | Recuperar contraseña | Pedir un enlace para cambiar la contraseña. |
| P5 | Mi lista (inicio) | Ver y editar la lista, cantidades y un resumen de dónde sale más barato. Incluye estado vacío. |
| P6 | Agregar producto | Buscar ("arroz") y escoger el producto exacto comparando los 3 súper. |
| P7 | Resultado: ¿Dónde te sale más barato? | Total por supermercado, ganador resaltado, ahorro. |
| P8 | Detalle por supermercado | Producto por producto en un súper, con faltantes y sustitutos. |
| P9 | Elegir sustituto (hoja inferior) | Escoger un producto parecido cuando falta en un súper. |
| P10 | Mi cuenta | Correo, cerrar sesión, borrar cuenta, sobre los precios. |

---

## 5. Flujo

```
                 ┌──────────────┐
  (primera vez)  │ P1 Bienvenida│
                 └──┬────────┬──┘
     "Crear cuenta" │        │ "Ya tengo cuenta"
                    v        v
           ┌──────────┐   ┌──────────────┐  "¿Olvidaste tu contraseña?"  ┌──────────────┐
           │P2 Crear  │<->│P3 Iniciar    │ ───────────────────────────>  │P4 Recuperar  │
           │  cuenta  │   │   sesión     │ <───── "Volver a entrar" ──── │  contraseña  │
           └────┬─────┘   └──────┬───────┘                               └──────────────┘
                │ "Crear mi cuenta" │ "Entrar"
                v                   v
            ┌───────────────────────────┐   ícono de persona  ┌────────────┐
  (ya con   │       P5 Mi lista         │ ──────────────────> │P10 Mi cuenta│
   sesión)─>│ (vacía o con productos)   │ <──── "Volver" ──── └────────────┘
            └──┬──────────────────┬─────┘
   "+ Agregar  │                  │ "Ver dónde sale más barato"
    producto"  v                  v
     ┌──────────────────┐   ┌───────────────────────┐ "Ver detalle" ┌────────────────────┐
     │P6 Agregar        │   │P7 Resultado           │ ────────────> │P8 Detalle por súper│
     │  producto        │   │                       │ <── "Volver"  │                    │
     └──────┬───────────┘   └───────────────────────┘               └─────────┬──────────┘
  "Agregar" │ (vuelve a P5 con mensaje                       "Elegir sustituto"│
            │  "Listo, agregamos…")                                            v
            v                                                     ┌────────────────────┐
         P5 Mi lista                                              │P9 Elegir sustituto │
                                                                  │  (hoja inferior)   │
                                                                  └────────────────────┘
                                                                  "Usar este" -> vuelve a P8
                                                                  con el total recalculado
```

Reglas de navegación:
- Si la persona ya tiene sesión, la app abre directo en **P5 Mi lista**.
- Botón atrás del celular siempre regresa a la pantalla anterior; desde P5 sale
  de la app.
- No hay barra de pestañas: solo hay una lista (ver mejora futura en §8).

---

## 6. Pantallas en detalle

Los bocetos están a ~360 px de ancho. `[ ]` = botón, `( )` = campo,
`▓▓▓` = esqueleto de carga.

### P1 — Bienvenida

Elementos de arriba hacia abajo:
1. Ilustración simple (carrito de línea en verde) — decorativa.
2. Título: **"Compara Súper"**
3. Texto: "Arma tu lista y te decimos en qué súper te sale más barata: La Colonia, Colonial o Comisariato Los Andes."
4. Tres puntos breves con check:
   - "Precios de los 3 súper en un solo lugar"
   - "Sabes cuánto ahorras antes de salir"
   - "Gratis"
5. (Abajo, fijo) Botón principal: **"Crear cuenta"**
6. Botón de texto: **"Ya tengo cuenta"**

```
┌────────────────────────────────────┐
│                                    │
│              (  🛒  )              │  <- ilustración de línea
│                                    │
│          Compara Súper             │
│                                    │
│  Arma tu lista y te decimos en qué │
│  súper te sale más barata: La      │
│  Colonia, Colonial o Comisariato   │
│  Los Andes.                        │
│                                    │
│  ✓ Precios de los 3 súper en un    │
│    solo lugar                      │
│  ✓ Sabes cuánto ahorras antes de   │
│    salir                           │
│  ✓ Gratis                          │
│                                    │
│                                    │
│ ┌────────────────────────────────┐ │
│ │         Crear cuenta           │ │  <- verde, 56 px
│ └────────────────────────────────┘ │
│          Ya tengo cuenta           │
└────────────────────────────────────┘
```

### P2 — Crear cuenta

1. Flecha "Volver" (arriba a la izquierda).
2. Título: **"Crea tu cuenta"**
3. Texto: "Así guardamos tu lista para la próxima vez."
4. Campo **"Correo electrónico"** — ejemplo dentro: "nombre@correo.com". Teclado de correo.
5. Campo **"Contraseña"** con botón "Mostrar" / "Ocultar". Ayuda debajo: "Mínimo 8 caracteres."
6. (Abajo, fijo) Botón principal: **"Crear mi cuenta"** (cargando: "Creando tu cuenta…").
7. Texto pequeño: "¿Ya tienes cuenta? **Entrar**"

Mensajes de error (debajo del campo, en rojo con ícono):
- Correo vacío o mal escrito: "Revisa tu correo, parece que le falta algo."
- Contraseña corta: "Tu contraseña necesita al menos 8 caracteres."
- Correo ya registrado: "Ese correo ya tiene cuenta. ¿Quieres **entrar**?"
- Sin internet: "No hay conexión. Revisa tu internet e intenta de nuevo."

```
┌────────────────────────────────────┐
│ ←                                  │
│ Crea tu cuenta                     │
│ Así guardamos tu lista para la     │
│ próxima vez.                       │
│                                    │
│ Correo electrónico                 │
│ ┌────────────────────────────────┐ │
│ │ nombre@correo.com              │ │
│ └────────────────────────────────┘ │
│                                    │
│ Contraseña                         │
│ ┌────────────────────────────────┐ │
│ │ ••••••••              Mostrar  │ │
│ └────────────────────────────────┘ │
│ Mínimo 8 caracteres.               │
│                                    │
│                                    │
│ ┌────────────────────────────────┐ │
│ │        Crear mi cuenta         │ │
│ └────────────────────────────────┘ │
│     ¿Ya tienes cuenta? Entrar      │
└────────────────────────────────────┘
```

### P3 — Iniciar sesión

1. Flecha "Volver".
2. Título: **"Qué bueno verte"**
3. Campo **"Correo electrónico"**.
4. Campo **"Contraseña"** con "Mostrar".
5. Botón de texto: "¿Olvidaste tu contraseña?"
6. (Abajo, fijo) Botón principal: **"Entrar"** (cargando: "Entrando…").
7. Texto pequeño: "¿No tienes cuenta? **Crear cuenta**"

Error de datos: banda roja arriba del botón: "El correo o la contraseña no coinciden. Intenta de nuevo."
(No decir cuál de los dos está mal.)

```
┌────────────────────────────────────┐
│ ←                                  │
│ Qué bueno verte                    │
│                                    │
│ Correo electrónico                 │
│ ┌────────────────────────────────┐ │
│ │                                │ │
│ └────────────────────────────────┘ │
│ Contraseña                         │
│ ┌────────────────────────────────┐ │
│ │                       Mostrar  │ │
│ └────────────────────────────────┘ │
│ ¿Olvidaste tu contraseña?          │
│                                    │
│ ┌────────────────────────────────┐ │
│ │            Entrar              │ │
│ └────────────────────────────────┘ │
│    ¿No tienes cuenta? Crear cuenta │
└────────────────────────────────────┘
```

### P4 — Recuperar contraseña

1. Flecha "Volver".
2. Título: **"Recupera tu contraseña"**
3. Texto: "Escribe tu correo y te enviamos un enlace para crear una nueva."
4. Campo **"Correo electrónico"**.
5. Botón principal: **"Enviar enlace"**.
6. Después de enviar, se reemplaza el contenido por:
   - Título: "Revisa tu correo"
   - Texto: "Si hay una cuenta con **nombre@correo.com**, te llegará un enlace en unos minutos. Revisa también la carpeta de correo no deseado."
   - Botón secundario: "Volver a entrar"

```
┌────────────────────────────────────┐
│ ←                                  │
│ Recupera tu contraseña             │
│ Escribe tu correo y te enviamos un │
│ enlace para crear una nueva.       │
│                                    │
│ Correo electrónico                 │
│ ┌────────────────────────────────┐ │
│ │                                │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌────────────────────────────────┐ │
│ │         Enviar enlace          │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

### P5 — Mi lista (pantalla de inicio)

**Encabezado** (no fijo):
1. Título **"Mi lista"** a la izquierda. *(Mejora futura: aquí irá el selector de listas, ver §8.)*
2. Ícono de persona a la derecha → P10 (etiqueta accesible: "Mi cuenta").
3. Subtítulo gris: "8 productos" (o "1 producto").

**Contenido:**
4. Botón secundario ancho completo: **"+ Agregar producto"** (arriba de la lista, a la vista).
5. Lista de productos. Cada fila:
   - Nombre exacto: "Arroz Progreso"
   - Debajo en gris: "Bolsa 5 lb"
   - Selector de cantidad `[ − ] 2 [ + ]`
   - A la derecha: precio más bajo encontrado de ese producto: "desde L 89.90" (gris, 15 px).
   - Si falta en algún súper, línea ámbar: "No disponible en Colonial".
   - Deslizar a la izquierda o mantener presionado muestra **"Quitar"**. (Por accesibilidad, también se quita bajando la cantidad a 0.)
6. Aviso de precios al final de la lista: "Precios consultados hoy a las 10:45 a. m. Pueden variar en tienda."

**Barra inferior fija** (fondo `#F5F7F8`, borde superior):
7. Línea de resumen: "Más barato: **La Colonia · L 812.50**" (con la etiqueta LC).
8. Botón principal: **"Ver dónde sale más barato"**.

Al quitar un producto: mensaje breve "Quitamos Arroz Progreso." con botón **"Deshacer"**.
Al bajar la cantidad de 1: hoja inferior "¿Quitar Arroz Progreso de tu lista?" — botones "Quitar" (rojo, texto) y "Dejarlo" (principal).

```
┌────────────────────────────────────┐
│ Mi lista                       (👤)│
│ 8 productos                        │
│ ┌────────────────────────────────┐ │
│ │       + Agregar producto       │ │  <- secundario
│ └────────────────────────────────┘ │
│ ────────────────────────────────── │
│ Arroz Progreso                     │
│ Bolsa 5 lb          desde L 89.90  │
│ [ − ]  2  [ + ]                    │
│ ────────────────────────────────── │
│ Frijoles rojos Kern's              │
│ Bolsa 2 lb          desde L 58.50  │
│ ⊘ No disponible en Colonial        │  <- ámbar
│ [ − ]  1  [ + ]                    │
│ ────────────────────────────────── │
│ Leche entera Sula                  │
│ Galón               desde L 98.00  │
│ [ − ]  3  [ + ]                    │
│ ────────────────────────────────── │
│ ⏱ Precios consultados hoy a las    │
│   10:45 a. m. Pueden variar en     │
│   tienda.                          │
├────────────────────────────────────┤
│ Más barato: (LC) La Colonia        │
│             L 812.50               │
│ ┌────────────────────────────────┐ │
│ │  Ver dónde sale más barato     │ │  <- verde
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

**Estado: lista vacía**
- Ilustración simple de lista en blanco.
- Título: **"Tu lista está vacía"**
- Texto: "Agrega lo que vas a comprar y te decimos en qué súper te sale más barato."
- Botón principal (abajo, fijo): **"Agregar mi primer producto"**
- No se muestra resumen ni aviso de precios.

```
┌────────────────────────────────────┐
│ Mi lista                       (👤)│
│                                    │
│                                    │
│             ┌──────┐               │
│             │ ──── │               │
│             │ ──── │               │
│             └──────┘               │
│                                    │
│        Tu lista está vacía         │
│                                    │
│   Agrega lo que vas a comprar y te │
│   decimos en qué súper te sale más │
│   barato.                          │
│                                    │
│                                    │
│ ┌────────────────────────────────┐ │
│ │   Agregar mi primer producto   │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

**Estado: actualizando precios** (al abrir la app con una lista ya armada)
- Las filas se ven normales, pero el "desde L …" se reemplaza por una barra de esqueleto.
- La barra inferior dice: "Buscando los precios de hoy…" y el botón principal queda deshabilitado con el texto "Buscando precios…".
- Si tarda más de 8 segundos: "Esto está tardando más de lo normal. Seguimos buscando."

### P6 — Agregar producto

Pantalla completa (no hoja) para tener espacio y teclado.

1. Encabezado: flecha "Volver" + título **"Agregar producto"**.
2. Buscador con el teclado abierto automáticamente. Ejemplo dentro: "Busca, por ejemplo: arroz, leche, café".
3. Mientras escribe (después de 2 letras), aparecen resultados.
4. Texto de ayuda sobre los resultados: "Escoge la marca y el tamaño exacto."
5. **Tarjeta de resultado** (un producto exacto, con sus precios en los 3 súper):
   - Nombre: "Arroz Progreso"
   - Gris: "Bolsa 5 lb"
   - Tres filas, una por súper, en este orden fijo: La Colonia, Colonial, Comisariato Los Andes:
     - `(LC) La Colonia ............ L 92.50`
     - `(CL) Colonial .............. L 89.90` + insignia **"Más barato"**
     - `(LA) Los Andes ............. ⊘ No disponible`
   - Botón secundario a la derecha o abajo: **"Agregar"**. Si ya está en la lista: "En tu lista ✓" (deshabilitado) .
6. Las tarjetas se ordenan por las que están en más supermercados primero (las que están en los 3 arriba).
7. Al tocar "Agregar": vuelve a P5 y muestra "Listo, agregamos Arroz Progreso 5 lb." con cantidad 1.

Texto de cada fila sin producto: **"No disponible"** (ámbar). Si el súper falló al responder: **"No pudimos consultar"** (rojo), ver estados.

```
┌────────────────────────────────────┐
│ ←  Agregar producto                │
│ ┌────────────────────────────────┐ │
│ │ 🔍 arroz                    ×  │ │
│ └────────────────────────────────┘ │
│ Escoge la marca y el tamaño exacto.│
│ ┌────────────────────────────────┐ │
│ │ Arroz Progreso                 │ │
│ │ Bolsa 5 lb                     │ │
│ │ (LC) La Colonia      L 92.50   │ │
│ │ (CL) Colonial        L 89.90   │ │
│ │      [✓ Más barato]            │ │
│ │ (LA) Los Andes       L 94.00   │ │
│ │ ┌────────────────────────────┐ │ │
│ │ │          Agregar           │ │ │
│ │ └────────────────────────────┘ │ │
│ └────────────────────────────────┘ │
│ ┌────────────────────────────────┐ │
│ │ Arroz Gallo Dorado             │ │
│ │ Bolsa 4 lb                     │ │
│ │ (LC) La Colonia      L 81.75   │ │
│ │      [✓ Más barato]            │ │
│ │ (CL) Colonial    ⊘ No disponible│ │
│ │ (LA) Los Andes       L 84.20   │ │
│ │ ┌────────────────────────────┐ │ │
│ │ │          Agregar           │ │ │
│ │ └────────────────────────────┘ │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

**Estados de P6:**
- **Antes de escribir:** texto gris centrado: "Escribe qué quieres comprar." Debajo, si hay, "Buscaste antes:" con 3–5 búsquedas recientes como botones.
- **Buscando:** 3 tarjetas de esqueleto. Texto: "Buscando en los 3 súper…"
- **Un súper responde más lento:** las tarjetas aparecen con los súper que ya respondieron; la fila del lento muestra esqueleto y "Buscando…".
- **Un súper falló:** en las filas de ese súper: "No pudimos consultar" (rojo). Arriba de los resultados, banda roja suave: "No pudimos consultar Colonial en este momento. Te mostramos La Colonia y Los Andes." + botón de texto **"Reintentar"**.
- **Sin resultados:** título "No encontramos "arrozz"", texto "Revisa cómo está escrito o prueba con algo más general, como "arroz"."
- **Sin internet:** "No hay conexión. Revisa tu internet para buscar precios." + botón "Reintentar".

### P7 — Resultado: ¿Dónde te sale más barato?

1. Encabezado: flecha "Volver" + título **"¿Dónde te sale más barato?"**
2. Subtítulo: "Tu lista de 8 productos".
3. **Tarjeta ganadora** (fondo `#E7F5EE`, borde verde 2 px):
   - Insignia: **"✓ Más barato"**
   - Etiqueta + nombre: "(LC) La Colonia"
   - Total grande: **"L 812.50"**
   - Línea de ahorro en verde oscuro, peso 600: **"Ahorras L 87.40 frente a Comisariato Los Andes"**
   - Estado: "Tiene todos tus productos" (con check).
   - Botón secundario: **"Ver detalle"**
4. **Tarjetas de los otros dos súper**, ordenadas de menor a mayor total. Cada una:
   - Etiqueta + nombre.
   - Total: "L 845.10" y a la derecha en gris: "+ L 32.60".
   - Estado: "Tiene todos tus productos" o, en ámbar, "Faltan 2 productos".
   - Botón de texto: **"Ver detalle"**.
5. Aviso de precios: "Precios consultados hoy a las 10:45 a. m. Pueden variar en tienda."
6. Botón de texto: **"Actualizar precios"**.

Barra inferior fija: botón secundario **"Volver a mi lista"**.

```
┌────────────────────────────────────┐
│ ←  ¿Dónde te sale más barato?      │
│ Tu lista de 8 productos            │
│ ┌════════════════════════════════┐ │  <- borde verde, fondo menta
│ ║ [✓ Más barato]                 ║ │
│ ║ (LC) La Colonia                ║ │
│ ║ L 812.50                       ║ │  <- 32 px
│ ║ Ahorras L 87.40 frente a       ║ │
│ ║ Comisariato Los Andes          ║ │
│ ║ ✓ Tiene todos tus productos    ║ │
│ ║ ┌────────────────────────────┐ ║ │
│ ║ │        Ver detalle         │ ║ │
│ ║ └────────────────────────────┘ ║ │
│ └════════════════════════════════┘ │
│ ┌────────────────────────────────┐ │
│ │ (LA) Comisariato Los Andes     │ │
│ │ L 899.90           + L 87.40   │ │
│ │ ✓ Tiene todos tus productos    │ │
│ │ Ver detalle                    │ │
│ └────────────────────────────────┘ │
│ ┌────────────────────────────────┐ │
│ │ (CL) Colonial                  │ │
│ │ L 790.25                       │ │
│ │ ⊘ Faltan 2 productos           │ │  <- ámbar
│ │ No se compara con los demás    │ │
│ │ hasta completar la lista.      │ │
│ │ Elegir sustitutos              │ │
│ └────────────────────────────────┘ │
│ ⏱ Precios consultados hoy a las    │
│   10:45 a. m. Pueden variar en     │
│   tienda.                          │
│ Actualizar precios                 │
├────────────────────────────────────┤
│ ┌────────────────────────────────┐ │
│ │       Volver a mi lista        │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

#### Regla para productos faltantes (importante)

Un súper al que le faltan productos puede parecer más barato solo porque cobra
menos cosas. Para que la comparación sea justa:

1. **Solo compiten por "Más barato" los súper que tienen la lista completa**
   (contando sustitutos que la persona haya elegido).
2. Un súper incompleto muestra su total con la nota en ámbar
   **"Faltan 2 productos"** y debajo **"No se compara con los demás hasta
   completar la lista."**, más el botón de texto **"Elegir sustitutos"** (lleva
   a P8 de ese súper).
3. El ahorro ("Ahorras L …") se calcula contra el más caro **de los completos**.
4. **Si ningún súper tiene la lista completa:** se comparan solo los productos
   que están en los 3. La tarjeta ganadora dice:
   "Más barato en los 6 productos que hay en los 3 súper" y arriba aparece una
   banda ámbar: "Ningún súper tiene todos tus productos. Comparamos los 6 que
   sí tienen los tres." + botón de texto "Ver cuáles faltan".
5. Si solo un súper está completo, gana ese, y el ahorro se muestra solo si hay
   otro completo con qué comparar; si no, la línea dice
   "Es el único con todos tus productos".

#### Estados de P7

- **Cargando:** las 3 tarjetas con esqueleto en el total. Título igual. Texto bajo el título: "Buscando los precios de hoy en los 3 súper…". Cada tarjeta se llena en cuanto su súper responde; la insignia "Más barato" aparece solo cuando terminan todos (o fallan).
- **Error de un súper:** su tarjeta, en lugar del total, muestra banda roja suave: "No pudimos consultar Colonial en este momento." + botón **"Reintentar"**. El ganador se calcula entre los otros dos y la tarjeta ganadora agrega en gris: "Sin contar Colonial".
- **Error de los tres / sin internet:** ilustración simple, título "No pudimos consultar los precios", texto "Revisa tu conexión e intenta de nuevo. Tu lista está guardada.", botón principal "Reintentar".
- **Empate:** ambas tarjetas con insignia "Mismo precio", texto: "Te sale igual en La Colonia y Colonial."

### P8 — Detalle por supermercado

Se llega desde "Ver detalle" en P7.

1. Encabezado: flecha "Volver" + título con etiqueta: **"(LC) La Colonia"**.
2. Resumen: total grande **"L 812.50"**; debajo "8 de 8 productos" o, en ámbar, "6 de 8 productos · Faltan 2".
3. Selector rápido para cambiar de súper sin volver: tres botones tipo pestaña "La Colonia | Colonial | Los Andes" (el activo con subrayado verde de 3 px y texto en negrita).
4. **Sección "Faltan en este súper"** (solo si hay), arriba de todo para que se vea:
   - Fila: "Frijoles rojos Kern's · Bolsa 2 lb" + insignia "No disponible" + botón secundario **"Elegir sustituto"** (→ P9).
   - Texto gris: "O cómpralo en La Colonia a L 58.50."
5. **Sección "Tus productos"**: filas con
   - Nombre + presentación.
   - "2 × L 46.25" en gris.
   - Subtotal a la derecha "L 92.50" en negrita.
   - Si es el precio más bajo de los 3 súper para ese producto: pequeño texto verde "El mejor precio".
   - Si es sustituto: insignia "Sustituto" y en gris "En lugar de Frijoles rojos Kern's 2 lb" + botón de texto "Cambiar".
6. Línea de total al final: "Total  L 812.50".
7. Aviso de precios.

```
┌────────────────────────────────────┐
│ ←  (CL) Colonial                   │
│ L 790.25                           │
│ ⊘ 6 de 8 productos · Faltan 2      │
│  La Colonia │ Colonial │ Los Andes │
│             ‾‾‾‾‾‾‾‾‾‾             │
│ Faltan en este súper               │
│ ┌────────────────────────────────┐ │
│ │ Frijoles rojos Kern's          │ │
│ │ Bolsa 2 lb   [⊘ No disponible] │ │
│ │ O cómpralo en La Colonia a     │ │
│ │ L 58.50.                       │ │
│ │ ┌────────────────────────────┐ │ │
│ │ │     Elegir sustituto       │ │ │
│ │ └────────────────────────────┘ │ │
│ └────────────────────────────────┘ │
│ Tus productos                      │
│ ────────────────────────────────── │
│ Arroz Progreso · Bolsa 5 lb        │
│ 2 × L 44.95              L 89.90   │
│ El mejor precio                    │
│ ────────────────────────────────── │
│ Leche entera Sula · Galón          │
│ 3 × L 99.50             L 298.50   │
│ ────────────────────────────────── │
│ Total                   L 790.25   │
│ ⏱ Precios consultados hoy a las    │
│   10:45 a. m. Pueden variar en     │
│   tienda.                          │
└────────────────────────────────────┘
```

### P9 — Elegir sustituto (hoja inferior)

Sube desde abajo sobre P8; ocupa hasta el 85 % de la pantalla.

1. Asa gris arriba y botón "×" (etiqueta "Cerrar").
2. Título: **"Sustituto en Colonial"**
3. Texto: "No encontramos **Frijoles rojos Kern's · Bolsa 2 lb**. Estos se parecen:"
4. Opciones (máximo 5), ordenadas por más parecido y luego por precio. Cada una es una fila tocable de 64 px:
   - Botón de opción (círculo) + "Frijoles rojos Ducal" / gris "Bolsa 2 lb" + precio "L 55.00".
   - Si el tamaño es distinto, aviso gris: "Tamaño distinto: 1.5 lb".
5. Opción final: "No quiero sustituto" — gris: "Este súper seguirá con un producto faltante."
6. Botón principal fijo: **"Usar este"** (deshabilitado hasta escoger).

Al confirmar: se cierra, P8 se actualiza, mensaje breve: "Listo, usamos Frijoles rojos Ducal en Colonial." El sustituto aplica **solo a ese súper**; los demás conservan el producto original.

Si no hay parecidos: "No encontramos productos parecidos en Colonial." + botón "Cerrar".

```
┌────────────────────────────────────┐
│ (P8 oscurecida detrás)             │
├──────────────── ── ────────────────┤
│ Sustituto en Colonial           ×  │
│ No encontramos Frijoles rojos      │
│ Kern's · Bolsa 2 lb. Estos se      │
│ parecen:                           │
│ ┌────────────────────────────────┐ │
│ │ ◉ Frijoles rojos Ducal L 55.00 │ │
│ │   Bolsa 2 lb                   │ │
│ ├────────────────────────────────┤ │
│ │ ○ Frijoles rojos Don    L 41.90│ │
│ │   Bolsa 1.5 lb                 │ │
│ │   Tamaño distinto: 1.5 lb      │ │
│ ├────────────────────────────────┤ │
│ │ ○ No quiero sustituto          │ │
│ │   Este súper seguirá con un    │ │
│ │   producto faltante.           │ │
│ └────────────────────────────────┘ │
│ ┌────────────────────────────────┐ │
│ │           Usar este            │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

### P10 — Mi cuenta

1. Flecha "Volver" + título **"Mi cuenta"**.
2. Correo de la persona (gris): "nombre@correo.com".
3. Sección **"Sobre los precios"** (texto): "Consultamos los precios en las páginas de La Colonia, Colonial y Comisariato Los Andes. Pueden cambiar o ser distintos en la tienda. Compara Súper no tiene relación con estos supermercados."
4. Botón de lista: **"Cambiar contraseña"**.
5. Botón secundario: **"Cerrar sesión"**.
6. Botón de texto en rojo, abajo: **"Borrar mi cuenta"** → confirmación: título "¿Borrar tu cuenta?", texto "Se borrarán tu cuenta y tu lista. No se puede deshacer.", botones "Sí, borrar" (rojo) y "Cancelar" (principal).
7. Versión en gris pequeño: "Versión 1.0".

```
┌────────────────────────────────────┐
│ ←  Mi cuenta                       │
│ nombre@correo.com                  │
│                                    │
│ Sobre los precios                  │
│ Consultamos los precios en las     │
│ páginas de La Colonia, Colonial y  │
│ Comisariato Los Andes. Pueden      │
│ cambiar o ser distintos en la      │
│ tienda. Compara Súper no tiene     │
│ relación con estos supermercados.  │
│ ────────────────────────────────── │
│ Cambiar contraseña              >  │
│ ────────────────────────────────── │
│ ┌────────────────────────────────┐ │
│ │         Cerrar sesión          │ │
│ └────────────────────────────────┘ │
│         Borrar mi cuenta           │  <- rojo
│            Versión 1.0             │
└────────────────────────────────────┘
```

---

## 7. Accesibilidad (resumen obligatorio)

- Contraste mínimo 4.5:1 en todo texto (ver tabla de colores).
- Zonas táctiles de 48 × 48 px como mínimo; acciones principales al alcance del pulgar.
- Nunca usar solo color para comunicar: "Más barato" lleva texto y check; "No disponible" lleva texto e ícono; los súper llevan nombre e iniciales.
- Etiquetas visibles en todos los campos (no solo el texto de ejemplo).
- Precios leídos completos por lectores de pantalla: "92 lempiras con 50 centavos".
- Cambios de estado anunciados (ej. "Precios actualizados. Más barato: La Colonia, 812 lempiras con 50").
- Respetar "reducir movimiento" y el tamaño de letra del sistema.
- Orden de foco igual al orden visual de arriba hacia abajo.

---

## 8. Mejoras futuras (anotadas, fuera de la v1)

- **Varias listas:** el título "Mi lista" de P5 se convierte en un selector
  ("Mi lista ▾") que abre una hoja inferior con las listas ("Compra de la
  semana", "Quincena", "+ Nueva lista"). No requiere cambiar el resto del flujo.
- **Ruta mixta:** "Si compras en dos súper ahorras L 120" (combinar tiendas).
- **Sucursal favorita** y precios por sucursal.
- **Historial de precios** de un producto.
- **Compartir lista** por WhatsApp.
- **Modo oscuro** (los colores de esta versión están pensados solo para fondo claro).

---

## 9. Decisiones a confirmar con la persona

1. **Regla de faltantes:** ¿de acuerdo con que un súper incompleto no pueda ganar
   hasta que se elija sustituto (§6, P7)? Alternativa: sumarle el precio del
   producto en otro súper como estimado.
2. **Sustitutos:** ¿la app solo los sugiere (la persona elige) o puede escogerlos
   sola automáticamente? Propuesta v1: la persona elige.
3. **Color de acento verde** (`#0F7A4F`) asociado a "ahorro". ¿Le gusta o prefiere otro?
4. **Nombre de la app:** Compara Súper, Canasta Lista, ¿Dónde Sale? o Ahorrito.
5. **Precio "desde"** en la lista (P5): ¿útil o prefiere la lista más limpia, sin precios?
6. **Iniciales de los súper** (LC, CL, LA): La Colonia y Colonial se parecen
   mucho; confirmar que con nombre + iniciales + color distinto se distinguen bien.
