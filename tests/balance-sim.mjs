/* Simulación de balance sin navegador.
 *
 * Ejercita la lógica de dominio (estado, combate, economía, IA) con las tres
 * facciones controladas por la IA, sin registrar ningún manejador en el bus de
 * render. Sirve para dos cosas:
 *   1. Prueba de humo de la refactorización: si un módulo quedó mal cableado,
 *      esto revienta.
 *   2. Ajuste de balance con datos en vez de a ojo (p. ej. SUPPORT_FACTOR).
 *
 * Uso:  node tests/balance-sim.mjs [nPartidas]
 */
import { MAX_TURNS, DOMINANCE_RATIO, SUPPORT_FACTOR } from '../src/config.js';
import { state, setState, newState, territoryCount, resetMovement } from '../src/state.js';
import { produceResources, pagarMantenimiento } from '../src/economy.js';
import { aiTakeTurn } from '../src/ai.js';
import { score } from '../src/victory.js';

const games = parseInt(process.argv[2], 10) || 200;

function playOneGame() {
  setState(newState());
  const total = state.hexes.size;

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    resetMovement();
    // las tres facciones juegan con la misma IA: mide el balance, no la habilidad
    for (const f of state.factions) {
      if (f.alive) aiTakeTurn(f.id);
    }
    for (const f of state.factions) {
      if (f.alive && territoryCount(f) === 0) f.alive = false;
    }
    const alive = state.factions.filter(f => f.alive);
    if (alive.length <= 1) {
      return { turns: turn, outcome: 'eliminacion', shares: shareSnapshot(total),
               ganador: alive[0] ? alive[0].id : null };
    }
    const leader = [...state.factions].sort((a, b) => territoryCount(b) - territoryCount(a))[0];
    if (territoryCount(leader) / total >= DOMINANCE_RATIO) {
      return { turns: turn, outcome: 'dominancia', shares: shareSnapshot(total),
               ganador: leader.id };
    }
    state.turn = turn;
    // mismo orden que endTurn(): primero se cobra el mantenimiento (lo impagado se
    // apaga y deja de producir) y solo después se produce. Sin esta línea la
    // simulación regalaba el sostenimiento de todas las instalaciones y salían
    // economías —y expansiones— que el juego real no permite.
    pagarMantenimiento();
    produceResources();
  }
  // agotados los turnos decide la puntuación, igual que hace checkVictory()
  const porPuntos = [...state.factions].sort((a, b) => score(b) - score(a));
  return { turns: MAX_TURNS, outcome: 'limite_turnos', shares: shareSnapshot(total),
           ganador: porPuntos[0].id, puntos: state.factions.map(score) };
}

function shareSnapshot(total) {
  return state.factions.map(f => +(territoryCount(f) / total * 100).toFixed(1));
}

const results = [];
for (let i = 0; i < games; i++) results.push(playOneGame());

const byOutcome = {};
for (const r of results) byOutcome[r.outcome] = (byOutcome[r.outcome] || 0) + 1;

const avgTurns = (results.reduce((s, r) => s + r.turns, 0) / results.length).toFixed(1);
const decisive = results.filter(r => r.outcome !== 'limite_turnos').length;

// reparto medio de territorio y cuánto acapara el líder: mide si el mapa se congela
const leaderShares = results.map(r => Math.max(...r.shares));
const avgLeader = (leaderShares.reduce((a, b) => a + b, 0) / leaderShares.length).toFixed(1);

console.log(`SUPPORT_FACTOR = ${SUPPORT_FACTOR}   ·   ${games} partidas IA vs IA vs IA\n`);
console.log('Desenlace                 Partidas   %');
for (const [k, v] of Object.entries(byOutcome).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(22)} ${String(v).padStart(6)}   ${(v / games * 100).toFixed(1)}%`);
}
console.log(`\nTurnos medios hasta el desenlace   : ${avgTurns} / ${MAX_TURNS}`);
console.log(`Resueltas por conquista (no a puntos): ${(decisive / games * 100).toFixed(1)}%`);
console.log(`Territorio medio del líder final   : ${avgLeader}%`);

/* Con MAX_TURNS corto (40, el de las reglas) casi ninguna partida llega a la
   dominancia: las decide la puntuación, y eso es el diseño, no una avería. La
   comprobación útil ya no es «cuántas se resuelven por conquista» sino si las tres
   IAs —que juegan exactamente igual— ganan por igual. Un sesgo persistente ahí sí
   señala un problema real: una posición de salida mejor que otra, o una ventaja
   del orden de turno. */
const victorias = state.factions.map((_, i) => results.filter(r => r.ganador === i).length);
console.log('\nReparto de victorias (las tres IAs juegan igual):');
victorias.forEach((v, i) => {
  console.log(`  Facción ${i}${' '.repeat(18)} ${String(v).padStart(6)}   ${(v / games * 100).toFixed(1)}%`);
});

/* El umbral se mide en desviaciones típicas, no en un porcentaje fijo: con pocas
   partidas el reparto oscila mucho por puro azar y un porcentaje fijo daría falsas
   alarmas cada vez que `npm test` corre su tanda corta. Contar victorias es una
   binomial (p = 1/N facciones), así que 3σ marca el punto a partir del cual la
   desviación ya no se explica por el azar. */
const p = 1 / victorias.length;
const esperado = games * p;
const sigma = Math.sqrt(games * p * (1 - p));
const desvio = Math.max(...victorias.map(v => Math.abs(v - esperado)));
if (desvio > 3 * sigma) {
  console.log(`\n⚠  Reparto desigual: ${desvio.toFixed(1)} victorias de desvío, más de 3σ (${(3*sigma).toFixed(1)}).`);
  console.log('   Con la misma IA en las tres, esto apunta a que el tablero o el orden de');
  console.log('   turno favorecen a alguien: mira repartirBases() y las zonas de expansión');
  console.log('   en mapgen.js antes que la IA.');
} else {
  console.log(`\n✓ Reparto equilibrado (desvío ${desvio.toFixed(1)} sobre ${(3*sigma).toFixed(1)} admisible): ninguna posición domina.`);
}
