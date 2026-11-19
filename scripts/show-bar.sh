#!/usr/bin/env bash
# Focus the emoji suggestion bar. Bind this in GNOME Settings > Keyboard >
# Custom Shortcuts if Ctrl+Alt+Enter is unavailable (e.g. before joining the
# `input` group). Also usable as:  bash scripts/show-bar.sh
set -euo pipefail

PIDFILE="${XDG_RUNTIME_DIR:-/tmp}/emoji-bar.pid"

if [ ! -f "$PIDFILE" ]; then
  echo "emoji bar is not running (no $PIDFILE)" >&2
  exit 1
fi

PID="$(cat "$PIDFILE")"
if ! kill -0 "$PID" 2>/dev/null; then
  echo "emoji bar process $PID is not running" >&2
  exit 1
fi

kill -USR1 "$PID"
