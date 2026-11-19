# Emoji Suggestions Bar

A liquid-glass emoji suggestion bar for Linux (GNOME/Wayland), built with
Electron + Node.js. It opens **only** on <kbd>Ctrl+Alt+Enter</kbd> (never on
its own), suggests emoji from the full Unicode list as you type a search,
remembers your recent picks and where you dragged it, and pastes the chosen
emoji into the app you were working in (clipboard + simulated <kbd>Ctrl+V</kbd>
via ydotool).

## Status

Already set up on this machine:

- Emoji DB built (1927 emoji with names + keywords from Unicode's
  full-emoji-list + CLDR annotations) → `data/emojis.json`
- `ydotoold` running as a **user** service (socket `$XDG_RUNTIME_DIR/.ydotool_socket`)
- GNOME custom shortcuts bound:
  - <kbd>Ctrl+Alt+Enter</kbd> → open the bar (`scripts/show-bar.sh`)
  - <kbd>Ctrl+Alt+Q</kbd> → quit (`scripts/quit-bar.sh`)

Start it with:

```bash
npm start
```

## Optional: last-word pre-fill

Joining the `input` group lets the app read raw keystrokes so that
<kbd>Ctrl+Alt+Enter</kbd> pre-fills the search with the word you were just
typing (and gives a compositor-independent hotkey):

```bash
sudo usermod -aG input $USER   # then log out and back in
```

Without it the bar still opens via the GNOME shortcut — it just starts with an
empty search.

## Controls

| Key | Action |
| --- | --- |
| <kbd>Ctrl+Alt+Enter</kbd> | open/focus the bar (pre-fills the last typed word) |
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | move selection |
| <kbd>Enter</kbd> | pick → emoji is pasted into the previous app, bar closes |
| <kbd>Shift+Enter</kbd> | paste the emoji but **keep the bar open** to add more |
| <kbd>Backspace</kbd> | edit the query |
| <kbd>Ctrl+Backspace</kbd> | clear the whole query |
| <kbd>Ctrl+V</kbd> (in the bar) | paste a word from the clipboard into the search |
| <kbd>Esc</kbd> / click elsewhere | dismiss |
| <kbd>Ctrl+Alt+Q</kbd> | quit |
| drag the bar | move it — the position is remembered across restarts |

Notes:

- **Recents**: when the search is empty, your most recently used emoji are
  shown first, then curated defaults. Stored in
  `~/.config/emojis-suggestions/recents.json`.
- **Position**: remembered in `~/.config/emojis-suggestions/position.json`
  (validated against connected displays — if the monitor layout changes and
  the spot is off-screen, it falls back to bottom-center).
- Your keyd layer still works: <kbd>RightAlt</kbd>+<kbd>hjkl</kbd> sends arrow
  keys, which the bar navigates with.

## How it works

```
src/evdev-typing.js   reads /dev/input/event* (24-byte input_event structs):
                      - tracks the word being typed (hotkey pre-fills with it)
                      - detects Ctrl+Alt+Enter / Ctrl+Alt+Q below the compositor
                      - skips ydotoold's own devices + dedupes keyd's virtual
                        keyboard against raw keyboards
src/suggestions.js    ranked search: exact > prefix > keyword > substring;
                      empty query = recents first, then curated defaults
src/ydotool.js        pastes via clipboard + ydotool key 29:1 47:1 47:0 29:0
                      (ydotool's `type` only maps ASCII, hence clipboard+Ctrl+V)
main.js               frameless transparent always-on-top window; hotkeys,
                      position/recents persistence, insert vs pick flow
index.html + src/*    liquid-glass renderer (gradients, specular highlight,
                      sheen sweep, staggered emoji pops) + drag region
scripts/build-emoji-db.js   merges Unicode full-emoji-list.html + CLDR en.xml
```

Two paste flows:

- **Enter (pick)** — emoji → clipboard → bar hides (focus returns to your app)
  → 140 ms later ydotool sends <kbd>Ctrl+V</kbd> → bar stays closed.
- **Shift+Enter (insert)** — same paste, then the bar automatically reopens
  with your query and selection intact so you can add another emoji.

If ydotool fails, the emoji stays on the clipboard and the bar shows a hint.

## Troubleshooting

- **Hotkey does nothing** → the GNOME shortcut runs `scripts/show-bar.sh`,
  which signals the app via its pidfile
  (`$XDG_RUNTIME_DIR/emoji-bar.pid`). If the app isn't running, the shortcut
  does nothing by design.
- **Search never pre-fills the last word** → you are not in the `input` group
  (see "Optional: last-word pre-fill"). The `npm start` log prints the exact
  `usermod` command when devices are denied.
- **Paste lands nowhere** → focus did not return to the previous app (known
  Wayland quirk); the emoji is on the clipboard, press <kbd>Ctrl+V</kbd>
  yourself. The bar shows a hint if ydotool itself fails.
- **Reset recents/position** → delete
  `~/.config/emojis-suggestions/recents.json` / `position.json`.
- **Rebuild the emoji DB**: `node scripts/build-emoji-db.js`
- **Full reset**: `bash scripts/setup.sh`
