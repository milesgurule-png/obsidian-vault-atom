// Minimal stand-in for the Obsidian API, only for local visual testing.
const P = HTMLElement.prototype;
P.empty ??= function () { this.innerHTML = ''; };
P.addClass ??= function (c) { this.classList.add(c); };
P.toggleClass ??= function (c, on) { this.classList.toggle(c, on); };
P.setText ??= function (t) { this.textContent = t; };
P.isShown ??= function () { return true; };
P.createEl ??= function (tag, o = {}) { const e = document.createElement(tag); if (o.cls) e.className = o.cls; if (o.text) e.textContent = o.text; this.appendChild(e); return e; };
P.createDiv ??= function (o = {}) { return this.createEl('div', typeof o === 'string' ? { cls: o } : o); };
P.createSpan ??= function (o = {}) { return this.createEl('span', o); };
export class Plugin { constructor(app) { this.app = app; } registerView(t, f) { this._viewFactory = f; } addRibbonIcon() {} addCommand() {} addSettingTab() {} async loadData() { return {}; } async saveData() {} }
export class ItemView { constructor(leaf) { this.leaf = leaf; this.app = leaf.app; this.containerEl = document.createElement('div'); this.containerEl.appendChild(document.createElement('div')); this.containerEl.appendChild(document.createElement('div')); document.body.appendChild(this.containerEl); this.containerEl.style.cssText = 'position:fixed;inset:0'; this.containerEl.children[1].style.cssText = 'position:absolute;inset:0'; } registerEvent() {} }
export class PluginSettingTab {} export class Setting {}
export const debounce = (f) => f;
