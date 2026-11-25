# Retoca

Corrige el texto de tus PDF escaneados, desde tu celular. Todo pasa en el
navegador: el archivo no se sube a ningún lado.

## Cómo correrla

```bash
npm install      # también copia a public/ los archivos de tesseract, pdf.js y las letras (sin internet)
npm run dev      # abre http://localhost:5173
```

Para probar en el celular dentro de la misma red: `npm run dev -- --host`.

Versión final: `npm run build` (queda en `dist/`, se puede subir a cualquier
hosting estático) y `npm run preview` para verla.

## Prueba automática

```bash
npm run build
npm run sample   # crea las muestras en samples/ (JPEG, 3 páginas, CCITT G4 con ImageMagick, y serif/mono/sans)
npm run e2e      # Playwright en tamaño celular; guarda capturas en capturas/
```

La prueba abre la app con `?prueba=1`, que expone datos de diagnóstico de la
detección de letra (`window.__retocaDeteccion`); sin ese parámetro (o fuera de
`npm run dev`) no existen.

Diagnóstico de la detección de letra sobre una carpeta de PDF:
`npm run build && npm run probar-letras -- <carpeta> [carpetaSalida]` (imprime el
ranking de cada PDF y, si se da carpetaSalida, guarda un antes/después).

## Dónde está cada cosa

- `src/lib/pdf.ts` abre el PDF y dibuja cada página.
- `src/lib/ocr.ts` lee el texto (tesseract.js en español, archivos locales).
- `src/lib/edit.ts` mide fondo, color, tamaño y grosor; borra, corre la línea y dibuja el texto nuevo.
- `src/lib/catalogo.ts` catálogo de letras libres (woff2 en `public/fuentes`, se cargan al usarlas).
- `src/lib/fuentes.ts` detecta sola la letra más parecida a la del escaneo.
- `src/lib/exportPdf.ts` arma el PDF final con pdf-lib.
- `src/screens/` pantallas; `src/components/` piezas reutilizables (ver `DISENO.md`).
