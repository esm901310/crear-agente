# Diseño — Entrega 1: "Retoca"

**Nombre:** Retoca (alternativa: "Retoca PDF" si se quiere ser explícito).
**Frase:** "Corrige el texto de tus PDF escaneados, desde tu celular."
**Tono:** cercano, en tú (LATAM), frases cortas, sin palabras técnicas (no "OCR", no "render").
Se dice "leer el texto", "palabras", "guardar", "descargar".

Pantalla de referencia: 375 x 667 px (vertical). Todo debe funcionar desde 320 px.
Zona del pulgar: las acciones principales van en el tercio inferior.

---

## 1. Estilo visual

### Colores
| Uso | Hex |
|---|---|
| Fondo de la app | `#F5F3EF` (gris cálido claro) |
| Superficie (barras, panel) | `#FFFFFF` |
| Texto principal | `#1F2328` |
| Texto secundario | `#5B6370` (contraste 5.9:1 sobre blanco) |
| Primario (botones, foco) | `#1E6FD9` |
| Primario presionado | `#1758AE` |
| Texto sobre primario | `#FFFFFF` |
| Borde suave | `#E2DED6` |
| Éxito | `#1E8A4C` |
| Aviso | `#B26A00` |
| Error | `#C62828` |
| Fondo de error | `#FDECEC` |
| Fondo detrás de la página | `#E9E6E0` |

### Marcas sobre las palabras (sin tapar el documento)
| Estado | Relleno | Borde |
|---|---|---|
| Palabra detectada | `#1E6FD9` al 8 % | 1 px `#1E6FD9` al 35 %, radio 3 px |
| Palabra seleccionada | `#FFC23D` al 30 % | 2 px `#E0A100` sólido |
| Palabra ya editada | `#1E8A4C` al 8 % | 1 px `#1E8A4C` al 50 % punteado |
| Palabra con lectura dudosa (confianza < 60 %) | igual que detectada | borde punteado |

- El texto de la página siempre se lee a través del relleno.
- Interruptor "Ocultar marcas" (ojo) para ver la página limpia.
- Área tocable real: aunque el recuadro sea pequeño, el toque se acepta en un margen invisible de 8 px alrededor; si dos palabras compiten, gana la más cercana al centro del dedo.

### Tipografía de la interfaz
- Familia: **Inter**, de respaldo `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- Títulos de pantalla: 22 px / 600. Subtítulos: 18 px / 600.
- Texto normal: 16 px / 400, interlineado 1.5. Mínimo absoluto: 14 px (solo textos de ayuda).
- Botones: 16 px / 600. Campo de texto: 18 px (evita el zoom automático en iPhone).

### Medidas
- Toque mínimo: **44 x 44 px**; botón principal: 52 px de alto, ancho completo menos márgenes.
- Separación mínima entre elementos tocables: 8 px.
- Espaciado base 8 px: 4 / 8 / 16 / 24 / 32. Margen lateral de pantalla: 16 px.
- Radios: botones 12 px, tarjetas 16 px, panel inferior 20 px (solo esquinas de arriba).
- Sombra del panel y barras: `0 -2px 12px rgba(0,0,0,0.08)`.
- Foco visible: anillo de 3 px `#1E6FD9` al 40 %.
- Respetar zona segura inferior del iPhone (barra de inicio).

---

## 2. Pantallas y flujo

```
[A Inicio] --Elegir PDF--> [B Leyendo] --listo--> [C Página]
    ^                         |                    |  toca palabra
    |                         +--error--> [F Errores]  v
    +--------"Abrir otro"-------------------- [D Panel de edición]
                                               |  Guardar cambio
                                               v
                                    [C Página con cambio] --Descargar--> [E Descargando]
```

### A. Inicio (vacío)
De arriba hacia abajo:
1. Logo + "Retoca" (22 px), centrado, a 32 px del borde superior.
2. Ilustración simple de una hoja con un lápiz (120 px de alto).
3. Título: **"Corrige el texto de tus PDF"**
4. Texto: "Abre un PDF escaneado o de fotos, toca la palabra que quieras cambiar y escribe la nueva. Todo pasa en tu celular: tu archivo no se sube a ningún lado."
5. (Tercio inferior) Botón principal: **"Elegir PDF"**.
6. Debajo, texto de ayuda 14 px: "Hasta 20 páginas y 25 MB."
- Si se arrastra un archivo (en computadora) la tarjeta se marca con borde punteado primario: "Suelta tu PDF aquí".

### B. Cargando / Leyendo texto
1. Barra superior: nombre del archivo (recortado con "…") y botón **"Cancelar"** a la derecha.
2. Miniatura de la página actual con un brillo que la recorre (no spinner solo).
3. Título: **"Leyendo el texto…"**
4. Texto: "Página 2 de 5"
5. Barra de progreso (8 px de alto, radio 4 px, primario sobre `#E2DED6`) con porcentaje "40 %".
6. Ayuda: "Esto toma unos segundos por página. No cierres esta pestaña."
- Antes del OCR, un paso breve: "Preparando tus páginas…".
- Recomendado: mostrar la página 1 en cuanto esté lista (pasar a C) y seguir leyendo las demás en segundo plano; las miniaturas pendientes muestran "Leyendo…".
- "Cancelar" pide confirmar: "¿Dejar de leer este PDF?" — **"Sí, cancelar"** / **"Seguir leyendo"**.

### C. Página con palabras marcadas (pantalla principal)
1. **Barra superior** (56 px, blanca):
   - Izquierda: botón "Atrás" (flecha) → vuelve a Inicio con confirmación si hay cambios.
   - Centro: nombre del archivo.
   - Derecha: botón **Deshacer** (flecha curva) y **Rehacer** (desactivados si no aplica, opacidad 40 %).
2. **Aviso único** la primera vez (tarjeta, cerrable con "Entendido"):
   "Toca una palabra para cambiarla. Para elegir varias de la misma línea, mantén presionado y desliza."
3. **Página** sobre fondo `#E9E6E0`, ajustada al ancho con 8 px de margen, con sombra suave.
   - Pellizcar para acercar (hasta 4x); con dos dedos se mueve. Con un dedo: tocar/seleccionar.
   - Botón flotante pequeño abajo a la derecha de la página: "Ocultar marcas" (icono ojo, 44 px).
4. **Barra inferior fija** (64 px + zona segura):
   - Izquierda: "‹" página anterior (44 px).
   - Centro: "Página 1 de 5" (tocable: abre la tira de miniaturas).
   - Derecha: "›" página siguiente (44 px).
   - Encima, ancho completo: botón principal **"Descargar PDF"**. Si no hay cambios: botón secundario (contorno) con el mismo texto.
- Cambio de página también deslizando a los lados cuando no hay zoom.
- **Tira de miniaturas** (panel inferior): miniaturas de 72 px de ancho, la actual con borde primario 2 px; un punto verde marca las páginas con cambios.
- Al guardar un cambio: aviso breve abajo (3 s) **"Listo, palabra cambiada"** con botón **"Deshacer"**.

### D. Panel de edición (bottom sheet)
Sube desde abajo al tocar una palabra o terminar una selección; ocupa ~45 % de la altura y sube con el teclado. La página se desplaza para que la selección quede visible encima del panel.
1. Agarradera (36 x 4 px, `#E2DED6`).
2. Título: **"Cambiar texto"**. A la derecha: botón cerrar (X, 44 px).
3. Etiqueta: "Texto que leímos" + texto original en gris (14 px), para comparar.
4. Campo de texto de una línea, prellenado y con todo el texto seleccionado, 52 px de alto, 18 px.
5. Si la lectura fue dudosa: "Puede que no lo hayamos leído bien. Revísalo antes de guardar." (color aviso).
6. Fila de ajustes (opcional, plegada bajo "Ajustar estilo"):
   - Tamaño: botones **"A−"** / **"A+"**.
   - Grosor: interruptor **"Negrita"**.
   - Color: muestra circular del color detectado + 4 opciones (negro `#000000`, gris oscuro `#333333`, azul `#1A3D8F`, rojo `#B00020`).
7. Botones (fila, 52 px): **"Cancelar"** (contorno, 1/3) y **"Guardar cambio"** (principal, 2/3).
- Si la palabra ya fue editada: aparece además enlace rojo **"Volver al original"**.
- Campo vacío + Guardar: borra el texto. Se pide confirmar: "¿Borrar este texto de la página?" — **"Sí, borrar"** / **"No"**.
- Vista previa en vivo: mientras se escribe, la página muestra cómo quedará.
- Si el texto nuevo es mucho más largo que el espacio: "El texto nuevo es más largo; lo haremos un poco más pequeño para que quepa."

### E. Descargando
1. Panel inferior pequeño: **"Preparando tu PDF…"** + barra de progreso "Página 3 de 5".
2. Al terminar: icono de éxito y **"¡Tu PDF está listo!"**
   - Botón principal **"Descargar de nuevo"** (por si el navegador no lo bajó) y, si el celular lo permite, **"Compartir"**.
   - Botón texto **"Seguir editando"**.
- Nombre del archivo: `nombre-original-retocado.pdf`.
- Al salir con cambios sin descargar: "Tienes cambios sin descargar. Si sales, se perderán." — **"Salir igual"** / **"Quedarme"**.

### F. Errores
Tarjeta centrada con icono, título, texto y un botón. Fondo `#FDECEC` solo en el icono, no en toda la pantalla.

| Caso | Título | Texto | Botón(es) |
|---|---|---|---|
| No es PDF | "Ese archivo no es un PDF" | "Elige un archivo que termine en .pdf. Si es una foto, primero conviértela a PDF." | **"Elegir otro archivo"** |
| Muy grande | "Este PDF es muy grande" | "Puede ir lento o trabarse tu celular. Funciona mejor con menos de 25 MB y 20 páginas." | **"Elegir otro archivo"** / **"Intentar de todos modos"** (secundario) |
| Sin texto detectado (todo el PDF) | "No encontramos texto" | "Puede que la imagen esté borrosa, muy oscura o de lado. Prueba con un escaneo más nítido." | **"Elegir otro archivo"** / **"Ver el PDF igual"** |
| Página sin texto (una sola) | Aviso en la página: "No encontramos texto en esta página." | — | — |
| PDF con contraseña o dañado | "No pudimos abrir este PDF" | "Puede estar protegido con contraseña o dañado." | **"Elegir otro archivo"** |
| Falla al descargar | "No se pudo crear tu PDF" | "Tus cambios siguen aquí. Inténtalo otra vez." | **"Reintentar"** |
| Memoria / navegador | "Tu celular se quedó sin espacio para seguir" | "Cierra otras pestañas e inténtalo de nuevo." | **"Reintentar"** |

---

## 3. Selección de varias palabras (frase)
- Tocar: selecciona una palabra y abre el panel.
- Mantener presionado (400 ms, vibración corta si existe) y deslizar: va sumando palabras **contiguas de la misma línea**; el resaltado amarillo se une en una sola franja.
- Si el dedo se va a otra línea, la selección no la incluye (se queda en la línea inicial).
- Al soltar: se abre el panel con la frase completa ("Texto que leímos: …").
- Dentro del panel, el enlace **"Elegir otras palabras"** cierra el panel y deja la selección para ajustarla.

## 4. Deshacer / rehacer
- Historial por documento (todas las páginas), mínimo 50 pasos.
- Deshacer en la barra superior + en el aviso breve tras cada cambio.
- Cada palabra editada se puede volver a tocar para editar de nuevo o "Volver al original".

## 5. Accesibilidad
- Contraste de texto mínimo 4.5:1; iconos con nombre para lector de pantalla ("Página siguiente", "Deshacer").
- Nada depende solo del color: palabras editadas usan borde punteado además del verde.
- Respetar "reducir movimiento": sin animación del panel, solo aparece.
- Textos de la app escalan si el usuario agranda la letra del celular (unidades relativas).
- Animación del panel: 200 ms, suave al salir.

## 6. Componentes reutilizables
1. **BotonPrincipal / BotonSecundario / BotonTexto / BotonIcono** (alto 52 o 44 px, estados normal, presionado, desactivado, cargando).
2. **BarraSuperior** (atrás, título recortable, acciones a la derecha).
3. **BarraPaginas** (anterior, "Página X de Y", siguiente).
4. **VisorPagina** (imagen de la página + capa de marcas, zoom con pellizco, deslizar entre páginas).
5. **MarcaPalabra** (estados: detectada, seleccionada, editada, dudosa).
6. **PanelInferior** (bottom sheet con agarradera, se ajusta al teclado, cierra al deslizar abajo).
7. **CampoTexto** (etiqueta, ayuda, aviso).
8. **SelectorEstilo** (A−/A+, Negrita, muestras de color).
9. **BarraProgreso** (con texto "Página X de Y" y porcentaje).
10. **TarjetaMensaje** (icono, título, texto, 1-2 botones; variantes error/aviso/éxito).
11. **AvisoBreve** (toast abajo, 3 s, con acción opcional "Deshacer").
12. **DialogoConfirmar** (pregunta + dos botones).
13. **TiraMiniaturas** (miniatura actual marcada, punto de "con cambios", estado "Leyendo…").

## 7. Fuera de esta entrega
Agregar texto nuevo donde no había, cambiar fuentes por nombre, editar imágenes, cuentas, guardar en la nube, otros idiomas.
