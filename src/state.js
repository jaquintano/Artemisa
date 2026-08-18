/* Estado de la partida y consultas sobre la rejilla hexagonal. Sin DOM.
   El tablero lo construye src/mapgen.js; aquí solo se consulta y se muta. */
import { DIRS, PLAYER_COUNT } from './config.js';
import { generarMapa, faccionesDe, hexKey as claveHex } from './mapgen.js';

/* Binding vivo: los módulos que lo importan ven las reasignaciones hechas aquí.
   Para sustituirlo por completo hay que usar setState(). */
export let state = null;
export function setState(s){ state = s; }

export const hexKey = claveHex;

export function newState(jugadores = PLAYER_COUNT){
  // el tablero, las bases y las guarniciones neutrales salen ya listos de mapgen
  const { hexes, radius } = generarMapa(jugadores);

  const factions = faccionesDe(jugadores).map(f=>({
    id:f.id, name:f.name, color:f.color, dim:f.dim, isPlayer:f.isPlayer, alive:true,
    resources:{ regolith:60, helium3:25, ice:20 },
    techs:new Set(),
    kills:0,   // unidades rivales destruidas; puntúa para la victoria técnica
  }));

  return { hexes, factions, radius, jugadores, turn:1, phase:'player',
           gameOver:false, selected:null, pending:null, log:[] };
}

export function getHex(q,r){ return state.hexes.get(hexKey(q,r)); }
export function neighborsOf(h){
  return DIRS.map(d=>getHex(h.q+d[0], h.r+d[1])).filter(Boolean);
}
export function sectorLabel(h){
  // el radio ya no es constante: depende del número de jugadores
  const col = String.fromCharCode(65 + (h.q + state.radius));
  const row = h.r + state.radius + 1;
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
