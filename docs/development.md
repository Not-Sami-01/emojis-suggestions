# Development

## Choose an implementation

- Electron: stay on branch `main`, work at the repository root.
- Rust/GTK4: switch to branch `rust-native`, work in `rust-native/`.
- Do not move either implementation into the other's source tree. Shared data
  and project-wide documentation stay at the repository root.

## Electron

```bash
npm run setup
npm start
npm test
```

`npm run setup` installs Node dependencies and regenerates the emoji database.
Normal development can use the checked-in `data/emojis.json` without fetching
Unicode sources.

## Rust/GTK4

On Fedora, install GTK4 development files and a C compiler, then run:

```bash
sudo dnf install gtk4-devel pkgconf-pkg-config gcc
cargo run --manifest-path rust-native/Cargo.toml
```

The Rust project uses `include_str!` to share the root emoji database. Run
`cargo fmt --manifest-path rust-native/Cargo.toml` before committing Rust
changes. Build and behavior checks require GTK4 development libraries and Cargo
dependencies from crates.io.

## Shared rules

- Preserve `data/emojis.json` provenance and Unicode licensing.
- Keep raw keyboard monitoring disabled unless a user explicitly opts in.
- Keep clipboard insertion local; do not add telemetry or network requests to
  the runtime application.
- Update the relevant README and docs when controls or install behavior change.
