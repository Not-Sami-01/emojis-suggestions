# Architecture

Emoji Suggestions currently has two implementations on separate Git branches.
The Electron application lives at the repository root on `main`; the Rust/GTK4
prototype lives under `rust-native/` on `rust-native`. Both use the shared
`data/emojis.json` database.

## Electron application

- `main.js` owns the hidden picker window, setup and settings windows, GNOME
  integration, persistence, clipboard operations, and IPC handlers.
- `preload.js`, `setup-preload.js`, and `settings-preload.js` expose narrow
  renderer APIs through Electron's context bridge.
- `src/renderer.js` handles keyboard input and suggestion rendering.
- `src/suggestions.js` ranks names and keywords and puts recent picks first.
- `src/evdev-typing.js` is an opt-in raw input monitor; it is disabled by
  default.
- `src/ydotool.js` pastes clipboard content by simulating Ctrl+V.
- `scripts/` contains Unicode data generation and GNOME shortcut setup tools.

User state is stored below `${XDG_CONFIG_HOME:-~/.config}/emojis-suggestions/`.
It includes recents, picker position, and appearance/behavior preferences.
The application also writes user-level GNOME desktop entries and shortcuts.

## Rust prototype

`rust-native/` is a separate Cargo project. Its current GTK4 window loads the
shared emoji database at compile time and implements ranked search and
clipboard/paste. It is a prototype, not yet feature-equivalent to Electron.
The intended direction is to port one feature at a time while keeping the two
implementations independently buildable.

## Platform boundary

The application targets Linux and GNOME. Global shortcuts are registered with
GNOME settings because Wayland does not provide a general application-level
global-hotkey API. Paste uses the user's `ydotool` service. Keep these desktop
integrations behind small functions so they can change without rewriting
search or UI code.
