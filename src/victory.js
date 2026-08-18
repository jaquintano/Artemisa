/* Condiciones de victoria y eliminación. La presentación se delega en el bus de render. */
import { DOMINANCE_RATIO, MAX_TURNS, SCORE } from './config.js';
import { state, territoryCount, log } from './state.js';
import { showGameOver } from './render/bus.js';

/* Puntuación desglosada de una facción. Devuelve tanto los puntos por concepto
   como los conteos en bruto, porque el desglose de la cabecera necesita enseñar
   las dos cosas («12 sectores → 36 pts»). */
export function scoreDetail(faction){
  let sectores = 0, edificios = 0;
  for(const h of state.hexes.values()){
    if(h.owner !== faction.id) continue;
    sectores++;
    if(h.building) edificios++;
  }
  const bajas = faction.kills || 0;
  const relay = faction.techs.has('relay');
  const pts = {
    sectores:  sectores  * SCORE.sector,
    edificios: edificios * SCORE.edificio,
    bajas:     bajas     * SCORE.baja,
    relay:     relay ? SCORE.relay : 0,
  };
  return {
    ...pts,
    total: pts.sectores + pts.edificios + pts.bajas + pts.relay,
    conteo: { sectores, edificios, bajas, relay },
  };
}
export function score(faction){ return scoreDetail(faction).total; }

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
    // victoria técnica: decide la puntuación, no el territorio a secas
    const ranked = [...state.factions].sort((a,b)=>score(b)-score(a));
    if(ranked[0].id===0){
      endGame('VICTORIA TÉCNICA', `Se alcanzó el límite de ${MAX_TURNS} rondas. Ganas por puntuación con ${score(player)} puntos frente a los ${score(ranked[1])} de ${ranked[1].name}.`);
    } else {
      endGame('DERROTA TÉCNICA', `Se alcanzó el límite de ${MAX_TURNS} rondas. ${ranked[0].name} gana por puntuación: ${score(ranked[0])} puntos frente a tus ${score(player)}.`);
    }
  }
}


export function endGame(title, text){
  state.gameOver = true;
  showGameOver(title, text);
}
