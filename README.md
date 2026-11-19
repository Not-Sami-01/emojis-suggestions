<p align="center">
  <img src="assets/logo.svg" alt="Emoji Suggestions" width="420">
</p>

# Emoji Suggestions Bar

A liquid-glass emoji suggestion bar for Linux desktops, built with Electron +
Node.js. It opens only when you ask for it, searches the full Unicode emoji
list as you type, remembers your recent picks and where you dragged the bar,
and pastes the chosen emoji into the app you were working in.

```
Ctrl+Alt+Enter  →  bar appears at the bottom, focused
type "fire"     →  🔥 🧑‍🚒 🚒 🎆 ...
Enter           →  bar hides, emoji is pasted into your app
Shift+Enter     →  emoji is pasted, bar stays open for the next one
```

## Features

- **Full Unicode emoji search** — 3781 fully-qualified emoji with official
  names + keywords (Unicode Emoji 16.0 + CLDR 46 English annotations).
- **Ranked suggestions** — exact name > name prefix > keyword > substring;
  skin-tone variants always rank after the plain emoji.
- **Recents first** — an empty search shows your most recently used emoji,
  then curated defaults (stored in
  `~/.config/emojis-suggestions/recents.json`, capped at 30).
- **Remembers its place** — drag the bar anywhere; the position is saved to
  `~/.config/emojis-suggestions/position.json` and validated against
  connected displays on every start.
- **Insert into any app** — the emoji goes on the clipboard, the bar hides so
  focus returns to your app, then ydotool simulates <kbd>Ctrl+V</kbd>.
- **Runs in the background** — frameless, transparent, always-on-top window;
  never steals focus until you open it.
- **Opens only on demand** — no auto-show, ever.

## Requirements

- Linux with **GNOME** (tested on Fedora 45 / GNOME 51, Wayland)
- [`ydotool`](https://github.com/ydotool/ydotool) for pasting
  (`sudo dnf install ydotool`) and its daemon running **as your user**:
  ```bash
  systemctl --user enable --now ydotoold
  ```
  The socket should be `$XDG_RUNTIME_DIR/.ydotool_socket` with mode 0666.
- Optional, for raw-keyboard features (see Privacy below): membership in the
  `input` group.

Other Wayland/X11 desktops may work for search + copy, but the GNOME
shortcut installer and focus behavior are GNOME-specific.

## Install

### Option A — from source

```bash
git clone <this-repo> && cd emojis-suggestions
npm run setup        # installs deps, downloads Unicode data, builds the DB
npm start
```

Then bind the hotkey (GNOME):

```bash
bash scripts/install-gnome-shortcuts.sh "$PWD/node_modules/.bin/electron $PWD"
```

### Option B — packaged release

Download the AppImage or `.deb` from the releases page:

```bash
chmod +x emoji-suggestions-bar-*.AppImage
./emoji-suggestions-bar-*.AppImage
```

- Fedora/RHEL: AppImages need the fuse2 compatibility library once —
  `sudo dnf install fuse-libs`
- Ubuntu/Debian: `sudo apt install libfuse2`
- No fuse at all? Run it with `APPIMAGE_EXTRACT_AND_RUN=1 ./emoji-suggestions-bar-*.AppImage`

or `sudo dpkg -i emoji-suggestions-bar_*.deb`.

Bind the hotkey to the installed binary:

```bash
bash scripts/install-gnome-shortcuts.sh /usr/bin/emoji-suggestions-bar
# AppImage users: pass the full path to the AppImage instead
```

Unbind later with `bash scripts/uninstall-gnome-shortcuts.sh`.

## Controls

| Key | Action |
| --- | --- |
| <kbd>Ctrl+Alt+Enter</kbd> | open/focus the bar |
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | move selection |
| <kbd>Enter</kbd> | pick → emoji pasted into the previous app, bar closes |
| <kbd>Shift+Enter</kbd> | paste the emoji but **keep the bar open** to add more |
| <kbd>Backspace</kbd> | edit the query |
| <kbd>Ctrl+Backspace</kbd> | clear the whole query |
| <kbd>Ctrl+V</kbd> (in the bar) | paste a word from the clipboard into the search |
| <kbd>Esc</kbd> / click elsewhere | dismiss |
| <kbd>Ctrl+Alt+Q</kbd> | quit |
| drag the bar | move it — the position is remembered |

If you run the optional keyboard monitor (below), your keyd layer still
works: <kbd>RightAlt</kbd>+<kbd>hjkl</kbd> sends arrow keys, which the bar
navigates with.

## Privacy: optional keyboard monitor

By default the app **reads no keystrokes**. It can be opted in at launch:

```bash
EMOJI_BAR_ENABLE_KEYBOARD_MONITOR=1 npm start
```

What that enables:

- **Pre-fill**: <kbd>Ctrl+Alt+Enter</kbd> seeds the search with the word you
  were just typing.
- **Hotkey below the compositor**: detects <kbd>Ctrl+Alt+Enter</kbd> /
  <kbd>Ctrl+Alt+Q</kbd> even if the GNOME shortcut is not bound.

To read `/dev/input/event*` you must be in the `input` group:

```bash
sudo usermod -aG input $USER   # then log out and back in
```

Everything is processed in-memory: the app never writes keystrokes to disk,
never sends them anywhere, and the word buffer is cleared when you open or
pick from the bar. ydotool's own input devices are excluded so simulated
keystrokes can't re-trigger anything.

## Building a release

```bash
npm run build        # downloads Unicode data, rebuilds DB, builds AppImage + deb
```

Artifacts land in `dist/`. The packaged app ships the prebuilt
`data/emojis.json`, so end users never need to download anything.

## Troubleshooting

- **Hotkey does nothing** → re-run
  `bash scripts/install-gnome-shortcuts.sh "<command line>"`, or check
  `gsettings get org.gnome.settings-daemon.plugins.media-keys custom-keybindings`.
  The shortcut just starts the app with `--show`; if the app isn't running it
  launches it.
- **Paste lands nowhere** → focus did not return to the previous app (known
  Wayland quirk); the emoji is on the clipboard, press <kbd>Ctrl+V</kbd>
  yourself. The bar shows a hint if ydotool itself fails.
- **`ydotoold` errors** → make sure it runs as your *user* service, not
  system-wide (`systemctl --user enable --now ydotoold`).
- **Reset recents/position** → delete
  `~/.config/emojis-suggestions/recents.json` / `position.json`.
- **Rebuild the emoji DB** → `npm run build:data`
- **Full reset** → `npm run setup`

## Project layout

```
main.js                    window, hotkeys, position/recents persistence, IPC
preload.js                 contextBridge API
src/renderer.js            keydown handling (arrows, Shift+Enter, Ctrl+Backspace)
src/suggestions.js         ranked search + recents
src/evdev-typing.js        opt-in /dev/input reader (word buffer, hotkey fallback)
src/ydotool.js             clipboard + Ctrl+V injection sequence
src/styles.css             liquid-glass UI + drag region
scripts/build-emoji-db.js  merges emoji-test.txt + CLDR annotations
scripts/download-emoji-data.js  fetches pinned Unicode sources
scripts/install-gnome-shortcuts.sh / uninstall-gnome-shortcuts.sh
data/emojis.json           prebuilt emoji database (3781 entries)
```

## Licensing

- **Code**: MIT — see [LICENSE](LICENSE).
- **Emoji data** (`data/emojis.json`, generated from Unicode Emoji 16.0
  `emoji-test.txt` and CLDR 46 English annotations): Unicode License v3 —
  see [LICENSE-UNICODE.txt](LICENSE-UNICODE.txt).
- Attribution and dependency notices: [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Unicode and the Unicode logo are registered trademarks of Unicode, Inc.
This project is not affiliated with or endorsed by Unicode, Inc.
