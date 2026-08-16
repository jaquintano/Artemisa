/* Economía: producción por turno, construcción, entrenamiento e investigación. */
import { TERRAIN, BUILDING_TYPES, TECHS, TRAIN_COST } from './config.js';
import { state, sectorLabel, log, popCap, totalUnits } from './state.js';
import { requestRender } from './render/bus.js';

export function produceResources(){
  for(const faction of state.factions){
    if(!faction.alive) continue;
    const gain = {regolith:0, helium3:0, water:0};
    for(const h of state.hexes.values()){
      if(h.owner!==faction.id) continue;
      const t = TERRAIN[h.terrain];
      gain.regolith += t.regolith; gain.helium3 += t.helium3; gain.water += t.water;
      if(h.building){
        const b = BUILDING_TYPES[h.building];
        gain.regolith += b.produce.regolith;
        gain.helium3  += b.produce.helium3;
        gain.water    += b.produce.water;
        if(h.building==='mine' && faction.techs.has('drilling')) gain.regolith += 2;
        if(h.building==='melter' && faction.techs.has('cryo')) gain.water += 2;
        if(h.building==='extractor' && faction.techs.has('fusion')) gain.helium3 += 2;
      }
    }
    faction.resources.regolith += gain.regolith;
    faction.resources.helium3  += gain.helium3;
    faction.resources.water    += gain.water;
    if(faction.isPlayer){
      log(`Producción: +${gain.regolith} regolito, +${gain.helium3} helio-3, +${gain.water} agua`);
    }
  }
}

/* Los costes se declaran con los tres recursos, pero se leen con `|| 0` para que
   un coste parcial escrito a mano no rompa las cuentas en silencio. */
export function canAfford(faction, cost){
  return faction.resources.regolith >= (cost.regolith || 0)
      && faction.resources.helium3  >= (cost.helium3  || 0)
      && faction.resources.water    >= (cost.water    || 0);
}
export function payCost(faction, cost){
  faction.resources.regolith -= (cost.regolith || 0);
  faction.resources.helium3  -= (cost.helium3  || 0);
  faction.resources.water    -= (cost.water    || 0);
}

export function canBuild(hex, type){
  const b = BUILDING_TYPES[type];
  return b.allowed.includes(hex.terrain) && !hex.building;
}

/* Las guarniciones solo salen de un edificio marcado con `trains`: la Base
   Principal y el Cuartel Lunar. Perder todos ellos deja a la facción sin poder
   reponer tropas, que es justo la tensión que persigue la regla. */
export function canTrainAt(hex){
  return !!hex.building && !!BUILDING_TYPES[hex.building].trains;
}

export function buildBuilding(hex, type){
  const faction = state.factions[0];
  const b = BUILDING_TYPES[type];
  if(!canBuild(hex,type)) return;
  if(!canAfford(faction, b.cost)) return;
  payCost(faction, b.cost);
  hex.building = type;
  log(`Construida <b>${b.name}</b> en ${sectorLabel(hex)}`);
  requestRender();
}

export function trainUnit(hex){
  const faction = state.factions[0];
  if(!canTrainAt(hex)) return;
  if(!canAfford(faction, TRAIN_COST)) return;
  if(totalUnits(faction) >= popCap(faction)) return;
  payCost(faction, TRAIN_COST);
  hex.units += 1;
  log(`Nueva unidad entrenada en ${sectorLabel(hex)}`);
  requestRender();
}

export function research(techId){
  const faction = state.factions[0];
  const tech = TECHS.find(t=>t.id===techId);
  if(faction.techs.has(techId) || faction.resources.helium3 < tech.cost) return;
  faction.resources.helium3 -= tech.cost;
  faction.techs.add(techId);
  log(`Tecnología investigada: <b>${tech.name}</b>`);
  requestRender();
}
