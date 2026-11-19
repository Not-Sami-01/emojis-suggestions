#!/usr/bin/env bash
# Quit the emoji suggestion bar. Bind alongside scripts/show-bar.sh if you
# want a GNOME-level quit shortcut (Ctrl+Alt+Q).
set -euo pipefail

PIDFILE="${XDG_RUNTIME_DIR:-/tmp}/emoji-bar.pid"

[ -f "$PIDFILE" ] || exit 0
PID="$(cat "$PIDFILE")"
kill -0 "$PID" 2>/dev/null || exit 0
kill -USR2 "$PID"
