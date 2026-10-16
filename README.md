# ⚛️ Vault Atom for Obsidian

**See your whole vault as a 3D atom.** Your core notes glow at the nucleus, each folder orbits as its own shell, and every link between notes is drawn as a line through space.

[![build](https://github.com/milesgurule-png/obsidian-vault-atom/actions/workflows/build.yml/badge.svg)](https://github.com/milesgurule-png/obsidian-vault-atom/actions/workflows/build.yml) ![release](https://img.shields.io/github/v/release/milesgurule-png/obsidian-vault-atom) ![license](https://img.shields.io/badge/license-MIT-green)

![Vault Atom demo](docs/demo.gif)

## Features
- **Nucleus:** your most-linked note, or any notes you choose, at the center
- **Shells:** folders become orbiting rings, sized by how many notes they hold. Automatic depth picks the clearest grouping, and tiny folders merge into "Other".
- **Links:** every resolved `[[link]]` drawn in 3D and colored by shell
- **Interact:** drag to rotate, scroll to zoom, hover for the note name and link count, click to open the note (Cmd/Ctrl-click for a new tab)
- **Legend:** click a shell to hide or show it
- **Live:** updates as you write, rename or delete notes
- **Settings:** nucleus notes, shell depth (auto/1/2/3), exclude folders, show links, auto-rotate, orbit speed, max notes
- Uses your theme's colors and works in light or dark mode

## Install (manual, until it's in the Community Plugins list)
1. Download `main.js`, `manifest.json` and `styles.css` from the latest release.
2. Put them in `<your vault>/.obsidian/plugins/vault-atom/`.
3. In Obsidian, go to **Settings → Community plugins**, turn off Restricted mode, and enable **Vault Atom**.
4. Click the ⚛ ribbon icon or run **"Open Vault Atom"** from the command palette.

## Contributing
Ideas and bug reports are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Build
```
npm install
npm run build
```

Made by [Miles Gurule](https://github.com/milesgurule-png).

## License
MIT. See [LICENSE](LICENSE).
