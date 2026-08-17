# CLAUDE.md — Artemisa

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
  economy.js        producción, tope de población, construcción, reclutamiento
  ai.js             turno de las rivales: ataque, concentración, construcción…
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
tools/
  serve.mjs         servidor estático de desarrollo (`npm start`), sin dependencias
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
servidor estático; el del repo solo usa módulos internos de Node:

```bash
npm start     # node tools/serve.mjs 8000, y abrir http://localhost:8000
```

## Comprobaciones antes de dar por buena una tarea

```bash
node tests/check-imports.mjs     # no debe haber referencias rotas
node tests/balance-sim.mjs 200   # la lógica debe correr sin DOM
```

La simulación de balance es además el **contrato de la regla 6**: si alguien
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
- **Tope de población**: `4 + producción de hielo por turno + sectores
  controlados`, en `popCap()` de `economy.js`. Depende del *flujo* de hielo y no
  del montón acumulado, a propósito: acaparar no sirve, hay que sostener la
  producción. Y como cada sector suma, expandirse es lo que financia el ejército
  con el que sigues expandiéndote. Vive en `economy.js` y no en `state.js` porque
  necesita `projectedIncome()`; traerlo al estado crearía un ciclo de imports.
  Una facción puede quedar **por encima** del tope al perder terreno o casquetes:
  eso solo le impide reclutar, nunca destruye tropas ya existentes. Cuando pasa,
  el contador de la barra superior se pinta en rojo (`.res.pop.excedido`). Las
  guarniciones iniciales son 5 justamente para cuadrar con el tope de arranque
  (4 + 0 de hielo + 1 sector): se empieza al completo, no por encima.
- **Blindaje Reforzado en defensa**: solo cuenta si el sector atacado **tiene
  guarnición**. El blindaje lo llevan puestas las tropas, así que un sector vacío
  no se beneficia por mucho que su facción tenga la tecnología. En ataque no
  aplica la restricción: ahí siempre hay tropas enviadas.
- **Combate**: gana quien tenga más fuerza; el desglose completo debe seguir
  apareciendo en el registro de misión y en la vista previa. No sustituyas el
  modelo determinista por tiradas aleatorias sin pedirlo explícitamente.

## Balance: histórico de una investigación larga

Estado actual, medido con `node tests/balance-sim.mjs 200`: **el 85,5 % de las
partidas se resuelven por dominancia**, en 64,3 rondas de media sobre 80, con el
líder controlando el 59 % del mapa. La incidencia que arrastraba este documento
—*el 100 % de las partidas agotaban el límite de rondas*— está **cerrada**.

### Qué la causaba

**La IA dispersaba las tropas de una en una y nunca las concentraba.** Medido en
su momento: el 72,4 % de sus sectores con frontera no tenían tropas que enviar
(guarnecían 1 unidad y `aiTakeTurn()` envía `availableUnits-1`), el 58,8 % de
todos los sectores tenían exactamente 1 unidad, y a los frentes bloqueados les
faltaban solo **0,6 puntos de fuerza**. No les faltaba ejército: les faltaba
juntarlo.

Se arregló con `concentrarTropas()` en `ai.js` y subiendo `MAX_TURNS` de 60 a 80:

| | antes | con concentración | y con 80 rondas |
|---|---|---|---|
| partidas resueltas | 0 % | 40 % | **85,5 %** |
| territorio del líder | 14,2 % | 52,2 % | **59,0 %** |

### Callejones sin salida (no repitas estas pruebas)

Todo esto se midió y **no era la causa**. Dos de ellos llegaron a estar
recomendados en versiones anteriores de este mismo documento:

- **El apoyo.** `SUPPORT_FACTOR` a 0 / 0.25 / 0.5 / 1: ninguna partida se resolvía
  en ningún caso.
- **Los recursos.** El líder terminaba con ~750 de regolito sin gastar.
- **El tope de población.** Barrido de la base de `popCap()` de 4 a 30, 200
  partidas por valor: las resueltas seguían en 0 % y el líder solo pasaba de 8,5 a
  10,8 sectores. Con la base en 30 las facciones ni siquiera llenaban el tope
  (presión 83 %), lo que demostraba que no era el techo lo que las frenaba.
- **La cadencia de reclutamiento.** Con la IA reclutando 1 unidad por cada punto
  de recluta en vez de 1 por turno: 8,7 sectores frente a 8,5.
- **Encoger el mapa.** Ayuda en proporción pero no resuelve: entre `RADIUS` 7, 5 y
  4 el líder se quedó clavado en 9-11 sectores absolutos, y lo que subía era el
  porcentaje porque bajaba el denominador.

La lección: **la presión del tope al 98 % era un espejismo.** El ejército estaba
pegado al techo porque no llegaba a gastarse en combate, no porque faltara techo.
Un indicador saturado no prueba que ese indicador sea el cuello de botella.

### Barrido del tope de población, ya con la concentración activa

| base de `popCap()` | resueltas | líder | presión del tope |
|------|-----------|-------|------------------|
|  **4** (actual) | 42,5 % | 52,2 % | **57 %** |
|  6   | 36,5 % | 52,7 % | 42 % |
|  8   | 39,0 % | 52,9 % | 38 % |
| 10   | 42,5 % | 54,2 % | 35 % |
| 12   | 32,0 % | 52,4 % | 33 % |
| 16   | 38,5 % | 52,4 % | 30 % |

Ningún valor mejora la resolución —las diferencias son ruido a 200 partidas— y
subir la base solo desploma la presión. **Se deja en 4**, que es la que conserva
la tensión que la regla persigue; subirla devuelve el tope al papel decorativo.

### Barrido de `MAX_TURNS`, con la concentración activa

| rondas | resueltas | ronda media |
|--------|-----------|-------------|
| 60 | 40,0 % | 57,3 |
| 70 | 70,5 % | 62,0 |
| **80** (actual) | **84-85 %** | 64,3 |
| 90 | 89,5 % | 65,5 |
| 100 | 96,0 % | 66,2 |

Las partidas piden unas 65 rondas para decidirse, así que 60 las cortaba justo
antes del desenlace. A partir de 90 la curva se aplana y solo alarga la partida.

**Conviene medir cada cambio con la simulación** en vez de ajustar a ojo.

## Estilo de código

- Español en comentarios y en todo el texto de cara al usuario.
- Comentarios que expliquen el *porqué* (decisiones de diseño, trampas
  conocidas), no el *qué*.
- Sin punto y coma opcional omitido; comillas simples en JS.
- Nombres de dominio en español (`guarnición`, `sector`) en el texto visible;
  identificadores de código en inglés o español, pero coherentes con el módulo.
