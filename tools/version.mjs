/* Gestión del número de versión.
 *
 * La fuente de verdad es APP_VERSION en src/config.js, porque es lo que el
 * navegador puede importar sin pedir un fichero extra. package.json se mantiene
 * sincronizado desde aquí, de modo que los dos no puedan divergir.
 *
 * Uso:
 *   node tools/version.mjs           muestra la versión actual
 *   node tools/version.mjs bump      incrementa el parche (1.0.4 -> 1.0.5)
 *   node tools/version.mjs bump minor|major
 *   node tools/version.mjs check     falla si config.js y package.json difieren
 *
 * Lo invoca tools/../.claude/auto-deploy.sh antes de cada publicación, así que en
 * la práctica cada cambio que llega a GitHub lleva su propia versión.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const CONFIG = join(RAIZ, 'src', 'config.js');
const PAQUETE = join(RAIZ, 'package.json');

const RE_VERSION = /(export const APP_VERSION = ')(\d+\.\d+\.\d+)(')/;

function leerConfig(){
  const texto = readFileSync(CONFIG, 'utf8');
  const m = texto.match(RE_VERSION);
  if(!m) throw new Error('No encuentro APP_VERSION en src/config.js');
  return { texto, version: m[2] };
}

function escribir(nueva){
  const { texto } = leerConfig();
  writeFileSync(CONFIG, texto.replace(RE_VERSION, `$1${nueva}$3`));
  const paquete = JSON.parse(readFileSync(PAQUETE, 'utf8'));
  paquete.version = nueva;
  // \n final: sin él, git marca el fichero como modificado en cada escritura
  writeFileSync(PAQUETE, JSON.stringify(paquete, null, 2) + '\n');
}

function incrementar(version, parte){
  const [may, men, par] = version.split('.').map(Number);
  if(parte === 'major') return `${may + 1}.0.0`;
  if(parte === 'minor') return `${may}.${men + 1}.0`;
  return `${may}.${men}.${par + 1}`;
}

const orden = process.argv[2] || 'show';
const { version } = leerConfig();

if(orden === 'show'){
  console.log(version);
} else if(orden === 'bump'){
  const nueva = incrementar(version, process.argv[3]);
  escribir(nueva);
  console.log(nueva);
} else if(orden === 'check'){
  const enPaquete = JSON.parse(readFileSync(PAQUETE, 'utf8')).version;
  if(enPaquete !== version){
    console.error(`✗ versión descuadrada: config.js dice ${version} y package.json ${enPaquete}`);
    process.exit(1);
  }
  console.log(`✓ versión ${version} coherente en config.js y package.json`);
} else {
  console.error(`Orden desconocida: ${orden}`);
  process.exit(1);
}
