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

/* Recarga que de verdad trae el código nuevo.
 *
 * `location.reload()` a secas NO basta, y este era el fallo: desde Chrome 54 una
 * recarga normal solo revalida el documento principal; los subrecursos se sirven
 * de la caché según sus cabeceras. Con el `max-age=600` de GitHub Pages llegaba un
 * index.html nuevo pero los 18 módulos seguían siendo los viejos —medido, todos
 * con `transferSize: 0`—, así que APP_VERSION no cambiaba y el aviso se quedaba
 * clavado hasta que expiraba la caché.
 *
 * Los módulos no se pueden versionar en la URL sin un paso de compilación, así que
 * se refrescan a mano: `cache:'reload'` salta la caché Y guarda en ella la
 * respuesta nueva, de modo que la recarga posterior ya encuentra el código actual.
 * La lista sale de lo que el navegador cargó de verdad, para que no haya que
 * mantenerla al añadir módulos. */
async function recargarSinCache(){
  const urls = performance.getEntriesByType('resource')
    .map(e => e.name)
    .filter(u => u.startsWith(location.origin) && /\.(js|mjs|css)(\?|$)/.test(u));
  // si alguna falla (sin red), se recarga igual: nunca peor que antes
  await Promise.all(urls.map(u => fetch(u, { cache: 'reload' }).catch(() => {})));
  location.reload();
}

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
    elVersion.addEventListener('click', () => {
      // refrescar los módulos lleva un instante: que se note que hace algo
      elVersion.textContent = 'actualizando…';
      elVersion.classList.remove('caducada');
      recargarSinCache();
    }, { once: true });
  })
  .catch(() => {});   // sin conexión o servido desde file://: no es motivo de fallo

/* Paneles con el mismo patrón de interruptor: el botón refleja su estado en
   aria-pressed, que es de lo que tira el CSS para resaltarlo en ámbar.
   `alAbrir` se invoca solo al desplegar, nunca al plegar ni en el arranque: es
   lo que permite que dos paneles rivales se excluyan sin llamarse en bucle. */
function conmutador(idBoton, idPanel, visibleAlEmpezar, alAbrir){
  const boton = document.getElementById(idBoton);
  const panel = document.getElementById(idPanel);
  const aplicar = visible => {
    panel.hidden = !visible;
    boton.setAttribute('aria-pressed', String(visible));
  };
  boton.addEventListener('click', () => {
    const abrir = panel.hidden;
    if(abrir && alAbrir) alAbrir();
    aplicar(abrir);
  });
  aplicar(visibleAlEmpezar);
  return aplicar;
}

// el tutorial arranca plegado: estorba el mapa y siempre está a un clic del botón
const mostrarHowto = conmutador('howtotoggle', 'howto', false);
/* Registro e investigación comparten la misma esquina superior derecha, así que se
   excluyen entre sí: abrir uno pliega el otro en vez de solaparse. */
const mostrarLog = conmutador('logtoggle', 'logpopup', false, () => mostrarTech(false));
const mostrarTech = conmutador('techtoggle', 'techpopup', false, () => mostrarLog(false));
// la ✕ del propio tutorial tiene que dejar el botón de la cabecera coherente
document.getElementById('howtoclose').addEventListener('click', () => mostrarHowto(false));
document.getElementById('zoomin').addEventListener('click', () => setZoom(mapZoom * ZOOM_STEP));
document.getElementById('zoomout').addEventListener('click', () => setZoom(mapZoom / ZOOM_STEP));
window.addEventListener('resize', () => { if (state) renderMap(); });

startGame();
