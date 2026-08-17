/* Turnos de la IA rival: expansión, construcción, reclutamiento e investigación. */
import { BUILDING_TYPES, TECHS, TRAIN_COST } from './config.js';
import { state, neighborsOf, availableUnits, totalUnits, log } from './state.js';
import { attackPower, defensePower, resolveCombat } from './combat.js';
import { canBuild, canTrainAt, canAfford, payCost, popCap } from './economy.js';

/* La IA no gasta hasta el último recurso: exige un colchón sobre el coste para no
   quedarse sin margen de reacción justo después de construir. */
function conMargen(cost){
  return { regolith:(cost.regolith||0)+10, helium3:(cost.helium3||0)+5, ice:(cost.ice||0)+2 };
}

/* Distancia de cada sector propio al frente, en saltos por territorio propio.
   0 = linda con algo que no es nuestro, o sea que es atacable. */
function distanciasAlFrente(factionId){
  const dist = new Map();
  const cola = [];
  for(const h of state.hexes.values()){
    if(h.owner!==factionId) continue;
    if(neighborsOf(h).some(n=>n.owner!==factionId)){ dist.set(h,0); cola.push(h); }
  }
  for(let i=0;i<cola.length;i++){
    const h = cola[i], d = dist.get(h);
    for(const n of neighborsOf(h)){
      if(n.owner!==factionId || dist.has(n)) continue;
      dist.set(n, d+1); cola.push(n);
    }
  }
  return dist;
}

/* Concentración: el problema medido no era falta de tropas sino que estaban
   repartidas de una en una. Un sector que no linda con nadie hostil es
   inalcanzable este turno, así que su guarnición no defiende nada: la vuelca
   hacia el frente.
 *
 * Se procesa de más profundo a más cercano al frente para que una cadena de
 * sectores interiores avance toda en el mismo turno. Eso NO salta el límite de un
 * sector por ronda: las tropas que llegan quedan marcadas en `movedUnits`, así que
 * `availableUnits()` ya no las cuenta y no encadenan un segundo salto. */
function concentrarTropas(factionId){
  const dist = distanciasAlFrente(factionId);
  const interiores = [...dist.entries()]
    .filter(([h,d]) => d>=1 && availableUnits(h)>0)
    .sort((a,b) => b[1]-a[1]);
  for(const [h,d] of interiores){
    const envio = availableUnits(h);
    if(envio<=0) continue;
    const destinos = neighborsOf(h).filter(n => n.owner===factionId && dist.get(n)===d-1);
    if(!destinos.length) continue;
    // refuerza la pila más grande: el objetivo es formar un puño, no repartir
    destinos.sort((a,b) => b.units - a.units);
    const destino = destinos[0];
    h.units -= envio;
    destino.units += envio;
    destino.movedUnits = (destino.movedUnits||0) + envio;
  }
}

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

  // 2. Concentración: sube la retaguardia al frente para el turno que viene
  concentrarTropas(factionId);

  // 3. Construcción
  const misSectores = [...state.hexes.values()].filter(h=>h.owner===factionId);
  let puntosDeRecluta = misSectores.filter(canTrainAt).length;
  for(const h of misSectores.filter(h=>!h.building)){
    const options = Object.keys(BUILDING_TYPES).filter(t=>t!=='base' && canBuild(h,t));
    // Con el reclutamiento limitado a los edificios 'trains', quedarse corto de
    // cuarteles asfixia la expansión: mientras no llegue a uno por cada 5 sectores,
    // el Cuartel Lunar pasa por delante del resto de opciones. Ojo con el umbral:
    // si se calcula de forma que iguale a los que ya tiene, nunca se prioriza y la
    // IA se queda reclutando solo en su base.
    if(puntosDeRecluta < 1 + Math.ceil(misSectores.length/5)){
      options.sort((a,b) => (b==='barracks') - (a==='barracks'));
    }
    for(const opt of options){
      const b = BUILDING_TYPES[opt];
      if(canAfford(faction, conMargen(b.cost))){
        payCost(faction, b.cost);
        h.building = opt;
        if(b.trains) puntosDeRecluta++;
        break;
      }
    }
  }

  // 4. Entrenamiento: solo en base y cuarteles
  const cuarteles = misSectores.filter(canTrainAt);
  if(cuarteles.length && canAfford(faction, conMargen(TRAIN_COST))
     && totalUnits(faction) < popCap(faction)){
    const target = cuarteles[Math.floor(Math.random()*cuarteles.length)];
    payCost(faction, TRAIN_COST);
    target.units += 1;
  }

  // 5. Tecnología
  const nextTech = TECHS.find(t=>!faction.techs.has(t.id) && faction.resources.helium3 >= t.cost+15);
  if(nextTech){
    faction.resources.helium3 -= nextTech.cost;
    faction.techs.add(nextTech.id);
    log(`<b>${faction.name}</b> completa investigación: ${nextTech.name}`);
  }
}
