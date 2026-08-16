/* Iconos de terreno en pixel art, regenerados a distinta resolución según el zoom. */
import { HEX_SIZE, PIXEL_BASE } from '../config.js';

export function emptyGrid(n){ return Array.from({length:n},()=>Array(n).fill(null)); }
export function fillTriangle(grid, apexRow, centerCol, rows, maxHalfWidth, colorFn){
  for(let i=0;i<rows;i++){
    const row = Math.round(apexRow)+i;
    if(row<0 || row>=grid.length) continue;
    const hw = Math.min(i, maxHalfWidth);
    for(let col=0; col<grid[0].length; col++){
      if(Math.abs(col-centerCol) <= hw+0.5) grid[row][col] = colorFn(i, col-centerCol);
    }
  }
}
export function mountainGrid(n){
  // tierras altas: pico rocoso con cara iluminada (izq) y sombra (der)
  const f = n/PIXEL_BASE;
  const g = emptyGrid(n);
  const highlightRows = Math.max(1, Math.round(1*f));
  fillTriangle(g, Math.max(1,Math.round(1*f)), (n-1)/2, Math.max(3,Math.round(6*f)), Math.max(1,Math.round(3*f)), (i,dx)=>{
    if(i<=highlightRows) return '#B7AC9C';
    return dx>0.3 ? '#40392F' : '#6B6355';
  });
  return g;
}
export function iceGrid(n){
  // hielo: grupo de fragmentos/cristales angulosos
  const f = n/PIXEL_BASE;
  const g = emptyGrid(n);
  fillTriangle(g, 3*f, 1.7*f, Math.max(2,Math.round(4*f)), Math.max(1,Math.round(1.4*f)), (i,dx)=> i===0 ? '#FFFFFF' : (dx>0.2 ? '#6FA9BE' : '#CFEFF7'));
  fillTriangle(g, 1*f, 4.5*f, Math.max(2,Math.round(5*f)), Math.max(1,Math.round(2*f)),   (i,dx)=> i===0 ? '#FFFFFF' : (dx>0.2 ? '#6FA9BE' : '#E3F6FB'));
  fillTriangle(g, 4*f, 6.3*f, Math.max(2,Math.round(3*f)), Math.max(1,Math.round(1.1*f)), (i,dx)=> i===0 ? '#FFFFFF' : (dx>0.2 ? '#6FA9BE' : '#CFEFF7'));
  return g;
}
export function craterGrid(n){
  // cráter: cuenco oscuro con borde iluminado por un lado
  const f = n/PIXEL_BASE;
  const g = emptyGrid(n);
  const c = (n-1)/2;
  const inner = 2.1*f, outer = 3.4*f;
  for(let row=0; row<n; row++){
    for(let col=0; col<n; col++){
      const d = Math.hypot(col-c, row-c);
      if(d<=inner) g[row][col] = '#1E2026';
      else if(d<=outer) g[row][col] = (row<n/2 && col<n/2) ? '#8B8378' : '#5A554E';
    }
  }
  return g;
}
export function mareGrid(n){
  // mare: llanura plana con pequeñas rocas y un craterito
  const f = n/PIXEL_BASE;
  const g = emptyGrid(n);
  const pebbles = [[1,2],[2,5],[4,1],[5,6],[6,3],[3,6],[6,1]];
  pebbles.forEach(([r,c])=>{
    const rr = Math.min(n-1, Math.round(r*f)), cc = Math.min(n-1, Math.round(c*f));
    g[rr][cc] = '#333B47';
  });
  const blob = [[4,4,'#2A303A'],[4,5,'#2A303A'],[5,4,'#3A4250'],[5,5,'#3A4250']];
  blob.forEach(([r,c,col])=>{
    const rr = Math.min(n-1, Math.round(r*f)), cc = Math.min(n-1, Math.round(c*f));
    g[rr][cc] = col;
  });
  return g;
}
export function gridToRects(grid){
  let s='';
  for(let r=0;r<grid.length;r++){
    for(let c=0;c<grid[r].length;c++){
      const col = grid[r][c];
      if(col) s += `<rect x="${c}" y="${r}" width="1.04" height="1.04" fill="${col}"></rect>`;
    }
  }
  return s;
}

export let ICON_N = PIXEL_BASE;
export let TERRAIN_ICON_DEFS = '';
export let ICON_DISPLAY_SIZE = HEX_SIZE*1.25;   // ancho/alto del icono ya escalado (constante, no depende del zoom)
export let ICON_PX = ICON_DISPLAY_SIZE/ICON_N;  // tamaño de cada "píxel" en pantalla (varía con la resolución)
export let ICON_HALF = ICON_DISPLAY_SIZE/2;

export function rebuildTerrainIcons(){
  const grids = { mare:mareGrid(ICON_N), highlands:mountainGrid(ICON_N), crater:craterGrid(ICON_N), ice:iceGrid(ICON_N) };
  TERRAIN_ICON_DEFS = '<defs>' + Object.entries(grids)
    .map(([key,g])=>`<g id="icon-${key}">${gridToRects(g)}</g>`).join('') + '</defs>';
  ICON_PX = ICON_DISPLAY_SIZE/ICON_N;
  ICON_HALF = ICON_DISPLAY_SIZE/2;
}

/* ICON_N es un binding exportado (solo lectura para los importadores):
   este setter es la única vía para cambiar la resolución. */
export function setIconResolution(n){
  ICON_N = n;
  rebuildTerrainIcons();
}
