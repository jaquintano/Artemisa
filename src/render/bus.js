/* Bus de presentación.
 *
 * Motivo: la lógica de juego (economy, game, victory) necesita disparar un
 * repintado, pero la capa de render necesita a su vez llamar a la lógica. Si se
 * importan mutuamente aparece un ciclo. Registrando aquí los manejadores desde
 * main.js, la lógica solo depende de este módulo y nunca de la UI concreta.
 *
 * Esto es también lo que permite ejecutar la lógica en Node (tests, simulaciones
 * de balance) sin DOM: basta con no registrar ningún manejador.
 */

let renderer = null;
let gameOverHandler = null;

export function setRenderer(fn){ renderer = fn; }
export function setGameOverHandler(fn){ gameOverHandler = fn; }

export function requestRender(){
  if(renderer) renderer();
}

export function showGameOver(title, text){
  if(gameOverHandler) gameOverHandler(title, text);
}

export function hideGameOver(){
  if(gameOverHandler) gameOverHandler(null, null);
}
