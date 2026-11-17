/* global document */
// Toma capturas de las pantallas principales en modo simulado.
// 1) En otra terminal: npm run dev:simulada -- --port 5180
// 2) npm run capturas            (URL distinta: URL_APP=http://localhost:5173 npm run capturas)
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, devices } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const salida = join(raiz, 'capturas');
const URL_APP = process.env.URL_APP || 'http://localhost:5180';

await mkdir(salida, { recursive: true });
const navegador = await chromium.launch();
const contexto = await navegador.newContext({ ...devices['Pixel 7'], locale: 'es-HN', timezoneId: 'America/Tegucigalpa' });
const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(String(e)));
p.on('console', (m) => m.type() === 'error' && errores.push(m.text()));

const foto = async (nombre, completa = false) => {
  await p.waitForTimeout(350);
  const vista = p.viewportSize();
  if (completa) {
    // Agranda la ventana al alto del contenido para que la barra fija quede abajo.
    const alto = await p.evaluate(() => document.documentElement.scrollHeight);
    if (alto > vista.height) await p.setViewportSize({ width: vista.width, height: alto });
    await p.waitForTimeout(250);
  }
  await p.screenshot({ path: join(salida, `${nombre}.png`) });
  await p.setViewportSize(vista);
  console.log('Captura', nombre);
};

const agregar = async (busqueda, nombreTarjeta, presentacion) => {
  await p.getByRole('link', { name: /agregar/i }).first().click();
  await p.getByLabel('Buscar producto').fill(busqueda);
  const tarjeta = p.getByRole('article', { name: `${nombreTarjeta}, ${presentacion}` });
  await tarjeta.waitFor();
  await tarjeta.getByRole('button', { name: 'Agregar' }).click();
  await p.getByRole('heading', { name: 'Mi lista' }).waitFor();
};

await p.goto(URL_APP);
await p.evaluate(() => localStorage.clear());
await p.goto(URL_APP);
await p.getByRole('heading', { name: 'Comparar Súper' }).waitFor();
await foto('P1-bienvenida');

await p.getByRole('link', { name: 'Crear cuenta' }).click();
await p.getByRole('button', { name: 'Crear mi cuenta' }).click();
await foto('P2-crear-cuenta-errores');
await p.getByLabel('Correo electrónico').fill('prueba@correo.com');
await p.getByLabel('Contraseña', { exact: true }).fill('contrasena123');
await p.getByRole('button', { name: 'Crear mi cuenta' }).click();
await p.getByText('Tu lista está vacía').waitFor();
await foto('P5-lista-vacia');

// P6 con resultados
await p.getByRole('link', { name: 'Agregar mi primer producto' }).click();
await p.getByLabel('Buscar producto').fill('arroz');
await p.getByText('Escoge la marca y el tamaño exacto.').waitFor();
await foto('P6-agregar-producto', true);
await p.getByRole('article', { name: 'Arroz Progreso, Bolsa 5 lb' }).getByRole('button', { name: 'Agregar' }).click();
await p.getByRole('heading', { name: 'Mi lista' }).waitFor();
await foto('P5-mensaje-agregado');

await agregar('frijoles', "Frijoles rojos Kern's", 'Bolsa 2 lb');
await agregar('leche entera', 'Leche entera Sula', 'Galón');
await agregar('huevos', 'Huevos rojos', 'Cartón de 30');
await agregar('cafe', 'Café molido Maya', '400 g');
await p.getByRole('button', { name: 'Uno más de Arroz Progreso' }).click();
await p.getByRole('button', { name: 'Uno más de Leche entera Sula' }).click();
await p.getByRole('button', { name: 'Uno más de Leche entera Sula' }).click();
await p.waitForTimeout(4200); // que se vaya el mensaje breve
await foto('P5-mi-lista', true);

// P7
await p.getByRole('link', { name: 'Ver dónde sale más barato' }).click();
await p.getByText('Tu lista de 5 productos').waitFor();
await p.getByRole('button', { name: 'Actualizar precios' }).waitFor();
await foto('P7-resultado', true);

// P8 de Colonial (le falta un producto)
await p.getByRole('button', { name: 'Elegir sustitutos' }).click();
await p.getByRole('heading', { name: 'Faltan en este súper' }).waitFor();
await foto('P8-detalle-colonial', true);

// P9
await p.getByRole('button', { name: 'Elegir sustituto' }).click();
await p.getByText('Estos se parecen:').waitFor();
await p.getByText('Frijoles rojos Ducal').click();
await foto('P9-elegir-sustituto');
await p.getByRole('button', { name: 'Usar este' }).click();
await p.getByText(/Listo, usamos/).waitFor();
await foto('P8-detalle-con-sustituto', true);

// P7 ya con las dos tiendas completas
await p.getByRole('button', { name: 'Volver' }).click();
await p.getByRole('button', { name: 'Actualizar precios' }).waitFor();
await p.waitForTimeout(4200);
await foto('P7-resultado-completo', true);

// P7 con una tienda que falla
await p.evaluate(() => localStorage.setItem('comparasuper-simulada-falla', 'colonial'));
await p.getByRole('button', { name: 'Actualizar precios' }).click();
await p.getByText(/No pudimos consultar Colonial/).waitFor();
await foto('P7-error-una-tienda', true);
await p.evaluate(() => localStorage.setItem('comparasuper-simulada-falla', 'red'));
await p.getByRole('button', { name: 'Actualizar precios' }).click();
await p.getByText(/Te mostramos los de la última consulta/).waitFor();
await foto('P7-sin-conexion-con-resultados-previos');
await p.reload();
await p.getByText('No pudimos consultar los precios').waitFor();
await foto('P7-sin-conexion');
await p.evaluate(() => localStorage.removeItem('comparasuper-simulada-falla'));

// P10
await p.goto(`${URL_APP}/cuenta`);
await p.getByRole('heading', { name: 'Mi cuenta' }).waitFor();
await foto('P10-mi-cuenta');
await p.getByRole('button', { name: 'Borrar mi cuenta' }).click();
await foto('P10-confirmar-borrar');

await navegador.close();
if (errores.length) {
  console.log('Errores en la consola del navegador:\n' + errores.join('\n'));
  process.exitCode = 1;
}
