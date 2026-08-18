/* Economía: producción por turno, tope de población, construcción, entrenamiento
   e investigación. */
import { TERRAIN, BUILDING_TYPES, TECHS, TRAIN_COST } from './config.js';
import { state, sectorLabel, log, totalUnits, territoryCount } from './state.js';
import { requestRender } from './render/bus.js';

/* Producción que entrará en el próximo cierre de turno, sin aplicarla.
   La usan a la vez produceResources() para cobrarla y la barra superior para
   anunciarla: así el número que ve el jugador y el que se le abona no pueden
   separarse cuando se toquen los bonus. */
/* Una instalación cuenta solo si está en pie Y pagada. `hex.disabled` lo marca
   pagarMantenimiento() al cerrar el turno; mientras esté puesto, la instalación no
   produce, no defiende y no habilita nada. */
export function edificioActivo(hex){
  return !!hex.building && !hex.disabled;
}

/* Bonificación acumulada de las tecnologías sobre un tipo de instalación.
   Las de nivel II suman sobre las de nivel I: una Mina con las dos Perforaciones
   produce 3+2+2 = 7 de regolito. */
export function bonoTecnologico(faction, tipoEdificio){
  const total = {regolith:0, helium3:0, ice:0};
  for(const t of TECHS){
    if(!t.bono || !t.bono[tipoEdificio] || !faction.techs.has(t.id)) continue;
    for(const [rec, n] of Object.entries(t.bono[tipoEdificio])) total[rec] += n;
  }
  return total;
}

const RECURSOS = ['regolith','helium3','ice'];
const cero = () => ({regolith:0, helium3:0, ice:0});

/* Desglose de lo que entrará y saldrá en el próximo cierre de turno, separado en
 * las tres partidas que enseña el menú técnico de la barra superior: lo que dan
 * los sectores por su terreno, lo que añaden las instalaciones de extracción (con
 * sus bonos tecnológicos) y lo que se va en mantenimiento.
 *
 * Esta es la cuenta única de producción: `projectedIncome()` no repite el bucle,
 * suma estas dos partidas. Añadir un bono nuevo se hace aquí y la previsión, el
 * cobro y el desglose siguen contando lo mismo.
 *
 * El mantenimiento se devuelve en positivo (quien lo pinte decide el signo) y NO
 * se descuenta de la producción: lo cobra pagarMantenimiento() por separado, así
 * que restarlo dentro de projectedIncome lo cobraría dos veces. `neto` es lo que
 * de verdad varía el montón de recursos de un turno al siguiente. */
export function desgloseIngresos(faction){
  const terreno = cero(), edificios = cero();
  for(const h of state.hexes.values()){
    if(h.owner!==faction.id) continue;
    const t = TERRAIN[h.terrain];
    terreno.regolith += t.regolith; terreno.helium3 += t.helium3; terreno.ice += t.ice;
    if(!edificioActivo(h)) continue;
    const b = BUILDING_TYPES[h.building];
    const bono = bonoTecnologico(faction, h.building);
    edificios.regolith += b.produce.regolith + bono.regolith;
    edificios.helium3  += b.produce.helium3  + bono.helium3;
    edificios.ice      += b.produce.ice      + bono.ice;
  }
  const mantenimiento = mantenimientoDe(faction);
  const neto = cero();
  for(const r of RECURSOS) neto[r] = terreno[r] + edificios[r] - mantenimiento[r];
  return { terreno, edificios, mantenimiento, neto };
}

/* Producción bruta del próximo turno, sin descontar mantenimiento: es lo que
   abona produceResources(). Para lo que realmente se gana o se pierde en el turno,
   usa `desgloseIngresos(faction).neto`. */
export function projectedIncome(faction){
  const { terreno, edificios } = desgloseIngresos(faction);
  const gain = cero();
  for(const r of RECURSOS) gain[r] = terreno[r] + edificios[r];
  return gain;
}

/* Mantenimiento total que debe la facción este turno. */
export function mantenimientoDe(faction){
  const total = {regolith:0, helium3:0, ice:0};
  for(const h of state.hexes.values()){
    if(h.owner!==faction.id || !h.building) continue;
    const up = BUILDING_TYPES[h.building].upkeep;
    if(!up) continue;
    total.regolith += up.regolith||0; total.helium3 += up.helium3||0; total.ice += up.ice||0;
  }
  return total;
}

/* Cobra el mantenimiento y apaga lo que no se pueda pagar.
 *
 * El orden importa cuando no llega para todo, así que es fijo y no aleatorio: la
 * Base primero (perderla deja sin reclutar), luego los Cuarteles, luego el
 * Laboratorio y por último las Torretas. Así una facción arruinada conserva la
 * capacidad de rehacerse antes que sus defensas.
 *
 * Un edificio apagado no se destruye: vuelve a encenderse solo en cuanto haya
 * recursos para pagarlo. */
const PRIORIDAD_MANTENIMIENTO = ['base', 'barracks', 'lab', 'turret'];

export function pagarMantenimiento(){
  for(const faction of state.factions){
    if(!faction.alive) continue;
    const suyos = [...state.hexes.values()].filter(h => h.owner===faction.id && h.building);
    suyos.sort((a,b) => PRIORIDAD_MANTENIMIENTO.indexOf(a.building) -
                        PRIORIDAD_MANTENIMIENTO.indexOf(b.building));
    let apagados = 0;
    for(const h of suyos){
      const up = BUILDING_TYPES[h.building].upkeep;
      if(!up){ h.disabled = false; continue; }
      if(canAfford(faction, up)){
        payCost(faction, up);
        h.disabled = false;
      } else {
        if(!h.disabled) apagados++;
        h.disabled = true;
      }
    }
    if(apagados && faction.isPlayer){
      log(`<b>Sin mantenimiento:</b> ${apagados} instalación(es) se han desactivado por falta de recursos.`);
    }
  }
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

/* Cuenta cuántas instalaciones de un tipo tiene ya la facción, para los `unique`. */
export function cuantasTiene(faction, tipo){
  let n = 0;
  for(const h of state.hexes.values()) if(h.owner===faction.id && h.building===tipo) n++;
  return n;
}

export function canBuild(hex, type, faction = state.factions[0]){
  const b = BUILDING_TYPES[type];
  if(!b.allowed.includes(hex.terrain) || hex.building) return false;
  // el Laboratorio está limitado a uno por facción en todo el mapa
  if(b.unique && cuantasTiene(faction, type) > 0) return false;
  return true;
}

/* ¿Tiene la facción algún edificio activo que habilite esta función?
   Hoy solo el Laboratorio habilita cosas: 'research' y 'hoppers'. */
export function habilitado(faction, funcion){
  for(const h of state.hexes.values()){
    if(h.owner!==faction.id || !edificioActivo(h)) continue;
    const b = BUILDING_TYPES[h.building];
    if(b.enables && b.enables.includes(funcion)) return true;
  }
  return false;
}

/* Las guarniciones solo salen de un edificio marcado con `trains`: la Base
   Principal y el Cuartel Lunar. Perder todos ellos —o quedarse sin pagarlos—
   deja a la facción sin poder reponer tropas. */
export function canTrainAt(hex){
  return edificioActivo(hex) && !!BUILDING_TYPES[hex.building].trains;
}

/* Requisitos de una investigación: Laboratorio activo siempre, y la tecnología
   previa cuando la haya. */
export function puedeInvestigar(faction, tech){
  if(faction.techs.has(tech.id)) return false;
  if(!habilitado(faction, 'research')) return false;
  if(tech.requiere && !faction.techs.has(tech.requiere)) return false;
  return true;
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
  if(!puedeInvestigar(faction, tech) || faction.resources.helium3 < tech.cost) return;
  faction.resources.helium3 -= tech.cost;
  faction.techs.add(techId);
  // La tecnología Hopper no surte efecto hasta el turno siguiente: se anota en qué
  // ronda se completó para que el Laboratorio no pueda fabricar el mismo turno.
  if(techId === 'hopper') faction.hopperDesdeRonda = state.turn + 1;
  log(`Tecnología investigada: <b>${tech.name}</b>`);
  requestRender();
}
