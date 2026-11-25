#!/bin/bash
# Copie Mes Cours.app dans /Applications puis la lance.
set -euo pipefail
cd "$(dirname "$0")"
SRC="Mes Cours.app"
DEST="/Applications/Mes Cours.app"

if [ ! -d "$SRC" ]; then
  osascript -e 'display alert "Mes Cours" message "Dossier Mes Cours.app introuvable à côté de cet installateur." as critical' >/dev/null 2>&1 || true
  echo "Mes Cours.app introuvable." >&2
  exit 1
fi

rm -rf "$DEST"
cp -R "$SRC" "$DEST"
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true
chmod +x "$DEST/Contents/MacOS/MesCours"

echo "Installé dans $DEST"
open "$DEST"
