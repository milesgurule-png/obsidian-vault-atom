import Plugin from '../src/main.js';
const data = await (await fetch('graph.json')).json();
const files = data.files.map(p => ({ path: p, basename: p.split('/').pop().replace(/\.md$/, '') }));
const app = { vault: { getMarkdownFiles: () => files, on: () => {} }, metadataCache: { resolvedLinks: data.resolved, on: () => {} },
  workspace: { openLinkText: (p) => console.log('open', p) } };
const plugin = new Plugin(app); await plugin.onload();
const view = plugin._viewFactory({ app }); await view.onOpen(); window.__view = view;
