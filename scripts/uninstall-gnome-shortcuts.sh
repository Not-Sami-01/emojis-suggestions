#!/usr/bin/env bash
set -euo pipefail

# Removes the shortcuts installed by install-gnome-shortcuts.sh.
BASE="/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings"
SHOW="$BASE/emoji-bar/"
QUIT="$BASE/emoji-bar-quit/"
CURRENT="$(gsettings get org.gnome.settings-daemon.plugins.media-keys custom-keybindings)"

SHOW_PATHS="$(python3 - "$CURRENT" "$SHOW" "$QUIT" <<'PY'
import ast, sys
remove = set(sys.argv[2:])
print(repr([x for x in ast.literal_eval(sys.argv[1]) if x not in remove]))
PY
)"
gsettings set org.gnome.settings-daemon.plugins.media-keys custom-keybindings "$SHOW_PATHS"
echo "Emoji Suggestions GNOME shortcuts removed."
