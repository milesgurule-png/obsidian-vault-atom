# Contributing to Vault Atom

Thanks for helping! Small, focused pull requests are easiest to review.

## Develop
```
npm install
npm run dev     # rebuilds main.js on save
```
Copy or symlink `main.js`, `manifest.json` and `styles.css` into `<test vault>/.obsidian/plugins/vault-atom/` and reload Obsidian.

`test/index.html` is a quick browser harness. It needs a `test/graph.json` with `{files:[...], resolved:{...}}`, which is gitignored.

## Pull requests
- Describe what changed and why, and include a screenshot or GIF for visual changes.
- Keep performance in mind: large vaults (5,000+ notes) should still render smoothly.
- `npm run build` must pass, and CI checks it.

## Releasing (maintainer)
Bump the version in `manifest.json` and `package.json`, commit, then push a tag like `0.2.0`. The release workflow builds and attaches the plugin files.
