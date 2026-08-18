/* Transportador (Hopper): unidad de transporte. Sin DOM.
 *
 * Es una guarnición sin fuerza de combate: no ataca, no defiende y no cuenta en
 * ningún cálculo de combate. Su único cometido es dar un salto de hasta 2 casillas
 * llevándose hasta 4 tropas de infantería de su misma loseta, para reforzar un
 * frente sin recorrer el camino andando a un sector por ronda.
 *
 * Se guardan aparte de `hex.units` a propósito: esa cifra es la infantería y la
 * usa medio juego (combate, apoyo, tope de población). Meter aquí los hoppers
 * habría obligado a descontarlos en cada uno de esos sitios, con un fallo latente
 * en cada olvido. `hex.hoppers` es un contador independiente.
 */
import { HOPPER, BUILDING_TYPES } from './config.js';
import { state, sectorLabel, log, getHex, availableUnits } from './state.js';
import { distancia } from './mapgen.js';
import { edificioActivo, habilitado, canAfford, payCost } from './economy.js';
import { requestRender } from './render/bus.js';

export function hoppersEn(hex){ return hex.hoppers || 0; }

/* Un Laboratorio activo puede fabricar transportes si la facción investigó la
   tecnología y ya pasó el turno en que la completó (regla: nunca el mismo turno). */
export function puedeFabricarHopper(faction, hex){
  if(!edificioActivo(hex) || hex.building !== 'lab') return false;
  if(hex.owner !== faction.id) return false;
  if(!habilitado(faction, 'hoppers')) return false;
  if(!faction.techs.has('hopper')) return false;
  return state.turn >= (faction.hopperDesdeRonda ?? Infinity);
}

export function fabricarHopper(hex){
  const faction = state.factions[hex.owner];
  if(!puedeFabricarHopper(faction, hex)) return false;
  if(!canAfford(faction, HOPPER.cost)) return false;
  payCost(faction, HOPPER.cost);
  hex.hoppers = hoppersEn(hex) + 1;
  log(`<b>${HOPPER.name}</b> fabricado en ${sectorLabel(hex)}`);
  requestRender();
  return true;
}

/* Una Torreta rival activa niega el aire sobre su casilla: ni se puede aterrizar
   en ella ni sobrevolarla. */
export function torretaEnemigaActiva(hex, factionId){
  return hex.owner != null && hex.owner !== factionId &&
         hex.building === 'turret' && edificioActivo(hex) &&
         BUILDING_TYPES.turret.blocksHoppers;
}

/* ¿Es válido el salto de `origen` a `destino` para la facción dada?
 *
 * El destino debe estar a 2 casillas o menos, libre de guarniciones y de
 * instalaciones rivales (cuartel general o torreta), y hace falta al menos una
 * ruta hasta él que no sobrevuele una torreta enemiga activa. */
export function destinoValido(origen, destino, factionId){
  if(!destino || destino === origen) return false;
  if(distancia(origen, destino) > HOPPER.alcance) return false;
  // libre de guarniciones enemigas y de instalaciones rivales que lo defiendan
  if(destino.owner != null && destino.owner !== factionId){
    if(destino.units > 0) return false;
    if(destino.building === 'base' || destino.building === 'turret') return false;
  }
  if(destino.owner == null && destino.units > 0) return false;
  if(torretaEnemigaActiva(destino, factionId)) return false;
  return hayRutaAerea(origen, destino, factionId);
}

/* Con alcance 2, un salto o pasa por una casilla intermedia o es a un vecino.
   Basta con que exista UNA intermedia despejada de torretas enemigas. */
function hayRutaAerea(origen, destino, factionId){
  if(distancia(origen, destino) <= 1) return true;
  for(const h of state.hexes.values()){
    if(distancia(origen, h) === 1 && distancia(h, destino) === 1 &&
       !torretaEnemigaActiva(h, factionId)) return true;
  }
  return false;
}

export function destinosPosibles(origen){
  if(hoppersEn(origen) <= 0) return [];
  return [...state.hexes.values()].filter(d => destinoValido(origen, d, origen.owner));
}

/* Ejecuta el salto. Mueve el hopper y hasta `tropas` de infantería disponible.
   Las tropas transportadas llegan con el movimiento gastado: el salto ES su
   movimiento de la ronda, igual que caminar. */
export function saltar(origen, destino, tropas){
  const factionId = origen.owner;
  if(hoppersEn(origen) <= 0) return false;
  if(!destinoValido(origen, destino, factionId)) return false;
  const llevadas = Math.max(0, Math.min(tropas, HOPPER.capacidad, availableUnits(origen)));

  origen.hoppers = hoppersEn(origen) - 1;
  destino.hoppers = hoppersEn(destino) + 1;
  if(llevadas > 0){
    origen.units -= llevadas;
    origen.movedUnits = Math.min(origen.units, origen.movedUnits || 0);
    destino.units += llevadas;
    destino.movedUnits = (destino.movedUnits || 0) + llevadas;
  }
  // aterrizar en tierra de nadie o en un sector rival vacío lo reclama
  if(destino.owner !== factionId && destino.units > 0) destino.owner = factionId;

  log(`<b>${HOPPER.name}</b> salta de ${sectorLabel(origen)} a ${sectorLabel(destino)}`
    + (llevadas ? ` con ${llevadas} unidad(es)` : ' vacío'));
  requestRender();
  return true;
}
