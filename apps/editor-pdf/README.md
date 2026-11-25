# Retoca

Corrige el texto de tus PDF escaneados, desde tu celular. Todo pasa en el
navegador: el archivo no se sube a ningún lado.

## Cómo correrla

```bash
npm install      # también copia a public/ los archivos de tesseract y de pdf.js (sin internet)
npm run dev      # abre http://localhost:5173
```

Para probar en el celular dentro de la misma red: `npm run dev -- --host`.

Versión final: `npm run build` (queda en `dist/`, se puede subir a cualquier
hosting estático) y `npm run preview` para verla.

## Prueba automática

```bash
npm run build
npm run sample   # crea las muestras en samples/ (JPEG, 3 páginas y CCITT G4; esta última usa ImageMagick)
npm run e2e      # Playwright en tamaño celular; guarda capturas en capturas/
```

## Dónde está cada cosa

- `src/lib/pdf.ts` abre el PDF y dibuja cada página.
- `src/lib/ocr.ts` lee el texto (tesseract.js en español, archivos locales).
- `src/lib/edit.ts` mide fondo, color, tamaño y grosor; borra y dibuja el texto nuevo.
- `src/lib/exportPdf.ts` arma el PDF final con pdf-lib.
- `src/screens/` pantallas; `src/components/` piezas reutilizables (ver `DISENO.md`).
