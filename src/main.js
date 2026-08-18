/* Punto de entrada.
 *
 * Único módulo que conoce a la vez la lógica y la presentación: aquí se cablean
 * los eventos del DOM y se registran los manejadores del bus. El resto de
 * módulos no se importan mutuamente entre capas, así que no hay ciclos.
 */
import { ZOOM_STEP, APP_VERSION } from './config.js';
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
const elVersion = document.getElementById('version');
elVersion.textContent = 'v' + APP_VERSION;

/* Aviso de versión caducada.
 *
 * GitHub Pages sirve el HTML con `Cache-Control: max-age=600`, así que después de
 * publicar el navegador puede seguir enseñando la copia anterior hasta diez
 * minutos. Eso ya despistó un par de veces: parecía que el despliegue había
 * fallado cuando lo único viejo era la pestaña abierta.
 *
 * Se compara la versión de esta copia con la publicada, pidiendo package.json sin
 * pasar por la caché. Si no coinciden, el distintivo lo avisa y al pulsarlo
 * recarga. No recarga solo a propósito: hacerlo a media partida sería peor que el
 * problema que resuelve. */
fetch('package.json?cb=' + Date.now(), { cache: 'no-store' })
  .then(r => r.ok ? r.json() : null)
  .then(p => {
    if (!p || p.version === APP_VERSION) return;
    elVersion.classList.add('caducada');
    elVersion.textContent = `v${APP_VERSION} → v${p.version} disponible`;
    elVersion.title = 'Estás viendo una copia en caché. Pulsa para recargar.';
    elVersion.addEventListener('click', () => location.reload());
  })
  .catch(() => {});   // sin conexión o servido desde file://: no es motivo de fallo

/* Dos paneles con el mismo patrón de interruptor: el botón refleja su estado en
   aria-pressed, que es de lo que tira el CSS para resaltarlo en ámbar. */
function conmutador(idBoton, idPanel, visibleAlEmpezar){
  const boton = document.getElementById(idBoton);
  const panel = document.getElementById(idPanel);
  const aplicar = visible => {
    panel.hidden = !visible;
    boton.setAttribute('aria-pressed', String(visible));
  };
  boton.addEventListener('click', () => aplicar(panel.hidden));
  aplicar(visibleAlEmpezar);
  return aplicar;
}

// el tutorial arranca plegado: estorba el mapa y siempre está a un clic del botón
const mostrarHowto = conmutador('howtotoggle', 'howto', false);
conmutador('logtoggle', 'logpopup', false);
// la ✕ del propio tutorial tiene que dejar el botón de la cabecera coherente
document.getElementById('howtoclose').addEventListener('click', () => mostrarHowto(false));
document.getElementById('zoomin').addEventListener('click', () => setZoom(mapZoom * ZOOM_STEP));
document.getElementById('zoomout').addEventListener('click', () => setZoom(mapZoom / ZOOM_STEP));
window.addEventListener('resize', () => { if (state) renderMap(); });

startGame();
