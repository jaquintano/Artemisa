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
4. **Gráficos generados por código y 100 % vectoriales.** Terreno, unidades y
   recursos son SVG calculado en tiempo de ejecución: nada de ficheros de imagen
   ni sprites externos. Todo se dibuja una sola vez y lo reescala el navegador,
   nítido a cualquier zoom (`terrain-icons.js`, `unit-icon.js`,
   `resource-icons.js`). Hubo una etapa en que el terreno era pixel art que se
   regeneraba a más resolución al acercar el zoom; se retiró por decisión del
   mantenedor y con él toda su maquinaria (`pixelart.js`, `PIXEL_BASE`,
   `ICON_N_*`, `setIconResolution()`). No lo reintroduzcas.
   Los iconos que se repiten por el mapa se emiten como `<defs>` + `<use>`, no
   inline: duplicar sus trazados en decenas de sectores infla el DOM sin
   necesidad. Por eso la ficha de guarnición precalcula una variante por facción
   en vez de recibir el color por parámetro en cada llamada.
5. **El relieve del terreno no lleva color propio.** `terrain-icons.js` dibuja
   solo blancos y negros semitransparentes, de modo que el tono lo aporta siempre
   el relleno de debajo: el color del terreno si el sector es neutral y el de la
   facción si tiene dueño. Gracias a eso basta un juego de baldosas para los dos
   casos. Si metes un color fijo ahí, los sectores conquistados dejarán de verse
   coherentes.
6. **La lógica de dominio no toca el DOM.** `config`, `state`, `combat`,
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
    terrain-icons.js   relieve vectorial de las cuatro baldosas de terreno
    resource-icons.js  iconos vectoriales de regolito, helio-3 y hielo
    unit-icon.js    ficha de guarnición, teñida con el color de cada facción
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
sustituir la partida entera hay que llamar a `setState()`.

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
- **Reclutamiento localizado**: las guarniciones solo se entrenan en edificios
  marcados con `trains:true` en `BUILDING_TYPES` — hoy la Base Principal y el
  Cuartel Lunar. `canTrainAt(hex)` es la única vía legítima para comprobarlo: no
  compares contra los nombres de tipo a mano. Combinado con el movimiento de 1
  sector por ronda, esto convierte la colocación de cuarteles en la decisión que
  fija el frente, y deja sin refuerzos a quien pierda todos sus puntos de recluta.
- **Costes en tres recursos**: `cost` siempre declara `regolith`, `helium3` e
  `ice`. Usa `canAfford()` / `payCost()` de `economy.js` en lugar de restar
  recursos a mano; el Cuartel Lunar fue el primero en gastar hielo y varios sitios
  daban por hecho que solo existían dos monedas.
- **Un solo nombre para el tercer recurso: «hielo»** (`ice` en código). Antes
  convivían `water`/«agua» con el terreno «Casquete de Hielo» y el «Fusor de
  Hielo», y nadie entendía si eran uno o dos recursos. No reintroduzcas «agua».
- **La producción se calcula en un único sitio**: `projectedIncome(faction)`.
  `produceResources()` la cobra y la barra superior la anuncia con el `(+N)`. Si
  añades un bonus, hazlo ahí dentro o el jugador verá una previsión que no se
  cumple.
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
  partida se resuelve en ningún caso. Más apoyo incluso *acelera* la expansión,
  porque favorece a quien ya tiene frente formado.
- **No son los recursos ni el tope de población.** En la ronda 60 el líder
  acumula ~660 de regolito sin gastar y un tope de población muy por encima de
  las ~42 unidades que llega a reclutar.
- **La causa está en el ritmo de reclutamiento**: `aiTakeTurn()` entrena **una
  sola unidad por turno** como mucho, ritmo insuficiente para conquistar el mapa
  en 60 rondas. Ese techo no lo movió ninguno de los cambios posteriores.

Medidas sucesivas del territorio medio del líder al final (misma simulación):

| Configuración                                    | Mapa | Líder final |
|--------------------------------------------------|------|-------------|
| `RADIUS=7`, reclutamiento libre                   | 169  | 17,3 % (~29 sect.) |
| `RADIUS=5`, reclutamiento libre                   |  91  | 26,4 % (~24 sect.) |
| `RADIUS=5` + reclutamiento solo en base/cuartel   |  91  |  7,7 % (~7 sect.) |
| …y la IA priorizando cuarteles (`ai.js`)          |  91  | 12,5 % (~11 sect.) |

Lecturas: encoger el mapa ayuda mucho en proporción (17,3 → 26,4 %) pero **no
basta** para resolver partidas. Limitar el reclutamiento cuesta más o menos la
mitad del territorio del líder (26,4 → 12,5 %), que es el precio esperado de la
regla; el hundimiento hasta 7,7 % era en cambio un fallo: el umbral de prioridad
de cuarteles estaba mal calculado y la IA se quedaba con un único punto de
recluta. El techo de 1 unidad/turno sigue mandando por encima de todo.

Líneas de ataque razonables, a decidir por el mantenedor: permitir a la IA
reclutar en proporción a sus puntos de recluta, subir `MAX_TURNS`, o bajar
`DOMINANCE_RATIO`. **Conviene medir cada cambio con la simulación** en vez de
ajustar a ojo.

## Estilo de código

- Español en comentarios y en todo el texto de cara al usuario.
- Comentarios que expliquen el *porqué* (decisiones de diseño, trampas
  conocidas), no el *qué*.
- Sin punto y coma opcional omitido; comillas simples en JS.
- Nombres de dominio en español (`guarnición`, `sector`) en el texto visible;
  identificadores de código en inglés o español, pero coherentes con el módulo.
