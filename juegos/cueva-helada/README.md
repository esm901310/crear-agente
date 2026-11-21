# Cueva Helada

Puzzle en pixel art retro para el navegador. Pipo patina por una cueva de hielo sin poder frenar: recoge todos los cristales y llega a la salida.

## Cómo jugar

Abre `index.html` en cualquier navegador (no necesita instalación ni internet, salvo para cargar las fuentes).

- **Mover:** flechas o WASD · en celular, desliza el dedo o usa la cruceta
- **Deshacer:** Z · **Reiniciar:** R · **Pista:** H

Casillas: cristal (recoger), salida (se abre al tener todos), nieve (te frena), hielo frágil (se rompe al pasar; no caigas al agua) y roca (te detiene).

16 niveles. Cada uno tiene una meta de movimientos (la solución más corta); igualarla da 3 estrellas. El progreso se guarda en el navegador.

## Herramientas (para crear niveles)

En `herramientas/` (requiere Node.js):

- `engine.js`: reglas del juego y un solucionador que encuentra la solución más corta.
- `gen.js`: genera niveles al azar y muestra los que tienen solución.
  Uso: `node gen.js <semilla> <ancho> <alto> <densidadRocas> <cristales> <nieve> <hieloFragil> <movMinimos> <intentos>`
  Ejemplo: `node gen.js 5 8 8 0.12 2 0 0 6 2000`
- `niveles.json`: los 16 niveles del juego. Símbolos: `#` roca, `.` hielo, `P` inicio, `*` cristal, `E` salida, `_` nieve, `x` hielo frágil.

Si cambias los niveles, calcula la meta de cada uno con `solve()` de `engine.js` y actualiza la lista `LEVELS` dentro de `index.html`.
