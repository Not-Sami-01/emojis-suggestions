# Roadmap

## Shared product direction

- Keep the picker quick to open, keyboard-first, and usable on GNOME Wayland.
- Keep the liquid surface restrained and preserve readable contrast.
- Keep the Electron implementation usable while the native implementation
  develops independently.

## Rust port sequence

The Rust branch should reach functional parity in small, reviewable steps:

1. **Picker core:** search, keyboard navigation, recents, clipboard, and paste.
2. **Window behavior:** frameless floating bar, focus handling, drag and saved
   position, and reduced-motion support.
3. **GNOME integration:** install/uninstall flow, desktop launcher, custom
   shortcuts, and launch-at-login preference.
4. **Settings:** theme, liquid motion, and behavior preferences persisted per
   user.
5. **Packaging:** build AppImage and Debian packages, then compare cold start,
   memory, and artifact size against Electron on the same machine.

Keep Electron-specific assumptions out of the Rust crate. Share the emoji data
and document any platform integration that cannot be shared safely.

## Release gate

Do not replace or remove the Electron release until the Rust build has working
GNOME setup, picker/search, paste, saved preferences, uninstall, and tested
Linux packaging. A release comparison should report actual measurements rather
than assuming a native rewrite will be smaller or faster.
