/* Flujo de la partida: órdenes de movimiento, cierre de turno y arranque. */
import { state, setState, newState, availableUnits, sectorLabel, log, resetMovement } from './state.js';
import { resolveCombat } from './combat.js';
import { produceResources } from './economy.js';
import { aiTakeTurn } from './ai.js';
import { checkVictory } from './victory.js';
import { requestRender, hideGameOver } from './render/bus.js';

export function confirmMove(source, target, amount){
  amount = Math.max(1, Math.min(amount, availableUnits(source)));
  if(amount<=0) return;
  if(target.owner===source.owner){
    // reubicación amistosa, sin combate
    source.units -= amount;
    target.units += amount;
    // las tropas trasladadas ya han consumido su movimiento de este turno
    target.movedUnits = (target.movedUnits||0) + amount;
    log(`Movimiento de ${amount} unidades hacia ${sectorLabel(target)} (ya no pueden volver a moverse este turno)`);
  } else {
    resolveCombat(source, target, amount);
  }
  state.selected = null; state.pending = null;
  requestRender();
}

export function endTurn(){
  if(state.gameOver) return;
  state.selected = null; state.pending = null;
  // cada IA arranca su fase con las guarniciones frescas
  resetMovement();
  for(const f of state.factions){ if(!f.isPlayer && f.alive) aiTakeTurn(f.id); }
  checkVictory();
  if(!state.gameOver){
    state.turn += 1;
    produceResources();
  }
  // nueva ronda del jugador: todas las guarniciones recuperan su movimiento
  resetMovement();
  requestRender();
}

export function startGame(){
  // `state` es un binding importado (solo lectura aquí): se sustituye vía setState()
  setState(newState());
  produceResources();
  state.log = [];   // descarta el mensaje de producción del reparto inicial
  log('Comienza la campaña de conquista lunar.');
  hideGameOver();
  requestRender();
}
