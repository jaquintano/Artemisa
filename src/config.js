/* Constantes de dominio y parámetros de balance. Sin estado mutable ni DOM. */

// Radio del mapa hexagonal. El lado del hexágono grande mide RADIUS+1 sectores y
// el total es 3·R²+3·R+1, así que R=5 son 6 de lado y 91 sectores.
export const RADIUS = 5;
export const HEX_SIZE = 30;
export const MAX_TURNS = 60;
export const DOMINANCE_RATIO = 0.6;    // % de mapa para victoria por dominancia

// elevación en px de cada terreno para la extrusión isométrica (negativo = depresión)
export const ELEVATION = { mare:0, highlands:0, crater:0, ice:0 };

export const TERRAIN = {
  mare:      { name:'Mare (llanura basáltica)', color:'#4A5568', regolith:1, helium3:0, ice:0, defense:0 },
  highlands: { name:'Tierras Altas',            color:'#9C8F72', regolith:1, helium3:1, ice:0, defense:1 },
  crater:    { name:'Cráter',                   color:'#3D3B42', regolith:0, helium3:2, ice:0, defense:1 },
  ice:       { name:'Casquete de Hielo',        color:'#B9E3F0', regolith:0, helium3:0, ice:2, defense:0 },
};
export const TERRAIN_WEIGHTS = [['mare',.35],['highlands',.30],['crater',.20],['ice',.15]];

const TODO_TERRENO = ['mare','highlands','crater','ice'];

export const BUILDING_TYPES = {
  // 'resource' marca los edificios que se pintan con el icono vectorial del recurso
  // que extraen (ver render/resource-icons.js) en vez de con el glifo de 'icon'.
  // 'trains' marca los únicos edificios donde se pueden reclutar guarniciones.
  mine:      { name:'Mina de Regolito',   icon:'⛏', resource:'regolith', cost:{regolith:15,helium3:0,ice:0},  produce:{regolith:3,helium3:0,ice:0}, defense:0, allowed:['mare','highlands','crater'] },
  extractor: { name:'Extractor de He-3',  icon:'☢', resource:'helium3',  cost:{regolith:20,helium3:5,ice:0},  produce:{regolith:0,helium3:3,ice:0}, defense:0, allowed:['highlands','crater'] },
  melter:    { name:'Fusor de Hielo',     icon:'❄', resource:'ice',    cost:{regolith:15,helium3:0,ice:0},  produce:{regolith:0,helium3:0,ice:3}, defense:0, allowed:['ice'] },
  barracks:  { name:'Cuartel Lunar',      icon:'▣', trains:true,         cost:{regolith:20,helium3:10,ice:5}, produce:{regolith:0,helium3:0,ice:0}, defense:1, allowed:TODO_TERRENO },
  turret:    { name:'Torreta Defensiva',  icon:'▲', cost:{regolith:25,helium3:10,ice:0}, produce:{regolith:0,helium3:0,ice:0}, defense:3, allowed:TODO_TERRENO },
  lab:       { name:'Laboratorio',        icon:'◆', cost:{regolith:20,helium3:10,ice:0}, produce:{regolith:0,helium3:1,ice:0}, defense:0, allowed:TODO_TERRENO },
  // La base no produce hielo: el hielo solo sale del Casquete de Hielo y del Fusor,
  // así que hay que ir a buscarlo al mapa en vez de recibirlo gratis.
  base:      { name:'Base Principal',     icon:'★', trains:true,         cost:{regolith:0,helium3:0,ice:0},   produce:{regolith:1,helium3:1,ice:0}, defense:5, allowed:TODO_TERRENO },
};

/* Coste de reclutar una guarnición. Vive aquí porque lo consultan a la vez la
   economía, la IA y el panel de acciones. */
export const TRAIN_COST = { regolith:12, helium3:4, ice:0 };

export const TECHS = [
  { id:'armor',    name:'Blindaje Reforzado',     cost:40, desc:'+1 fuerza a todas tus unidades (ataque y defensa)' },
  { id:'drilling', name:'Perforación Profunda',   cost:35, desc:'+2 regolito por cada Mina' },
  { id:'cryo',     name:'Procesado Criogénico',   cost:35, desc:'+2 hielo por cada Fusor de Hielo' },
  { id:'fusion',   name:'Reactores de Fusión',    cost:50, desc:'+2 helio-3 por cada Extractor' },
  { id:'relay',    name:'Relé Orbital',           cost:60, desc:'+25% de fuerza al atacar' },
];

export const DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];


export const ZOOM_MIN = 0.6, ZOOM_MAX = 2.4, ZOOM_STEP = 1.25;

export const FACTION_DEFS = [
  { id:0, name:'Estación Ártemis',   color:'#4FC3E8', dim:'#2A5A6E', isPlayer:true  },
  { id:1, name:'Colectivo Vostok',   color:'#E8935D', dim:'#6E4A2A', isPlayer:false },
  { id:2, name:'Consorcio Helios',   color:'#7ED9A8', dim:'#3A6E52', isPlayer:false },
];

/* Proporción de la guarnición vecina que se aporta como apoyo (1 = fuerza completa).
   Bajarlo a 0.5 hace las líneas de frente menos decisivas. */
export const SUPPORT_FACTOR = 1;
