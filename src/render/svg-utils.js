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

/* ---- ficha de tropas: pequeño cubo isométrico de 3 caras ---- */
export function isoUnitToken(cx,cy,color){
  const s = 7.5;
  const top   = [[cx,cy-s],[cx+s,cy-s*0.5],[cx,cy],[cx-s,cy-s*0.5]];
  const left  = [[cx-s,cy-s*0.5],[cx,cy],[cx,cy+s*0.9],[cx-s,cy+s*0.4]];
  const right = [[cx,cy],[cx+s,cy-s*0.5],[cx+s,cy+s*0.4],[cx,cy+s*0.9]];
  return `<polygon points="${top.map(pt).join(' ')}" fill="${shade(color,0.20)}" stroke="rgba(0,0,0,.45)" stroke-width=".6"></polygon>
    <polygon points="${left.map(pt).join(' ')}" fill="${shade(color,-0.30)}" stroke="rgba(0,0,0,.45)" stroke-width=".6"></polygon>
    <polygon points="${right.map(pt).join(' ')}" fill="${shade(color,-0.12)}" stroke="rgba(0,0,0,.45)" stroke-width=".6"></polygon>`;
}

