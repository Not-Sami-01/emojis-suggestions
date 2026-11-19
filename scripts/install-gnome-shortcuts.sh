#!/usr/bin/env bash
set -euo pipefail

# Binds Ctrl+Alt+Enter (open) and Ctrl+Alt+Q (quit) in GNOME.
# Usage: install-gnome-shortcuts.sh "<full command line to start the app>"
#   e.g. install-gnome-shortcuts.sh "/opt/emoji-suggestions-bar/emoji-suggestions-bar"
#        install-gnome-shortcuts.sh "$PWD/node_modules/.bin/electron $PWD"
APP_COMMAND="${1:-}"
if [[ -z "$APP_COMMAND" ]]; then
  echo "Usage: $0 \"<full command line to start the app>\"" >&2
  exit 2
fi

FIRST_TOKEN="${APP_COMMAND%% *}"
if [[ "$FIRST_TOKEN" == */* ]]; then
  FIRST_TOKEN="$(realpath -e "$FIRST_TOKEN" 2>/dev/null || echo "$FIRST_TOKEN")"
fi
if [[ ! -x "$FIRST_TOKEN" ]] && ! command -v "$FIRST_TOKEN" >/dev/null 2>&1; then
  echo "App executable not found: $FIRST_TOKEN" >&2
  exit 1
fi

command -v gsettings >/dev/null || { echo "gsettings not found — this installer supports GNOME." >&2; exit 1; }

BASE="/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings"
SHOW="$BASE/emoji-suggestions-show/"
QUIT="$BASE/emoji-suggestions-quit/"
CURRENT="$(gsettings get org.gnome.settings-daemon.plugins.media-keys custom-keybindings)"

python3 - "$CURRENT" "$SHOW" "$QUIT" <<'PY' | {
  read -r SHOW_PATHS
  gsettings set org.gnome.settings-daemon.plugins.media-keys custom-keybindings "$SHOW_PATHS"
}
import ast, sys
current = ast.literal_eval(sys.argv[1])
for value in sys.argv[2:]:
    if value not in current:
        current.append(value)
print(repr(current))
PY

gsettings set "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$SHOW" name 'Emoji Suggestions: Open'
gsettings set "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$SHOW" binding '<Control><Alt>Return'
gsettings set "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$SHOW" command "$APP_COMMAND --show"

gsettings set "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$QUIT" name 'Emoji Suggestions: Quit'
gsettings set "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$QUIT" binding '<Control><Alt>q'
gsettings set "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$QUIT" command "$APP_COMMAND --quit"

echo "GNOME shortcuts installed: Ctrl+Alt+Enter opens; Ctrl+Alt+Q quits."
