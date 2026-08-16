/* Ficha de guarnición: busto de infante lunar con casco y visor.
 *
 * Sustituye al cubo isométrico anterior. Igual que los iconos de recurso, es
 * geometría vectorial pura descrita sobre una rejilla de 24x24 y reescalada al
 * emitirla, así que se mantiene nítida a cualquier zoom.
 *
 * El blindaje se tiñe con el color de la facción; lo único que no se tiñe es el
 * visor y el contorno, que son los que garantizan que la ficha se lea sobre un
 * hexágono del mismo color que ella (los sectores propios se pintan con una
 * variante clara del color de facción, así que el busto va deliberadamente un
 * punto más oscuro que el terreno que tiene debajo).
 *
 * Como el color varía pero la forma no, se precalcula una variante por facción
 * más una neutral y se emiten como <defs>: cada sector con tropas solo pone un
 * <use>, en vez de repetir una docena de trazados.
 */
import { FACTION_DEFS } from '../config.js';
import { shade } from './svg-utils.js';

const GRID = 24;
const LINE = '#23272E';      // contorno común, grueso y oscuro
const VISOR = '#5C626B';     // gris pizarra: no se tiñe, es el ancla de contraste
const VISOR_HI = '#949AA3';
const REJILLA = '#454B53';
const NEUTRAL = '#9AA0AC';   // guarniciones sin dueño

function path(d, fill, w){
  return `<path d="${d}" fill="${fill}" stroke="${LINE}" stroke-width="${w || 0.85}"
    stroke-linejoin="round" stroke-linecap="round"></path>`;
}

function bustoMarkup(color){
  const claro  = shade(color,  0.18);
  const cuerpo = shade(color, -0.02);
  const oscuro = shade(color, -0.22);
  const sombra = shade(color, -0.36);

  return (
    /* --- hombros --- */
    path('M 1.8,22.9 L 2.1,19.8 C 2.5,17.2 4.4,15.9 7.0,15.3 L 9.4,14.7 L 14.6,14.7 ' +
         'L 17.0,15.3 C 19.6,15.9 21.5,17.2 21.9,19.8 L 22.2,22.9 Z', cuerpo, 0.9) +
    // hombreras en sombra, para que el busto no quede plano
    path('M 2.1,19.8 C 2.5,17.2 4.4,15.9 7.0,15.3 L 7.6,17.6 C 5.4,18.4 4.3,20.2 4.1,22.9 ' +
         'L 1.8,22.9 Z', oscuro, 0.6) +
    path('M 21.9,19.8 C 21.5,17.2 19.6,15.9 17.0,15.3 L 16.4,17.6 C 18.6,18.4 19.7,20.2 19.9,22.9 ' +
         'L 22.2,22.9 Z', oscuro, 0.6) +
    // gola bajo el casco
    path('M 9.4,14.7 L 14.6,14.7 L 15.0,17.1 L 9.0,17.1 Z', sombra, 0.6) +
    // distintivos de la hombrera
    `<rect x="5.1" y="19.3" width="0.95" height="2.1" rx="0.4" fill="${sombra}"></rect>` +
    `<rect x="6.6" y="19.6" width="0.95" height="1.8" rx="0.4" fill="${sombra}"></rect>` +
    // rejilla de respiración
    `<rect x="9.7" y="16.3" width="4.6" height="4.3" rx="1.1" fill="${REJILLA}"
      stroke="${LINE}" stroke-width="0.7"></rect>` +
    [17.5, 18.5, 19.5].map(y =>
      `<line x1="10.5" y1="${y}" x2="13.5" y2="${y}" stroke="${VISOR_HI}"
        stroke-width="0.42" stroke-linecap="round" opacity=".8"></line>`).join('') +

    /* --- casco --- */
    path('M 4.9,12.6 C 4.3,5.4 7.7,2.3 12.0,2.3 C 16.5,2.3 19.9,5.4 19.3,12.6 ' +
         'C 19.1,15.1 16.4,16.6 12.2,16.6 C 8.0,16.6 5.1,15.1 4.9,12.6 Z', cuerpo, 0.9) +
    // faceta batida por la luz, arriba a la izquierda
    path('M 6.0,10.4 C 6.2,5.8 8.8,3.4 12.0,3.4 C 13.0,3.4 13.9,3.6 14.6,4.0 ' +
         'C 10.2,4.6 7.2,6.9 6.0,10.4 Z', claro, 0.45) +
    // mandíbula en sombra
    path('M 12.4,16.6 C 15.2,16.6 17.7,16.1 19.0,15.2 C 19.2,14.5 18.9,13.9 18.2,13.4 ' +
         'L 14.6,14.7 Z', oscuro, 0.45) +

    /* --- visor --- */
    path('M 8.0,7.3 C 10.6,5.9 15.7,5.9 18.0,7.3 C 18.6,10.1 17.4,12.9 15.0,14.3 ' +
         'C 12.2,15.5 9.3,14.4 8.2,12.4 C 7.5,10.6 7.5,8.5 8.0,7.3 Z', VISOR, 0.85) +
    // reflejo
    `<path d="M 14.4,7.6 C 16.0,7.5 17.2,8.0 17.6,8.9 C 16.9,9.7 15.5,9.9 14.3,9.5 ` +
      `C 13.7,8.9 13.8,8.0 14.4,7.6 Z" fill="${VISOR_HI}" opacity=".85"></path>`
  );
}

/* Una variante por facción, más la neutral al final. */
const PALETA = [...FACTION_DEFS.map(f => f.color), NEUTRAL];
const NEUTRAL_IDX = PALETA.length - 1;

export const UNIT_ICON_DEFS = '<defs>' +
  PALETA.map((c, i) => `<g id="unit-${i}">${bustoMarkup(c)}</g>`).join('') + '</defs>';

/* Algo mayor que el cubo al que sustituye (15 u): un busto con visor y rejilla
   necesita más píxeles que tres polígonos planos para leerse. El margen está
   comprobado: centrado en topY+10 ocupa de topY-1 a topY+21, así que no toca el
   icono de instalación (acaba en topY-1.5) ni el contador (va en x+15). */
export const UNIT_ICON_SIZE = 22;

/* `ownerId` null = guarnición neutral. Requiere UNIT_ICON_DEFS en el SVG. */
export function unitTokenUse(ownerId, cx, cy, size){
  const s = size || UNIT_ICON_SIZE;
  const i = (ownerId == null) ? NEUTRAL_IDX : ownerId;
  return `<use href="#unit-${i}" transform="translate(${(cx-s/2).toFixed(2)},${(cy-s/2).toFixed(2)}) scale(${(s/GRID).toFixed(4)})"></use>`;
}
