/* Constantes de dominio y parámetros de balance. Sin estado mutable ni DOM. */

/* Versión de la aplicación. Esta línea es la ÚNICA fuente de verdad: el navegador
   no puede leer package.json sin una petición extra, así que la versión vive aquí
   y `node tools/version.mjs` la copia a package.json. No la edites a mano en dos
   sitios; usa el script y quedarán siempre iguales. */
export const APP_VERSION = '1.0.9';

/* Número de jugadores de la partida: 3 o 4. Determina el tamaño del tablero
   (3 -> lado 5, 61 losetas; 4 -> lado 6, 91 losetas) y cuántas facciones entran
   en juego. El radio ya no es una constante: lo calcula src/mapgen.js a partir de
   este número y viaja en `state.radius`. */
export const PLAYER_COUNT = 3;

export const HEX_SIZE = 30;
// 80 y no 60: medido que las partidas piden ~65 rondas para decidirse, así que el
// límite anterior las cortaba justo antes de resolverse (40 % resueltas -> 84 %).
export const MAX_TURNS = 80;
export const DOMINANCE_RATIO = 0.6;    // % de mapa para victoria por dominancia

// Elevación en px de cada terreno para la extrusión isométrica (negativo = depresión).
// Hoy está todo a 0, así que el mapa se ve plano y map.js nunca llega a dibujar los
// laterales (`.hexskirt`). Se conserva como palanca: dar altura a un terreno aquí
// basta para que aparezcan.
export const ELEVATION = { mare:0, highlands:0, crater:0, ice:0 };

export const TERRAIN = {
  mare:      { name:'Mare (llanura basáltica)', color:'#4A5568', regolith:1, helium3:0, ice:0, defense:0 },
  highlands: { name:'Tierras Altas',            color:'#9C8F72', regolith:1, helium3:1, ice:0, defense:1 },
  crater:    { name:'Cráter',                   color:'#3D3B42', regolith:1, helium3:2, ice:0, defense:1 },
  // El Paraje Helado no da defensa, pero controlarlo sube el tope de población en
  // +3: +1 por el sector y +2 por el hielo que produce (ver popCap).
  ice:       { name:'Paraje Helado',            color:'#B9E3F0', regolith:0, helium3:0, ice:2, defense:0 },
};

const TODO_TERRENO = ['mare','highlands','crater','ice'];

/* Campos de cada instalación:
     resource  se pinta con el icono vectorial de ese recurso en vez del glifo
     trains    permite reclutar guarniciones
     unique    solo se puede tener una por facción en todo el mapa
     enables   funciones que habilita mientras esté activa
     upkeep    lo que cuesta mantenerla cada turno; si no se paga, se desactiva */
export const BUILDING_TYPES = {
  mine:      { name:'Mina de Regolito',   icon:'⛏', resource:'regolith',
               cost:{regolith:15,helium3:0,ice:0},  produce:{regolith:3,helium3:0,ice:0},
               defense:0, allowed:['mare','highlands','crater'] },
  extractor: { name:'Extractor de He-3',  icon:'☢', resource:'helium3',
               cost:{regolith:20,helium3:10,ice:0}, produce:{regolith:0,helium3:3,ice:0},
               defense:0, allowed:['highlands','crater'] },
  melter:    { name:'Fusor de Hielo',     icon:'❄', resource:'ice',
               cost:{regolith:15,helium3:0,ice:0},  produce:{regolith:0,helium3:0,ice:1},
               defense:0, allowed:['ice'] },
  lab:       { name:'Laboratorio',        icon:'◆', unique:true, enables:['research','hoppers'],
               cost:{regolith:15,helium3:5,ice:0},  produce:{regolith:0,helium3:0,ice:0},
               upkeep:{regolith:0,helium3:1,ice:0}, defense:0, allowed:TODO_TERRENO },
  barracks:  { name:'Cuartel Lunar',      icon:'▣', trains:true,
               cost:{regolith:20,helium3:5,ice:2},  produce:{regolith:0,helium3:0,ice:0},
               upkeep:{regolith:0,helium3:0,ice:1}, defense:1, allowed:TODO_TERRENO },
  turret:    { name:'Torreta Defensiva',  icon:'▲', blocksHoppers:true,
               cost:{regolith:35,helium3:25,ice:0}, produce:{regolith:0,helium3:0,ice:0},
               upkeep:{regolith:0,helium3:1,ice:0}, defense:3, allowed:TODO_TERRENO },
  // La base no produce hielo: el hielo solo sale del Paraje Helado y del Fusor,
  // así que hay que ir a buscarlo al mapa en vez de recibirlo gratis.
  base:      { name:'Base Principal',     icon:'★', trains:true,
               cost:{regolith:0,helium3:0,ice:0},   produce:{regolith:1,helium3:1,ice:0},
               upkeep:{regolith:0,helium3:0,ice:1}, defense:5, allowed:TODO_TERRENO },
};

/* Recursos y tropas de partida, según cuántos jueguen. Con 4 el tablero es mayor
   y hay un rival más, así que se arranca con más margen económico. */
export const STARTING = {
  3: { resources:{ regolith:62, helium3:26, ice:20 }, units:5 },
  4: { resources:{ regolith:75, helium3:30, ice:20 }, units:5 },
};

/* Coste de reclutar una guarnición. Vive aquí porque lo consultan a la vez la
   economía, la IA y el panel de acciones. */
export const TRAIN_COST = { regolith:12, helium3:4, ice:0 };

/* Árbol de investigación. TODAS exigen un Laboratorio construido y activo; las de
   segundo nivel piden además la de primer nivel (`requiere`).
   `bono` es lo que suma cada una a la producción por instalación, y se acumula:
   una Mina con las dos Perforaciones produce 3+2+2 = 7. */
export const TECHS = [
  { id:'hopper',    name:'Tecnología Hopper',       cost:20,
    desc:'Desbloquea fabricar Transportadores en el Laboratorio' },
  { id:'drilling1', name:'Perforación Profunda I',  cost:25, bono:{ mine:{regolith:2} },
    desc:'+2 regolito por cada Mina' },
  { id:'drilling2', name:'Perforación Profunda II', cost:40, requiere:'drilling1', bono:{ mine:{regolith:2} },
    desc:'+2 regolito más por Mina (total +7 por turno)' },
  { id:'cryo1',     name:'Procesado Criogénico I',  cost:25, bono:{ melter:{ice:2} },
    desc:'+2 hielo por cada Fusor de Hielo' },
  { id:'cryo2',     name:'Procesado Criogénico II', cost:45, requiere:'cryo1', bono:{ melter:{ice:1} },
    desc:'+1 hielo más por Fusor (total +4 por turno)' },
  { id:'armor',     name:'Blindaje Reforzado',      cost:35,
    desc:'+1 fuerza en ataque y defensa a tu infantería (no a instalaciones vacías)' },
  { id:'fusion1',   name:'Reactores de Fusión I',   cost:40, bono:{ extractor:{helium3:2} },
    desc:'+2 helio-3 por cada Extractor' },
  { id:'fusion2',   name:'Reactores de Fusión II',  cost:50, requiere:'fusion1', bono:{ extractor:{helium3:2} },
    desc:'+2 helio-3 más por Extractor (total +7 por turno)' },
  { id:'relay',     name:'Relé Orbital',            cost:45,
    desc:'+25% de fuerza en cualquier ataque' },
];

/* Transportador (Hopper): guarnición sin fuerza de combate que mueve infantería. */
export const HOPPER = {
  name:'Transportador',
  cost:{ regolith:15, helium3:0, ice:5 },
  capacidad:4,   // tropas que puede llevar
  alcance:2,     // casillas de distancia máxima del salto
};

export const DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];


export const ZOOM_MIN = 0.6, ZOOM_MAX = 2.4, ZOOM_STEP = 1.25;

/* El orden importa: se toman las PLAYER_COUNT primeras, así que la cuarta solo
   entra en las partidas de 4. El jugador es siempre la id 0. */
export const FACTION_DEFS = [
  { id:0, name:'Proyecto Artemis',   color:'#4FC3E8', dim:'#2A5A6E', isPlayer:true  },
  { id:1, name:'Grupo Vostok',       color:'#E8935D', dim:'#6E4A2A', isPlayer:false },
  { id:2, name:'Consorcio Helios',   color:'#7ED9A8', dim:'#3A6E52', isPlayer:false },
  { id:3, name:'Iniciativa Selene',  color:'#C58BE8', dim:'#5A3A6E', isPlayer:false },
];

/* Proporción de la guarnición vecina que se aporta como apoyo (1 = fuerza completa).
   Bajarlo a 0.5 hace las líneas de frente menos decisivas. */
export const SUPPORT_FACTOR = 1;

/* Puntuación para la victoria técnica: la que decide la partida cuando se agotan
   las rondas sin que nadie alcance la dominancia. El territorio es la base, pero
   no lo único, para que una facción pequeña y bien atrincherada pueda competir
   con otra que solo acumule casillas vacías. */
export const SCORE = {
  sector:   3,    // por cada sector controlado
  edificio: 5,    // por cada instalación en pie
  baja:     2,    // por cada unidad rival destruida
  relay:   15,    // bonus único por investigar el Relé Orbital
};
