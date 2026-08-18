/* Verificación estática ligera del grafo de módulos.
 *
 * No sustituye a un linter, pero detecta el fallo más probable tras una
 * refactorización: un identificador que se usa en un módulo pero que ni se
 * define allí ni se importa. Se ejecuta con:  node tests/check-imports.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

const GLOBALS = new Set([
  'window', 'document', 'console', 'Math', 'Object', 'Array', 'Map', 'Set', 'Number',
  'String', 'Boolean', 'JSON', 'Date', 'parseInt', 'parseFloat', 'isNaN', 'confirm',
  'alert', 'SVGElement', 'requestAnimationFrame', 'setTimeout', 'clearTimeout',
  'Infinity', 'NaN', 'undefined', 'null', 'true', 'false', 'this', 'globalThis',
]);

const RESERVED = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'of', 'in', 'while',
  'do', 'break', 'continue', 'new', 'typeof', 'instanceof', 'delete', 'void', 'class',
  'extends', 'super', 'import', 'export', 'from', 'as', 'default', 'try', 'catch',
  'finally', 'throw', 'switch', 'case', 'yield', 'async', 'await', 'static', 'get', 'set',
]);

/* Parte una lista de declaradores por las comas de nivel superior, ignorando las
   que estén dentro de paréntesis, corchetes o llaves. */
function dividirDeclaradores(texto) {
  let depth = 0, current = '';
  const parts = [];
  for (const ch of texto) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { parts.push(current); current = ''; }
    else current += ch;
  }
  parts.push(current);
  return parts;
}

/* Exportaciones declaradas por cada módulo. */
function exportsOf(src) {
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(m[1]);
  }
  // `export const A = 1, B = 2, C = 3;` exporta las tres: hay que recorrer
  // todos los declaradores de la sentencia, no solo el primero.
  for (const m of src.matchAll(/export\s+(?:const|let|var)\s+([^;]+);/g)) {
    for (const part of dividirDeclaradores(m[1])) {
      const id = part.trim().match(/^([A-Za-z_$][\w$]*)/);
      if (id) names.add(id[1]);
    }
  }
  return names;
}

/* Importaciones de un módulo: [{ names, spec }] */
function importsOf(src) {
  const out = [];
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const names = m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    out.push({ names, spec: m[2] });
  }
  return out;
}

/* Identificadores declarados localmente (aproximación deliberadamente amplia). */
function localsOf(src) {
  const names = new Set();
  const patterns = [
    /(?:^|\s)(?:export\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    /(?:^|\s)(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    /(?:const|let|var)\s*\{([^}]*)\}/g,          // desestructuración
    /(?:const|let|var)\s*\[([^\]]*)\]/g,
    /function\s*[A-Za-z_$\w]*\s*\(([^)]*)\)/g,   // parámetros
    /\(([^)]*)\)\s*=>/g,                          // parámetros de arrow
    /([A-Za-z_$][\w$]*)\s*=>/g,
    /for\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    /catch\s*\(\s*([A-Za-z_$][\w$]*)/g,
  ];
  // `const A = 1, B = 2;` declara las dos: los patrones de arriba solo ven la
  // primera, y las siguientes se tomaban por referencias sin definir.
  for (const m of src.matchAll(/(?:^|\s)(?:export\s+)?(?:const|let|var)\s+([^;]+);/g)) {
    for (const parte of dividirDeclaradores(m[1])) {
      const id = parte.trim().match(/^([A-Za-z_$][\w$]*)/);
      if (id) names.add(id[1]);
    }
  }
  for (const re of patterns) {
    for (const m of src.matchAll(re)) {
      for (const part of m[1].split(',')) {
        const id = part.trim().replace(/[:=].*$/, '').replace(/^\.\.\./, '').trim();
        if (/^[A-Za-z_$][\w$]*$/.test(id)) names.add(id);
      }
    }
  }
  return names;
}

const files = walk(join(ROOT, 'src'));
const exportMap = new Map();
for (const f of files) exportMap.set(f, exportsOf(readFileSync(f, 'utf8')));

/* Todos los nombres que algún módulo exporta. El barrido de constantes se limita
   a este conjunto: así una constante real sin importar salta, pero un rótulo de
   interfaz en mayúsculas («ACCIONES», «CONSTRUIR») no, porque nadie lo exporta.
   Hace falta porque el borrado de plantillas no soporta plantillas anidadas y
   deja texto de la interfaz suelto en el cuerpo analizado. */
const TODAS_LAS_EXPORTACIONES = new Set();
for (const nombres of exportMap.values()) for (const n of nombres) TODAS_LAS_EXPORTACIONES.add(n);

let problems = 0;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const rel = file.slice(ROOT.length + 1);

  const imported = new Set();
  for (const imp of importsOf(src)) {
    const target = resolve(dirname(file), imp.spec);
    const targetExports = exportMap.get(target);
    if (!targetExports) {
      console.log(`✗ ${rel}: importa de '${imp.spec}', que no existe`);
      problems++;
      continue;
    }
    for (const n of imp.names) {
      imported.add(n);
      if (!targetExports.has(n)) {
        console.log(`✗ ${rel}: importa '${n}' de '${imp.spec}', que no lo exporta`);
        problems++;
      }
    }
  }

  const locals = localsOf(src);
  // cuerpo sin cadenas, comentarios, plantillas ni accesos a propiedad
  // Los comentarios se eliminan PRIMERO: si no, la palabra "importan" dentro de
  // una frase hace que el patrón de import consuma hasta el siguiente ';',
  // destruyendo el cierre '*/' y dejando prosa suelta en el cuerpo analizado.
  const body = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/^\s*import[^;]+;/gm, '')
    .replace(/`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g, m => m.replace(/[^${}]/g, ' '))
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/\.\s*([A-Za-z_$][\w$]*)/g, '.');

  const seen = new Set();
  for (const m of body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = m[1];
    if (seen.has(name) || RESERVED.has(name) || GLOBALS.has(name)) continue;
    seen.add(name);
    if (!locals.has(name) && !imported.has(name)) {
      console.log(`✗ ${rel}: llama a '${name}()' sin importarlo ni definirlo`);
      problems++;
    }
  }

  /* Segundo barrido: constantes en MAYÚSCULAS.
   *
   * El de arriba solo mira identificadores seguidos de '(', o sea llamadas a
   * función. Una constante mal importada —`DIRS[d][0]`, sin paréntesis— se colaba
   * entera hasta reventar en ejecución; pasó de verdad y por eso está esto aquí.
   * Se limita a MAYÚSCULAS porque es la convención del proyecto para las
   * constantes de config.js, y así no hay que distinguir variables locales de
   * referencias rotas. El cuerpo ya viene sin cadenas ni plantillas, de modo que
   * los rótulos de la interfaz («ACCIONES», «RONDA») no cuentan como código. */
  for (const m of body.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) {
    const name = m[1];
    if (seen.has(name) || RESERVED.has(name) || GLOBALS.has(name)) continue;
    if (!TODAS_LAS_EXPORTACIONES.has(name)) continue;   // no es una constante del proyecto
    seen.add(name);
    if (!locals.has(name) && !imported.has(name)) {
      console.log(`✗ ${rel}: usa la constante '${name}' sin importarla ni definirla`);
      problems++;
    }
  }
}

if (problems === 0) {
  console.log(`✓ ${files.length} módulos verificados: sin referencias rotas`);
} else {
  console.log(`\n${problems} problema(s) encontrado(s)`);
  process.exit(1);
}
