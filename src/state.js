/* Estado de la partida y consultas sobre la rejilla hexagonal. Sin DOM. */
import { RADIUS, DIRS, TERRAIN, TERRAIN_WEIGHTS, FACTION_DEFS } from './config.js';

/* Binding vivo: los módulos que lo importan ven las reasignaciones hechas aquí.
   Para sustituirlo por completo hay que usar setState(). */
export let state = null;
export function setState(s){ state = s; }

export function hexKey(q,r){ return q+','+r; }

export function newState(){
  const hexes = new Map();
  for(let q=-RADIUS; q<=RADIUS; q++){
    const r1 = Math.max(-RADIUS, -q-RADIUS), r2 = Math.min(RADIUS, -q+RADIUS);
    for(let r=r1; r<=r2; r++){
      const s = -q-r;
      const terrain = weightedTerrain();
      hexes.set(hexKey(q,r), { q,r,s, terrain, owner:null, building:null, units:0, movedUnits:0 });
    }
  }
  const factions = FACTION_DEFS.map(f=>({
    id:f.id, name:f.name, color:f.color, dim:f.dim, isPlayer:f.isPlayer, alive:true,
    resources:{ regolith:60, helium3:25, ice:20 },
    techs:new Set(),
  }));

  const corners = [
    [RADIUS,-RADIUS], [0,RADIUS], [-RADIUS,0]
  ];
  corners.forEach((c,i)=>{
    const h = hexes.get(hexKey(c[0],c[1]));
    h.terrain = 'mare';
    h.owner = i;
    h.building = 'base';
    h.units = 6;
  });

  // guarniciones neutrales
  for(const h of hexes.values()){
    if(h.owner===null){
      const t = TERRAIN[h.terrain];
      h.units = (t.defense>=1) ? (1+Math.floor(Math.random()*3)) : (Math.random()<0.5?1:0);
    }
  }

  return { hexes, factions, turn:1, phase:'player', gameOver:false, selected:null, pending:null, log:[] };
}

export function weightedTerrain(){
  const r = Math.random();
  let acc=0;
  for(const [name,w] of TERRAIN_WEIGHTS){ acc+=w; if(r<=acc) return name; }
  return 'mare';
}

export function getHex(q,r){ return state.hexes.get(hexKey(q,r)); }
export function neighborsOf(h){
  return DIRS.map(d=>getHex(h.q+d[0], h.r+d[1])).filter(Boolean);
}
export function sectorLabel(h){
  const col = String.fromCharCode(65 + (h.q + RADIUS));
  const row = h.r + RADIUS + 1;
  return `Sector ${col}${row}`;
}
/* popCap() vive en economy.js: depende de la producción de hielo, que se calcula
   allí, y traerla aquí crearía un ciclo de imports entre estado y economía. */
export function totalUnits(faction){
  let n=0; for(const h of state.hexes.values()) if(h.owner===faction.id) n+=h.units;
  return n;
}
export function territoryCount(faction){
  let n=0; for(const h of state.hexes.values()) if(h.owner===faction.id) n++;
  return n;
}

export function log(msg){
  state.log.push({turn:state.turn, msg});
  if(state.log.length>80) state.log.shift();
}

export function isAdjacent(a,b){
  return DIRS.some(d => a.q+d[0]===b.q && a.r+d[1]===b.r);
}

/* Unidades de un sector que aún no han gastado su movimiento este turno. */
export function availableUnits(hex){ return Math.max(0, hex.units - (hex.movedUnits||0)); }

/* Reinicia el gasto de movimiento de todas las guarniciones al empezar una nueva ronda. */
export function resetMovement(){
  for(const h of state.hexes.values()) h.movedUnits = 0;
}
