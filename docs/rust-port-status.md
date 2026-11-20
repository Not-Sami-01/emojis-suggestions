# Rust port status

The prototype is maintained on branch `rust-native` in `rust-native/`. It is
deliberately separate from the Electron app at the repository root.

## Implemented

- GTK4 application window
- Shared Unicode emoji database loaded at compile time
- Ranked name and keyword search
- Curated defaults for an empty search
- Clipboard copy and ydotool paste attempt

## Not ported yet

- Per-user recents and picker position
- Floating, frameless, always-on-top picker and drag behavior
- GNOME setup/uninstall UI, desktop launcher, and global shortcuts
- Appearance and behavior settings, including launch at login
- First-run installation and release packaging
- Opt-in raw keyboard monitor

## Next implementation steps

1. Split search/ranking into testable Rust core code and verify parity with the
   Electron behavior.
2. Add a persistent configuration model for recents, position, and settings.
3. Port the GNOME install and shortcut flow, with a clear uninstall path.
4. Implement picker window and drag behavior using GTK capabilities supported
   by the target Wayland/GNOME versions.
5. Add packaging and benchmark a repeatable cold launch and artifact size.

Avoid adding the raw `/dev/input` monitor until the basic port is stable. It is
optional, privileged in practice, and should remain disabled by default.
