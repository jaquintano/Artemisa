/* Renderizado del mapa hexagonal y control de zoom/scroll. */
import { HEX_SIZE, ELEVATION, TERRAIN, BUILDING_TYPES, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, ICON_N_MIN, ICON_N_MAX, PIXEL_BASE } from '../config.js';
import { state, sectorLabel, availableUnits, getHex } from '../state.js';
import { supportersFor } from '../combat.js';
import { axialToPixel, shade, pt } from './svg-utils.js';
import { TERRAIN_ICON_DEFS, ICON_PX, ICON_HALF, setIconResolution } from './pixelart.js';
import { RESOURCE_ICON_DEFS, resourceIconUse } from './resource-icons.js';
import { UNIT_ICON_DEFS, unitTokenUse } from './unit-icon.js';

export let mapZoom = 1;

/* main.js registra aquí el manejador de clic, para que este módulo no dependa de la UI. */
let hexClickHandler = null;
export function setHexClickHandler(fn){ hexClickHandler = fn; }

export function setZoom(z){
  const wrap = document.getElementById('mapwrap');
  const oldScrollW = wrap.scrollWidth || 1, oldScrollH = wrap.scrollHeight || 1;
  const fracX = (wrap.scrollLeft + wrap.clientWidth/2) / oldScrollW;
  const fracY = (wrap.scrollTop + wrap.clientHeight/2) / oldScrollH;

  mapZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
  // la resolución del pixel art acompaña al zoom (ver render/pixelart.js)
  setIconResolution(Math.max(ICON_N_MIN, Math.min(ICON_N_MAX, Math.round(PIXEL_BASE*mapZoom))));
  if(state) renderMap();

  // recentra el scroll sobre el mismo punto del mapa que se estaba viendo antes de hacer zoom
  const newScrollW = wrap.scrollWidth, newScrollH = wrap.scrollHeight;
  wrap.scrollLeft = fracX*newScrollW - wrap.clientWidth/2;
  wrap.scrollTop = fracY*newScrollH - wrap.clientHeight/2;

  const zi=document.getElementById('zoomin'), zo=document.getElementById('zoomout');
  if(zi) zi.disabled = mapZoom >= ZOOM_MAX-0.001;
  if(zo) zo.disabled = mapZoom <= ZOOM_MIN+0.001;
  const zl=document.getElementById('zoomlevel');
  if(zl) zl.textContent = Math.round(mapZoom*100)+'%';
}

export function renderMap(){
  const svg = document.getElementById('mapsvg');
  const wrap = document.getElementById('mapwrap');
  const positions = new Map();
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const h of state.hexes.values()){
    const [x,y] = axialToPixel(h.q,h.r);
    const elev = ELEVATION[h.terrain];
    positions.set(h, {x,y,elev});
    minX=Math.min(minX,x-HEX_SIZE); maxX=Math.max(maxX,x+HEX_SIZE);
    minY=Math.min(minY, y-HEX_SIZE-Math.max(elev,0)-42);
    maxY=Math.max(maxY, y+HEX_SIZE-Math.min(elev,0)+18);
  }
  const pad=24;
  const vx = minX-pad, vy = minY-pad, vw = (maxX-minX)+pad*2, vh = (maxY-minY)+pad*2;
  svg.setAttribute('viewBox', `${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`);

  // Tamaño real en píxeles del SVG: encaja en el escenario a zoom 1× y crece/decrece con el
  // zoom aplicado. Cuando supera el tamaño visible del contenedor, aparece scroll automáticamente.
  // Se mide #mapstage (tamaño estable) y no #mapwrap, cuyo clientWidth encoge al aparecer las barras.
  const stage = document.getElementById('mapstage');
  const cw = (stage && stage.clientWidth) || 800, ch = (stage && stage.clientHeight) || 600;
  const fitScale = Math.min(cw/vw, ch/vh);
  const dispW = vw*fitScale*mapZoom, dispH = vh*fitScale*mapZoom;
  svg.style.width = dispW.toFixed(1)+'px';
  svg.style.height = dispH.toFixed(1)+'px';

  // orden de pintado (pintor): de fondo a frente, para que la extrusión se solape bien
  const ordered = [...positions.entries()].sort((a,b)=> (a[0].r-b[0].r) || (a[0].q-b[0].q));

  // sectores que aportan apoyo en la orden pendiente, para resaltarlos en el mapa
  let supAtk = [], supDef = [];
  if(state.pending){
    const p = state.pending;
    if(p.target.owner!==0){
      supAtk = supportersFor(p.source, p.target, 0);
      supDef = p.target.owner!=null ? supportersFor(p.target, p.source, p.target.owner) : [];
    }
  }
  const inList = (list,h) => list.some(s=>s.q===h.q && s.r===h.r);

  let html = TERRAIN_ICON_DEFS + RESOURCE_ICON_DEFS + UNIT_ICON_DEFS;
  for(const [h,pos] of ordered){
    const {x,y,elev} = pos;
    const topY = y - elev;
    const faction = h.owner!=null ? state.factions[h.owner] : null;
    const baseColor = faction ? faction.color : TERRAIN[h.terrain].color;
    const topFill = faction ? shade(baseColor, 0.10) : shade(baseColor, 0.05);
    const leftFill = shade(baseColor, -0.30);
    const rightFill = shade(baseColor, -0.14);

    let cls='hex';
    if(state.selected && state.selected.q===h.q && state.selected.r===h.r) cls+=' hex-sel';
    if(state.pending && state.pending.target.q===h.q && state.pending.target.r===h.r) cls+=' hex-target';
    if(inList(supAtk,h)) cls+=' hex-supatk';
    if(inList(supDef,h)) cls+=' hex-supdef';

    const corners=[], baseCorners=[];
    for(let i=0;i<6;i++){
      const ang = Math.PI/180*(60*i-30);
      const cx = x+HEX_SIZE*0.94*Math.cos(ang), cy = topY+HEX_SIZE*0.94*Math.sin(ang);
      corners.push([cx,cy]);
      baseCorners.push([cx,cy+elev]);
    }

    html += `<g class="${cls}" data-q="${h.q}" data-r="${h.r}">`;

    if(Math.abs(elev) > 0.5){
      html += `<polygon class="hexskirt" points="${pt(corners[1])} ${pt(corners[2])} ${pt(baseCorners[2])} ${pt(baseCorners[1])}" fill="${leftFill}"></polygon>`;
      html += `<polygon class="hexskirt" points="${pt(corners[2])} ${pt(corners[3])} ${pt(baseCorners[3])} ${pt(baseCorners[2])}" fill="${rightFill}"></polygon>`;
    }

    html += `<polygon class="hexface" points="${corners.map(pt).join(' ')}" fill="${topFill}" stroke="${faction?'rgba(0,0,0,.35)':'rgba(255,255,255,.18)'}"></polygon>`;

    html += `<use href="#icon-${h.terrain}" transform="translate(${(x-ICON_HALF).toFixed(1)},${(topY-ICON_HALF).toFixed(1)}) scale(${ICON_PX.toFixed(3)})"></use>`;

    if(h.building){
      const b = BUILDING_TYPES[h.building];
      // los edificios de recurso llevan icono vectorial; el resto siguen con su glifo
      html += b.resource
        ? resourceIconUse(b.resource, x, topY-9)
        : `<text class="hexicon" x="${x}" y="${topY-6}">${b.icon}</text>`;
    }
    if(h.units>0){
      html += unitTokenUse(h.owner, x, topY+10);
      html += `<text class="hexunits" x="${x+15}" y="${topY+15}" text-anchor="middle">${h.units}</text>`;
      // candado: guarnición propia que ya agotó su movimiento en esta ronda
      if(h.owner===0 && availableUnits(h)===0){
        html += `<text class="hexspent" x="${x-13}" y="${topY+15}" text-anchor="middle">⊘</text>`;
      }
    }
    const availTxt = h.owner===0 ? ` — disponibles: ${availableUnits(h)}/${h.units}` : '';
    html += `<title>${sectorLabel(h)} — ${TERRAIN[h.terrain].name}${faction?(' — '+faction.name):''}${availTxt}</title>`;
    html += `</g>`;
  }
  svg.innerHTML = html;

  svg.querySelectorAll('.hex').forEach(g=>{
    g.addEventListener('click', ()=>{
      const q = parseInt(g.getAttribute('data-q'),10);
      const r = parseInt(g.getAttribute('data-r'),10);
      if(hexClickHandler) hexClickHandler(getHex(q,r));
    });
  });
}
