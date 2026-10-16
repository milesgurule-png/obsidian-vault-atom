// Vault Atom: an Obsidian plugin that renders the vault as a 3D atom.
// Nucleus = your core note(s). Shells = folders, each a tilted orbit. Lines = resolved links.
// © 2026 Miles Gurule.

import { Plugin, ItemView, PluginSettingTab, Setting, debounce } from 'obsidian';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const VIEW_TYPE = 'vault-atom-view';
const DEFAULTS = {
  groupDepth: 0,          // folder depth that defines a shell (0 = auto, 1 = top-level folders)
  nucleus: '',            // note path(s) for the nucleus, comma-separated; empty = most-linked note
  maxNodes: 4000,         // safety cap for very large vaults
  showLinks: true,
  autoRotate: true,
  orbitSpeed: 1,
  excludeFolders: '',     // comma-separated folder prefixes to hide
};
const PALETTE = ['#e07a5f', '#ff7eb6', '#ffa94d', '#3dd6d0', '#5ad16b', '#9b7bff', '#4dabf7', '#94d82d', '#f5c542', '#74c0fc', '#20c997', '#f783ac', '#ced4da'];

function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967295; }

class AtomView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.disposers = []; }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'Vault Atom'; }
  getIcon() { return 'atom'; }

  async onOpen() {
    const root = this.containerEl.children[1];
    root.empty(); root.addClass('vault-atom-root');
    this.hud = root.createDiv({ cls: 'vault-atom-hud' });
    this.legend = root.createDiv({ cls: 'vault-atom-legend' });
    this.tip = root.createDiv({ cls: 'vault-atom-tip' });
    this.canvasWrap = root.createDiv({ cls: 'vault-atom-canvas' });
    this.hidden = new Set();
    this.initThree();
    this.rebuild();
    const refresh = debounce(() => this.rebuild(), 1500, true);
    this.registerEvent(this.app.metadataCache.on('resolved', refresh));
    this.registerEvent(this.app.vault.on('rename', refresh));
    this.registerEvent(this.app.vault.on('delete', refresh));
  }

  async onClose() {
    cancelAnimationFrame(this.raf);
    this.resizeObs?.disconnect();
    this.renderer?.dispose();
    this.scene?.traverse(o => { o.geometry?.dispose?.(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose?.()); });
  }

  css(name, fallback) { return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback; }

  initThree() {
    const w = this.canvasWrap.clientWidth || 800, h = this.canvasWrap.clientHeight || 600;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(w, h);
    this.canvasWrap.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 600);
    this.camera.position.set(0, 16, 46);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.8));
    this.light = new THREE.PointLight('#ffd166', 60, 60, 1.5); this.scene.add(this.light);
    this.resizeObs = new ResizeObserver(() => {
      const W = this.canvasWrap.clientWidth, H = this.canvasWrap.clientHeight; if (!W || !H) return;
      this.camera.aspect = W / H; this.camera.updateProjectionMatrix(); this.renderer.setSize(W, H);
    });
    this.resizeObs.observe(this.canvasWrap);
    // interaction
    this.ray = new THREE.Raycaster(); this.mouse = new THREE.Vector2(); this.hover = null;
    const dom = this.renderer.domElement; let down = null;
    dom.addEventListener('pointermove', e => this.onMove(e));
    dom.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; this.controls.autoRotate = false; });
    dom.addEventListener('pointerup', e => {
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5 && this.hover) {
        const n = this.nodes[this.hover.userData.i];
        this.app.workspace.openLinkText(n.path, '', e.metaKey || e.ctrlKey);
      }
    });
    const clock = new THREE.Clock();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      if (document.hidden || !this.containerEl.isShown()) return;
      const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
      const spd = this.plugin.settings.orbitSpeed;
      (this.orbits || []).forEach((g, i) => g.rotateY(dt * (0.05 + 0.02 * (i % 3)) * spd));
      this.updateLinks();
      this.light.intensity = 50 + Math.sin(t * 2) * 10;
      this.controls.update(); this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  graph() {
    const s = this.plugin.settings;
    const excl = s.excludeFolders.split(',').map(x => x.trim()).filter(Boolean);
    let files = this.app.vault.getMarkdownFiles().filter(f => !excl.some(p => f.path.startsWith(p)));
    if (files.length > s.maxNodes) files = files.slice(0, s.maxNodes);
    const index = new Map(files.map((f, i) => [f.path, i]));
    const links = []; const deg = new Array(files.length).fill(0);
    const resolved = this.app.metadataCache.resolvedLinks;
    for (const [src, targets] of Object.entries(resolved)) {
      const a = index.get(src); if (a === undefined) continue;
      for (const dst of Object.keys(targets)) { const b = index.get(dst); if (b === undefined || b === a) continue; links.push([a, b]); deg[a]++; deg[b]++; }
    }
    let nucleus = s.nucleus.split(',').map(x => x.trim()).filter(Boolean);
    if (!nucleus.length && files.length) nucleus = [files[deg.indexOf(Math.max(...deg))].path];
    const isNuc = f => nucleus.includes(f.path) || nucleus.includes(f.basename);
    const shellAt = (f, d) => { const parts = f.path.split('/'); return parts.length > 1 ? parts.slice(0, Math.min(d, parts.length - 1)).join('/') : '(root)'; };
    // auto depth: the shallowest level with 3+ shells where no shell holds more than ~45% of notes
    // auto depth: prefer 3–12 meaningful shells where no shell dominates; tiny folders merge into "Other"
    const minSize = Math.max(3, Math.ceil(files.length * 0.01));
    const shellCounts = d => { const c = {}; files.forEach(f => { const k = shellAt(f, d); c[k] = (c[k] || 0) + 1; }); return c; };
    let depth = s.groupDepth;
    if (!depth) { let best = 1, bestScore = -1e9;
      for (let d = 1; d <= 3; d++) { const v = Object.values(shellCounts(d)); const big = v.filter(x => x >= minSize).length; const max = Math.max(...v) / files.length;
        const score = (big >= 3 && big <= 12 ? 10 : -Math.abs(big - 8)) - max * 10; if (score > bestScore) { bestScore = score; best = d; } }
      depth = best; }
    const sc = shellCounts(depth);
    const shellOf = f => { if (isNuc(f)) return '__nucleus'; const k = shellAt(f, depth); return sc[k] >= minSize ? k : 'Other'; };
    const nodes = files.map((f, i) => ({ path: f.path, name: f.basename, shell: shellOf(f), deg: deg[i] }));
    return { nodes, links };
  }

  rebuild() {
    // clear previous meshes
    for (const o of this.objects || []) { o.parent?.remove(o); o.geometry?.dispose?.(); }
    this.objects = []; this.orbits = []; this.meshes = [];
    const { nodes, links } = this.graph(); this.nodes = nodes; this.links = links;
    const counts = {}; nodes.forEach(n => counts[n.shell] = (counts[n.shell] || 0) + 1);
    const shells = [...new Set(nodes.map(n => n.shell).filter(s => s !== '__nucleus'))].sort((a, b) => counts[a] - counts[b]);
    let r = 4;
    this.shells = shells.map((name, i) => { const band = Math.min(4, 0.4 + Math.sqrt(counts[name]) * 0.12); r += 1.4 + band / 2 + Math.sqrt(counts[name]) * 0.08;
      const sgn = i % 2 ? 1 : -1; const sh = { name, color: PALETTE[i % PALETTE.length], r, band, tilt: [sgn * (0.3 + 0.6 * hash(name)), i * 1.1] }; r += band / 2; return sh; });
    const byName = new Map(this.shells.map(s => [s.name, s]));
    this.camera.position.set(0, 0.62, 1).setLength(Math.max(30, r * 2.3));
    const groups = {};
    for (const s of this.shells) {
      const g = new THREE.Group();
      { const i = this.shells.indexOf(s), camDir = new THREE.Vector3(0, 0.62, 1).normalize();
        const p1 = new THREE.Vector3(1, 0, 0), p2 = new THREE.Vector3().crossVectors(camDir, p1).normalize(), phi = i * 2.399, k = 0.45 + 0.45 * hash(s.name);
        const normal = camDir.clone().addScaledVector(p1, Math.cos(phi) * k).addScaledVector(p2, Math.sin(phi) * k).normalize();
        g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal); } this.scene.add(g); groups[s.name] = g; this.orbits.push(g); this.objects.push(g);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(s.r, 0.025, 6, 160), new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: 0.35 }));
      ring.rotation.x = Math.PI / 2; g.add(ring); s.ring = ring;
    }
    const idx = {}; const sphere = new THREE.SphereGeometry(1, 12, 10);
    nodes.forEach((n, i) => {
      const isNuc = n.shell === '__nucleus';
      const color = isNuc ? '#ffd166' : byName.get(n.shell).color;
      const m = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: isNuc ? 1.4 : 0.7, roughness: 0.4 }));
      const size = isNuc ? 0.9 : 0.14 + Math.min(0.5, Math.sqrt(n.deg) * 0.06); m.scale.setScalar(size); m.userData = { i, size };
      if (isNuc) { const k = (idx.__n = (idx.__n || 0) + 1); m.position.copy(new THREE.Vector3(hash(n.path) - .5, hash(n.path + 'y') - .5, hash(n.path + 'z') - .5).multiplyScalar(k === 1 ? 0 : 2)); this.scene.add(m); this.objects.push(m); }
      else {
        const s = byName.get(n.shell); const k = (idx[n.shell] = (idx[n.shell] || 0) + 1);
        const a = (k / counts[n.shell]) * Math.PI * 2 + hash(n.path) * 0.2, j = (hash(n.path + 'j') - 0.5) * s.band, up = (hash(n.path + 'u') - 0.5) * (0.6 + s.band * 0.4);
        m.position.set(Math.cos(a) * (s.r + j), up, Math.sin(a) * (s.r + j)); groups[n.shell].add(m);
      }
      n.mesh = m; this.meshes.push(m);
    });
    // links as one LineSegments with per-vertex colors
    this.linkGeo = new THREE.BufferGeometry();
    this.linkGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(links.length * 6), 3));
    const col = new Float32Array(links.length * 6);
    links.forEach(([a, b], k) => { const ca = new THREE.Color(nodes[a].mesh.material.color), cb = new THREE.Color(nodes[b].mesh.material.color); col.set([ca.r, ca.g, ca.b, cb.r, cb.g, cb.b], k * 6); });
    this.linkGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.linkLine = new THREE.LineSegments(this.linkGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.2, depthWrite: false }));
    this.linkLine.visible = this.plugin.settings.showLinks; this.scene.add(this.linkLine); this.objects.push(this.linkLine);
    this.controls.autoRotate = this.plugin.settings.autoRotate; this.controls.autoRotateSpeed = 0.35;
    this.renderHud(nodes.length, links.length); this.renderLegend(counts); this.applyHidden();
  }

  updateLinks() {
    if (!this.linkGeo || !this.linkLine.visible) return;
    const pos = this.linkGeo.attributes.position.array, wp = this._wp || (this._wp = new THREE.Vector3());
    this.links.forEach(([a, b], k) => {
      const A = this.nodes[a].mesh, B = this.nodes[b].mesh;
      if (!A.visible || !B.visible) { pos.fill(0, k * 6, k * 6 + 6); return; }
      A.getWorldPosition(wp); pos[k * 6] = wp.x; pos[k * 6 + 1] = wp.y; pos[k * 6 + 2] = wp.z;
      B.getWorldPosition(wp); pos[k * 6 + 3] = wp.x; pos[k * 6 + 4] = wp.y; pos[k * 6 + 5] = wp.z;
    });
    this.linkGeo.attributes.position.needsUpdate = true; this.linkGeo.computeBoundingSphere();
  }

  renderHud(n, l) {
    this.hud.empty();
    this.hud.createEl('div', { cls: 'vault-atom-title', text: '⚛ Vault Atom' });
    const stats = this.hud.createDiv({ cls: 'vault-atom-stats' });
    for (const [v, k] of [[n, 'notes'], [l, 'links'], [this.shells.length, 'shells']]) { const d = stats.createDiv(); d.createEl('b', { text: String(v) }); d.createEl('span', { text: k }); }
  }

  renderLegend(counts) {
    this.legend.empty();
    const chip = (name, color, key) => {
      const c = this.legend.createDiv({ cls: 'vault-atom-chip' + (this.hidden.has(key) ? ' is-off' : '') });
      c.createSpan({ cls: 'vault-atom-dot' }).style.background = color; c.createSpan({ text: `${name} ${counts[key] || 0}` });
      c.onclick = () => { this.hidden.has(key) ? this.hidden.delete(key) : this.hidden.add(key); c.toggleClass('is-off', this.hidden.has(key)); this.applyHidden(); };
    };
    chip('Nucleus', '#ffd166', '__nucleus');
    for (const s of this.shells) chip(s.name, s.color, s.name);
  }

  applyHidden() {
    for (const n of this.nodes || []) n.mesh.visible = !this.hidden.has(n.shell);
    for (const s of this.shells || []) s.ring.visible = !this.hidden.has(s.name);
  }

  onMove(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.mouse, this.camera);
    const hit = this.ray.intersectObjects(this.meshes.filter(m => m.visible))[0]?.object || null;
    if (this.hover && this.hover !== hit) this.hover.scale.setScalar(this.hover.userData.size);
    this.hover = hit;
    if (hit) {
      hit.scale.setScalar(hit.userData.size * 1.7);
      const n = this.nodes[hit.userData.i];
      this.tip.setText(''); this.tip.createEl('b', { text: n.name }); this.tip.createEl('small', { text: `${n.shell === '__nucleus' ? 'Nucleus' : n.shell} · ${n.deg} links` });
      this.tip.style.display = 'block'; this.tip.style.left = (e.clientX - r.left + 14) + 'px'; this.tip.style.top = (e.clientY - r.top + 10) + 'px';
      this.renderer.domElement.style.cursor = 'pointer';
    } else { this.tip.style.display = 'none'; this.renderer.domElement.style.cursor = 'grab'; }
  }
}

class AtomSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl: el } = this; el.empty();
    const s = this.plugin.settings, save = async () => { await this.plugin.saveSettings(); this.plugin.refreshViews(); };
    new Setting(el).setName('Nucleus notes').setDesc('Note paths or names at the center, comma-separated. Leave empty to use your most-linked note.')
      .addText(t => t.setPlaceholder('Home.md').setValue(s.nucleus).onChange(async v => { s.nucleus = v; await save(); }));
    new Setting(el).setName('Shell depth').setDesc('Which folder level becomes a shell (0 = automatic, 1 = top-level folders).')
      .addSlider(sl => sl.setLimits(0, 3, 1).setValue(s.groupDepth).setDynamicTooltip().onChange(async v => { s.groupDepth = v; await save(); }));
    new Setting(el).setName('Exclude folders').setDesc('Comma-separated folder prefixes to hide (e.g. Templates, Archive).')
      .addText(t => t.setValue(s.excludeFolders).onChange(async v => { s.excludeFolders = v; await save(); }));
    new Setting(el).setName('Show links').addToggle(t => t.setValue(s.showLinks).onChange(async v => { s.showLinks = v; await save(); }));
    new Setting(el).setName('Auto-rotate camera').addToggle(t => t.setValue(s.autoRotate).onChange(async v => { s.autoRotate = v; await save(); }));
    new Setting(el).setName('Orbit speed').addSlider(sl => sl.setLimits(0, 3, 0.25).setValue(s.orbitSpeed).setDynamicTooltip().onChange(async v => { s.orbitSpeed = v; await save(); }));
    new Setting(el).setName('Max notes').setDesc('Safety cap for very large vaults.')
      .addText(t => t.setValue(String(s.maxNodes)).onChange(async v => { const n = parseInt(v, 10); if (n > 0) { s.maxNodes = n; await save(); } }));
  }
}

export default class VaultAtomPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    this.registerView(VIEW_TYPE, leaf => new AtomView(leaf, this));
    this.addRibbonIcon('atom', 'Open Vault Atom', () => this.activate());
    this.addCommand({ id: 'open-vault-atom', name: 'Open Vault Atom', callback: () => this.activate() });
    this.addSettingTab(new AtomSettingTab(this.app, this));
  }
  async saveSettings() { await this.saveData(this.settings); }
  refreshViews() { for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) leaf.view.rebuild?.(); }
  async activate() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) { leaf = this.app.workspace.getLeaf(true); await leaf.setViewState({ type: VIEW_TYPE, active: true }); }
    this.app.workspace.revealLeaf(leaf);
  }
}
