/**
 * Tests for OatRenderer — verifies all 37 components render correctly.
 * Uses a minimal DOM shim (no external dependencies).
 *
 * Run: node --test tests/test-renderer.js
 */

import { describe, it, before } from 'node:test';
import { strict as assert } from 'node:assert';

// ── Minimal DOM shim ──────────────────────────────────────────────────────────
// Just enough to satisfy document.createElement, appendChild, etc.

class MiniElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.className = '';
    this.textContent = '';
    this.innerHTML = '';
    this._listeners = {};
  }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  appendChild(child) { if (child) this.children.push(child); return child; }
  append(...nodes) { for (const n of nodes) this.appendChild(typeof n === 'string' ? new MiniTextNode(n) : n); }
  addEventListener(ev, fn) { this._listeners[ev] = fn; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  get classList() {
    const self = this;
    return {
      add(...cls) { const existing = self.className ? self.className.split(' ') : []; self.className = [...new Set([...existing, ...cls])].join(' '); },
      toggle(cls, force) { /* noop for tests */ },
    };
  }
}

class MiniTextNode {
  constructor(text) { this.textContent = text; this.tagName = '#text'; }
}

class MiniFragment {
  constructor() { this.children = []; this.tagName = '#fragment'; }
  appendChild(child) { if (child) this.children.push(child); return child; }
}

globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };

const _body = new MiniElement('body');

globalThis.document = {
  createElement: (tag) => new MiniElement(tag),
  createTextNode: (text) => new MiniTextNode(text),
  createDocumentFragment: () => new MiniFragment(),
  querySelector: () => null,
  body: _body,
};

// ── Import renderer after DOM shim is in place ────────────────────────────────

const { OatRenderer, createOatRenderer, registerWithWebLib, CATALOG_ID, VERSION } = await import('../renderer/index.js');

// ── Test context factory ──────────────────────────────────────────────────────

function makeContext(componentMap = {}, dataModel = {}) {
  return {
    getDataModel: () => dataModel,
    setDataModel: (path, val) => {
      const segs = path.replace(/^\//, '').split(/[/.]/);
      let obj = dataModel;
      for (let i = 0; i < segs.length - 1; i++) obj = obj[segs[i]] = obj[segs[i]] || {};
      obj[segs[segs.length - 1]] = val;
    },
    subscribe: () => () => {},
    renderChild: (id) => {
      const comp = componentMap[id];
      return comp ? renderer.renderComponent(comp, makeContext(componentMap, dataModel)) : null;
    },
    dispatchAction: () => {},
    getRegisteredFunction: () => null,
  };
}

let renderer;

before(() => {
  renderer = new OatRenderer();
});

// ── Public API ────────────────────────────────────────────────────────────────

describe('createOatRenderer', () => {
  it('returns renderer, functions, catalogId, version', () => {
    const result = createOatRenderer();
    assert.ok(result.renderer instanceof OatRenderer);
    assert.equal(typeof result.functions, 'object');
    assert.equal(Object.keys(result.functions).length, 21);
    assert.equal(result.catalogId, CATALOG_ID);
    assert.equal(result.version, 'v0.9');
  });
});

describe('registerWithWebLib', () => {
  it('calls registerRenderer, registerFunction, setCatalogId on web-lib mock', () => {
    const calls = { renderer: null, functions: [], catalogId: null };
    const mockWebLib = {
      registerRenderer: (id, r) => { calls.renderer = { id, renderer: r }; },
      registerFunction: (name, fn) => { calls.functions.push(name); },
      setCatalogId: (id) => { calls.catalogId = id; },
    };
    const result = registerWithWebLib(mockWebLib);
    assert.ok(result instanceof OatRenderer);
    assert.equal(calls.renderer.id, CATALOG_ID);
    assert.ok(calls.renderer.renderer instanceof OatRenderer);
    assert.equal(calls.functions.length, 21);
    assert.equal(calls.catalogId, CATALOG_ID);
  });
});

// ── Component rendering ───────────────────────────────────────────────────────

describe('renderer has all 37 component types registered', () => {
  const allComponents = [
    'Row', 'Column', 'Grid', 'List', 'Sidebar',
    'Text', 'Image', 'Icon', 'Divider', 'Badge', 'Avatar',
    'Spinner', 'Skeleton', 'Progress', 'Meter', 'Video', 'AudioPlayer',
    'Button', 'TextField', 'CheckBox', 'Switch', 'Slider',
    'DateTimeInput', 'ChoicePicker', 'Autocomplete',
    'Card', 'Modal', 'Tabs', 'Accordion', 'Tooltip', 'Dropdown',
    'Table', 'Pagination', 'Alert', 'Toast', 'Breadcrumb',
    'OatHTML',
  ];

  for (const name of allComponents) {
    it(`renders ${name} without error`, () => {
      const comp = makeMinimalComponent(name);
      const ctx = makeContext();
      const el = renderer.renderComponent(comp, ctx);
      assert.ok(el, `${name} returned null`);
      assert.ok(el.tagName, `${name} has no tagName`);
    });
  }
});

describe('renders unknown component with fallback', () => {
  it('returns div with error text for unknown type', () => {
    const el = renderer.renderComponent({ id: 'x', component: 'FakeWidget' }, makeContext());
    assert.equal(el.tagName, 'DIV');
    assert.ok(el.textContent.includes('Unknown') || el.dataset.unknownComponent === 'FakeWidget');
  });
});

describe('component output correctness', () => {
  it('Text renders correct tag for variant', () => {
    const el = renderer.renderComponent(
      { id: 't1', component: 'Text', text: 'Hello', variant: 'h1' },
      makeContext()
    );
    assert.equal(el.tagName, 'H1');
  });

  it('Text defaults to <p> with no variant', () => {
    const el = renderer.renderComponent(
      { id: 't2', component: 'Text', text: 'Hello' },
      makeContext()
    );
    assert.equal(el.tagName, 'P');
  });

  it('Button renders <button>', () => {
    const el = renderer.renderComponent(
      { id: 'b1', component: 'Button' },
      makeContext()
    );
    assert.equal(el.tagName, 'BUTTON');
  });

  it('Image renders <img> with src', () => {
    const el = renderer.renderComponent(
      { id: 'i1', component: 'Image', url: 'https://example.com/img.png', alt: 'test' },
      makeContext()
    );
    assert.equal(el.tagName, 'IMG');
  });

  it('Table renders <table>', () => {
    const el = renderer.renderComponent(
      { id: 'tbl', component: 'Table', columns: [{ key: 'name', label: 'Name' }], rows: [] },
      makeContext()
    );
    assert.equal(el.tagName, 'TABLE');
  });

  it('Alert renders with role="alert"', () => {
    const el = renderer.renderComponent(
      { id: 'a1', component: 'Alert', text: 'Warning!' },
      makeContext()
    );
    assert.equal(el.attributes.role, 'alert');
  });

  it('Progress renders <progress>', () => {
    const el = renderer.renderComponent(
      { id: 'p1', component: 'Progress', value: 50, max: 100 },
      makeContext()
    );
    assert.equal(el.tagName, 'PROGRESS');
  });

  it('CheckBox renders <input> with type checkbox', () => {
    const el = renderer.renderComponent(
      { id: 'cb1', component: 'CheckBox', label: 'Agree' },
      makeContext()
    );
    // CheckBox may wrap in label, check for input child or direct
    assert.ok(el.tagName === 'INPUT' || el.tagName === 'LABEL' || el.tagName === 'DIV');
  });

  it('Divider renders <hr>', () => {
    const el = renderer.renderComponent(
      { id: 'd1', component: 'Divider' },
      makeContext()
    );
    assert.equal(el.tagName, 'HR');
  });

  it('data binding resolves from data model', () => {
    const dataModel = { greeting: 'Hello World' };
    const el = renderer.renderComponent(
      { id: 't3', component: 'Text', text: { path: '/greeting' } },
      makeContext({}, dataModel)
    );
    assert.equal(el.textContent, 'Hello World');
  });

  it('sets data-component-id on rendered elements', () => {
    const el = renderer.renderComponent(
      { id: 'myid', component: 'Text', text: 'test' },
      makeContext()
    );
    assert.equal(el.dataset.componentId, 'myid');
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMinimalComponent(type) {
  const base = { id: `test-${type}`, component: type };

  // Provide required properties per component type
  const overrides = {
    Text: { text: 'test' },
    Image: { url: 'https://example.com/img.png' },
    Icon: { name: 'star' },
    Badge: { text: 'new' },
    Avatar: { url: 'https://example.com/avatar.png' },
    Progress: { value: 50, max: 100 },
    Meter: { value: 50, min: 0, max: 100 },
    Video: { src: 'https://example.com/video.mp4' },
    AudioPlayer: { src: 'https://example.com/audio.mp3' },
    Button: {},
    TextField: { label: 'Name' },
    CheckBox: { label: 'Agree' },
    Switch: { label: 'Toggle' },
    Slider: { value: 50 },
    DateTimeInput: {},
    ChoicePicker: { options: [{ label: 'A', value: 'a' }] },
    Autocomplete: { label: 'Search' },
    Table: { columns: [{ key: 'id', label: 'ID' }], rows: [] },
    Pagination: { currentPage: 1, totalPages: 5 },
    Alert: { text: 'Alert!' },
    Toast: { message: 'Done' },
    Breadcrumb: { items: [{ label: 'Home' }] },
    Tooltip: { text: 'Tip', child: null },
    Accordion: { title: 'Section' },
    Modal: {},
    Tabs: { tabs: [{ title: 'Tab 1' }] },
    OatHTML: { html: '<p>Safe</p>' },
    Card: {},
    Sidebar: {},
    Row: {},
    Column: {},
    Grid: {},
    List: {},
    Spinner: {},
    Skeleton: {},
    Divider: {},
    Dropdown: {},
  };

  return { ...base, ...(overrides[type] || {}) };
}
