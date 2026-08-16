/* Punto de entrada.
 *
 * Único módulo que conoce a la vez la lógica y la presentación: aquí se cablean
 * los eventos del DOM y se registran los manejadores del bus. El resto de
 * módulos no se importan mutuamente entre capas, así que no hay ciclos.
 */
import { ZOOM_STEP } from './config.js';
import { state } from './state.js';
import { startGame, endTurn } from './game.js';
import { setRenderer, setGameOverHandler } from './render/bus.js';
import { renderAll, onHexClick } from './render/ui.js';
import { renderMap, setZoom, setHexClickHandler, mapZoom } from './render/map.js';

/* --- registro de manejadores (invierte la dependencia lógica -> presentación) --- */
setRenderer(renderAll);
setHexClickHandler(onHexClick);
setGameOverHandler((title, text) => {
  const overlay = document.getElementById('overlay');
  if (title === null) { overlay.style.display = 'none'; return; }
  document.getElementById('overlaytitle').textContent = title;
  document.getElementById('overlaytext').textContent = text;
  overlay.style.display = 'flex';
});

/* --- eventos de la interfaz --- */
document.getElementById('endturnbtn').addEventListener('click', endTurn);
document.getElementById('restartbtn').addEventListener('click', () => {
  if (confirm('¿Reiniciar la partida actual?')) startGame();
});
document.getElementById('overlayrestart').addEventListener('click', startGame);
document.getElementById('howtoclose').addEventListener('click', () => {
  document.getElementById('howto').style.display = 'none';
});
document.getElementById('zoomin').addEventListener('click', () => setZoom(mapZoom * ZOOM_STEP));
document.getElementById('zoomout').addEventListener('click', () => setZoom(mapZoom / ZOOM_STEP));
window.addEventListener('resize', () => { if (state) renderMap(); });

startGame();
