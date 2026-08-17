/* Economía: producción por turno, tope de población, construcción, entrenamiento
   e investigación. */
import { TERRAIN, BUILDING_TYPES, TECHS, TRAIN_COST } from './config.js';
import { state, sectorLabel, log, totalUnits, territoryCount } from './state.js';
import { requestRender } from './render/bus.js';

/* Producción que entrará en el próximo cierre de turno, sin aplicarla.
   La usan a la vez produceResources() para cobrarla y la barra superior para
   anunciarla: así el número que ve el jugador y el que se le abona no pueden
   separarse cuando se toquen los bonus. */
export function projectedIncome(faction){
  const gain = {regolith:0, helium3:0, ice:0};
  for(const h of state.hexes.values()){
    if(h.owner!==faction.id) continue;
    const t = TERRAIN[h.terrain];
    gain.regolith += t.regolith; gain.helium3 += t.helium3; gain.ice += t.ice;
    if(h.building){
      const b = BUILDING_TYPES[h.building];
      gain.regolith += b.produce.regolith;
      gain.helium3  += b.produce.helium3;
      gain.ice      += b.produce.ice;
      if(h.building==='mine'      && faction.techs.has('drilling')) gain.regolith += 2;
      if(h.building==='melter'    && faction.techs.has('cryo'))     gain.ice      += 2;
      if(h.building==='extractor' && faction.techs.has('fusion'))   gain.helium3  += 2;
    }
  }
  return gain;
}

/* Tope de población: 4 de base, más la producción de hielo por turno, más un
   punto por cada sector controlado.
 *
 * Depende del *flujo* de hielo, no del montón acumulado: acaparar ya no sirve de
 * nada, hay que sostener la producción. Y como cada sector suma, expandirse es lo
 * que financia el ejército con el que sigues expandiéndote — esa es la tensión
 * que persigue la regla. Perder terreno o quedarte sin casquetes encoge el tope
 * de golpe, y una facción puede quedar por encima de él: eso solo impide reclutar,
 * nunca destruye tropas ya existentes. */
export function popCap(faction){
  return 4 + projectedIncome(faction).ice + territoryCount(faction);
}

export function produceResources(){
  for(const faction of state.factions){
    if(!faction.alive) continue;
    const gain = projectedIncome(faction);
    faction.resources.regolith += gain.regolith;
    faction.resources.helium3  += gain.helium3;
    faction.resources.ice      += gain.ice;
    if(faction.isPlayer){
      log(`Producción: +${gain.regolith} regolito, +${gain.helium3} helio-3, +${gain.ice} hielo`);
    }
  }
}

/* Los costes se declaran con los tres recursos, pero se leen con `|| 0` para que
   un coste parcial escrito a mano no rompa las cuentas en silencio. */
export function canAfford(faction, cost){
  return faction.resources.regolith >= (cost.regolith || 0)
      && faction.resources.helium3  >= (cost.helium3  || 0)
      && faction.resources.ice      >= (cost.ice      || 0);
}
export function payCost(faction, cost){
  faction.resources.regolith -= (cost.regolith || 0);
  faction.resources.helium3  -= (cost.helium3  || 0);
  faction.resources.ice      -= (cost.ice      || 0);
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
