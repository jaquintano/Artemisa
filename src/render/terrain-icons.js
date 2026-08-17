/* Relieve de las baldosas de terreno, en vectorial.
 *
 * Sustituye al pixel art de pixelart.js. La diferencia de fondo no es solo el
 * estilo: aquel se regeneraba a distinta resolución con cada nivel de zoom, y
 * esto se describe una vez y lo rasteriza el navegador, nítido a cualquier escala.
 *
 * Clave del diseño: aquí NO hay colores propios. Todo el dibujo son blancos y
 * negros semitransparentes, así que el tono lo pone siempre el relleno que haya
 * debajo — el color del terreno si el sector es neutral, el de la facción si
 * tiene dueño. Por eso un mismo juego de baldosas vale para los dos casos, en vez
 * de necesitar una variante por facción como la ficha de guarnición.
 *
 * La geometría se describe sobre un hexágono de circunradio 100 centrado en el
 * origen, con vértices arriba y abajo (la misma orientación que la rejilla del
 * mapa), y se reescala al emitirla.
 */
import { HEX_SIZE } from '../config.js';

const R = 100;
const ANG = [-30, 30, 90, 150, 210, 270];

const VERTICES = ANG.map(d => {
  const a = Math.PI / 180 * d;
  return [R * Math.cos(a), R * Math.sin(a)];
});

const f = n => n.toFixed(1);
const poly = pts => pts.map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ',' + f(p[1])).join(' ') + ' Z';

const CONTORNO = 'rgba(0,0,0,.45)';
const luz    = o => `rgba(255,255,255,${o})`;
const sombra = o => `rgba(0,0,0,${o})`;

/* ---------- piezas reutilizables ---------- */

/* Peñasco angular. Determinista a propósito: el mapa debe verse igual en cada
   repintado, así que la forma sale de los parámetros y no de Math.random(). */
function roca(cx, cy, r, giro, intensidad){
  const perfil = [1.0, 0.74, 0.96, 0.70, 0.88];
  const p = perfil.map((k, i) => {
    const a = giro + i * Math.PI * 2 / 5;
    return [cx + r * k * Math.cos(a), cy + r * k * Math.sin(a)];
  });
  // faceta superior: el mismo perfil encogido y desplazado hacia la luz
  const cara = p.map(q => [cx - r * 0.20 + (q[0] - cx) * 0.52, cy - r * 0.26 + (q[1] - cy) * 0.52]);
  return `<path d="${poly(p)}" fill="${luz(intensidad)}" stroke="${CONTORNO}" stroke-width="3.2" stroke-linejoin="round"></path>` +
         `<path d="${poly(cara)}" fill="${luz(intensidad + 0.14)}"></path>`;
}

/* Grieta: quebrada de segmentos, con una rama opcional. */
function grieta(puntos, grosor, opac){
  const d = puntos.map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ',' + f(p[1])).join(' ');
  return `<path d="${d}" fill="none" stroke="${sombra(opac)}" stroke-width="${grosor}" stroke-linecap="round" stroke-linejoin="round"></path>`;
}

/* ---------- mare: llanura basáltica sembrada de cascotes ---------- */
function mareMarkup(){
  const rocas = [
    [-54, -42, 20, 0.4], [ 47, -48, 16, 1.1], [  6, -74, 11, 2.0],
    [-68,   6, 14, 0.8], [-28, -14, 10, 2.6], [ 64,   4, 17, 0.3],
    [ 33, -18,  9, 1.5], [-45,  48, 18, 1.9], [ 46,  50, 13, 0.6],
    [-10,  74, 12, 2.3], [ 12,  30,  8, 1.2], [ 74, -22,  9, 2.8],
  ];
  return rocas.map(([x, y, r, g]) => roca(x, y, r, g, 0.20)).join('') +
    grieta([[-78, -20], [-52, -10], [-34, -22]], 3.4, .3) +
    grieta([[20, 62], [44, 72], [66, 66]], 3.0, .28) +
    grieta([[52, -68], [66, -52]], 2.6, .26);
}

/* ---------- crater: impacto circular con fracturas radiales ---------- */
function craterMarkup(){
  const rc = 52;
  let out = '';
  // fracturas que salen del borde hacia fuera
  for(let i = 0; i < 9; i++){
    const a = Math.PI * 2 / 9 * i + 0.35;
    const largo = 22 + (i % 3) * 12;
    out += grieta([
      [Math.cos(a) * (rc + 4), Math.sin(a) * (rc + 4)],
      [Math.cos(a + 0.06) * (rc + largo * 0.6), Math.sin(a + 0.06) * (rc + largo * 0.6)],
      [Math.cos(a - 0.05) * (rc + largo), Math.sin(a - 0.05) * (rc + largo)],
    ], 3.2, .3);
  }
  // cuenco: anillo exterior elevado, interior hundido
  out += `<circle cx="0" cy="0" r="${rc}" fill="${sombra(.2)}" stroke="${CONTORNO}" stroke-width="4"></circle>`;
  out += `<circle cx="0" cy="0" r="${rc - 9}" fill="none" stroke="${luz(.26)}" stroke-width="5"></circle>`;
  out += `<circle cx="0" cy="0" r="${rc - 15}" fill="${sombra(.16)}"></circle>`;
  // media luna iluminada en el borde superior izquierdo del cuenco
  out += `<path d="M ${f(-rc + 16)},${f(-16)} A ${f(rc - 17)} ${f(rc - 17)} 0 0 1 ${f(14)},${f(-rc + 17)}"
    fill="none" stroke="${luz(.2)}" stroke-width="7" stroke-linecap="round"></path>`;
  return out;
}

/* ---------- highlands: cordillera de picos nevados ---------- */
function montana(cx, base, ancho, alto){
  const cima = [cx, base - alto];
  const izq = [cx - ancho, base], der = [cx + ancho, base];
  // la arista de la cima parte la ladera en cara iluminada y cara en sombra
  const quiebro = [cx + ancho * 0.16, base - alto * 0.42];
  return `<path d="${poly([izq, cima, quiebro])}" fill="${luz(.26)}" stroke="${CONTORNO}" stroke-width="3" stroke-linejoin="round"></path>` +
         `<path d="${poly([quiebro, cima, der])}" fill="${sombra(.22)}" stroke="${CONTORNO}" stroke-width="3" stroke-linejoin="round"></path>` +
         // caperuza de nieve: zigzag corto colgando de la cima
         `<path d="${poly([
           [cx - ancho * 0.30, base - alto * 0.66], [cx - ancho * 0.12, base - alto * 0.80],
           cima, [cx + ancho * 0.16, base - alto * 0.74], [cx + ancho * 0.30, base - alto * 0.58],
           [cx + ancho * 0.10, base - alto * 0.64], [cx - ancho * 0.10, base - alto * 0.56],
         ])}" fill="${luz(.55)}"></path>`;
}

function highlandsMarkup(){
  // de atrás hacia delante, para que las cumbres traseras asomen entre las de delante
  const fondo = [[-52, 6, 34, 62], [10, 2, 30, 54], [62, 8, 32, 58]];
  const frente = [[-72, 54, 30, 50], [-22, 60, 36, 66], [30, 58, 32, 58], [76, 52, 26, 44]];
  return fondo.map(m => montana(...m)).join('') +
         `<path d="${poly([[-90, 8], [90, 8], [90, 22], [-90, 22]])}" fill="${sombra(.1)}"></path>` +
         frente.map(m => montana(...m)).join('');
}

/* ---------- ice: casquete con cristales y fracturas ramificadas ---------- */
function cristal(cx, cy, ancho, alto, inclina){
  const p = [
    [cx - ancho, cy], [cx - ancho * 0.55 + inclina, cy - alto],
    [cx + ancho * 0.30 + inclina, cy - alto * 0.82], [cx + ancho, cy],
  ];
  const brillo = [p[1], [cx - ancho * 0.10 + inclina, cy - alto * 0.86], [cx - ancho * 0.18, cy]];
  return `<path d="${poly(p)}" fill="${luz(.42)}" stroke="${CONTORNO}" stroke-width="3" stroke-linejoin="round"></path>` +
         `<path d="${poly(brillo)}" fill="${luz(.35)}"></path>`;
}

function iceMarkup(){
  return (
    // fractura ramificada que recorre la baldosa
    grieta([[-84, 26], [-44, 10], [-8, 18], [26, -2], [62, 6], [86, -14]], 5, .26) +
    grieta([[-44, 10], [-36, -26], [-14, -50]], 4, .24) +
    grieta([[26, -2], [34, 34], [16, 62]], 4, .24) +
    grieta([[62, 6], [72, 40]], 3.4, .22) +
    // placas heladas
    `<path d="${poly([[-70, -52], [-30, -64], [-6, -46], [-38, -34]])}" fill="${luz(.3)}"></path>` +
    `<path d="${poly([[34, 52], [70, 44], [82, 62], [46, 72]])}" fill="${luz(.28)}"></path>` +
    // esquirlas
    cristal(-56, 4, 15, 52, 5) +
    cristal(-16, -14, 12, 40, -4) +
    cristal(20, -30, 14, 46, 6) +
    cristal(58, -18, 13, 44, -5) +
    cristal(-30, 60, 13, 38, 4) +
    cristal(72, 30, 11, 34, 3)
  );
}

/* ---------- ensamblado ---------- */

const DIBUJO = {
  mare: mareMarkup(),
  highlands: highlandsMarkup(),
  crater: craterMarkup(),
  ice: iceMarkup(),
};

/* El recorte impide que un peñasco o un pico se salga por el borde del hexágono. */
const CLIP = `<clipPath id="tile-clip"><path d="${poly(VERTICES)}"></path></clipPath>`;

export const TERRAIN_TILE_DEFS = '<defs>' + CLIP +
  Object.entries(DIBUJO).map(([k, m]) =>
    `<g id="tile-${k}" clip-path="url(#tile-clip)">${m}</g>`).join('') + '</defs>';

/* El 0.94 replica el que map.js aplica a la cara del hexágono, para que el
   relieve encaje exactamente con el polígono que tiene debajo. */
const ESCALA = HEX_SIZE * 0.94 / R;

export function terrainTileUse(terrain, cx, cy){
  return `<use href="#tile-${terrain}" transform="translate(${f(cx)},${f(cy)}) scale(${ESCALA.toFixed(4)})"></use>`;
}
