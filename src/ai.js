/* Turnos de la IA rival: expansión, construcción, reclutamiento e investigación. */
import { BUILDING_TYPES, TECHS } from './config.js';
import { state, neighborsOf, availableUnits, popCap, totalUnits, log } from './state.js';
import { attackPower, defensePower, resolveCombat } from './combat.js';
import { canBuild } from './economy.js';

export function aiTakeTurn(factionId){
  const faction = state.factions[factionId];
  if(!faction.alive) return;

  // 1. Ataques/expansión (solo con tropas que no hayan gastado su movimiento este turno)
  const myHexes = [...state.hexes.values()].filter(h=>h.owner===factionId && availableUnits(h)>1);
  for(const h of myHexes){
    const sendable = Math.max(0, availableUnits(h)-1);
    if(sendable<=0) continue;
    const targets = neighborsOf(h).filter(n=>n.owner!==factionId);
    if(!targets.length) continue;
    // evalúa cada objetivo con el apoyo real de ambos bandos en ese frente concreto
    targets.sort((a,b)=>{
      const da = defensePower(a.owner!=null?state.factions[a.owner]:null, a, h);
      const db = defensePower(b.owner!=null?state.factions[b.owner]:null, b, h);
      return da - db;
    });
    const best = targets[0];
    const defFaction = best.owner!=null ? state.factions[best.owner] : null;
    const def = defensePower(defFaction, best, h);
    if(attackPower(faction, sendable, h, best) > def+0.5){
      resolveCombat(h, best, sendable);
    }
  }

  // 2. Construcción
  const buildable = [...state.hexes.values()].filter(h=>h.owner===factionId && !h.building);
  for(const h of buildable){
    const options = Object.keys(BUILDING_TYPES).filter(t=>t!=='base' && canBuild(h,t));
    for(const opt of options){
      const b = BUILDING_TYPES[opt];
      if(faction.resources.regolith>=b.cost.regolith+10 && faction.resources.helium3>=b.cost.helium3+5){
        faction.resources.regolith -= b.cost.regolith;
        faction.resources.helium3 -= b.cost.helium3;
        h.building = opt;
        break;
      }
    }
  }

  // 3. Entrenamiento
  const border = [...state.hexes.values()].filter(h=>h.owner===factionId);
  if(border.length){
    const target = border[Math.floor(Math.random()*border.length)];
    const cost = {regolith:12, helium3:4};
    if(faction.resources.regolith>=cost.regolith+10 && faction.resources.helium3>=cost.helium3
       && totalUnits(faction) < popCap(faction)){
      faction.resources.regolith -= cost.regolith;
      faction.resources.helium3 -= cost.helium3;
      target.units += 1;
    }
  }

  // 4. Tecnología
  const nextTech = TECHS.find(t=>!faction.techs.has(t.id) && faction.resources.helium3 >= t.cost+15);
  if(nextTech){
    faction.resources.helium3 -= nextTech.cost;
    faction.techs.add(nextTech.id);
    log(`<b>${faction.name}</b> completa investigación: ${nextTech.name}`);
  }
}
