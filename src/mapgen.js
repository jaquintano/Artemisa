/* Generación del mapa de juego. Sin DOM: se ejecuta igual en Node.
 *
 * El mapa deja de ser terreno aleatorio repartido por pesos y pasa a construirse
 * por reglas: un tablero de Mare sobre el que se tallan zonas de expansión
 * equivalentes para cada jugador y una tierra de nadie central. La intención es
 * que ningún jugador salga favorecido por el sorteo: los cuatro tipos de terreno
 * aparecen en la misma cantidad alrededor de cada base.
 *
 * El generador se autovalida (ver validarMapa): si alguna regla de conteo no se
 * cumple, revienta en vez de devolver un tablero silenciosamente injusto.
 */
import { TERRAIN, FACTION_DEFS, STARTING } from './config.js';

/* Lado del gran hexágono = RADIUS+1, y el total 3·R²+3·R+1.
   3 jugadores -> lado 5, 61 losetas.  4 jugadores -> lado 6, 91 losetas. */
export function radiusFor(N){
  if(N === 3) return 4;
  if(N === 4) return 5;
  throw new Error(`Número de jugadores no soportado: ${N} (solo 3 o 4)`);
}

export function hexKey(q, r){ return q + ',' + r; }

/* Distancia en casillas sobre coordenadas axiales. */
export function distancia(a, b){
  return (Math.abs(a.q-b.q) + Math.abs(a.r-b.r) + Math.abs(a.q+a.r-b.q-b.r)) / 2;
}

function coordenadas(R){
  const out = [];
  for(let q=-R; q<=R; q++){
    const r1 = Math.max(-R, -q-R), r2 = Math.min(R, -q+R);
    for(let r=r1; r<=r2; r++) out.push({ q, r });
  }
  return out;
}

/* Perímetro exterior, ordenado por ángulo para poder recorrerlo como un anillo. */
function perimetro(R){
  return coordenadas(R)
    .filter(h => distancia(h, {q:0,r:0}) === R)
    .map(h => ({ ...h, ang: Math.atan2(1.5*h.r, Math.sqrt(3)*(h.q + h.r/2)) }))
    .sort((a, b) => a.ang - b.ang);
}

/* Reparte N bases sobre el perímetro lo más equidistantes posible.
 *
 * No vale con repartir por índice de anillo: para N=4 el perímetro mide 30 y
 * 30/4 no es entero, y ese reparto da distancias 8,6,8,6. Buscando entre todas
 * las combinaciones sí aparece una perfecta (7,7,7,7), así que se busca en vez
 * de suponer. Con N de 3 o 4 y perímetros de 24-30 losetas son unos pocos miles
 * de combinaciones: instantáneo.
 *
 * Criterio: primero la menor diferencia entre la distancia mayor y la menor del
 * ciclo (equidistancia), y a igualdad la mayor separación posible. Se queda con
 * la primera de las empatadas para que la disposición sea estable entre partidas. */
export function repartirBases(R, N){
  const per = perimetro(R);
  const n = per.length;
  let mejor = null, mejorClave = null;
  const combinar = (inicio, elegidas) => {
    if(elegidas.length === N){
      const d = elegidas.map((b, i) => distancia(b, elegidas[(i+1) % N]));
      const clave = [Math.max(...d) - Math.min(...d), -Math.min(...d)];
      if(!mejorClave || clave[0] < mejorClave[0] ||
        (clave[0] === mejorClave[0] && clave[1] < mejorClave[1])){
        mejorClave = clave; mejor = elegidas.slice();
      }
      return;
    }
    for(let i=inicio; i<n; i++) combinar(i+1, [...elegidas, per[i]]);
  };
  combinar(0, []);
  return mejor.map(({ q, r }) => ({ q, r }));
}

/* Toma `cuantas` losetas al azar de `lista` sin repetir. */
function tomar(lista, cuantas, rnd){
  const copia = lista.slice();
  const out = [];
  for(let i=0; i<cuantas; i++){
    if(!copia.length) throw new Error('No quedan losetas donde repartir terreno especial');
    out.push(...copia.splice(Math.floor(rnd()*copia.length), 1));
  }
  return out;
}

const ESPECIALES = ['highlands', 'crater', 'ice'];

/* Curva de dificultad de las guarniciones neutrales.
 *
 * Las losetas que lindan con una base llevan de 1 a 3 unidades (regla 17): el
 * primer paso de la expansión tiene que costar algo, pero nunca ser un muro.
 * A partir de ahí sube con la distancia —la tierra de nadie es lo más disputado—
 * y con el terreno, porque un Cráter o unas Tierras Altas ya dan +1 de defensa y
 * conviene que además estén mejor guarnecidos. */
function unidadesNeutrales(distMin, terreno, rnd){
  if(distMin <= 1) return 1 + Math.floor(rnd()*3);
  const porTerreno   = terreno.defense >= 1 ? 1 : 0;
  const porDistancia = distMin >= 5 ? 2 : distMin >= 3 ? 1 : 0;
  const azar         = rnd() < 0.5 ? 1 : 0;
  return porTerreno + porDistancia + azar;
}

/* Cuántas losetas especiales de cada tipo van en la tierra de nadie. */
function especialesDelCentro(N){ return N === 3 ? 1 : 3; }

function barajar(lista, rnd){
  const a = lista.slice();
  for(let i=a.length-1; i>0; i--){
    const j = Math.floor(rnd()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Núcleo central: las `cuantas` losetas más próximas al centro del mapa.
 *
 * Las especiales de la tierra de nadie no se esparcen: forman un racimo en mitad
 * del tablero, para que el centro sea un premio concreto por el que pelear y no
 * un reparto difuso. A cara o cruz se incluye la loseta central o se deja fuera,
 * que son las dos variantes admitidas: con 3 jugadores salen exactamente «el
 * centro y dos adyacentes» o «tres adyacentes».
 *
 * Con 4 jugadores hacen falta 9 y el centro más su anillo solo dan 7, así que se
 * echa mano del segundo anillo; está comprobado que también cae entero dentro de
 * la tierra de nadie en ese tamaño. Los empates a igual distancia se desempatan
 * al azar para que el racimo no salga siempre con la misma forma. */
function nucleoCentral(todas, cuantas, rnd){
  const centro = todas.find(h => h.q === 0 && h.r === 0);
  const incluirCentro = rnd() < 0.5;
  const resto = todas
    .filter(h => h !== centro)
    .map(h => ({ h, d: distancia(h, centro), desempate: rnd() }))
    .sort((a, b) => a.d - b.d || a.desempate - b.desempate)
    .map(x => x.h);
  return incluirCentro ? [centro, ...resto.slice(0, cuantas-1)] : resto.slice(0, cuantas);
}

export function generarMapa(N = 3, rnd = Math.random){
  const R = radiusFor(N);
  const hexes = new Map();

  // 5. todo el tablero arranca siendo Mare
  for(const { q, r } of coordenadas(R)){
    hexes.set(hexKey(q, r), { q, r, s: -q-r, terrain:'mare', owner:null,
                              building:null, units:0, movedUnits:0 });
  }
  const todas = [...hexes.values()];
  const en = c => hexes.get(hexKey(c.q, c.r));

  // 6-8. bases equidistantes en el perímetro, que se quedan en Mare
  const bases = repartirBases(R, N).map((c, i) => {
    const h = en(c);
    h.terrain = 'mare';
    h.owner = i;
    h.building = 'base';
    h.units = STARTING[N].units;
    return h;
  });

  // 9-10. zona de expansión de cada jugador: 2 de cada especial en radio 2
  for(const base of bases){
    const zona = todas.filter(h => h !== base && distancia(h, base) <= 2);
    for(const tipo of ESPECIALES){
      const libres = zona.filter(h => h.terrain === 'mare');
      for(const h of tomar(libres, 2, rnd)) h.terrain = tipo;
    }
  }

  // 11-13. tierra de nadie: las especiales van en un racimo en mitad del tablero
  const porTipo = especialesDelCentro(N);
  const nucleo = barajar(nucleoCentral(todas, porTipo * ESPECIALES.length, rnd), rnd);
  ESPECIALES.forEach((tipo, i) => {
    for(let k=0; k<porTipo; k++) nucleo[i*porTipo + k].terrain = tipo;
  });

  // 17-18. guarniciones neutrales
  for(const h of todas){
    if(h.owner !== null) continue;
    const distMin = Math.min(...bases.map(b => distancia(h, b)));
    h.units = unidadesNeutrales(distMin, TERRAIN[h.terrain], rnd);
  }

  validarMapa({ hexes, radius:R, bases, jugadores:N });
  return { hexes, radius:R, bases, jugadores:N };
}

/* 14-15. Comprobación de que el tablero cumple las reglas de conteo.
 *
 * Ojo con el recuento de Mare: las losetas de las bases son Mare por obligación
 * (regla 8) pero se cuentan aparte, así que el total esperado de Mare "libre" es
 * 61−21−3 = 37 con 3 jugadores y 91−33−4 = 54 con 4. */
export function validarMapa({ hexes, radius, bases, jugadores }){
  const fallos = [];
  const total = hexes.size;
  const esperado = 3*radius*radius + 3*radius + 1;
  if(total !== esperado) fallos.push(`total de losetas ${total}, esperaba ${esperado}`);

  const porTipo = t => [...hexes.values()].filter(h => h.terrain === t).length;
  const especialesEsperados = jugadores * 2 + especialesDelCentro(jugadores);
  for(const tipo of ESPECIALES){
    if(porTipo(tipo) !== especialesEsperados){
      fallos.push(`${tipo}: ${porTipo(tipo)}, esperaba ${especialesEsperados}`);
    }
  }
  const mareLibre = porTipo('mare') - bases.length;
  const mareEsperado = total - especialesEsperados*3 - bases.length;
  if(mareLibre !== mareEsperado){
    fallos.push(`Mare libre ${mareLibre}, esperaba ${mareEsperado}`);
  }
  for(const b of bases){
    if(b.terrain !== 'mare') fallos.push(`la base de ${b.q},${b.r} no es Mare`);
  }

  /* Las especiales del centro deben formar un racimo pegado a la loseta central y
     estar dentro de la tierra de nadie. Se comprueba que las que caen fuera de
     toda zona de expansión ocupen justo las posiciones más próximas al centro. */
  const todas = [...hexes.values()];
  const centro = todas.find(h => h.q === 0 && h.r === 0);
  const delCentro = todas.filter(h => h.terrain !== 'mare' &&
    bases.every(b => distancia(h, b) >= 3));
  const cuantas = especialesDelCentro(jugadores) * ESPECIALES.length;
  if(delCentro.length !== cuantas){
    fallos.push(`${delCentro.length} especiales en tierra de nadie, esperaba ${cuantas}`);
  }
  const radioMax = Math.max(...delCentro.map(h => distancia(h, centro)));
  const cabenEn = todas.filter(h => distancia(h, centro) <= radioMax).length;
  if(delCentro.length < cabenEn && radioMax > 1){
    // si se usa el anillo 2 debe ser porque el 1 se ha llenado entero
    const enAnillo1 = delCentro.filter(h => distancia(h, centro) <= 1).length;
    const disponiblesAnillo1 = todas.filter(h => distancia(h, centro) <= 1).length;
    if(enAnillo1 < disponiblesAnillo1 - 1){
      fallos.push(`el racimo central se dispersa: llega a radio ${radioMax} con solo ${enAnillo1} losetas en radio 1`);
    }
  }
  for(const h of delCentro){
    if(distancia(h, centro) > 2) fallos.push(`especial central en (${h.q},${h.r}) a radio ${distancia(h, centro)} del centro`);
  }
  // las lindantes con una base nunca deben superar 3 unidades neutrales
  for(const h of hexes.values()){
    if(h.owner !== null) continue;
    const d = Math.min(...bases.map(b => distancia(h, b)));
    if(d === 1 && (h.units < 1 || h.units > 3)){
      fallos.push(`lindante con base en ${h.q},${h.r} tiene ${h.units} unidades (debe ser 1-3)`);
    }
  }
  if(fallos.length) throw new Error('Mapa inválido:\n  - ' + fallos.join('\n  - '));
}

/* Facciones que juegan esta partida. */
export function faccionesDe(N){ return FACTION_DEFS.slice(0, N); }
