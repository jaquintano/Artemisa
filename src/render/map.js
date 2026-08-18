/* Renderizado del mapa hexagonal y control de zoom/scroll. */
import { HEX_SIZE, ELEVATION, TERRAIN, BUILDING_TYPES, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, DIRS } from '../config.js';
import { state, sectorLabel, availableUnits, getHex } from '../state.js';
import { supportersFor } from '../combat.js';
import { axialToPixel, shade, pt } from './svg-utils.js';
import { TERRAIN_TILE_DEFS, terrainTileUse } from './terrain-icons.js';
import { RESOURCE_ICON_DEFS, resourceIconUse } from './resource-icons.js';
import { UNIT_ICON_DEFS, unitTokenUse } from './unit-icon.js';
import { hoppersEn } from '../hopper.js';

/* Colocación de las unidades dentro de la loseta.
 *
 * La ficha de infantería lleva su contador DEBAJO, solapado un cuarto de su alto,
 * en vez de al lado: así el hueco de la derecha queda libre para el Transportador
 * cuando ambos comparten sector. Ese apilado vertical es lo que obliga a subir el
 * grupo (CY=3 y no 10): un hexágono se estrecha deprisa hacia abajo, y con la
 * ficha centrada más abajo el contador de dos cifras se salía de la loseta.
 *
 * Cuando conviven los dos tipos de unidad, la infantería se va a la izquierda y el
 * Transportador a la derecha; con una sola, se queda centrada. SEPARACION es el
 * máximo que admite la loseta sin que la ficha desborde sus lados. */
const UNIDAD_CY = 2;        // centro vertical de la ficha, respecto al centro de la loseta
const SEPARACION = 10;      // desplazamiento lateral de cada unidad cuando hay dos tipos
/* Bajada de la línea base del contador respecto al centro de la ficha. Medido
   sobre el texto ya pintado (no calculado a partir del cuerpo de la fuente: el
   trazo de contorno de .hexunits engorda el glifo), de forma que el cuarto
   superior del número quede solapado con la parte baja de la ficha. Subirlo saca
   un contador de dos cifras por el lado inclinado de la loseta. */
const NUM_BAJADA = 15.0;

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
  // el terreno ya no depende del zoom: es vectorial y lo reescala el navegador
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

  let html = TERRAIN_TILE_DEFS + RESOURCE_ICON_DEFS + UNIT_ICON_DEFS;
  // los bordes se acumulan aparte y se pintan al final, por encima de todos los
  // hexágonos: si fueran dentro de cada <g>, el vecino dibujado después los taparía
  let bordes = '';
  // Y los realces (selección, objetivo y apoyos) se acumulan para pintarse encima
  // de los bordes: el contorno de territorio es más grueso que ellos y, dibujado
  // después, escondía justo la loseta que el jugador acaba de señalar.
  let realces = '';
  for(const [h,pos] of ordered){
    const {x,y,elev} = pos;
    const topY = y - elev;
    const faction = h.owner!=null ? state.factions[h.owner] : null;
    // La propiedad ya NO se pinta como relleno: el sector conserva siempre el color
    // de su terreno y el dueño se marca rodeando su territorio (ver bordes más
    // abajo). Así no se pierde de vista qué hay debajo de cada casilla conquistada.
    const baseColor = TERRAIN[h.terrain].color;
    const topFill = shade(baseColor, faction ? 0.10 : 0.05);
    const leftFill = shade(baseColor, -0.30);
    const rightFill = shade(baseColor, -0.14);

    let cls='hex';
    let realce = null;
    if(state.selected && state.selected.q===h.q && state.selected.r===h.r) realce='sel';
    else if(state.pending && state.pending.target.q===h.q && state.pending.target.r===h.r) realce='target';
    else if(inList(supAtk,h)) realce='supatk';
    else if(inList(supDef,h)) realce='supdef';

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

    html += `<polygon class="hexface" points="${corners.map(pt).join(' ')}" fill="${topFill}" stroke="rgba(255,255,255,.18)"></polygon>`;

    if(realce){
      realces += `<polygon class="hexhl hexhl-${realce}" points="${corners.map(pt).join(' ')}"></polygon>`;
    }

    /* Frontera del territorio. Basta con dibujar los lados que dan a alguien que no
       es de la misma facción: la unión de esos lados es exactamente el perímetro
       del grupo contiguo, sin necesidad de calcular componentes conexas. Un sector
       aislado dibuja sus seis lados; uno interior, ninguno.
       DIRS y las esquinas no van en el mismo orden, de ahí la tabla de conversión:
       la esquina i mira a 60·i−30 grados y la dirección d a los ángulos
       0/300/240/180/120/60. */
    if(faction){
      const LADO_DE_DIR = [0,5,4,3,2,1];
      for(let d=0; d<6; d++){
        const n = getHex(h.q+DIRS[d][0], h.r+DIRS[d][1]);
        if(n && n.owner===h.owner) continue;   // lado interior: no es frontera
        const i = LADO_DE_DIR[d];
        bordes += `<line x1="${corners[i][0].toFixed(1)}" y1="${corners[i][1].toFixed(1)}"
          x2="${corners[(i+1)%6][0].toFixed(1)}" y2="${corners[(i+1)%6][1].toFixed(1)}"
          stroke="${faction.color}" class="hexborder"></line>`;
      }
    }

    html += terrainTileUse(h.terrain, x, topY);

    if(h.building){
      const b = BUILDING_TYPES[h.building];
      // los edificios de recurso llevan icono vectorial; el resto siguen con su glifo
      html += b.resource
        ? resourceIconUse(b.resource, x, topY-9)
        : `<text class="hexicon" x="${x}" y="${topY-6}">${b.icon}</text>`;
    }
    const hoppers = hoppersEn(h);
    // con los dos tipos presentes cada uno se aparta a un lado; con uno solo, centrado
    const juntos = h.units>0 && hoppers>0;
    const cyUnidad = topY + UNIDAD_CY;
    if(h.units>0){
      const ux = juntos ? x - SEPARACION : x;
      html += unitTokenUse(h.owner, ux, cyUnidad);
      // el contador va centrado bajo la ficha, con su cuarto superior solapándola
      const numY = cyUnidad + NUM_BAJADA;
      html += `<text class="hexunits" x="${ux}" y="${numY.toFixed(1)}" text-anchor="middle">${h.units}</text>`;
      // candado: guarnición propia que ya agotó su movimiento en este turno.
      // Va centrado sobre la ficha, como un símbolo de prohibido encima de ella.
      if(h.owner===0 && availableUnits(h)===0){
        html += `<text class="hexspent" x="${ux}" y="${cyUnidad}" text-anchor="middle"
          dominant-baseline="central">⊘</text>`;
      }
    }
    // Transportador: provisionalmente una «H» del color de su facción, con la misma
    // tipografía y cuerpo que el contador de guarniciones.
    if(hoppers>0){
      const hx = juntos ? x + SEPARACION : x;
      const color = h.owner!=null ? state.factions[h.owner].color : '#fff';
      html += `<text class="hexhopper" x="${hx}" y="${cyUnidad}" text-anchor="middle"
        dominant-baseline="central" fill="${color}">H${hoppers>1?'×'+hoppers:''}</text>`;
    }
    const availTxt = h.owner===0 ? ` — disponibles: ${availableUnits(h)}/${h.units}` : '';
    html += `<title>${sectorLabel(h)} — ${TERRAIN[h.terrain].name}${faction?(' — '+faction.name):''}${availTxt}</title>`;
    html += `</g>`;
  }
  svg.innerHTML = html + bordes + realces;

  svg.querySelectorAll('.hex').forEach(g=>{
    g.addEventListener('click', ()=>{
      const q = parseInt(g.getAttribute('data-q'),10);
      const r = parseInt(g.getAttribute('data-r'),10);
      if(hexClickHandler) hexClickHandler(getHex(q,r));
    });
  });
}
