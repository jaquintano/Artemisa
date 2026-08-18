# Artemisa

Simulador de estrategia por turnos sobre la superficie lunar. 3 o 4 facciones
compiten por el control territorial de un mapa hexagonal generado por reglas:
61 losetas (lado 5) a 3 jugadores, 91 (lado 6) a 4.

JavaScript puro con ES modules: **sin dependencias, sin build step**.

## Ejecutar

Los ES modules no cargan desde `file://` (política CORS del navegador), así que
hace falta servir la carpeta. El servidor incluido solo usa módulos internos de
Node, sin instalar nada:

```bash
npm start
```

Y abrir `http://localhost:8000`. Cualquier otro servidor estático vale igual
(`python3 -m http.server 8000`, por ejemplo).

## Comprobaciones

```bash
node tests/check-imports.mjs     # grafo de módulos sin referencias rotas
node tests/balance-sim.mjs 200   # simulación IA vs IA, sin navegador
```

## Mecánicas

- **Economía en tres recursos**: regolito (construcción), helio-3 (tecnología),
  hielo (tope de población). El hielo solo se obtiene controlando Parajes
  Helados o construyendo Fusores: la base no lo produce.
- **Tope de población** = 4 + producción de hielo por turno + sectores
  controlados. Cuenta el flujo, no lo acopiado: expandirse es lo que financia el
  ejército con el que sigues expandiéndote.
- **Mapa equilibrado por diseño**: el tablero no es terreno aleatorio. Cada
  jugador arranca con una base equidistante en el perímetro y una zona de
  expansión con exactamente los mismos recursos que sus rivales.
- **Cuatro terrenos** con producción y bonus defensivo propios. Todo el arte
  —terreno, guarniciones e iconos de recurso— es SVG vectorial calculado en
  tiempo de ejecución: sin ficheros de imagen y nítido a cualquier zoom.
- **Movimiento de 1 sector por ronda** por guarnición.
- **Reclutamiento localizado**: las guarniciones solo se entrenan en la Base
  Principal y en los Cuarteles Lunares (20 regolito / 5 helio-3 / 2 hielo,
  +1 de defensa), construibles en cualquier sector propio libre.
- **Instalaciones con mantenimiento**: laboratorio, torretas, base y cuarteles
  cuestan recursos por turno; lo que no se paga se desactiva hasta poder pagarlo.
- **Árbol tecnológico** habilitado por el Laboratorio (uno por facción), con
  niveles cuyos bonos se acumulan.
- **Transportador (Hopper)**: unidad de apoyo sin fuerza de combate que salta
  tropas por el mapa; una torreta rival activa le niega el aire.
- **Apoyo de flanco**: un sector aliado refuerza el combate si linda a la vez con
  el combatiente y con el sector en disputa.
- **Combate determinista** con desglose completo de cada modificador. El bonus de
  *Blindaje Reforzado* solo cuenta en defensa si el sector tiene guarnición.
- **Victoria** por eliminación, por dominancia (60 % del mapa) o técnica por
  puntos al agotarse las 80 rondas.

Ver `CLAUDE.md` para la arquitectura y las restricciones del proyecto.
