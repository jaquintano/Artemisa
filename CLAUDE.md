# CLAUDE.md — Conquista Lunar

Instrucciones permanentes para trabajar en este repositorio.

## Qué es

Simulador de estrategia por turnos ambientado en la Luna. Tres facciones compiten
por el control territorial de un mapa hexagonal. Interfaz web, **JavaScript puro
con ES modules, sin dependencias de runtime ni build step**.

## Restricciones innegociables

1. **Cero dependencias de runtime.** Nada de React, D3, Phaser ni CDNs. El juego
   debe seguir funcionando sirviendo la carpeta con un servidor estático. Las
   dependencias de *desarrollo* (test runner, linter) sí son aceptables.
2. **Sin build step.** Nada de bundlers ni transpiladores. El navegador carga
   `src/main.js` como módulo directamente.
3. **Todo el texto de la interfaz en español**, incluidos los mensajes del
   registro de misión y el tutorial.
4. **Gráficos generados por código.** El terreno, las unidades y los recursos son
   SVG dibujado mediante rectángulos/polígonos calculados en tiempo de ejecución.
   No se incorporan ficheros de imagen ni sprites externos. Conviven dos estilos
   deliberadamente distintos: el terreno es pixel art que *se regenera* a más
   resolución al acercar el zoom (`pixelart.js`), mientras que unidades y recursos
   son vectoriales y se dibujan una sola vez, nítidos a cualquier escala
   (`svg-utils.js`, `resource-icons.js`). No unifiques ambos criterios.
5. **La lógica de dominio no toca el DOM.** `config`, `state`, `combat`,
   `economy`, `ai` y `victory` deben poder ejecutarse en Node sin navegador.
   Cualquier necesidad de repintar se canaliza por `src/render/bus.js`.

## Arquitectura

```
index.html          estructura y textos de la interfaz
styles.css          estilos (variables CSS en :root)
src/
  config.js         constantes de dominio y parámetros de balance
  state.js          estado de partida y consultas sobre la rejilla hexagonal
  combat.js         apoyo entre sectores, fuerzas de ataque/defensa, resolución
  economy.js        producción, construcción, reclutamiento, investigación
  ai.js             turno de las facciones rivales
  victory.js        eliminación y condiciones de victoria
  game.js           órdenes de movimiento, cierre de turno, arranque
  main.js           único módulo que cablea lógica y presentación
  render/
    bus.js          inversión de dependencia lógica -> presentación
    svg-utils.js    geometría hexagonal y sombreado de color
    pixelart.js     iconos de terreno, regenerados según el zoom
    resource-icons.js  iconos vectoriales de regolito, helio-3 y hielo
    map.js          render del mapa, zoom y scroll
    ui.js           paneles, registro de misión, leyenda
tests/
  check-imports.mjs verificación estática del grafo de módulos
  balance-sim.mjs   simulación IA vs IA sin navegador
```

### Regla de dependencias

El flujo es **presentación → lógica**, nunca al revés. Si un módulo de lógica
necesita repintar, llama a `requestRender()` de `render/bus.js`; `main.js` es
quien registra el renderizador real. **No introduzcas imports de `render/` en
módulos de lógica**: rompe la ejecución headless y crea ciclos.

### Estado compartido

`state` se exporta desde `state.js` como binding vivo (`export let`). Los módulos
que lo importan lo leen actualizado, pero **no pueden reasignarlo**: para
sustituir la partida entera hay que llamar a `setState()`. Lo mismo aplica a
`ICON_N` en `pixelart.js` (`setIconResolution()`) .

## Cómo ejecutarlo

Los ES modules no funcionan con `file://` por la política CORS. Hace falta un
servidor estático:

```bash
python3 -m http.server 8000     # y abrir http://localhost:8000
```

## Comprobaciones antes de dar por buena una tarea

```bash
node tests/check-imports.mjs     # no debe haber referencias rotas
node tests/balance-sim.mjs 200   # la lógica debe correr sin DOM
```

La simulación de balance es además el **contrato de la regla 5**: si alguien
introduce una dependencia del DOM en la capa de lógica, deja de ejecutarse.

## Reglas de juego (invariantes a preservar)

- **Movimiento**: cada guarnición se desplaza como máximo **1 sector por ronda**.
  Se controla con `hex.movedUnits`; `availableUnits(hex)` es la única vía
  legítima para saber cuántas tropas pueden recibir órdenes.
- **Apoyo**: un sector aliado refuerza a un combatiente si linda *a la vez* con
  el combatiente y con el sector en disputa. Simétrico para ataque y defensa. En
  una rejilla hexagonal dos casillas adyacentes comparten **siempre exactamente
  2 vecinos**, así que cada bando recibe como máximo 2 apoyos, y son las mismas
  dos casillas para ambos: controlarlas es el objetivo táctico real del frente.
  Las tropas de apoyo no se desplazan ni sufren bajas.
- **Combate**: gana quien tenga más fuerza; el desglose completo debe seguir
  apareciendo en el registro de misión y en la vista previa. No sustituyas el
  modelo determinista por tiradas aleatorias sin pedirlo explícitamente.

## Incidencia abierta: la partida no se resuelve

Medido con `node tests/balance-sim.mjs 200`: **el 100 % de las partidas agotan el
límite de rondas** sin que nadie alcance el 60 % de dominancia.

Diagnóstico ya realizado (no hace falta repetirlo):

- **No es el apoyo.** Probado con `SUPPORT_FACTOR` a 0 / 0.25 / 0.5 / 1: ninguna
  partida se resuelve en ningún caso. Más apoyo incluso *acelera* la expansión
  (líder final 9,8 % → 17,3 %), porque favorece a quien ya tiene frente formado.
- **No son los recursos ni el tope de población.** En la ronda 60 la facción
  acumula ~2.600 de regolito sin gastar y un tope de 1.252 unidades para 52
  reclutadas.
- **La causa está en el ritmo de reclutamiento**: `aiTakeTurn()` entrena **una
  sola unidad por turno**, y el mapa (169 sectores; hacen falta 102 para ganar)
  es demasiado grande para ese ritmo en 60 rondas.

Líneas de ataque razonables, a decidir por el mantenedor: permitir a la IA
reclutar en proporción a sus recursos, subir `MAX_TURNS`, reducir `RADIUS`, o
bajar `DOMINANCE_RATIO`. **Conviene medir cada cambio con la simulación** en vez
de ajustar a ojo.

## Estilo de código

- Español en comentarios y en todo el texto de cara al usuario.
- Comentarios que expliquen el *porqué* (decisiones de diseño, trampas
  conocidas), no el *qué*.
- Sin punto y coma opcional omitido; comillas simples en JS.
- Nombres de dominio en español (`guarnición`, `sector`) en el texto visible;
  identificadores de código en inglés o español, pero coherentes con el módulo.
