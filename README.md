# Conquista Lunar

Simulador de estrategia por turnos sobre la superficie lunar. Tres facciones
compiten por el control territorial de un mapa hexagonal de 169 sectores.

JavaScript puro con ES modules: **sin dependencias, sin build step**.

## Ejecutar

Los ES modules no cargan desde `file://` (política CORS del navegador), así que
hace falta servir la carpeta:

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

## Comprobaciones

```bash
node tests/check-imports.mjs     # grafo de módulos sin referencias rotas
node tests/balance-sim.mjs 200   # simulación IA vs IA, sin navegador
```

## Mecánicas

- **Economía en tres recursos**: regolito (construcción), helio-3 (tecnología),
  agua (tope de población).
- **Cuatro terrenos** con producción y bonus defensivo propios, dibujados como
  iconos pixel art que ganan resolución al acercar el zoom.
- **Movimiento de 1 sector por ronda** por guarnición.
- **Apoyo de flanco**: un sector aliado refuerza el combate si linda a la vez con
  el combatiente y con el sector en disputa.
- **Combate determinista** con desglose completo de cada modificador.
- **Victoria** por eliminación, por dominancia (60 % del mapa) o por puntos al
  agotarse las rondas.

Ver `CLAUDE.md` para la arquitectura, las restricciones del proyecto y las
incidencias abiertas.
