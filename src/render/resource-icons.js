/* Iconos vectoriales de los tres recursos: regolito, helio-3 y hielo.
 *
 * Se describen una sola vez como polígonos y es el navegador quien los rasteriza,
 * así que se leen igual de nítidos a cualquier escala. Mismo criterio que la
 * ficha de guarnición (unit-icon.js) y las baldosas de terreno
 * (terrain-icons.js).
 *
 * Toda la geometría está expresada sobre una rejilla de 24x24 y se reescala al
 * emitirla, así que las coordenadas de este fichero no dependen ni del zoom ni
 * del sitio donde acabe pintándose el icono.
 */

const GRID = 24;
const LINE = '#14171C';       // contorno común; da definición sobre hexágonos claros
const ICE_LINE = '#175E7C';   // el hielo lleva contorno azulado para no ensuciarse

function poly(points, fill, opts){
  const o = opts || {};
  return `<polygon points="${points}" fill="${fill}" stroke="${o.stroke || LINE}"
    stroke-width="${o.width || 0.85}" stroke-linejoin="round"></polygon>`;
}
function ball(cx, cy, r, fill){
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${LINE}" stroke-width=".95"></circle>`;
}
function gleam(cx, cy, fill){
  return `<ellipse cx="${cx}" cy="${cy}" rx="1.5" ry="1.15" fill="${fill}" opacity=".9"></ellipse>`;
}

/* ---------- Regolito: montículo de roca con una cara batida por el sol ---------- */
function regolithMarkup(){
  return (
    // silueta completa del montículo, y encima la vertiente derecha en sombra
    poly('2.6,20.2 6.4,12.4 10.7,3.0 14.4,9.4 18.2,12.6 21.4,20.2', '#343A45') +
    poly('10.7,3.0 14.4,9.4 18.2,12.6 21.4,20.2 11.9,20.2', '#23272F', {width:.6}) +
    // cara iluminada del pico
    poly('10.7,3.0 6.4,12.4 13.2,10.8', '#C6B189') +
    // cascotes claros incrustados
    poly('8.6,7.4 10.6,8.1 10.3,10.3 8.2,10.4 7.5,8.7', '#A9AFB9', {width:.7}) +
    poly('4.9,16.0 7.0,15.4 8.2,17.2 6.8,19.0 4.7,18.4', '#A9AFB9', {width:.7}) +
    poly('15.0,14.4 17.4,14.9 17.7,17.3 15.7,18.3 14.1,16.6', '#A9AFB9', {width:.7}) +
    poly('11.6,13.0 13.5,13.4 13.3,15.2 11.4,14.9', '#BCA87F', {width:.7}) +
    // guijarros sueltos al pie
    poly('18.9,21.0 20.7,20.4 22.1,21.5 20.9,22.8 19.1,22.4', '#2E333C', {width:.7}) +
    poly('15.9,21.4 17.4,21.0 18.1,22.2 16.8,22.9', '#2E333C', {width:.7})
  );
}

/* ---------- Helio-3: racimo de tres esferas con la etiqueta He3 ---------- */
function helium3Markup(){
  return (
    ball(9.4, 6.6, 3.9, '#AA6843')  + gleam(8.1, 5.3, '#D3966A') +
    ball(14.8, 8.8, 3.9, '#8B9099') + gleam(13.5, 7.5, '#B6BCC4') +
    ball(9.0, 11.4, 3.9, '#C07C4C') + gleam(7.7, 10.1, '#E4AC7E') +
    // el halo oscuro (paint-order) mantiene legible la etiqueta sobre hexágonos claros.
    // Va como atributo y no como clase CSS: las reglas externas no alcanzan el
    // árbol en sombra que crea <use>.
    `<text x="12" y="21.9" text-anchor="middle" font-size="7.6" font-weight="700"
      font-family="'Trebuchet MS',ui-sans-serif,sans-serif" fill="#E8EAED"
      stroke="${LINE}" stroke-width="1.2" stroke-linejoin="round"
      paint-order="stroke">He<tspan font-size="5.2" dy="1.4">3</tspan></text>`
  );
}

/* Cubo isométrico de tres caras. Reutiliza la silueta hexagonal de los sectores
   del mapa, para que el hielo rime visualmente con la rejilla del juego. */
function isoCube(cx, cy, r, topFill, leftFill, rightFill){
  const w = r*0.866;   // media anchura del hexágono (cos 30°)
  const f = pts => pts.map(p => p[0].toFixed(2)+','+p[1].toFixed(2)).join(' ');
  const n=[cx,cy-r], ne=[cx+w,cy-r/2], se=[cx+w,cy+r/2];
  const s=[cx,cy+r], sw=[cx-w,cy+r/2], nw=[cx-w,cy-r/2], c=[cx,cy];
  const o = { stroke:ICE_LINE, width:.65 };
  return poly(f([nw,n,ne,c]), topFill, o) +
         poly(f([nw,c,s,sw]), leftFill, o) +
         poly(f([c,ne,se,s]), rightFill, o);
}

/* ---------- Hielo: roseta de siete cristales en panal ---------- */
function iceMarkup(){
  const r = 3.55, d = r*Math.sqrt(3);   // separación exacta para que teselen sin holgura
  let out = '';
  for(let deg = 0; deg < 360; deg += 60){
    const a = Math.PI/180*deg;
    out += isoCube(12 + d*Math.cos(a), 12 + d*Math.sin(a), r, '#6FCBEA', '#2C90BC', '#48AED4');
  }
  // el cristal central se pinta el último y casi en blanco: es el foco del icono
  out += isoCube(12, 12, r, '#EDF9FD', '#9FD6EC', '#C4E8F6');
  return out;
}

/* Se calculan una sola vez: son estáticos, no dependen del zoom ni del estado. */
const MARKUP = {
  regolith: regolithMarkup(),
  helium3:  helium3Markup(),
  ice:    iceMarkup(),
};

export const RESOURCE_ICON_DEFS = '<defs>' +
  Object.entries(MARKUP).map(([kind, m]) => `<g id="res-${kind}">${m}</g>`).join('') + '</defs>';

/* Tamaño sobre el mapa, a la altura de la ficha de guarnición (ver
   render/unit-icon.js, UNIT_ICON_SIZE). */
export const RESOURCE_ICON_SIZE = 15;

/* Coloca el icono centrado en (cx,cy). Requiere que RESOURCE_ICON_DEFS esté en el SVG. */
export function resourceIconUse(kind, cx, cy, size){
  const s = size || RESOURCE_ICON_SIZE;
  return `<use href="#res-${kind}" transform="translate(${(cx-s/2).toFixed(2)},${(cy-s/2).toFixed(2)}) scale(${(s/GRID).toFixed(4)})"></use>`;
}

/* Versión suelta para los paneles HTML: se autocontiene en vez de referenciar los
   <defs> del mapa, que se reconstruyen enteros en cada repintado. */
export function resourceIconInline(kind, px){
  const s = px || 13;
  return `<svg class="ricon" width="${s}" height="${s}" viewBox="0 0 ${GRID} ${GRID}" aria-hidden="true">${MARKUP[kind]}</svg>`;
}
