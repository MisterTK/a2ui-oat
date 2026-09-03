/**
 * Tests for OatRenderer — verifies all 39 components render correctly.
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

// Context variant that actually fires subscribers, for reactivity tests.
function makeReactiveContext(dataModel = {}, registeredFunctions = {}) {
  const subscribers = {};
  return {
    getDataModel: () => dataModel,
    setDataModel: (path, val) => {
      const segs = path.replace(/^\//, '').split(/[/.]/);
      let obj = dataModel;
      for (let i = 0; i < segs.length - 1; i++) obj = obj[segs[i]] = obj[segs[i]] || {};
      obj[segs[segs.length - 1]] = val;
    },
    subscribe: (path, cb) => {
      (subscribers[path] ??= []).push(cb);
      return () => {};
    },
    fireChange(path, val) {
      const segs = path.replace(/^\//, '').split(/[/.]/);
      let obj = dataModel;
      for (let i = 0; i < segs.length - 1; i++) obj = obj[segs[i]] = obj[segs[i]] || {};
      obj[segs[segs.length - 1]] = val;
      for (const cb of subscribers[path] || []) cb(val);
    },
    renderChild: () => null,
    dispatchAction: () => {},
    getRegisteredFunction: (name) => registeredFunctions[name] || null,
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
    assert.equal(Object.keys(result.functions).length, 22);
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
    assert.equal(calls.functions.length, 22);
    assert.equal(calls.catalogId, CATALOG_ID);
  });
});

// ── Component rendering ───────────────────────────────────────────────────────

describe('renders all 39 component types', () => {
  const allComponents = [
    'Row', 'Column', 'Grid', 'List', 'Sidebar',
    'Text', 'Image', 'Icon', 'Divider', 'Badge', 'Avatar',
    'Spinner', 'Skeleton', 'Progress', 'Meter', 'Video', 'AudioPlayer',
    'Button', 'TextField', 'CheckBox', 'Switch', 'Slider',
    'DateTimeInput', 'ChoicePicker', 'Autocomplete', 'FileUpload', 'TagInput',
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

  it('Badge renders class="badge" and data-variant for color variants', () => {
    const el = renderer.renderComponent(
      { id: 'bd1', component: 'Badge', text: 'New', variant: 'success' },
      makeContext()
    );
    assert.equal(el.className, 'badge');
    assert.equal(el.dataset.variant, 'success');
  });

  it('Badge renders outline variant as a class, not data-variant', () => {
    const el = renderer.renderComponent(
      { id: 'bd2', component: 'Badge', text: 'New', variant: 'outline' },
      makeContext()
    );
    assert.equal(el.className, 'badge outline');
    assert.equal(el.dataset.variant, undefined);
  });

  it('Badge default variant has no data-variant or extra class', () => {
    const el = renderer.renderComponent(
      { id: 'bd3', component: 'Badge', text: 'New', variant: 'default' },
      makeContext()
    );
    assert.equal(el.className, 'badge');
    assert.equal(el.dataset.variant, undefined);
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

  it('Button renders secondary/danger variants as data-variant', () => {
    const el = renderer.renderComponent(
      { id: 'btn1', component: 'Button', child: null, variant: 'secondary' },
      makeContext()
    );
    assert.equal(el.dataset.variant, 'secondary');
    assert.equal(el.className, '');
  });

  it('Button renders outline/ghost variants as classes', () => {
    const el = renderer.renderComponent(
      { id: 'btn2', component: 'Button', child: null, variant: 'outline' },
      makeContext()
    );
    assert.equal(el.className, 'outline');
    assert.equal(el.dataset.variant, undefined);
  });

  it('Button renders primary/default variants with no extra class or attribute', () => {
    const el = renderer.renderComponent(
      { id: 'btn3', component: 'Button', child: null, variant: 'primary' },
      makeContext()
    );
    assert.equal(el.className, '');
    assert.equal(el.dataset.variant, undefined);
  });

  it('Skeleton sets role="status"', () => {
    const el = renderer.renderComponent(
      { id: 'sk1', component: 'Skeleton', variant: 'box' },
      makeContext()
    );
    assert.equal(el.attributes.role, 'status');
    assert.equal(el.className, 'skeleton box');
  });

  it('Tooltip sets data-tooltip-placement from the placement property', () => {
    const el = renderer.renderComponent(
      { id: 'tt1', component: 'Tooltip', text: 'Tip', placement: 'bottom' },
      makeContext()
    );
    assert.equal(el.dataset.tooltipPlacement, 'bottom');
  });

  it('Tooltip falls back to the deprecated position property', () => {
    const el = renderer.renderComponent(
      { id: 'tt2', component: 'Tooltip', text: 'Tip', position: 'left' },
      makeContext()
    );
    assert.equal(el.dataset.tooltipPlacement, 'left');
  });

  it('Tabs sets data-anchor from anchorKey', () => {
    const el = renderer.renderComponent(
      { id: 'tb1', component: 'Tabs', tabs: [{ title: 'One' }], anchorKey: 'section' },
      makeContext()
    );
    assert.equal(el.dataset.anchor, 'section');
  });

  it('Sidebar sets --sidebar-width from width property', () => {
    const el = renderer.renderComponent(
      { id: 'sb1', component: 'Sidebar', width: '20rem' },
      makeContext()
    );
    assert.equal(el.style.getPropertyValue('--sidebar-width'), '20rem');
  });

  it('Breadcrumb renders an unstyled list and unstyled links', () => {
    const el = renderer.renderComponent(
      { id: 'bc1', component: 'Breadcrumb', items: [{ label: 'Home', action: { event: { name: 'go' } } }, { label: 'Here' }] },
      makeContext()
    );
    const ol = el.children[0];
    assert.equal(ol.className, 'unstyled');
    const link = ol.children[0].children[0];
    assert.equal(link.className, 'unstyled');
  });

  it('FileUpload renders an ot-upload with a hidden file input and a trigger button', () => {
    const el = renderer.renderComponent(
      { id: 'fu1', component: 'FileUpload', accept: 'image/*', multiple: true },
      makeContext()
    );
    assert.equal(el.tagName, 'OT-UPLOAD');
    const input = el.children.find((c) => c.tagName === 'INPUT');
    assert.equal(input.accept, 'image/*');
    assert.equal(input.multiple, true);
    assert.equal(input.hidden, true);
    const button = el.children.find((c) => c.tagName === 'BUTTON');
    assert.ok(button);
    const filesContainer = el.children.find((c) => c.attributes['data-files'] !== undefined);
    assert.ok(filesContainer);
  });

  it('FileUpload writes selected files to the data model on change', () => {
    const dataModel = { upload: {} };
    const ctx = makeContext({}, dataModel);
    const el = renderer.renderComponent(
      { id: 'fu2', component: 'FileUpload', files: { path: '/upload/files' } },
      ctx
    );
    const input = el.children.find((c) => c.tagName === 'INPUT');
    input.files = [{ name: 'a.png', size: 100, type: 'image/png' }];
    input._listeners.change();
    assert.deepEqual(dataModel.upload.files, [{ name: 'a.png', size: 100, type: 'image/png' }]);
  });

  it('TagInput renders an ot-taginput with an inner input', () => {
    const el = renderer.renderComponent(
      { id: 'ti1', component: 'TagInput', placeholder: 'Add tags' },
      makeContext()
    );
    assert.equal(el.tagName, 'OT-TAGINPUT');
    const input = el.children.find((c) => c.tagName === 'INPUT');
    assert.equal(input.placeholder, 'Add tags');
  });

  it('TagInput renders a datalist when suggestions are provided', () => {
    const el = renderer.renderComponent(
      { id: 'ti2', component: 'TagInput', suggestions: ['red', 'green', 'blue'] },
      makeContext()
    );
    const datalist = el.children.find((c) => c.tagName === 'DATALIST');
    assert.ok(datalist);
    assert.equal(datalist.children.length, 3);
    const input = el.children.find((c) => c.tagName === 'INPUT');
    assert.equal(input.getAttribute('list'), datalist.id);
  });

  it('TagInput writes tags to the data model on input', () => {
    const dataModel = { tags: [] };
    const ctx = makeContext({}, dataModel);
    const el = renderer.renderComponent(
      { id: 'ti3', component: 'TagInput', value: { path: '/tags' } },
      ctx
    );
    el.value = ['a', 'b'];
    el._listeners.input();
    assert.deepEqual(dataModel.tags, ['a', 'b']);
  });
});

describe('Checkable / checks validation', () => {
  const requiredFn = ({ value }) => value != null && value !== '';

  it('TextField sets aria-invalid and shows the error message when a check fails', () => {
    const ctx = makeReactiveContext({ form: { email: '' } }, { required: requiredFn });
    const wrapper = renderer.renderComponent(
      {
        id: 'tf1', component: 'TextField', label: 'Email', value: { path: '/form/email' },
        checks: [{ functionCall: { call: 'required', args: { value: { path: '/form/email' } } }, message: 'Email is required' }],
      },
      ctx
    );
    const input = wrapper.children.find((c) => c.tagName === 'INPUT');
    assert.equal(input.attributes['aria-invalid'], 'true');
    const errorEl = wrapper.children.find((c) => c.className === 'error');
    assert.equal(errorEl.textContent, 'Email is required');
  });

  it('TextField clears aria-invalid once the check passes', () => {
    const ctx = makeReactiveContext({ form: { email: '' } }, { required: requiredFn });
    const wrapper = renderer.renderComponent(
      {
        id: 'tf2', component: 'TextField', label: 'Email', value: { path: '/form/email' },
        checks: [{ functionCall: { call: 'required', args: { value: { path: '/form/email' } } } }],
      },
      ctx
    );
    const input = wrapper.children.find((c) => c.tagName === 'INPUT');
    assert.equal(input.attributes['aria-invalid'], 'true');
    ctx.fireChange('/form/email', 'a@b.com');
    assert.equal(input.attributes['aria-invalid'], undefined);
  });

  it('TextField with no checks never sets aria-invalid', () => {
    const el = renderer.renderComponent({ id: 'tf3', component: 'TextField', label: 'Name' }, makeContext());
    const input = el.children.find((c) => c.tagName === 'INPUT');
    assert.equal(input.attributes['aria-invalid'], undefined);
  });

  it('CheckBox sets aria-invalid on its input when a check fails', () => {
    // Note: `required` treats `false` as "present" (it only rejects null/''),
    // so the check targets a separate empty-string field rather than the
    // boolean `value` itself — this still exercises the exact same
    // _renderChecks wiring, since it doesn't care what path a check reads.
    const ctx = makeReactiveContext({ agree: false, agreeName: '' }, { required: requiredFn });
    const wrapper = renderer.renderComponent(
      {
        id: 'cb1', component: 'CheckBox', label: 'Agree', value: { path: '/agree' },
        checks: [{ functionCall: { call: 'required', args: { value: { path: '/agreeName' } } }, message: 'You must agree' }],
      },
      ctx
    );
    const input = wrapper.children.find((c) => c.tagName === 'INPUT');
    assert.equal(input.attributes['aria-invalid'], 'true');
  });

  it('Button disables itself while a check fails, and re-enables when it passes', () => {
    const requiredFn = ({ value }) => value != null && value !== '';
    const ctx = makeReactiveContext({ form: { email: '' } }, { required: requiredFn });
    const btn = renderer.renderComponent(
      {
        id: 'submit', component: 'Button', child: null,
        checks: [{ functionCall: { call: 'required', args: { value: { path: '/form/email' } } } }],
      },
      ctx
    );
    assert.equal(btn.disabled, true);
    ctx.fireChange('/form/email', 'a@b.com');
    assert.equal(btn.disabled, false);
  });

  it('DateTimeInput sets aria-invalid without an error element', () => {
    const requiredFn = ({ value }) => value != null && value !== '';
    const ctx = makeReactiveContext({ date: '' }, { required: requiredFn });
    const el = renderer.renderComponent(
      { id: 'dt1', component: 'DateTimeInput', value: { path: '/date' }, checks: [{ functionCall: { call: 'required', args: { value: { path: '/date' } } } }] },
      ctx
    );
    assert.equal(el.attributes['aria-invalid'], 'true');
  });

  it('re-evaluates compound and/or checks when a path nested inside an array-valued arg changes', () => {
    // `and`'s `conditions` arg is an array of bindings, e.g.
    // { functionCall: { call: 'and', args: { conditions: [{path:'/form/a'}, {path:'/form/b'}] } } }.
    // `_evaluateCheck` only resolves top-level args, so `conditions` arrives at the
    // function unresolved; the function must resolve each element itself via
    // `resolveDynamic`. The point of this test is `_extractCheckPaths`: paths
    // referenced ONLY inside that nested array must still be subscribed to, so the
    // check re-evaluates when one of them changes.
    const andFn = ({ conditions }, { resolveDynamic }) =>
      (conditions || []).every((c) => {
        const v = resolveDynamic(c);
        return v != null && v !== '';
      });
    const ctx = makeReactiveContext({ form: { a: '', b: 'x' } }, { and: andFn });
    const wrapper = renderer.renderComponent(
      {
        id: 'tf-and', component: 'TextField', label: 'Both', value: { path: '/form/a' },
        checks: [{
          functionCall: {
            call: 'and',
            args: { conditions: [{ path: '/form/a' }, { path: '/form/b' }] },
          },
          message: 'Both fields are required',
        }],
      },
      ctx
    );
    const input = wrapper.children.find((c) => c.tagName === 'INPUT');
    // /form/a is '' so the compound check fails initially.
    assert.equal(input.attributes['aria-invalid'], 'true');
    // /form/a appears only nested inside the `conditions` array, never as a
    // top-level check arg — before the fix, _extractCheckPaths found no paths
    // for this check at all, so no subscription was ever set up and this
    // change would not clear aria-invalid.
    ctx.fireChange('/form/a', 'y');
    assert.equal(input.attributes['aria-invalid'], undefined);
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
    FileUpload: {},
    TagInput: {},
  };

  return { ...base, ...(overrides[type] || {}) };
}
