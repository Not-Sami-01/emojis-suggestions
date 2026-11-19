#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

[ -d node_modules ] || npm install

# Fetch pinned Unicode sources (skipped if already cached), then build the DB.
node scripts/download-emoji-data.js
node scripts/build-emoji-db.js

echo
echo "Done. Start with:  npm start"
echo
echo "The bar opens with Ctrl+Alt+Enter. To bind that shortcut in GNOME:"
echo
echo "    bash scripts/install-gnome-shortcuts.sh \"$(pwd)/node_modules/.bin/electron $(pwd)\""
echo
echo "(or pass the path of an installed AppImage/deb binary instead)."
echo
echo "Optional — pre-fill the search with the word you were just typing:"
echo "the app can watch raw keystrokes, but only when explicitly opted in:"
echo
echo "    EMOJI_BAR_ENABLE_KEYBOARD_MONITOR=1 npm start"
echo
echo "Reading /dev/input also needs input-group access:"
echo "    sudo usermod -aG input \$USER   # then log out and back in"
