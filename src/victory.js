/* Condiciones de victoria y eliminación. La presentación se delega en el bus de render. */
import { DOMINANCE_RATIO, MAX_TURNS } from './config.js';
import { state, territoryCount, log } from './state.js';
import { showGameOver } from './render/bus.js';

export function checkEliminations(){
  for(const faction of state.factions){
    if(faction.alive && territoryCount(faction)===0){
      faction.alive = false;
      log(`<b>${faction.name}</b> ha sido eliminada del mapa lunar.`);
    }
  }
}

export function checkVictory(){
  checkEliminations();
  const player = state.factions[0];
  const aliveFactions = state.factions.filter(f=>f.alive);
  const total = state.hexes.size;

  if(!player.alive){
    endGame('DERROTA', 'Tu facción ha sido eliminada de la superficie lunar. Otra potencia domina el territorio.');
    return;
  }
  if(aliveFactions.length===1 && aliveFactions[0].id===0){
    endGame('VICTORIA TOTAL', 'Has eliminado a todas las facciones rivales y controlas la totalidad del terreno lunar.');
    return;
  }
  const playerShare = territoryCount(player)/total;
  if(playerShare >= DOMINANCE_RATIO){
    endGame('VICTORIA POR DOMINANCIA', `Controlas el ${Math.round(playerShare*100)}% de la superficie lunar, suficiente para reclamar el dominio territorial.`);
    return;
  }
  if(state.turn >= MAX_TURNS){
    const ranked = [...state.factions].sort((a,b)=>territoryCount(b)-territoryCount(a));
    if(ranked[0].id===0){
      endGame('VICTORIA POR PUNTOS', `Se alcanzó el límite de ${MAX_TURNS} rondas. Terminas con el mayor control territorial (${territoryCount(player)} sectores).`);
    } else {
      endGame('DERROTA POR PUNTOS', `Se alcanzó el límite de ${MAX_TURNS} rondas. ${ranked[0].name} controla más territorio que tú.`);
    }
  }
}


export function endGame(title, text){
  state.gameOver = true;
  showGameOver(title, text);
}
