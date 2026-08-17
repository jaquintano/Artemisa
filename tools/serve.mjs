/* Servidor estático mínimo para desarrollo.
 *
 * Los ES modules no cargan desde file:// por la política CORS, así que hace falta
 * servir la carpeta por HTTP. Antes esto se documentaba como `python3 -m
 * http.server`, pero el proyecto ya depende de Node para los tests y no todo el
 * mundo tiene Python: con esto basta `npm start`.
 *
 * Solo usa módulos internos de Node, así que no rompe la regla de cero
 * dependencias.
 *
 * Uso:  node tools/serve.mjs [puerto]
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath y no URL.pathname: este proyecto vive en una ruta con espacios y
// pathname los deja como %20, con lo que no se encontraba ni un fichero.
const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PUERTO = Number(process.argv[2]) || 8000;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
};

createServer(async (req, res) => {
  const pedido = decodeURIComponent(req.url.split('?')[0]);
  // normalize() impide que un ../../ se escape de la carpeta del proyecto
  const relativo = normalize(pedido === '/' ? 'index.html' : pedido).replace(/^([/\\])+/, '');
  const fichero = join(RAIZ, relativo);
  if(!fichero.startsWith(RAIZ)){
    res.writeHead(403); res.end('Prohibido'); return;
  }
  try {
    const datos = await readFile(fichero);
    res.writeHead(200, { 'Content-Type': TIPOS[extname(fichero)] || 'application/octet-stream' });
    res.end(datos);
  } catch {
    res.writeHead(404); res.end('No encontrado');
  }
}).listen(PUERTO, () => {
  console.log(`Artemisa en http://localhost:${PUERTO}`);
});
