# CLAUDE.md — Artemisa

Instrucciones permanentes para trabajar en este repositorio.

## Qué es

Simulador de estrategia por turnos ambientado en la Luna: 3 o 4 facciones
compiten por el control territorial de un mapa hexagonal. Interfaz web,
**JavaScript puro con ES modules, sin dependencias de runtime ni build step**.

## Restricciones innegociables

1. **Cero dependencias de runtime.** Nada de React, D3, Phaser ni CDNs; el juego
   funciona sirviendo la carpeta con un servidor estático. Dependencias de
   *desarrollo* (test runner) sí valen.
2. **Sin build step.** El navegador carga `src/main.js` como módulo directamente.
3. **Todo el texto de cara al usuario en español**, incluidos registro de misión y
   tutorial.
4. **Gráficos por código y 100 % vectoriales.** Terreno, unidades y recursos son
   SVG calculado en tiempo de ejecución (`terrain-icons.js`, `unit-icon.js`,
   `resource-icons.js`): nada de imágenes ni sprites. Los iconos que se repiten
   por el mapa se emiten como `<defs>` + `<use>`, no inline, para no inflar el DOM;
   por eso la ficha de guarnición precalcula una variante por facción.
5. **El relieve del terreno no lleva color propio.** `terrain-icons.js` dibuja solo
   blancos y negros semitransparentes; el tono lo pone el relleno de debajo (color
   del terreno si es neutral, de la facción si tiene dueño). Un color fijo ahí
   rompería los sectores conquistados.
6. **La lógica de dominio no toca el DOM.** `config`, `state`, `mapgen`, `combat`,
   `economy`, `ai`, `victory`, `hopper` corren en Node sin navegador. Todo
   repintado se canaliza por `render/bus.js`. La simulación de balance es el
   contrato de esta regla: si alguien mete una dependencia del DOM en la lógica,
   deja de ejecutarse.

## Arquitectura

```
index.html          estructura y textos de la interfaz
styles.css          estilos (variables CSS en :root)
src/
  config.js         constantes de dominio y parámetros de balance
  mapgen.js         generación del tablero por reglas (bases, terreno, neutrales)
  state.js          estado de partida y consultas sobre la rejilla hexagonal
  combat.js         apoyo, fuerzas de ataque/defensa, resolución
  economy.js        producción, mantenimiento, tope de población, construcción
  hopper.js         Transportador: fabricación y reglas de salto
  ai.js             turno de las rivales en 6 fases: mantenimiento, recluta, ataque, maniobra, ciencia, expansión
  victory.js        eliminación, dominancia y victoria técnica por puntos
  game.js           órdenes de movimiento, cierre de turno, arranque
  main.js           único módulo que cablea lógica y presentación
  render/
    bus.js          inversión de dependencia lógica -> presentación
    svg-utils.js    geometría hexagonal y sombreado de color
    terrain-icons.js   relieve vectorial de las cuatro baldosas de terreno
    resource-icons.js  iconos vectoriales de regolito, helio-3 y hielo
    unit-icon.js    ficha de guarnición, teñida con el color de cada facción
    map.js          render del mapa, zoom, scroll y fronteras de territorio
    ui.js           panel de sector, árbol tecnológico, registro de misión, leyenda
tests/
  check-imports.mjs verificación estática del grafo de módulos
  balance-sim.mjs   simulación IA vs IA sin navegador
  mapgen-test.mjs   comprueba las reglas de generación sobre cientos de mapas
tools/
  serve.mjs         servidor estático de desarrollo (`npm start`), sin dependencias
  version.mjs       consulta, incrementa y comprueba el número de versión
```

### Regla de dependencias

Flujo **presentación → lógica**, nunca al revés. Si un módulo de lógica necesita
repintar, llama a `requestRender()` de `render/bus.js`; `main.js` registra el
renderizador real. **No importes `render/` desde módulos de lógica**: rompe la
ejecución headless y crea ciclos.

### Estado compartido

`state` se exporta desde `state.js` como binding vivo (`export let`): los módulos
lo leen actualizado pero **no pueden reasignarlo**. Para sustituir la partida
entera, `setState()`.

### Número de versión

Fuente de verdad: `APP_VERSION` en `src/config.js` (el navegador la importa sin
petición extra). `tools/version.mjs` la copia a `package.json`; **no la edites a
mano en dos sitios**. `.claude/auto-deploy.sh` la incrementa (`bump`) antes de
cada publicación y lo pliega en el commit de cabeza con `--amend`. `npm test`
ejecuta `version.mjs check`, que falla si divergen.

**Ojo con la caché al verificar un despliegue.** GitHub Pages sirve el HTML con
`max-age=600`: hasta diez minutos el navegador puede seguir mostrando la copia
anterior aunque el push fuera bien. Para saber qué hay publicado, pide el fichero
con `cache:'no-store'` (o `curl`), no mires la pestaña. `main.js` compara al
arrancar su versión con la de `package.json` y avisa en la cabecera si difieren.

## Cómo ejecutarlo y comprobarlo

Los ES modules no cargan desde `file://` (CORS); hace falta servir la carpeta:

```bash
npm start                        # sirve en http://localhost:8000
node tests/check-imports.mjs     # grafo de módulos sin referencias rotas
node tests/balance-sim.mjs 200   # la lógica corre sin DOM; mide el balance
node tests/mapgen-test.mjs 200   # reglas de generación sobre cientos de mapas
```

## Reglas de juego (invariantes a preservar)

- **`PLAYER_COUNT` (3 o 4) manda sobre el tamaño**: 3 → lado 5 y 61 losetas; 4 →
  lado 6 y 91. El radio no es constante: viaja en `state.radius`. Las facciones
  son las `PLAYER_COUNT` primeras de `FACTION_DEFS`, y los recursos iniciales
  salen de `STARTING`.
- **El tablero se genera por reglas, no al azar** (`mapgen.js`). Todo arranca
  siendo Mare; se tallan una *zona de expansión* por jugador (radio 2 desde su
  base, con 2 de cada terreno especial) y una *tierra de nadie* central cuyas
  especiales forman un **racimo pegado a la loseta central** (con 3 jugadores:
  «centro + 2 adyacentes» o «3 adyacentes»). La intención es que **nadie salga
  favorecido por el sorteo**: mantén la simetría si tocas el reparto.
  `generarMapa()` se autovalida y revienta si los conteos no cuadran.
- **Bases equidistantes en el perímetro.** Repartir por índice de anillo NO vale
  para 4 jugadores (perímetro 30, no divisible): `repartirBases()` busca la
  disposición perfecta. Resultado: 3 → triángulo (parejas a 8); 4 → cuadrado
  (contiguas a 7, diagonales a 10). **Busca, no supongas.**
- **Movimiento**: cada guarnición se mueve máximo **1 sector por ronda**, vía
  `hex.movedUnits`; `availableUnits(hex)` es la única forma legítima de saber
  cuántas tropas pueden recibir órdenes.
- **Reclutamiento localizado**: solo en edificios con `trains:true` (Base y
  Cuartel Lunar). Comprueba con `canTrainAt(hex)`, no contra nombres de tipo a
  mano. Junto al movimiento de 1/ronda, esto hace de la colocación de cuarteles la
  decisión que fija el frente.
- **Costes y recursos en tres monedas** (`regolith`, `helium3`, `ice`, llamada
  siempre «hielo» — nunca reintroduzcas «agua»). Usa `canAfford()` / `payCost()`,
  no restes a mano.
- **La producción se calcula en un solo sitio**: `projectedIncome(faction)`.
  `produceResources()` la cobra y la barra la anuncia con el `(+N)`. Si añades un
  bono, hazlo ahí o la previsión mentirá.
- **Mantenimiento y apagados**: cada instalación con `upkeep` se cobra al cerrar el
  turno, **antes** de producir. Lo impagado queda `hex.disabled = true` y deja de
  producir, defender y habilitar; no se destruye y se reactiva sola al haber
  recursos. **Consulta siempre `edificioActivo(hex)`, nunca `hex.building` a
  secas** — cada olvido regala un bono sin pagar. Orden de pago fijo (base,
  cuarteles, laboratorio, torretas): una facción arruinada conserva antes su
  capacidad de rehacerse que sus defensas.
- **Laboratorio: llave de la ciencia.** `unique:true` (uno por facción) y
  `enables:['research','hoppers']`. Sin uno activo no hay investigación ni
  transportes. Usa `habilitado(faction,'research')` y `puedeInvestigar()`.
- **Los bonos tecnológicos se acumulan** vía `bonoTecnologico()`: Perforación I+II
  dan +4 sobre la Mina (3+2+2 = 7). Un nivel III se declara solo en `TECHS`.
- **Tope de población** = `4 + producción de hielo por turno + sectores`, en
  `popCap()` (vive en `economy.js` porque necesita `projectedIncome()`; en
  `state.js` crearía un ciclo). Depende del *flujo* de hielo, no del acumulado:
  expandirse financia el ejército con el que sigues expandiéndote. Una facción
  puede quedar **por encima** del tope al perder terreno; eso solo impide reclutar
  (contador en rojo, `.res.pop.excedido`), no destruye tropas.
- **Apoyo**: un sector aliado refuerza a un combatiente si linda *a la vez* con él
  y con el sector en disputa. En rejilla hexagonal dos casillas adyacentes
  comparten **exactamente 2 vecinos**, así que cada bando recibe máximo 2 apoyos, y
  son las mismas dos para ambos. Las tropas de apoyo no se mueven ni sufren bajas.
- **Blindaje Reforzado** solo cuenta en defensa si el sector **tiene guarnición**
  (el blindaje lo llevan las tropas). En ataque no aplica la restricción.
- **Combate determinista**: gana quien tenga más fuerza; el desglose completo
  aparece en el registro y en la vista previa. No lo sustituyas por tiradas
  aleatorias sin pedirlo.
- **El Transportador va aparte de `hex.units`** (`hex.hoppers`). Esa cifra es la
  infantería y la usan combate, apoyo y tope de población; meter hoppers ahí
  obligaría a descontarlos en todos esos sitios. El hopper no tiene fuerza de
  combate: salta hasta 2 casillas con hasta 4 tropas. Una Torreta rival **activa**
  niega aterrizar y sobrevolar (`torretaEnemigaActiva`); el destino no admite
  torreta rival ni aunque esté apagada.
- **Victoria técnica por puntos**: al agotarse los turnos decide `score()`, no el
  territorio a secas. Puntúan sectores, instalaciones en pie, bajas rivales
  (`faction.kills`, que lleva `resolveCombat` — las neutrales no cuentan) y el Relé
  Orbital. Pesos en `SCORE` de `config.js`: **2 / 1 / 1 / 3**, los de las reglas del
  juego. Con `MAX_TURNS` en 40 esta es la vía por la que se decide casi toda
  partida, así que tocar estos pesos cambia el juego entero.
- **El saldo que anuncia la barra superior es neto**: producción menos
  mantenimiento. `desgloseIngresos()` es la cuenta única (terreno, edificios y
  mantenimiento por separado) y `projectedIncome()` suma sus dos partidas de
  producción. **No metas el mantenimiento dentro de `projectedIncome`**: lo cobra
  `pagarMantenimiento()` aparte y se cobraría dos veces.
- **La propiedad se marca con el perímetro, no con el relleno.** Cada loseta
  conserva el color de su terreno; `map.js` traza en el color de la facción los
  lados que dan a alguien distinto. La unión de esos lados es el contorno del
  territorio contiguo (sin calcular componentes conexas). Los bordes se pintan al
  final, por encima de todos los hexágonos, o el vecino los taparía. **Y encima de
  ellos van los realces** (`.hexhl`: selección, objetivo y apoyos) en una tercera
  capa: el borde de territorio es más grueso y escondía la loseta señalada.
- **Colocación de unidades en la loseta** (`UNIDAD_CY`, `SEPARACION`, `NUM_BAJADA`
  en `map.js`): el contador va centrado *bajo* la ficha, no al lado, para dejar el
  hueco derecho al Transportador cuando comparten sector. Ese apilado obliga a
  subir el grupo: el hexágono se estrecha deprisa hacia abajo y un contador de dos
  cifras desplazado a un lado se salía por el lado inclinado. Si tocas estas
  constantes, comprueba las cuatro combinaciones (solo tropas, solo hopper, ambos,
  y con dos cifras).

## Balance

`MAX_TURNS` es **40**, el límite que fijan las reglas del juego. Con una partida
tan corta **casi ninguna se resuelve por dominancia**: al agotarse los turnos
decide `score()`, y eso es el diseño, no una avería. El líder acaba sobre el 25 %
del mapa. **No subas `MAX_TURNS` para "arreglar" el porcentaje de conquistas.**

Por eso `tests/balance-sim.mjs` ya no mide «cuántas se resuelven por conquista»
sino **si las tres IAs, que juegan con el mismo código, ganan por igual**. Un
sesgo ahí sí es un fallo real (posición de salida u orden de turno), y el umbral
está en 3σ de la binomial para que la tanda corta de `npm test` no dé falsas
alarmas. Ojo: a 600 partidas el reparto **sí** sale sesgado hacia la facción 1
(~41 % frente al 33 % esperado); está sin diagnosticar.

La simulación **paga el mantenimiento** como hace `endTurn()`. Antes no lo hacía y
regalaba el sostenimiento de todas las instalaciones, así que sus economías y sus
expansiones eran más optimistas que las del juego real.

`ai.js` ejecuta el turno en seis fases fijas (mantenimiento como reserva,
reclutamiento, ataque quirúrgico, maniobra de apoyo, tecnología y expansión).
Recluta hasta el tope de población cuando no domina el frente, prioriza capturar
Parajes Helados y Cráteres (más He-3 y tope de población) y solo asalta con
victoria matemática garantizada.

La palanca que de verdad mueve el avance es `concentrarTropas()`: sin ella la IA
reparte las tropas de una en una y no rompe ningún frente. **Por eso corre cada
turno**, no solo los turnos sin ataque: mueve tropas interiores (inalcanzables ese
turno) al frente, así que no compite con la fase de ataque.

**El reclutamiento respeta un suelo de helio-3** (`RESERVA_CIENCIA`, el coste del
Laboratorio). Reclutar también cuesta helio-3, y sin ese suelo la Fase 2 se lo
gastaba entero: medido, el 100 % de las partidas terminaban sin Laboratorio, sin
una sola tecnología y sin un Transportador — la fase de ciencia era código muerto.
Reservar *más* no aumenta la ciencia (lo que la limita es el ingreso de helio-3) y
sí encoge la expansión: apartar 45 para el Relé deja al líder en el 17 % del mapa
frente al 25 % con el suelo actual.

**Ya se midieron y descartaron** como causa del estancamiento el apoyo
(`SUPPORT_FACTOR`), los recursos, el tope de población (barrido de 4 a 30 sin
efecto) y la cadencia de reclutamiento; no repitas esas pruebas. Medido también
(con el límite anterior de 80 turnos, como orden de magnitud): enviar toda la
guarnición al asalto sin dejar 1 de guarnición empeora mucho el avance, y perseguir
la loseta más fácil en vez de la prioridad de terreno también. **Mide cada cambio
de balance con la simulación**, no a ojo.

## Estilo de código

- Español en comentarios y en todo el texto de cara al usuario.
- Comentarios que expliquen el *porqué* (decisiones, trampas), no el *qué*.
- Comillas simples en JS; sin punto y coma opcional omitido.
- Nombres de dominio en español en el texto visible (`guarnición`, `sector`);
  identificadores de código coherentes con su módulo.
