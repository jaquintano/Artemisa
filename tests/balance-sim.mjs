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
import { produceResources } from '../src/economy.js';
import { aiTakeTurn } from '../src/ai.js';

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
      return { turns: turn, outcome: 'eliminacion', shares: shareSnapshot(total) };
    }
    const leader = [...state.factions].sort((a, b) => territoryCount(b) - territoryCount(a))[0];
    if (territoryCount(leader) / total >= DOMINANCE_RATIO) {
      return { turns: turn, outcome: 'dominancia', shares: shareSnapshot(total) };
    }
    state.turn = turn;
    produceResources();
  }
  return { turns: MAX_TURNS, outcome: 'limite_rondas', shares: shareSnapshot(total) };
}

function shareSnapshot(total) {
  return state.factions.map(f => +(territoryCount(f) / total * 100).toFixed(1));
}

const results = [];
for (let i = 0; i < games; i++) results.push(playOneGame());

const byOutcome = {};
for (const r of results) byOutcome[r.outcome] = (byOutcome[r.outcome] || 0) + 1;

const avgTurns = (results.reduce((s, r) => s + r.turns, 0) / results.length).toFixed(1);
const decisive = results.filter(r => r.outcome !== 'limite_rondas').length;

// reparto medio de territorio y cuánto acapara el líder: mide si el mapa se congela
const leaderShares = results.map(r => Math.max(...r.shares));
const avgLeader = (leaderShares.reduce((a, b) => a + b, 0) / leaderShares.length).toFixed(1);

console.log(`SUPPORT_FACTOR = ${SUPPORT_FACTOR}   ·   ${games} partidas IA vs IA vs IA\n`);
console.log('Desenlace                 Partidas   %');
for (const [k, v] of Object.entries(byOutcome).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(22)} ${String(v).padStart(6)}   ${(v / games * 100).toFixed(1)}%`);
}
console.log(`\nRondas medias hasta el desenlace : ${avgTurns} / ${MAX_TURNS}`);
console.log(`Partidas resueltas antes del límite: ${(decisive / games * 100).toFixed(1)}%`);
console.log(`Territorio medio del líder final   : ${avgLeader}%`);

if (decisive / games < 0.5) {
  console.log('\n⚠  Más de la mitad de las partidas agotan el límite de rondas.');
  console.log('   Descartado como causa: SUPPORT_FACTOR (probado 0 a 1, sin efecto en la');
  console.log('   resolución), el tope de población y los recursos (quedan sin gastar).');
  console.log('   Sospechoso principal: aiTakeTurn() recluta 1 unidad por turno, ritmo');
  console.log('   insuficiente para conquistar el mapa. Ver CLAUDE.md, "Incidencia abierta".');
} else {
  console.log('\n✓ El mapa no se congela: la mayoría de partidas se resuelven por conquista.');
}
