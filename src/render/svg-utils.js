/* Utilidades geométricas y de color para el renderizado SVG. */
import { HEX_SIZE } from '../config.js';

export function axialToPixel(q,r){
  const x = HEX_SIZE*Math.sqrt(3)*(q+r/2);
  const y = HEX_SIZE*1.5*r;
  return [x,y];
}
export function hexPoints(cx,cy){
  const pts=[];
  for(let i=0;i<6;i++){
    const ang = Math.PI/180*(60*i-30);
    pts.push((cx+HEX_SIZE*0.94*Math.cos(ang)).toFixed(1)+','+(cy+HEX_SIZE*0.94*Math.sin(ang)).toFixed(1));
  }
  return pts.join(' ');
}

/* ---- utilidades de color para el sombreado isométrico ---- */
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

/* La ficha de guarnición vive en render/unit-icon.js: dejó de ser un cubo
   isométrico y pasó a ser un busto de infante teñido con el color de la facción. */

