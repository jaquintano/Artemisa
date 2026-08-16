/* Resolución de combate: apoyo entre sectores, fuerzas y desglose textual. Sin DOM. */
import { DIRS, TERRAIN, BUILDING_TYPES, SUPPORT_FACTOR } from './config.js';
import { state, getHex, isAdjacent, sectorLabel, log } from './state.js';
import { checkEliminations } from './victory.js';

export function fmtNum(n){ return Number.isInteger(n) ? String(n) : n.toFixed(1); }

/* Sectores que apoyan a `combatant` en un choque contra `foe`:
   deben ser de la misma facción que el combatiente, y lindar TANTO con el
   combatiente COMO con el sector enemigo (es decir, cubrir el mismo frente). */
export function supportersFor(combatant, foe, factionId){
  if(factionId==null) return []; // los sectores neutrales no reciben apoyo
  const out = [];
  for(const d of DIRS){
    const n = getHex(combatant.q+d[0], combatant.r+d[1]);
    if(!n || n.owner!==factionId || n.units<=0) continue;
    if(n.q===foe.q && n.r===foe.r) continue;
    if(!isAdjacent(n, foe)) continue;   // debe lindar también con el sector en disputa
    out.push(n);
  }
  return out;
}
export function supportStrength(list){
  return list.reduce((s,h)=> s + h.units*SUPPORT_FACTOR, 0);
}

export function attackPowerDetail(faction, units, source, target){
  let p = units;
  const armor = !!(faction && faction.techs.has('armor'));
  if(armor) p += 1;
  const supporters = (source && target) ? supportersFor(source, target, faction ? faction.id : null) : [];
  const support = supportStrength(supporters);
  p += support;
  const relay = !!(faction && faction.techs.has('relay'));
  if(relay) p *= 1.25;   // el relé multiplica también el apoyo coordinado
  return { total:p, units, armor, relay, supporters, support };
}
export function defensePowerDetail(faction, hex, source){
  let p = hex.units;
  const armor = !!(faction && faction.techs.has('armor'));
  if(armor) p += 1;
  const terrainBonus = TERRAIN[hex.terrain].defense;
  p += terrainBonus;
  const buildingBonus = hex.building ? BUILDING_TYPES[hex.building].defense : 0;
  p += buildingBonus;
  const neutralBonus = faction ? 0 : 1; // guarnición automática de sectores sin dueño
  p += neutralBonus;
  const supporters = (source && faction) ? supportersFor(hex, source, faction.id) : [];
  const support = supportStrength(supporters);
  p += support;
  return { total:p, units:hex.units, armor, terrainBonus, buildingBonus, neutralBonus, supporters, support };
}
export function attackPower(faction, units, source, target){ return attackPowerDetail(faction, units, source, target).total; }
export function defensePower(faction, hex, source){ return defensePowerDetail(faction, hex, source).total; }

export function supportLabel(d){
  const n = d.supporters.length;
  return `+${fmtNum(d.support)} apoyo de ${n} sector${n===1?'':'es'} adyacente${n===1?'':'s'} (${d.supporters.map(sectorLabel).join(', ')})`;
}
export function describeAttack(d){
  const parts = [`${d.units} unidades`];
  if(d.armor) parts.push('+1 Blindaje Reforzado');
  if(d.support>0) parts.push(supportLabel(d));
  if(d.relay) parts.push('×1.25 Relé Orbital');
  return parts.join(', ');
}
export function describeDefense(d, hex){
  const parts = [`${d.units} unidades`];
  if(d.armor) parts.push('+1 Blindaje Reforzado');
  if(d.terrainBonus) parts.push(`+${d.terrainBonus} terreno (${TERRAIN[hex.terrain].name})`);
  if(d.buildingBonus) parts.push(`+${d.buildingBonus} ${BUILDING_TYPES[hex.building].name}`);
  if(d.neutralBonus) parts.push('+1 guarnición neutral');
  if(d.support>0) parts.push(supportLabel(d));
  return parts.join(', ');
}

export function resolveCombat(source, target, sent){
  const atkFaction = state.factions[source.owner];
  const defFaction = target.owner!=null ? state.factions[target.owner] : null;
  const atkD = attackPowerDetail(atkFaction, sent, source, target);
  const defD = defensePowerDetail(defFaction, target, source);
  const atkDesc = describeAttack(atkD);
  const defDesc = describeDefense(defD, target);
  const atkStr = fmtNum(atkD.total), defStr = fmtNum(defD.total);
  source.units -= sent;
  source.movedUnits = Math.min(source.units, (source.movedUnits||0));

  if(atkD.total > defD.total){
    const survivors = Math.max(1, Math.round(sent - target.units));
    const prevOwnerName = defFaction ? defFaction.name : 'territorio neutral';
    target.owner = atkFaction.id;
    target.units = survivors;
    // las tropas que acaban de asaltar ya han gastado su movimiento de este turno
    target.movedUnits = survivors;
    if(target.building!=='base') target.building = null;
    log(`<b>${atkFaction.name}</b> conquista ${sectorLabel(target)} (antes: ${prevOwnerName}). `
      + `Ataque ${atkStr} [${atkDesc}] supera defensa ${defStr} [${defDesc}]. Sobreviven ${survivors} unidades.`);
    checkEliminations();
  } else {
    const survivors = Math.max(0, Math.round(target.units - sent));
    target.units = survivors;
    target.movedUnits = Math.min(target.movedUnits||0, survivors);
    log(`<b>${atkFaction.name}</b> falla el asalto sobre ${sectorLabel(target)}. `
      + `Ataque ${atkStr} [${atkDesc}] no supera defensa ${defStr} [${defDesc}]. Al defensor le quedan ${survivors} unidades.`);
  }
}
