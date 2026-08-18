/* Turno de la IA rival en SEIS fases, en el orden fijado por el diseño:
 *   1. Mantenimiento y logística  (reserva de recursos)
 *   2. Evaluación de tropas y reclutamiento
 *   3. Ataque quirúrgico de alta probabilidad
 *   4. Maniobra y posicionamiento de apoyo
 *   5. Inversión en desarrollo tecnológico
 *   6. Expansión de infraestructura económica y militar
 *
 * Sobre la Fase 1: el cobro REAL del mantenimiento no ocurre aquí, sino en
 * pagarMantenimiento() al cerrar el turno (es global y afecta a todas las
 * facciones). Pagarlo también aquí cobraría dos veces. Así que esta fase no
 * "paga": aparta una reserva de recursos igual al mantenimiento debido para que
 * las fases siguientes no la gasten, y la IA nunca se quede sin cubrir sus
 * edificios. El apagado selectivo de torretas/cuarteles sigue viviendo en
 * economy.js; reservar de antemano evita entrar en esa situación. */
import { BUILDING_TYPES, TECHS, TRAIN_COST, HOPPER } from './config.js';
import { state, neighborsOf, availableUnits, totalUnits, log } from './state.js';
import { attackPower, defensePower, resolveCombat } from './combat.js';
import { canBuild, canTrainAt, canAfford, payCost, popCap,
         mantenimientoDe, puedeInvestigar } from './economy.js';
import { hoppersEn, destinosPosibles, saltar,
         puedeFabricarHopper, fabricarHopper } from './hopper.js';

/* ---------- Reserva de mantenimiento (Fase 1) ---------- */

/* Recursos que la IA aparta antes de gastar: el mantenimiento debido más un
   pequeño colchón, para no quedar justo al borde del apagón tras invertir. */
function reservaDe(faction){
  const m = mantenimientoDe(faction);
  return { regolith:(m.regolith||0), helium3:(m.helium3||0)+1, ice:(m.ice||0)+1 };
}

/* ¿Puede pagar `cost` conservando intacta la reserva? */
function puedoGastar(faction, cost, reserva){
  return canAfford(faction, {
    regolith:(cost.regolith||0)+(reserva.regolith||0),
    helium3: (cost.helium3 ||0)+(reserva.helium3 ||0),
    ice:     (cost.ice     ||0)+(reserva.ice     ||0),
  });
}

/* ---------- Geografía del frente ---------- */

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

/* Sectores propios que lindan con algo no propio: la línea atacable. */
function sectoresFrontera(factionId){
  return [...state.hexes.values()].filter(h =>
    h.owner===factionId && neighborsOf(h).some(n => n.owner!==factionId));
}

function contarHoppers(faction){
  let n=0;
  for(const h of state.hexes.values()) if(h.owner===faction.id) n+=hoppersEn(h);
  return n;
}

/* ---------- Evaluación de ataques (Fases 2 y 3) ---------- */

/* Orden de captura del Paso 3: 1º Parajes Helados, 2º Cráteres, 3º sectores con
   edificio enemigo, 4º Mare (y el resto). Menor número = mayor prioridad. */
function prioridadTerreno(h){
  if(h.terrain==='ice') return 0;
  if(h.terrain==='crater') return 1;
  if(h.building) return 2;
  return 3;
}

/* Mejor asalto GANADO desde `source`: el objetivo no propio adyacente cuya
   defensa (con su terreno, instalación y apoyos) sea estrictamente inferior a
   nuestra fuerza de ataque neta. Entre los que garantizan la victoria elige por
   prioridad de captura y, a igualdad, el de menor defensa. null si ninguno la
   garantiza al 100 %. Se deja 1 tropa de guarnición en el origen. */
function mejorObjetivo(faction, source){
  const sendable = Math.max(0, availableUnits(source)-1);
  if(sendable<=0) return null;
  let best=null;
  for(const t of neighborsOf(source)){
    if(t.owner===faction.id) continue;
    const defF = t.owner!=null ? state.factions[t.owner] : null;
    const def = defensePower(defF, t, source);
    if(attackPower(faction, sendable, source, t) <= def) continue; // sin victoria segura
    if(!best){ best={source, target:t, sendable, def}; continue; }
    const pa = prioridadTerreno(t), pb = prioridadTerreno(best.target);
    if(pa < pb || (pa===pb && def < best.def)) best={source, target:t, sendable, def};
  }
  return best;
}

/* ---------- Fase 2: evaluación de tropas y reclutamiento ---------- */

function faseReclutamiento(faction, reserva, dist){
  // Si ya hay algún asalto con victoria garantizada, no fuerza reclutamiento:
  // ese ejército del frente ya supera a la loseta rival más débil.
  const hayAsalto = sectoresFrontera(faction.id).some(s => mejorObjetivo(faction, s));
  if(hayAsalto) return;

  // Prioridad: fabricar 1 Transportador si tiene la tecnología y no hay ninguno.
  if(faction.techs.has('hopper') && contarHoppers(faction)===0){
    const lab = [...state.hexes.values()].find(h => puedeFabricarHopper(faction, h));
    if(lab && puedoGastar(faction, HOPPER.cost, reserva)) fabricarHopper(lab);
  }

  // Sin superioridad en el frente: engorda el ejército hasta el tope de población.
  // Se apila en el cuartel MÁS adelantado para formar un puño capaz de romper una
  // loseta ya en la Fase 3 de este mismo turno (las tropas recién reclutadas no
  // han gastado movimiento).
  const cuarteles = [...state.hexes.values()]
    .filter(h => h.owner===faction.id && canTrainAt(h))
    .sort((a,b)=> (dist.get(a)??99) - (dist.get(b)??99));
  if(!cuarteles.length) return;
  const destino = cuarteles[0];
  while(totalUnits(faction) < popCap(faction) && puedoGastar(faction, TRAIN_COST, reserva)){
    payCost(faction, TRAIN_COST);
    destino.units += 1;
  }
}

/* ---------- Fase 3: ataque quirúrgico de alta probabilidad ---------- */

function faseAtaque(faction){
  // Recolecta el mejor asalto ganador de cada origen del frente y los ejecuta en
  // orden de prioridad de captura (helados, cráteres, edificios, mare).
  const candidatos = [];
  for(const source of sectoresFrontera(faction.id)){
    const op = mejorObjetivo(faction, source);
    if(op) candidatos.push(op);
  }
  candidatos.sort((a,b)=> prioridadTerreno(a.target)-prioridadTerreno(b.target) || a.def-b.def);

  let atacó = false;
  for(const op of candidatos){
    if(op.target.owner===faction.id) continue;            // ya capturado por otro asalto
    const sendable = Math.max(0, availableUnits(op.source)-1);
    if(sendable<=0) continue;                             // origen ya gastado en otro asalto
    const defF = op.target.owner!=null ? state.factions[op.target.owner] : null;
    const def = defensePower(defF, op.target, op.source);
    if(attackPower(faction, sendable, op.source, op.target) > def){
      resolveCombat(op.source, op.target, sendable);
      atacó = true;
    }
  }
  return atacó;
}

/* ---------- Fase 4: maniobra y posicionamiento de apoyo ---------- */

/* Concentración: el problema medido no era falta de tropas sino que estaban
   repartidas de una en una. Un sector que no linda con nadie hostil es
   inalcanzable este turno, así que su guarnición no defiende nada: la vuelca
   hacia el frente. Es la única palanca que de verdad movió el balance (ver
   CLAUDE.md). Se procesa de más profundo a más cercano al frente para que una
   cadena de sectores interiores avance toda en el mismo turno, sin saltarse el
   límite de un sector por ronda (lo que llega queda marcado en movedUnits). */
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
    destinos.sort((a,b) => b.units - a.units);  // refuerza la pila mayor: un puño, no reparto
    const destino = destinos[0];
    h.units -= envio;
    destino.units += envio;
    destino.movedUnits = (destino.movedUnits||0) + envio;
  }
}

/* Salto del Transportador hacia el frente: si un hopper con tropas está en la
   retaguardia, las lleva de golpe a un sector propio fronterizo en vez de
   gastarlas caminando un sector por ronda. Prepara el puño del turno siguiente. */
function saltarHopperAlFrente(faction, dist){
  for(const origen of state.hexes.values()){
    if(origen.owner!==faction.id || hoppersEn(origen)<=0) continue;
    if(availableUnits(origen)<=0 || (dist.get(origen)??0)===0) continue;
    const destinos = destinosPosibles(origen)
      .filter(d => d.owner===faction.id && (dist.get(d)??99)===0)
      .sort((a,b)=> b.units - a.units);
    if(destinos.length){
      saltar(origen, destinos[0], HOPPER.capacidad);
      return;   // un salto por turno basta para no vaciar la retaguardia de golpe
    }
  }
}

/* La concentración de retaguardia corre SIEMPRE (mueve tropas interiores que no
   podían atacar este turno, así que no compite con la Fase 3 y es la palanca de
   balance de CLAUDE.md). El salto del Transportador al frente es la maniobra
   discrecional de la Fase 4 propiamente dicha: solo cuando no se atacó. */
function faseManiobra(faction, dist, atacó){
  if(!atacó) saltarHopperAlFrente(faction, dist);
  concentrarTropas(faction.id);
}

/* ---------- Fase 5: inversión en desarrollo tecnológico ---------- */

/* Investiga una tecnología para `faction`. Replica research() de economy.js
   (que está cableado al jugador) para una facción cualquiera. La línea del
   hopper es imprescindible: sin ella hopperDesdeRonda queda a Infinity y la IA
   nunca podría fabricar Transportadores pese a tener la tecnología. */
function investigar(faction, tech){
  faction.resources.helium3 -= tech.cost;
  faction.techs.add(tech.id);
  if(tech.id==='hopper') faction.hopperDesdeRonda = state.turn + 1;
  log(`<b>${faction.name}</b> completa investigación: ${tech.name}`);
}

function faseTecnologia(faction, reserva){
  const lab = [...state.hexes.values()].find(h => h.owner===faction.id && h.building==='lab');
  // Sin Laboratorio: constrúyelo en una casilla vacía de Mare si puede pagarlo.
  if(!lab){
    const sitio = [...state.hexes.values()].find(h =>
      h.owner===faction.id && h.terrain==='mare' && canBuild(h,'lab',faction));
    if(sitio && puedoGastar(faction, BUILDING_TYPES.lab.cost, reserva)){
      payCost(faction, BUILDING_TYPES.lab.cost);
      sitio.building = 'lab';
    }
    return;   // recién construido: aún no investiga este turno
  }
  // Con Laboratorio: investiga por prioridad estricta. Fusión solo si controla
  // algún Cráter (donde el Extractor rinde más).
  const controlaCrater = [...state.hexes.values()]
    .some(h => h.owner===faction.id && h.terrain==='crater');
  const orden = ['hopper','armor','relay','fusion1','fusion2'];
  for(const id of orden){
    if((id==='fusion1'||id==='fusion2') && !controlaCrater) continue;
    const tech = TECHS.find(t=>t.id===id);
    if(!puedeInvestigar(faction, tech)) continue;
    // Solo gasta He-3 remanente tras la reserva de mantenimiento.
    if(faction.resources.helium3 < tech.cost + (reserva.helium3||0)) break;
    investigar(faction, tech);
    break;   // una investigación por turno
  }
}

/* ---------- Fase 6: expansión de infraestructura ---------- */

function faseConstruccion(faction, reserva, dist){
  // Una sola instalación por turno, respetando la geografía: en el frente,
  // torreta o cuartel; en retaguardia segura, economía (extractor, fusor y, como
  // última opción, mina). Se prueban los sectores del frente primero.
  const vacios = [...state.hexes.values()]
    .filter(h => h.owner===faction.id && !h.building)
    .sort((a,b)=> (dist.get(a)??99) - (dist.get(b)??99));

  for(const h of vacios){
    const enFrente = (dist.get(h)??99)===0;
    let candidatos;
    if(enFrente){
      candidatos = ['turret','barracks'];
    } else {
      candidatos = [];
      if(h.terrain==='crater' || h.terrain==='highlands') candidatos.push('extractor');
      if(h.terrain==='ice') candidatos.push('melter');
      candidatos.push('mine');   // última opción, en Mare
    }
    for(const tipo of candidatos){
      const b = BUILDING_TYPES[tipo];
      if(!canBuild(h, tipo, faction)) continue;
      // La torreta añade mantenimiento en He-3: no la levantes si no puedes
      // sostenerlo (se suma a la reserva antes de comprobar el pago).
      const reservaEfectiva = tipo==='turret'
        ? { ...reserva, helium3:(reserva.helium3||0) + (b.upkeep?.helium3||0) }
        : reserva;
      if(!puedoGastar(faction, b.cost, reservaEfectiva)) continue;
      payCost(faction, b.cost);
      h.building = tipo;
      return;   // una única instalación por turno
    }
  }
}

/* ---------- Turno completo ---------- */

export function aiTakeTurn(factionId){
  const faction = state.factions[factionId];
  if(!faction.alive) return;

  // Fase 1: reserva de mantenimiento (el cobro real lo hace pagarMantenimiento()).
  const reserva = reservaDe(faction);
  const dist = distanciasAlFrente(factionId);

  // Fase 2: evaluación de tropas y reclutamiento.
  faseReclutamiento(faction, reserva, dist);

  // Fase 3: ataque quirúrgico de alta probabilidad.
  const atacó = faseAtaque(faction);

  // Fase 4: maniobra de apoyo (ver faseManiobra: concentración siempre, salto solo
  // si no hubo ataque).
  faseManiobra(faction, dist, atacó);

  // Fase 5: desarrollo tecnológico.
  faseTecnologia(faction, reserva);

  // Fase 6: expansión de infraestructura (recalcula el frente tras las conquistas).
  faseConstruccion(faction, reserva, distanciasAlFrente(factionId));
}
