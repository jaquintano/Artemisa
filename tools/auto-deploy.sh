#!/usr/bin/env bash
# Publicación automática del repo export/ al terminar cada turno (hook Stop).
#
# Este script YA NO COMMITEA. Antes lo hacía con un mensaje generado
# ("Cambios automáticos de sesión: ..."), y eso se adelantaba siempre a quien
# estuviera trabajando: para cuando ibas a escribir un commit con un mensaje que
# explicara el cambio, ya estaba hecho y además publicado, así que corregirlo
# exigía reescribir historia ya subida. Ahora el commit lo hace una persona (o
# Claude) con un mensaje de verdad, y este script sólo se ocupa de publicar.
#
# Lo que sigue haciendo:
#   - avisar si queda trabajo sin commitear (la red de seguridad de antes, pero
#     sin decidir por ti)
#   - incrementar la versión una vez por publicación
#   - NO publicar si `tests/check-imports.mjs` falla: GitHub Pages despliega en
#     cada push a main, y subir código roto tumbaría el sitio que otros prueban
#   - empujar a origin/main

set -u

# El script vive en export/tools/, así que la raíz del repo es su carpeta padre.
REPO="$(cd "$(dirname "$0")/.." && pwd)"
[ -d "$REPO/.git" ] || exit 0
cd "$REPO" || exit 0

# que git falle rápido en vez de quedarse colgado pidiendo credenciales
export GIT_TERMINAL_PROMPT=0

NODE="$(command -v node || true)"
[ -x "$NODE" ] || NODE="/c/Program Files/nodejs/node.exe"

msg() { printf '{"systemMessage":"%s"}\n' "$1"; }

# --- aviso: trabajo sin commitear ---
# No se commitea nada por cuenta propia; sólo se avisa. Eso conserva el valor real
# que tenía el commit automático (no perder trabajo de vista) sin quitarle a nadie
# el mensaje del commit.
sucio="$(git status --porcelain | wc -l | tr -d ' ')"
if [ "$sucio" -gt 0 ]; then
  resumen="$(git status --porcelain | sed 's|^...||' | sed 's|.*/||' | head -3 | tr '\n' ',' | sed 's/,$//' | sed 's/,/, /g')"
  [ "$sucio" -gt 3 ] && resumen="$resumen y $((sucio - 3)) más"
  msg "SIN COMMITEAR: $resumen. Ese trabajo NO se ha publicado; commitealo cuando quieras subirlo."
fi

# --- ¿hay algo que empujar? ---
git rev-parse --verify -q origin/main >/dev/null 2>&1 || exit 0
pendientes="$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)"
[ "$pendientes" -gt 0 ] || exit 0

# --- versión: un incremento por publicación ---
# Se hace aquí porque este script es el único punto por el que pasa todo cambio
# que llega a GitHub. Se pliega dentro del commit de cabeza con --amend en vez de
# añadir un commit propio, para no llenar el historial de ruido; es seguro porque
# ese commit todavía no está en el remoto (lo garantiza el $pendientes > 0 de
# arriba). El --amend conserva el mensaje original (--no-edit) y sólo arrastra los
# dos ficheros de versión, así que no se traga cambios sueltos del árbol.
nueva="$("$NODE" tools/version.mjs bump 2>/dev/null)"
if [ -n "$nueva" ]; then
  git add src/config.js package.json
  git commit -q --amend --no-edit
fi

# --- puerta de calidad: no desplegar el juego roto ---
if ! "$NODE" tests/check-imports.mjs >/dev/null 2>&1; then
  msg "Push OMITIDO: check-imports.mjs falla. Hay $pendientes commit(s) en local sin subir; arregla las importaciones y volveran a salir solos."
  exit 0
fi

if git push -q origin main >/dev/null 2>&1; then
  msg "Sincronizado: $pendientes commit(s) subidos a origin/main como v${nueva:-?}. GitHub Pages redespliega en ~1 min."
else
  msg "Push FALLIDO ($pendientes commit(s) esperando en local). Revisa credenciales o conexion y ejecuta: git -C export push origin main"
fi
