/**
 * Minimal DOM shim for adapter tests (no external dependencies).
 * Superset of the inline shim in test-renderer.js: adds parentNode tracking,
 * replaceChildren/removeChild/replaceWith/remove for adapter re-rendering.
 */
export class MiniElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.parentNode = null;
    this.style = {
      _props: {},
      setProperty(name, value) { this._props[name] = value; },
      getPropertyValue(name) { return this._props[name] ?? ''; },
    };
    this.className = '';
    this.textContent = '';
    this.innerHTML = '';
    this._listeners = {};
  }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  removeAttribute(k) { delete this.attributes[k]; }
  appendChild(child) {
    if (child) { child.parentNode = this; this.children.push(child); }
    return child;
  }
  append(...nodes) {
    for (const n of nodes) {
      this.appendChild(typeof n === 'string' ? new MiniTextNode(n) : n);
    }
  }
  removeChild(child) {
    this.children = this.children.filter((c) => c !== child);
    if (child) child.parentNode = null;
    return child;
  }
  replaceChildren(...nodes) {
    for (const c of this.children) c.parentNode = null;
    this.children = [];
    for (const n of nodes) this.appendChild(n);
  }
  replaceWith(node) {
    if (!this.parentNode) return;
    const idx = this.parentNode.children.indexOf(this);
    if (idx >= 0) {
      this.parentNode.children[idx] = node;
      node.parentNode = this.parentNode;
      this.parentNode = null;
    }
  }
  remove() { this.parentNode?.removeChild(this); }
  addEventListener(ev, fn) { this._listeners[ev] = fn; }
  dispatchEvent(ev) { this._listeners[ev.type]?.(ev); }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  get classList() {
    const self = this;
    return {
      add(...cls) {
        const existing = self.className ? self.className.split(' ') : [];
        self.className = [...new Set([...existing, ...cls])].join(' ');
      },
      toggle() { /* noop for tests */ },
    };
  }
}

export class MiniTextNode {
  constructor(text) { this.textContent = text; this.tagName = '#text'; }
}

class MiniFragment {
  constructor() { this.children = []; this.tagName = '#fragment'; }
  appendChild(child) { if (child) this.children.push(child); return child; }
}

/** Install document/rAF globals. Returns the shim body element. */
export function installDomShim() {
  globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };
  const body = new MiniElement('body');
  globalThis.document = {
    createElement: (tag) => new MiniElement(tag),
    createTextNode: (text) => new MiniTextNode(text),
    createDocumentFragment: () => new MiniFragment(),
    querySelector: () => null,
    body,
  };
  return body;
}

/** Depth-first search of the shim tree by predicate. */
export function findEl(root, pred) {
  if (!root || root.tagName === '#text') return null;
  if (pred(root)) return root;
  for (const c of root.children ?? []) {
    const hit = findEl(c, pred);
    if (hit) return hit;
  }
  return null;
}
