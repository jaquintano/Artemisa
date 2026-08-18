/* Verificación de las reglas de generación de mapa.
 *
 * generarMapa() ya se autovalida en los conteos, pero eso comprueba una partida.
 * Esto la ejercita muchas veces y además revisa las reglas geométricas que el
 * generador no puede comprobar solo: equidistancia de bases, que estén en el
 * perímetro, el reparto por zona de expansión y la curva de guarniciones.
 *
 * Uso:  node tests/mapgen-test.mjs [nMapas]
 */
import { generarMapa, distancia, radiusFor } from '../src/mapgen.js';

const N_MAPAS = parseInt(process.argv[2], 10) || 200;
const ESPECIALES = ['highlands', 'crater', 'ice'];
let fallos = 0;
const mal = (msg) => { console.log('  ✗ ' + msg); fallos++; };

for(const jugadores of [3, 4]){
  const R = radiusFor(jugadores);
  const totalEsperado = 3*R*R + 3*R + 1;
  const espPorTipo = jugadores*2 + (jugadores === 3 ? 1 : 3);
  console.log(`\n=== ${jugadores} jugadores | lado ${R+1} | ${totalEsperado} losetas ===`);

  const distsBases = new Set();
  const unidadesPorDistancia = new Map();

  for(let i=0; i<N_MAPAS; i++){
    const { hexes, bases, radius } = generarMapa(jugadores);
    const todas = [...hexes.values()];

    if(i === 0){
      if(radius !== R) mal(`radio ${radius}, esperaba ${R}`);
      if(hexes.size !== totalEsperado) mal(`${hexes.size} losetas, esperaba ${totalEsperado}`);
      if(bases.length !== jugadores) mal(`${bases.length} bases, esperaba ${jugadores}`);
    }

    // reglas 6-7: bases en el perímetro y equidistantes
    for(const b of bases){
      if(distancia(b, {q:0,r:0}) !== R) mal(`base en (${b.q},${b.r}) no está en el perímetro`);
    }
    const ciclo = bases.map((b, k) => distancia(b, bases[(k+1) % bases.length]));
    if(new Set(ciclo).size !== 1) mal(`bases no equidistantes: ${ciclo.join(',')}`);
    ciclo.forEach(d => distsBases.add(d));

    // regla 8: las bases siguen siendo Mare
    for(const b of bases){
      if(b.terrain !== 'mare') mal(`base en (${b.q},${b.r}) es ${b.terrain}`);
    }

    // regla 10: 2 de cada especial dentro del radio 2 de CADA base
    for(const b of bases){
      const zona = todas.filter(h => h !== b && distancia(h, b) <= 2);
      for(const tipo of ESPECIALES){
        const n = zona.filter(h => h.terrain === tipo).length;
        if(n !== 2) mal(`zona de (${b.q},${b.r}) tiene ${n} de ${tipo}, esperaba 2`);
      }
    }

    // reglas 12-13: especiales de la tierra de nadie
    const centro = todas.filter(h => bases.every(b => distancia(h, b) >= 3));
    const porTipoCentro = jugadores === 3 ? 1 : 3;
    for(const tipo of ESPECIALES){
      const n = centro.filter(h => h.terrain === tipo).length;
      if(n !== porTipoCentro) mal(`centro con ${n} de ${tipo}, esperaba ${porTipoCentro}`);
    }

    // regla 14: totales absolutos
    for(const tipo of ESPECIALES){
      const n = todas.filter(h => h.terrain === tipo).length;
      if(n !== espPorTipo) mal(`${n} de ${tipo} en total, esperaba ${espPorTipo}`);
    }

    // regla 15: el resto es Mare
    const mareLibre = todas.filter(h => h.terrain === 'mare').length - bases.length;
    const mareEsperado = totalEsperado - espPorTipo*3 - bases.length;
    if(mareLibre !== mareEsperado) mal(`Mare libre ${mareLibre}, esperaba ${mareEsperado}`);

    // regla 17: lindantes con base, entre 1 y 3
    for(const h of todas){
      if(h.owner !== null) continue;
      const d = Math.min(...bases.map(b => distancia(h, b)));
      if(d === 1 && (h.units < 1 || h.units > 3)) mal(`(${h.q},${h.r}) lindante con ${h.units} unidades`);
      const acc = unidadesPorDistancia.get(d) || { n:0, suma:0, max:0 };
      acc.n++; acc.suma += h.units; acc.max = Math.max(acc.max, h.units);
      unidadesPorDistancia.set(d, acc);
    }
  }

  console.log(`  ${N_MAPAS} mapas generados`);
  console.log(`  distancia entre bases contiguas: ${[...distsBases].join(', ')}`);
  console.log(`  especiales: ${espPorTipo} de cada tipo (${espPorTipo*3} en total)`);
  console.log(`  Mare libre: ${totalEsperado - espPorTipo*3 - jugadores}`);
  console.log('  curva de guarniciones neutrales (regla 18):');
  for(const d of [...unidadesPorDistancia.keys()].sort((a,b)=>a-b)){
    const a = unidadesPorDistancia.get(d);
    console.log(`    a ${d} de la base más cercana: media ${(a.suma/a.n).toFixed(2)}, máximo ${a.max}`);
  }
}

console.log(fallos === 0
  ? `\n✓ Todas las reglas de generación se cumplen en ${N_MAPAS*2} mapas`
  : `\n${fallos} incumplimiento(s)`);
process.exit(fallos ? 1 : 0);
