# Native Rust experiment

This is an alternate implementation inside the same repository. The existing
Electron app remains at the repository root; this prototype is isolated here
and reads the shared `data/emojis.json` database.

The first slice is a GTK4 emoji picker with ranked name/keyword search,
clipboard copy, and the existing ydotool paste sequence. It is intended to
compare startup time, package size, and interaction feel before deciding which
features to port next.

## Fedora development dependencies

```bash
sudo dnf install gtk4-devel pkgconf-pkg-config gcc
cargo run --manifest-path rust-native/Cargo.toml
```

`ydotool` and its user daemon are needed for paste; copying still works without
them. The GNOME global shortcut installer and settings UI are not ported yet.
