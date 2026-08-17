# Conquista Lunar

Simulador de estrategia por turnos sobre la superficie lunar. Tres facciones
compiten por el control territorial de un mapa hexagonal de 61 sectores
(5 de lado).

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
  hielo (tope de población). El hielo solo se obtiene controlando Casquetes de
  Hielo o construyendo Fusores: la base no lo produce.
- **Tope de población** = 4 + producción de hielo por turno + sectores
  controlados. Cuenta el flujo, no lo acopiado: expandirse es lo que financia el
  ejército con el que sigues expandiéndote.
- **Cuatro terrenos** con producción y bonus defensivo propios. Todo el arte
  —terreno, guarniciones e iconos de recurso— es SVG vectorial calculado en
  tiempo de ejecución: sin ficheros de imagen y nítido a cualquier zoom.
- **Movimiento de 1 sector por ronda** por guarnición.
- **Reclutamiento localizado**: las guarniciones solo se entrenan en la Base
  Principal y en los Cuarteles Lunares (20 regolito / 10 helio-3 / 5 hielo,
  +1 de defensa), construibles en cualquier sector propio libre.
- **Apoyo de flanco**: un sector aliado refuerza el combate si linda a la vez con
  el combatiente y con el sector en disputa.
- **Combate determinista** con desglose completo de cada modificador. El bonus de
  *Blindaje Reforzado* solo cuenta en defensa si el sector tiene guarnición.
- **Victoria** por eliminación, por dominancia (60 % del mapa) o por puntos al
  agotarse las 80 rondas.

Ver `CLAUDE.md` para la arquitectura, las restricciones del proyecto y las
incidencias abiertas.
