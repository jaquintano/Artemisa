/* Utilidades geométricas y de color para el renderizado SVG. */
import { HEX_SIZE } from '../config.js';

export function axialToPixel(q,r){
  const x = HEX_SIZE*Math.sqrt(3)*(q+r/2);
  const y = HEX_SIZE*1.5*r;
  return [x,y];
}
/* ---- utilidades de color para el sombreado de caras ---- */
export function hexToRgb(hex){
  const h = hex.replace('#','');
  return [parseInt(h.substr(0,2),16), parseInt(h.substr(2,2),16), parseInt(h.substr(4,2),16)];
}
export function shade(hexColor, factor){
  const [r,g,b] = hexToRgb(hexColor);
  const f = c => Math.min(255, Math.max(0, Math.round(c + 255*factor)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
export function pt(c){ return c[0].toFixed(1)+','+c[1].toFixed(1); }

/* Aquí solo hay geometría y color. El arte vive en módulos propios:
   terrain-icons.js (baldosas), unit-icon.js (guarnición) y resource-icons.js. */

