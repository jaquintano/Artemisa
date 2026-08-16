/* Constantes de dominio y parámetros de balance. Sin estado mutable ni DOM. */

export const RADIUS = 7;               // radio del mapa hexagonal (mapa grande)
export const HEX_SIZE = 30;
export const MAX_TURNS = 60;
export const DOMINANCE_RATIO = 0.6;    // % de mapa para victoria por dominancia

// elevación en px de cada terreno para la extrusión isométrica (negativo = depresión)
export const ELEVATION = { mare:0, highlands:0, crater:0, ice:0 };

export const TERRAIN = {
  mare:      { name:'Mare (llanura basáltica)', color:'#4A5568', regolith:1, helium3:0, water:0, defense:0 },
  highlands: { name:'Tierras Altas',            color:'#9C8F72', regolith:1, helium3:1, water:0, defense:1 },
  crater:    { name:'Cráter',                   color:'#3D3B42', regolith:0, helium3:2, water:0, defense:1 },
  ice:       { name:'Casquete de Hielo',        color:'#B9E3F0', regolith:0, helium3:0, water:2, defense:0 },
};
export const TERRAIN_WEIGHTS = [['mare',.35],['highlands',.30],['crater',.20],['ice',.15]];

export const BUILDING_TYPES = {
  // 'resource' marca los edificios que se pintan con el icono vectorial del recurso
  // que extraen (ver render/resource-icons.js) en vez de con el glifo de 'icon'.
  mine:      { name:'Mina de Regolito',   icon:'⛏', resource:'regolith', cost:{regolith:15,helium3:0},  produce:{regolith:3,helium3:0,water:0}, defense:0, allowed:['mare','highlands','crater'] },
  extractor: { name:'Extractor de He-3',  icon:'☢', resource:'helium3',  cost:{regolith:20,helium3:5},  produce:{regolith:0,helium3:3,water:0}, defense:0, allowed:['highlands','crater'] },
  melter:    { name:'Fusor de Hielo',     icon:'❄', resource:'water',    cost:{regolith:15,helium3:0},  produce:{regolith:0,helium3:0,water:3}, defense:0, allowed:['ice'] },
  turret:    { name:'Torreta Defensiva',  icon:'▲', cost:{regolith:25,helium3:10}, produce:{regolith:0,helium3:0,water:0}, defense:3, allowed:['mare','highlands','crater','ice'] },
  lab:       { name:'Laboratorio',        icon:'◆', cost:{regolith:20,helium3:10}, produce:{regolith:0,helium3:1,water:0}, defense:0, allowed:['mare','highlands','crater','ice'] },
  base:      { name:'Base Principal',     icon:'★', cost:{regolith:0,helium3:0},   produce:{regolith:1,helium3:1,water:1}, defense:5, allowed:['mare','highlands','crater','ice'] },
};

export const TECHS = [
  { id:'armor',    name:'Blindaje Reforzado',     cost:40, desc:'+1 fuerza a todas tus unidades (ataque y defensa)' },
  { id:'drilling', name:'Perforación Profunda',   cost:35, desc:'+2 regolito por cada Mina' },
  { id:'cryo',     name:'Procesado Criogénico',   cost:35, desc:'+2 agua por cada Fusor de Hielo' },
  { id:'fusion',   name:'Reactores de Fusión',    cost:50, desc:'+2 helio-3 por cada Extractor' },
  { id:'relay',    name:'Relé Orbital',           cost:60, desc:'+25% de fuerza al atacar' },
];

export const DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];


export const ZOOM_MIN = 0.6, ZOOM_MAX = 2.4, ZOOM_STEP = 1.25;
export const ICON_N_MIN = 4, ICON_N_MAX = 18;

export const FACTION_DEFS = [
  { id:0, name:'Estación Ártemis',   color:'#4FC3E8', dim:'#2A5A6E', isPlayer:true  },
  { id:1, name:'Colectivo Vostok',   color:'#E8935D', dim:'#6E4A2A', isPlayer:false },
  { id:2, name:'Consorcio Helios',   color:'#7ED9A8', dim:'#3A6E52', isPlayer:false },
];

/* Proporción de la guarnición vecina que se aporta como apoyo (1 = fuerza completa).
   Bajarlo a 0.5 hace las líneas de frente menos decisivas. */
export const SUPPORT_FACTOR = 1;

// resolución NxN de referencia de los iconos pixel art a zoom 1×
export const PIXEL_BASE = 8;
