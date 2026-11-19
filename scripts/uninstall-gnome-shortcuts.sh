#!/usr/bin/env bash
set -euo pipefail
BASE="/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings"
SHOW="$BASE/emoji-suggestions-show/"
QUIT="$BASE/emoji-suggestions-quit/"
CURRENT="$(gsettings get org.gnome.settings-daemon.plugins.media-keys custom-keybindings)"
python3 - "$CURRENT" "$SHOW" "$QUIT" <<'PY' | {
  read -r SHOW_PATHS
  gsettings set org.gnome.settings-daemon.plugins.media-keys custom-keybindings "$SHOW_PATHS"
}
import ast, sys
remove = set(sys.argv[2:])
print(repr([x for x in ast.literal_eval(sys.argv[1]) if x not in remove]))
PY
echo "Emoji Suggestions GNOME shortcuts removed."
