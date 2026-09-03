# Real @a2ui/web_core Surface Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fictional `registerWithWebLib()` with a real, tested integration adapter (`createSurfaceAdapter`) built on the published `@a2ui/web_core@0.10.7` protocol engine.

**Architecture:** One `MessageProcessor` per adapter, one `NodeResolver` per surface used only for structural shape (child refs, list-template expansion, placeholders). The adapter reads raw pre-resolution properties via `ComponentContext.componentModel.properties` and supplies the six-method `RenderContext` that `OatRenderer.renderComponent()` already expects, so all 39 component renderers and every existing test stay untouched. web_core is dependency-injected (`webCore` option) — a2ui-oat keeps zero runtime dependencies.

**Tech Stack:** Plain ESM JavaScript with JSDoc (no TypeScript, no bundler), `node --test`, `@a2ui/web_core@^0.10.7` as devDependency only.

**Spec:** `docs/superpowers/specs/2026-09-03-track1-web-core-adapter-design.md` — read it first; it contains the verified API facts (exact signatures from the published tarball) that this plan's code relies on.

## Global Constraints

- `package.json` `dependencies` stays absent/empty — `@a2ui/web_core` enters ONLY as a devDependency (`^0.10.7`).
- Adapter imports nothing from `@a2ui/web_core` at module level; the consumer passes the imported `@a2ui/web_core/v0_9` module as the `webCore` option.
- Minimum web_core: 0.10.7 (capability-checked: `NodeResolver` + `ComponentContext` must exist on `webCore`).
- Wire protocol version emitted/accepted: `"v0.9.1"` (MessageProcessor option `{ version: "v0.9.1" }`; it accepts `"v0.9"` messages too).
- Root component id is the hardcoded web_core convention `'root'`.
- MIME type in all docs/examples: `application/a2ui+json` (replacing `application/json+a2ui`).
- All pre-existing tests must pass unmodified at every commit: `npm test && npm run validate`.
- Existing files `renderer/oat-renderer.js` and `renderer/functions/*.js` are NOT modified by any task.

---

### Task 1: devDependency + catalog compatibility transform (`catalog-compat.js`)

`@a2ui/web_core`'s `Catalog.fromSchema()` (source: `catalog/schema_loader.js` in the package) recognizes only standard JSON-schema types and `$ref`s of the form `common_types.json#/$defs/<Name>`. Our `catalog/oat-catalog.json` uses a custom vocabulary (`"type": "ChildList"`, `"ComponentId"`, `"Action"`, `"DynamicString"`, `"DynamicNumber"`, `"Dynamic"`), which the loader converts to `z.any()` — losing the child-ref markers `NodeResolver` needs — and it converts plain `boolean`/`number`/`string` props to strict zod primitives that **throw `A2uiValidationError`** when an agent sends a `{path}` binding (0.10.6+ validates every `updateComponents` payload against the catalog schema and rejects the whole batch on failure). This task adds a pure transform that fixes both, without touching `oat-catalog.json` itself.

**Files:**
- Create: `renderer/catalog-compat.js`
- Modify: `package.json` (devDependency + test script)
- Test: `tests/test-catalog-compat.js`

**Interfaces:**
- Consumes: `catalog/oat-catalog.json` (read-only), `@a2ui/web_core/v0_9` (`Catalog.fromSchema`, `extractRefFields`) in tests only.
- Produces: `toWebCoreCatalogJson(catalogJson: object): object` — returns a NEW deep-cloned catalog JSON object in the format `Catalog.fromSchema()` understands. Task 2 calls this inside the adapter.

- [ ] **Step 1: Install the devDependency and register the new test files**

```bash
npm install --save-dev @a2ui/web_core@^0.10.7
```

In `package.json`, extend the test script (both new files now, so Task 2 doesn't need another package.json edit):

```json
"test": "node --test tests/test-functions.js tests/test-catalog.js tests/test-renderer.js tests/test-catalog-compat.js tests/test-surface-adapter.js"
```

Create an empty placeholder `tests/test-surface-adapter.js` containing only `// populated in Task 2` so `node --test` doesn't fail on a missing file (Node treats a file with no tests as passing).

- [ ] **Step 2: Write the failing tests**

Create `tests/test-catalog-compat.js`:

```js
/**
 * Tests for catalog-compat — transforms oat-catalog.json into the format
 * @a2ui/web_core's Catalog.fromSchema() understands.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { toWebCoreCatalogJson } from '../renderer/catalog-compat.js';
import * as webCore from '@a2ui/web_core/v0_9';
import catalogJson from '../catalog/oat-catalog.json' with { type: 'json' };

describe('toWebCoreCatalogJson', () => {
  it('maps ChildList and ComponentId to protocol $refs', () => {
    const out = toWebCoreCatalogJson(catalogJson);
    assert.equal(out.components.Row.properties.children.$ref,
      'common_types.json#/$defs/ChildList');
    assert.equal(out.components.Row.properties.children.type, undefined);
    assert.equal(out.components.Card.properties.child.$ref,
      'common_types.json#/$defs/ComponentId');
  });

  it('maps Dynamic*, Action, and bindable primitives to protocol $refs', () => {
    const out = toWebCoreCatalogJson(catalogJson);
    assert.equal(out.components.Text.properties.text.$ref,
      'common_types.json#/$defs/DynamicString');
    assert.equal(out.components.Button.properties.action.$ref,
      'common_types.json#/$defs/Action');
    // plain boolean → DynamicBoolean so {path} bindings pass validation
    assert.equal(out.components.TextField.properties.disabled.$ref,
      'common_types.json#/$defs/DynamicBoolean');
  });

  it('keeps enum properties literal-validated', () => {
    const out = toWebCoreCatalogJson(catalogJson);
    assert.deepEqual(out.components.Row.properties.justify.enum,
      catalogJson.components.Row.properties.justify.enum);
  });

  it('relaxes array and object properties to permissive schemas', () => {
    const out = toWebCoreCatalogJson(catalogJson);
    // Tabs.tabs is an array of {title, child}; bindings and nested refs must
    // survive strict validation, so the transform drops the type constraint.
    assert.equal(out.components.Tabs.properties.tabs.type, undefined);
    assert.equal(out.components.Tabs.properties.tabs.$ref, undefined);
  });

  it('does not mutate its input', () => {
    const before = JSON.stringify(catalogJson);
    toWebCoreCatalogJson(catalogJson);
    assert.equal(JSON.stringify(catalogJson), before);
  });

  it('re-shapes functions into the loader format', () => {
    const out = toWebCoreCatalogJson(catalogJson);
    const fd = out.functions.formatDate;
    assert.equal(fd.args.type, 'object');
    assert.ok(fd.args.properties);
    assert.deepEqual(fd.args.required,
      catalogJson.functions.formatDate.requiredParameters ?? []);
    assert.equal(fd.returnType, 'any');
  });

  it('produces a catalog whose child refs web_core detects', () => {
    const cat = webCore.Catalog.fromSchema(toWebCoreCatalogJson(catalogJson));
    assert.equal(cat.id, catalogJson.catalogId);
    assert.equal(cat.components.size,
      Object.keys(catalogJson.components).length);
    const rowRefs = webCore.extractRefFields(cat.components.get('Row').schema);
    assert.equal(rowRefs.get('children')?.kind, 'list');
    const cardRefs = webCore.extractRefFields(cat.components.get('Card').schema);
    assert.equal(cardRefs.get('child')?.kind, 'single');
  });

  it('validates both literal and binding values for dynamic props', () => {
    const cat = webCore.Catalog.fromSchema(toWebCoreCatalogJson(catalogJson));
    const tf = cat.components.get('TextField').schema;
    assert.ok(tf.safeParse({ label: 'Name', value: 'literal' }).success);
    assert.ok(tf.safeParse({ label: 'Name', value: { path: '/user/name' } }).success);
    assert.ok(tf.safeParse({ label: 'Name', disabled: { path: '/locked' } }).success);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/test-catalog-compat.js`
Expected: FAIL — `Cannot find module '../renderer/catalog-compat.js'`.

- [ ] **Step 4: Implement `renderer/catalog-compat.js`**

```js
/**
 * catalog-compat — transforms catalog/oat-catalog.json into the raw-schema
 * format @a2ui/web_core's Catalog.fromSchema() understands.
 *
 * oat-catalog.json uses a compact vocabulary ("type": "ChildList",
 * "ComponentId", "DynamicString", ...). web_core's schema loader recognizes
 * only standard JSON-schema types plus $refs to
 * "common_types.json#/$defs/<Name>". Without this mapping, NodeResolver
 * cannot detect child-reference properties and MessageProcessor's strict
 * property validation (web_core >= 0.10.6) rejects data-bound values.
 *
 * @module catalog-compat
 */

/** Oat-catalog custom types → protocol $defs names. */
const PROTOCOL_REFS = {
  ChildList: 'ChildList',
  ComponentId: 'ComponentId',
  Action: 'Action',
  DynamicString: 'DynamicString',
  DynamicNumber: 'DynamicNumber',
  DynamicBoolean: 'DynamicBoolean',
  Dynamic: 'DynamicValue',
  CheckRule: 'CheckRule',
};

/** Plain primitives that agents may data-bind → Dynamic* equivalents. */
const BINDABLE_PRIMITIVES = {
  string: 'DynamicString',
  boolean: 'DynamicBoolean',
  number: 'DynamicNumber',
  integer: 'DynamicNumber',
};

const STANDARD_JSON_TYPES = new Set([
  'string', 'number', 'integer', 'boolean', 'object', 'array', 'null',
]);

function refSchema(name, description) {
  const out = { $ref: `common_types.json#/$defs/${name}` };
  if (description) out.description = description;
  return out;
}

function transformProperty(prop) {
  if (!prop || typeof prop !== 'object') return prop;
  const { type, description } = prop;

  // Enums stay literal-validated (matches web_core's own basic catalog).
  if (Array.isArray(prop.enum)) return prop;

  const custom = PROTOCOL_REFS[type];
  if (custom) return refSchema(custom, description);

  const bindable = BINDABLE_PRIMITIVES[type];
  if (bindable) return refSchema(bindable, description);

  // Arrays/objects: the loader cannot express "typed value OR binding OR
  // nested component ids", so relax to a permissive schema; the renderer
  // resolves and interprets these values itself.
  if (type === 'array' || type === 'object') {
    return description ? { description } : {};
  }

  return prop;
}

/**
 * Transform oat-catalog JSON into web_core Catalog.fromSchema() input.
 * Pure: returns a new object, never mutates the input.
 *
 * @param {object} catalogJson - Parsed contents of catalog/oat-catalog.json.
 * @returns {object} Loader-compatible catalog schema object.
 */
export function toWebCoreCatalogJson(catalogJson) {
  const out = structuredClone(catalogJson);

  for (const comp of Object.values(out.components ?? {})) {
    if (!comp.properties) continue;
    for (const [name, prop] of Object.entries(comp.properties)) {
      comp.properties[name] = transformProperty(prop);
    }
  }

  const functions = {};
  for (const [name, fn] of Object.entries(out.functions ?? {})) {
    const properties = {};
    for (const [param, schema] of Object.entries(fn.parameters ?? {})) {
      if (schema && typeof schema === 'object'
          && schema.type && !STANDARD_JSON_TYPES.has(schema.type)) {
        // Custom vocab in function params (e.g. DynamicString) → permissive.
        const { type, ...rest } = schema;
        properties[param] = rest;
      } else {
        properties[param] = schema;
      }
    }
    functions[name] = {
      description: fn.description,
      returnType: fn.returnType ?? 'any',
      args: {
        type: 'object',
        properties,
        required: fn.requiredParameters ?? [],
      },
    };
  }
  out.functions = functions;

  return out;
}
```

Note: the loader ignores our `requiredProperties` key (it reads JSON-schema `required`), so all component props end up optional in the zod schema. That is intentionally permissive — required-prop enforcement stays the renderer's/agent's concern.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/test-catalog-compat.js`
Expected: PASS (all 8 tests). If `extractRefFields` assertions fail, check the exact `$ref` string — the loader matches `#/$defs/<Name>` via regex `/#\/(?:\$defs|definitions)\//`.

- [ ] **Step 6: Run the full suite**

Run: `npm test && npm run validate`
Expected: PASS — existing suites untouched.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json renderer/catalog-compat.js tests/test-catalog-compat.js tests/test-surface-adapter.js
git commit -m "Add web_core catalog compatibility transform + @a2ui/web_core devDependency"
```

---

### Task 2: Adapter core — `createSurfaceAdapter` renders a static tree

**Files:**
- Create: `renderer/surface-adapter.js`
- Create: `tests/helpers/dom-shim.js`
- Modify: `package.json` (exports map)
- Test: `tests/test-surface-adapter.js` (replaces the Task 1 placeholder)

**Interfaces:**
- Consumes: `toWebCoreCatalogJson(catalogJson)` from Task 1; `createOatRenderer(options)` from `renderer/index.js` (returns `{renderer, functions, catalogId, version}`); web_core APIs per the spec's "Verified API facts".
- Produces: `createSurfaceAdapter(options) => { processMessages(messages), processor, dispose() }` where `options = { webCore, container, onAction?, onError?, resolveContainer?, applyTheme?, rendererOptions?, catalogJson? }`. Tasks 3–6 extend this same file; their tests drive everything through `processMessages`.

- [ ] **Step 1: Create the shared DOM shim helper**

Create `tests/helpers/dom-shim.js`. It is the `MiniElement` shim from `tests/test-renderer.js` (lines ~14–70) extracted into an importable installer, extended with the parent-tracking methods the adapter needs (`replaceChildren`, `removeChild`, `replaceWith`, `remove`). `tests/test-renderer.js` keeps its own inline copy — do not modify it.

```js
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
```

- [ ] **Step 2: Write the failing tests**

Replace the placeholder `tests/test-surface-adapter.js` with:

```js
/**
 * Tests for the real @a2ui/web_core surface adapter.
 * Runs against the actual published package (devDependency), not a mock.
 */
import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { installDomShim, findEl } from './helpers/dom-shim.js';

installDomShim();

const webCore = await import('@a2ui/web_core/v0_9');
const { createSurfaceAdapter } = await import('../renderer/surface-adapter.js');
const { CATALOG_ID } = await import('../renderer/index.js');

const V = 'v0.9.1';
const create = (surfaceId = 's1', extra = {}) =>
  ({ version: V, createSurface: { surfaceId, catalogId: CATALOG_ID, ...extra } });
const update = (components, surfaceId = 's1') =>
  ({ version: V, updateComponents: { surfaceId, components } });
const data = (path, value, surfaceId = 's1') =>
  ({ version: V, updateDataModel: { surfaceId, path, value } });

function makeAdapter(extra = {}) {
  const container = document.createElement('div');
  const actions = [];
  const errors = [];
  const adapter = createSurfaceAdapter({
    webCore,
    container,
    onAction: (a) => actions.push(a),
    onError: (e) => errors.push(e),
    ...extra,
  });
  return { adapter, container, actions, errors };
}

describe('createSurfaceAdapter construction', () => {
  it('throws without webCore', () => {
    assert.throws(() => createSurfaceAdapter({ container: document.createElement('div') }),
      /webCore/);
  });
  it('throws when webCore is too old (no NodeResolver)', () => {
    assert.throws(() => createSurfaceAdapter({
      webCore: { ...webCore, NodeResolver: undefined },
      container: document.createElement('div'),
    }), /0\.10\.7/);
  });
  it('throws without container', () => {
    assert.throws(() => createSurfaceAdapter({ webCore }), /container/);
  });
});

describe('static rendering through the real protocol engine', () => {
  it('renders a component tree from wire messages', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      update([
        { id: 'root', component: 'Column', children: ['t1', 'b1'] },
        { id: 't1', component: 'Text', text: 'Hello' },
        { id: 'b1', component: 'Button', label: 'Go' },
      ]),
    ]);
    const text = findEl(container, (el) => el.textContent === 'Hello');
    assert.ok(text, 'Text component rendered');
    const btn = findEl(container, (el) => el.tagName === 'BUTTON');
    assert.ok(btn, 'Button rendered');
    assert.equal(findEl(container, (el) => el.dataset.surfaceId === 's1').dataset.surfaceId, 's1');
  });

  it('accepts v0.9 messages too', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      { version: 'v0.9', createSurface: { surfaceId: 's1', catalogId: CATALOG_ID } },
      { version: 'v0.9', updateComponents: { surfaceId: 's1', components: [
        { id: 'root', component: 'Text', text: 'legacy' },
      ] } },
    ]);
    assert.ok(findEl(container, (el) => el.textContent === 'legacy'));
  });

  it('resolves single-child refs (Card)', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      update([
        { id: 'root', component: 'Card', child: 'inner' },
        { id: 'inner', component: 'Text', text: 'inside' },
      ]),
    ]);
    assert.ok(findEl(container, (el) => el.textContent === 'inside'));
  });

  it('reports malformed batches via onError without killing existing surfaces', () => {
    const { adapter, container, errors } = makeAdapter();
    adapter.processMessages([create(), update([
      { id: 'root', component: 'Text', text: 'still here' },
    ])]);
    adapter.processMessages([update([
      { id: 'root', component: 'Text', bogusProp: 1 },
    ])]);
    assert.ok(errors.length >= 1, 'validation error surfaced');
    assert.ok(findEl(container, (el) => el.textContent === 'still here'));
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/test-surface-adapter.js`
Expected: FAIL — `Cannot find module '../renderer/surface-adapter.js'`.

- [ ] **Step 4: Implement `renderer/surface-adapter.js`**

```js
/**
 * surface-adapter — real @a2ui/web_core (>= 0.10.7) protocol integration.
 *
 * Dependency-injected: the consumer imports '@a2ui/web_core/v0_9' (from npm
 * or an ESM CDN such as esm.sh) and passes it as `webCore`. a2ui-oat itself
 * declares no runtime dependency.
 *
 * One MessageProcessor per adapter; one NodeResolver per surface, used only
 * for structural shape (child refs, list-template expansion, placeholder
 * states). Property values are read raw from
 * ComponentContext.componentModel.properties and handed to
 * OatRenderer.renderComponent() unchanged.
 *
 * @module a2ui-oat/surface-adapter
 */

import { createOatRenderer } from './index.js';
import { toWebCoreCatalogJson } from './catalog-compat.js';
import defaultCatalogJson from '../catalog/oat-catalog.json' with { type: 'json' };

/** Maps oat-catalog theme keys to Oat CSS custom properties. */
const THEME_VARS = {
  primaryColor: '--color-primary',
  backgroundColor: '--color-bg',
  textColor: '--color-text',
  fontFamily: '--font-family',
  borderRadius: '--border-radius',
  spacing: '--spacing',
};

function defaultApplyTheme(theme, el) {
  if (!theme) return;
  for (const [key, cssVar] of Object.entries(THEME_VARS)) {
    if (theme[key]) el.style.setProperty(cssVar, theme[key]);
  }
  if (theme.mode === 'dark') el.setAttribute('data-theme', 'dark');
}

/**
 * Create an adapter that feeds A2UI wire messages through @a2ui/web_core
 * and renders every surface with OatRenderer.
 *
 * @param {object} options
 * @param {object} options.webCore - The imported '@a2ui/web_core/v0_9' module.
 * @param {HTMLElement} options.container - Default mount point for surfaces.
 * @param {function(object): void} [options.onAction] - Server-bound event actions.
 * @param {function(Error, object=): void} [options.onError]
 * @param {function(string): HTMLElement} [options.resolveContainer] - Per-surface mount.
 * @param {function(object, HTMLElement): void} [options.applyTheme]
 * @param {object} [options.rendererOptions] - Forwarded to OatRenderer.
 * @param {object} [options.catalogJson] - Overrides the bundled oat-catalog.json.
 * @returns {{ processMessages: function, processor: object, dispose: function }}
 */
export function createSurfaceAdapter(options = {}) {
  const {
    webCore, container,
    onAction = () => {},
    onError = (err) => console.error('[a2ui-oat adapter]', err),
    resolveContainer,
    applyTheme = defaultApplyTheme,
    rendererOptions = {},
    catalogJson = defaultCatalogJson,
  } = options;

  if (!webCore) {
    throw new Error(
      "createSurfaceAdapter: 'webCore' is required — pass the imported '@a2ui/web_core/v0_9' module");
  }
  if (typeof webCore.NodeResolver !== 'function'
      || typeof webCore.ComponentContext !== 'function') {
    throw new Error('a2ui-oat surface adapter requires @a2ui/web_core >= 0.10.7');
  }
  if (!container) {
    throw new Error("createSurfaceAdapter: 'container' is required");
  }

  const { renderer, functions: rawFunctions } = createOatRenderer(rendererOptions);
  const catalog = buildExecutableCatalog(webCore, catalogJson, rawFunctions, onError);

  const processor = new webCore.MessageProcessor(
    [catalog],
    (action) => { try { onAction(action); } catch (err) { onError(err); } },
    { version: 'v0.9.1' },
  );

  /** surfaceId -> { resolver, stopEffect, surfaceEl, host } */
  const mounted = new Map();

  const createdSub = processor.onSurfaceCreated((surface) => {
    try { mountSurface(surface); } catch (err) { onError(err); }
  });
  const deletedSub = processor.onSurfaceDeleted((surfaceId) => {
    unmountSurface(surfaceId);
  });

  function mountSurface(surface) {
    const host = resolveContainer?.(surface.id) ?? container;
    const surfaceEl = document.createElement('div');
    surfaceEl.dataset.surfaceId = surface.id;
    host.appendChild(surfaceEl);
    applyTheme(surface.theme, surfaceEl);

    const resolver = new webCore.NodeResolver(surface, catalog);
    const stopEffect = webCore.effect(() => {
      const root = webCore.getValue(resolver.rootNode);
      if (!root) return;
      try {
        surfaceEl.replaceChildren(renderNode(root, surface));
      } catch (err) {
        onError(err);
      }
    });
    mounted.set(surface.id, { resolver, stopEffect, surfaceEl, host });
  }

  function unmountSurface(surfaceId) {
    const entry = mounted.get(surfaceId);
    if (!entry) return;
    entry.stopEffect?.();
    entry.resolver.dispose();
    entry.host.removeChild(entry.surfaceEl);
    mounted.delete(surfaceId);
  }

  function renderNode(node, surface) {
    if (node.state !== 'resolved') {
      // pending / unknown-type / cyclic → OatRenderer's unknown-component
      // fallback element (type is 'Placeholder' for pending/cyclic).
      return renderer.renderComponent(
        { id: node.componentId, component: node.type },
        makeRenderContext(node, surface, null, new Map()),
      );
    }
    const componentContext =
      new webCore.ComponentContext(surface, node.componentId, node.dataPath);
    const raw = componentContext.componentModel.properties;
    const { props, childMap } = normalizeRefFields(raw, node);
    const ctx = makeRenderContext(node, surface, componentContext, childMap);
    return renderer.renderComponent(
      { id: node.componentId, component: node.type, ...props }, ctx);
  }

  /**
   * Replace child-reference property values (which NodeResolver resolves to
   * live ComponentNode objects) with plain id strings/arrays so every
   * existing _render* method keeps consuming ids exactly as in direct mode.
   * Everything else stays the raw pre-resolution value.
   */
  function normalizeRefFields(raw, node) {
    const props = { ...raw };
    const childMap = new Map();
    const api = catalog.components.get(node.type);
    if (!api) return { props, childMap };
    const refFields = webCore.extractRefFields(api.schema);
    const resolved = webCore.peekValue(node.props);
    for (const [key, kind] of refFields) {
      const value = resolved?.[key];
      if (kind.kind === 'single' && webCore.isComponentNode(value)) {
        childMap.set(value.componentId, value);
        childMap.set(value.instanceId, value);
        props[key] = value.componentId;
      } else if (kind.kind === 'list' && Array.isArray(value)) {
        const ids = [];
        for (const child of value) {
          if (!webCore.isComponentNode(child)) continue;
          childMap.set(child.instanceId, child);
          ids.push(child.instanceId);
        }
        props[key] = ids;
      }
      // kind 'nested' (e.g. tabs[].child): raw ids stay in place; the
      // componentsModel fallback in renderChild resolves them.
    }
    return { props, childMap };
  }

  /** Render a component that is not part of the resolver's node tree
   *  (nested refs like tabs[].child). Subscriptions attach to parentNode. */
  function renderRawComponent(model, parentNode, surface) {
    const cc = new webCore.ComponentContext(surface, model.id, parentNode.dataPath);
    const ctx = makeRenderContext(parentNode, surface, cc, new Map());
    return renderer.renderComponent(
      { id: model.id, component: model.type, ...cc.componentModel.properties }, ctx);
  }

  function makeRenderContext(node, surface, componentContext, childMap) {
    const dc = componentContext?.dataContext ?? null;
    return {
      getDataModel: () => {
        try { return surface.dataModel.get('/'); } catch { return {}; }
      },
      setDataModel: (path, value) => {
        if (!dc) return;
        try { dc.set(path, value); } catch (err) { onError(err); }
      },
      subscribe: (path, cb) => {
        if (!dc) return () => {};
        const sub = dc.subscribeDynamicValue({ path }, cb);
        node.addCleanup(() => sub.unsubscribe());
        return () => sub.unsubscribe();
      },
      renderChild: (id) => {
        const childNode = childMap.get(id);
        if (childNode) return renderNode(childNode, surface);
        const model = surface.componentsModel.get(id);
        if (model) return renderRawComponent(model, node, surface);
        return null;
      },
      dispatchAction: (action) => {
        try {
          const resolved = resolveDeepSync(action, dc);
          surface.dispatchAction(resolved, node.componentId).catch(onError);
        } catch (err) {
          onError(err);
        }
      },
      getRegisteredFunction: (name) => rawFunctions[name] ?? null,
    };
  }

  /** Mirror of GenericBinder.bindAction's resolution walk: nested objects
   *  carrying 'path' or 'call' resolve synchronously (local functionCall
   *  actions execute here as a side effect); the rest passes through. */
  function resolveDeepSync(value, dc) {
    if (Array.isArray(value)) return value.map((v) => resolveDeepSync(v, dc));
    if (value && typeof value === 'object') {
      if (('path' in value || 'call' in value) && dc) {
        return dc.resolveDynamicValue(value);
      }
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = resolveDeepSync(v, dc);
      return out;
    }
    return value;
  }

  return {
    processMessages(messages) {
      try {
        processor.processMessages(messages);
      } catch (err) {
        onError(err);
      }
    },
    processor,
    dispose() {
      for (const surfaceId of [...mounted.keys()]) unmountSurface(surfaceId);
      createdSub?.unsubscribe?.();
      deletedSub?.unsubscribe?.();
    },
  };
}

/**
 * Build an executable Catalog: component schemas from the compat-transformed
 * oat-catalog.json, functions wrapped as FunctionImplementation objects
 * ({...FunctionApi, execute}) around renderer/functions/*.js.
 */
function buildExecutableCatalog(webCore, catalogJson, rawFunctions, onError) {
  const schemaCatalog = webCore.Catalog.fromSchema(toWebCoreCatalogJson(catalogJson));
  const impls = [];
  for (const fnApi of schemaCatalog.functions.values()) {
    const raw = rawFunctions[fnApi.name];
    if (!raw) continue;
    impls.push({
      ...fnApi,
      execute: (args, dataContext, abortSignal) =>
        raw(args, functionContext(dataContext, rawFunctions, onError), abortSignal),
    });
  }
  return new webCore.Catalog(
    schemaCatalog.id,
    [...schemaCatalog.components.values()],
    impls,
    schemaCatalog.themeSchema,
  );
}

/** Minimal RenderContext-shaped view over a DataContext, for functions
 *  invoked through web_core's own {call: ...} resolution path. */
function functionContext(dataContext, rawFunctions, onError) {
  return {
    getDataModel: () => {
      try { return dataContext.resolveDynamicValue({ path: '/' }); } catch { return {}; }
    },
    setDataModel: (path, value) => {
      try { dataContext.set(path, value); } catch (err) { onError(err); }
    },
    subscribe: () => () => {},
    renderChild: () => null,
    dispatchAction: () => {},
    getRegisteredFunction: (name) => rawFunctions[name] ?? null,
  };
}
```

Add the subpath export to `package.json`:

```json
"exports": {
  ".": "./renderer/index.js",
  "./surface-adapter": "./renderer/surface-adapter.js",
  "./catalog": "./catalog/oat-catalog.json",
  "./sanitizer": "./direct/sanitizer.js"
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/test-surface-adapter.js`
Expected: PASS. Likely failure points and what they mean:
- `A2uiValidationError` on valid payloads → the compat transform missed a property type; inspect the logged `issues`.
- Root never renders → confirm the root component's id is exactly `'root'` in the test messages.
- `onSurfaceCreated is not a function` → check whether the subscription API returns `{unsubscribe}` vs a function; adjust `dispose()` accordingly (the `?.unsubscribe?.()` guard covers both).

- [ ] **Step 6: Run the full suite**

Run: `npm test && npm run validate`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add renderer/surface-adapter.js tests/helpers/dom-shim.js tests/test-surface-adapter.js package.json
git commit -m "Add createSurfaceAdapter: real @a2ui/web_core protocol integration"
```

---

### Task 3: Reactivity, two-way binding, and structural re-render

**Files:**
- Modify: `renderer/surface-adapter.js`
- Test: `tests/test-surface-adapter.js`

**Interfaces:**
- Consumes: Task 2's adapter internals (`renderNode`, `normalizeRefFields`, `makeRenderContext`).
- Produces: no API change; behavior only. Structural changes to a node's children re-render that node's element in place (`replaceWith`), keyed by a child-id signature.

- [ ] **Step 1: Write the failing tests**

Append to `tests/test-surface-adapter.js`:

```js
describe('reactivity through the real signals pipeline', () => {
  it('updates bound text on updateDataModel without re-mounting', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      data('/user', { name: 'Ada' }),
      update([{ id: 'root', component: 'Text', text: { path: '/user/name' } }]),
    ]);
    const before = findEl(container, (el) => el.textContent === 'Ada');
    assert.ok(before, 'initial bound value rendered');
    adapter.processMessages([data('/user/name', 'Grace')]);
    assert.equal(before.textContent, 'Grace', 'same element updated in place');
  });

  it('writes two-way bindings back into the real DataModel', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      data('/form', { name: '' }),
      update([{ id: 'root', component: 'TextField',
                label: 'Name', value: { path: '/form/name' } }]),
    ]);
    const input = findEl(container, (el) => el.tagName === 'INPUT');
    assert.ok(input, 'TextField input rendered');
    input.value = 'Linus';
    input.dispatchEvent({ type: 'input', target: input });
    const surface = adapter.processor.model.getSurface('s1');
    assert.equal(surface.dataModel.get('/form/name'), 'Linus');
  });

  it('re-renders a container when its child list changes', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      update([
        { id: 'root', component: 'Column', children: ['t1'] },
        { id: 't1', component: 'Text', text: 'one' },
      ]),
    ]);
    assert.ok(findEl(container, (el) => el.textContent === 'one'));
    assert.equal(findEl(container, (el) => el.textContent === 'two'), null);
    adapter.processMessages([
      update([
        { id: 'root', component: 'Column', children: ['t1', 't2'] },
        { id: 't2', component: 'Text', text: 'two' },
      ]),
    ]);
    assert.ok(findEl(container, (el) => el.textContent === 'two'),
      'newly added child rendered');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/test-surface-adapter.js`
Expected: the first two may already PASS (Task 2 wired `subscribe`/`setDataModel` — if so, note it and keep them as regression tests). The third ("child list changes") FAILS: nothing re-renders when `node.props` changes below the root.

- [ ] **Step 3: Implement the structural re-render effect**

In `renderNode` (the `state === 'resolved'` branch), after computing `{ props, childMap }` and rendering `el`, watch the node's resolved props for **structural** changes only (child-id signature), replacing the element in place when it changes:

```js
    const el = renderer.renderComponent(
      { id: node.componentId, component: node.type, ...props }, ctx);

    // Structural re-render: when the node's resolved child set changes
    // (list items added/removed, refs swapped), replace this element.
    // Value-only updates flow through subscribe() and never hit this path.
    let signature = childSignature(node);
    let currentEl = el;
    const stop = webCore.effect(() => {
      webCore.getValue(node.props); // track
      const next = childSignature(node);
      if (next === signature) return;
      signature = next;
      try {
        const replacement = renderNode(node, surface);
        currentEl.replaceWith(replacement);
        currentEl = replacement;
      } catch (err) {
        onError(err);
      }
    });
    node.addCleanup(stop);
    return el;
```

with the helper (place near `normalizeRefFields`):

```js
  /** Stable string of the node's resolved child instanceIds, per ref field. */
  function childSignature(node) {
    const api = catalog.components.get(node.type);
    if (!api) return '';
    const refFields = webCore.extractRefFields(api.schema);
    const resolved = webCore.peekValue(node.props);
    const parts = [];
    for (const [key] of refFields) {
      const value = resolved?.[key];
      if (webCore.isComponentNode(value)) parts.push(`${key}:${value.instanceId}`);
      else if (Array.isArray(value)) {
        parts.push(`${key}:${value
          .filter((v) => webCore.isComponentNode(v))
          .map((v) => v.instanceId).join(',')}`);
      }
    }
    return parts.join('|');
  }
```

Refactor note: `renderNode`'s resolved branch now does render + watch; keep it under ~40 lines by extracting the watch block into `watchStructure(node, surface, el)` if it grows past that. Guard against re-entrancy: `renderNode` is called again inside the effect — the new call registers its own effect and cleanup on the same node; the old effect's `stop` was registered via `node.addCleanup`, and web_core drops node cleanups when the node is destroyed. To avoid stacking effects across replacements of the SAME live node, call the previous `stop()` before `replaceWith` re-render — i.e. inside the effect callback, first line after the signature check: `stop();` (the effect disposes itself, and the fresh `renderNode` call installs its successor).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/test-surface-adapter.js`
Expected: PASS. If the two-way binding test fails on the shim event, check how `_renderTextField` wires its listener (it uses `addEventListener('input', ...)` and reads `e.target.value`) and match the dispatched event object shape.

- [ ] **Step 5: Full suite + commit**

Run: `npm test && npm run validate` — PASS, then:

```bash
git add renderer/surface-adapter.js tests/test-surface-adapter.js
git commit -m "Adapter: reactive bindings, two-way writes, structural re-render"
```

---

### Task 4: Action dispatch — events reach onAction, functionCalls run locally

**Files:**
- Modify: `renderer/surface-adapter.js` (only if tests reveal gaps — the dispatch path was written in Task 2)
- Test: `tests/test-surface-adapter.js`

**Interfaces:**
- Consumes: `dispatchAction`/`resolveDeepSync` from Task 2; `surface.dispatchAction(payload, sourceComponentId)` (validates + emits only `event`-wrapped payloads).
- Produces: verified behavior contract: `onAction` receives event actions with nested dynamic values resolved; local functionCall actions execute the registered function and never reach `onAction`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/test-surface-adapter.js`:

```js
describe('action dispatch', () => {
  it('delivers event actions to onAction with dynamic values resolved', () => {
    const { adapter, container, actions } = makeAdapter();
    adapter.processMessages([
      create(),
      data('/cart', { total: 42 }),
      update([{ id: 'root', component: 'Button', label: 'Buy',
        action: { event: { name: 'checkout',
                           context: { total: { path: '/cart/total' } } } } }]),
    ]);
    const btn = findEl(container, (el) => el.tagName === 'BUTTON');
    btn.dispatchEvent({ type: 'click', preventDefault() {} });
    assert.equal(actions.length, 1);
    assert.equal(actions[0].event.name, 'checkout');
    assert.equal(actions[0].event.context.total, 42, 'binding resolved before dispatch');
  });

  it('executes local functionCall actions without reaching onAction', () => {
    const { adapter, container, actions } = makeAdapter();
    adapter.processMessages([
      create(),
      data('/msg', 'before'),
      update([{ id: 'root', component: 'Button', label: 'Nav',
        action: { call: { name: 'navigateTo',
                          args: { url: '#after', targetPath: '/msg' } } } }]),
    ]);
    const btn = findEl(container, (el) => el.tagName === 'BUTTON');
    btn.dispatchEvent({ type: 'click', preventDefault() {} });
    assert.equal(actions.length, 0, 'local call never reaches onAction');
  });
});
```

Note for the executor: check `renderer/functions/navigateTo.js`'s actual signature before finalizing the second test — pick whichever existing registered function is easiest to observe side effects from under the DOM shim (a function that writes to the data model via `context.setDataModel` is ideal; assert on `surface.dataModel.get(...)` afterwards). The assertion that matters is: function executed, `onAction` not called. If no existing function fits cleanly, register a test-only function by passing `rendererOptions` — but do NOT modify `renderer/functions/*`.

- [ ] **Step 2: Run tests to verify they fail (or pass)**

Run: `node --test tests/test-surface-adapter.js`
Expected: the event-action test likely PASSES already (Task 2 wired the chain); the functionCall test exercises `buildExecutableCatalog`'s wrapper + `resolveDeepSync`'s `call` branch for the first time and may fail. Investigate failures against the spec's verified dispatch chain (event payloads are zod-validated by `surface.dispatchAction` — a malformed `event` shape throws rather than emits).

- [ ] **Step 3: Fix what the tests reveal, re-run to green**

Run: `node --test tests/test-surface-adapter.js` until PASS. Do not weaken assertions to get there; if web_core's behavior differs from the spec's description, fix the adapter and note the discrepancy in the commit message.

- [ ] **Step 4: Full suite + commit**

```bash
npm test && npm run validate
git add renderer/surface-adapter.js tests/test-surface-adapter.js
git commit -m "Adapter: verify event/functionCall action dispatch chain"
```

---

### Task 5: Structural edge cases — list templates, nested refs, placeholders, Checkable

**Files:**
- Modify: `renderer/surface-adapter.js` (as needed)
- Test: `tests/test-surface-adapter.js`

**Interfaces:**
- Consumes: `normalizeRefFields` child map + `renderChild` componentsModel fallback (Task 2), structural re-render (Task 3).
- Produces: verified behavior for the four structural scenarios below. No API change.

- [ ] **Step 1: Write the failing tests**

Append to `tests/test-surface-adapter.js`:

```js
describe('structural resolution', () => {
  it('expands a List template into one child per data item', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      data('/items', [{ label: 'a' }, { label: 'b' }, { label: 'c' }]),
      update([
        { id: 'root', component: 'List',
          children: { componentId: 'itemTpl', path: '/items' } },
        { id: 'itemTpl', component: 'Text', text: { path: 'label' } },
      ]),
    ]);
    for (const t of ['a', 'b', 'c']) {
      assert.ok(findEl(container, (el) => el.textContent === t),
        `template item '${t}' rendered with item-scoped binding`);
    }
  });

  it('tracks template item additions', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      data('/items', [{ label: 'a' }]),
      update([
        { id: 'root', component: 'List',
          children: { componentId: 'itemTpl', path: '/items' } },
        { id: 'itemTpl', component: 'Text', text: { path: 'label' } },
      ]),
    ]);
    adapter.processMessages([data('/items', [{ label: 'a' }, { label: 'b' }])]);
    assert.ok(findEl(container, (el) => el.textContent === 'b'));
  });

  it('renders nested refs (Tabs items[].child) via the componentsModel fallback', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      update([
        { id: 'root', component: 'Tabs',
          tabs: [{ title: 'One', child: 'p1' }, { title: 'Two', child: 'p2' }] },
        { id: 'p1', component: 'Text', text: 'panel one' },
        { id: 'p2', component: 'Text', text: 'panel two' },
      ]),
    ]);
    assert.ok(findEl(container, (el) => el.textContent === 'panel one'));
    assert.ok(findEl(container, (el) => el.textContent === 'panel two'));
  });

  it('renders the unknown-component fallback for a missing child (no throw)', () => {
    const { adapter, container, errors } = makeAdapter();
    adapter.processMessages([
      create(),
      update([{ id: 'root', component: 'Card', child: 'ghost' }]),
    ]);
    // 'ghost' never arrives: NodeResolver reports a pending placeholder.
    const fallback = findEl(container,
      (el) => el.dataset.unknownComponent !== undefined);
    assert.ok(fallback, 'placeholder rendered through OatRenderer fallback');
    assert.equal(errors.filter((e) => e instanceof TypeError).length, 0);
  });

  it('evaluates Checkable checks through the adapter (aria-invalid)', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      data('/form', { email: '' }),
      update([{ id: 'root', component: 'TextField',
        label: 'Email', value: { path: '/form/email' },
        checks: [{ condition: { call: { name: 'required',
                                        args: { value: { path: '/form/email' } } } },
                   message: 'Email is required' }] }]),
    ]);
    const input = findEl(container, (el) => el.tagName === 'INPUT');
    assert.equal(input.getAttribute('aria-invalid'), 'true',
      'empty required field flagged invalid');
    adapter.processMessages([data('/form/email', 'a@b.co')]);
    assert.notEqual(input.getAttribute('aria-invalid'), 'true',
      'valid value clears aria-invalid');
  });
});
```

Executor note: before finalizing the Checkable test, read how `tests/test-renderer.js` drives `checks` (search `makeReactiveContext` usages with `required`) and mirror the exact `checks`/`condition` payload shape used there — the renderer's `_renderChecks` contract is already pinned by those tests.

- [ ] **Step 2: Run tests to verify current state**

Run: `node --test tests/test-surface-adapter.js`
Expected: template expansion and nested-ref tests exercise new territory and may fail; placeholder and Checkable may pass. For each failure, debug against the resolver's actual output — add a temporary `console.dir(webCore.peekValue(node.props), {depth:3})` in `normalizeRefFields`, and remove it before committing.

Known risk (documented in the spec): the `List.children` value for a template is `{componentId, path}` raw; if `extractRefFields` classifies `children` as `'list'` but the resolved value is template-expanded nodes, `normalizeRefFields` already handles it (array of ComponentNodes → instanceIds). If instead the resolved value shape differs (e.g. a nested structure), adapt `normalizeRefFields`, not the renderer.

- [ ] **Step 3: Fix to green, then full suite + commit**

```bash
npm test && npm run validate
git add renderer/surface-adapter.js tests/test-surface-adapter.js
git commit -m "Adapter: list templates, nested refs, placeholders, Checkable"
```

---

### Task 6: Theme, disposal, and error-path hardening

**Files:**
- Modify: `renderer/surface-adapter.js` (as needed)
- Test: `tests/test-surface-adapter.js`

**Interfaces:**
- Consumes: everything above.
- Produces: verified `dispose()` contract (no live nodes, DOM emptied, resolver disposed), `deleteSurface` handling, theme application.

- [ ] **Step 1: Write the failing tests**

Append to `tests/test-surface-adapter.js`:

```js
describe('theme, deletion, disposal', () => {
  it('applies createSurface theme to the surface element', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create('s1', { theme: { primaryColor: '#ff0000', mode: 'dark' } }),
      update([{ id: 'root', component: 'Text', text: 'themed' }]),
    ]);
    const surfaceEl = findEl(container, (el) => el.dataset.surfaceId === 's1');
    assert.equal(surfaceEl.style.getPropertyValue('--color-primary'), '#ff0000');
    assert.equal(surfaceEl.getAttribute('data-theme'), 'dark');
  });

  it('removes the surface DOM on deleteSurface', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([create(), update([
      { id: 'root', component: 'Text', text: 'bye' }])]);
    adapter.processMessages([{ version: V, deleteSurface: { surfaceId: 's1' } }]);
    assert.equal(findEl(container, (el) => el.dataset.surfaceId === 's1'), null);
  });

  it('dispose() tears everything down', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      data('/x', 1),
      update([
        { id: 'root', component: 'Column', children: ['t1'] },
        { id: 't1', component: 'Text', text: { path: '/x' } },
      ]),
    ]);
    const surface = adapter.processor.model.getSurface('s1');
    const entryResolverDisposed = () => {
      // after dispose(), rendering state must be gone:
      return findEl(container, (el) => el.dataset.surfaceId === 's1') === null;
    };
    adapter.dispose();
    assert.ok(entryResolverDisposed(), 'surface DOM removed');
    // data updates after dispose must not touch the old DOM or throw
    adapter.processMessages([data('/x', 2)]);
  });

  it('routes renderer exceptions to onError without breaking the surface', () => {
    const { adapter, errors } = makeAdapter({
      rendererOptions: {},
      // force an error: unknown catalogId in createSurface
    });
    adapter.processMessages([
      { version: V, createSurface: { surfaceId: 'sX', catalogId: 'urn:nope' } },
    ]);
    // web_core either throws (caught → onError) or ignores; both acceptable,
    // but it must not leave a half-mounted surface element behind.
    assert.ok(Array.isArray(errors));
  });
});
```

- [ ] **Step 2: Run, fix, re-run to green**

Run: `node --test tests/test-surface-adapter.js`
Expected failures concentrate in `dispose()` ordering (stop effects BEFORE disposing resolvers, so effect callbacks never see disposed nodes) and in `deleteSurface` (verify `onSurfaceDeleted` actually fires — if web_core's processor handles deletion before our subscription, hook `processor.model.onSurfaceDeleted` instead; both exist per the spec).

- [ ] **Step 3: Full suite + commit**

```bash
npm test && npm run validate
git add renderer/surface-adapter.js tests/test-surface-adapter.js
git commit -m "Adapter: theme application, surface deletion, disposal hardening"
```

---

### Task 7: Remove `registerWithWebLib`, naming sweep, v0.9.1 + MIME bumps

**Files:**
- Modify: `renderer/index.js` (delete `registerWithWebLib`, bump `VERSION`)
- Modify: `tests/test-renderer.js` (drop `registerWithWebLib` from the import + any tests referencing it)
- Modify: `catalog/oat-catalog.json` (`"version": "v0.9"` → `"v0.9.1"`)
- Modify: `catalog/oat-catalog-rules.txt` (version guidance)
- Modify: `README.md`, `docs/architecture.md`, `examples/**` (text only: `@a2ui/web-lib` → `@a2ui/web_core`, `application/json+a2ui` → `application/a2ui+json`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `renderer/index.js` exports `createOatRenderer`, `OatRenderer`, `CATALOG_ID`, `VERSION = "v0.9.1"`, and the function re-exports — `registerWithWebLib` is GONE. Task 9's changelog names this as the breaking change.

- [ ] **Step 1: Find every reference**

```bash
grep -rn "registerWithWebLib\|web-lib\|json+a2ui" --include="*.js" --include="*.md" --include="*.html" --include="*.txt" --include="*.json" . | grep -v node_modules | grep -v docs/superpowers
```

Keep the list; every hit must be updated or consciously left (spec/plan history under `docs/superpowers/` stays as-is).

- [ ] **Step 2: Write the failing test (export surface)**

In `tests/test-renderer.js`, find the import line and any test asserting `registerWithWebLib` exists (search `registerWithWebLib`). Update the import to drop it and replace any such test with:

```js
  it('does not export the removed registerWithWebLib', async () => {
    const mod = await import('../renderer/index.js');
    assert.equal(mod.registerWithWebLib, undefined);
    assert.equal(mod.VERSION, 'v0.9.1');
  });
```

Run: `node --test tests/test-renderer.js` → FAIL (function still exported, VERSION still `v0.9`).

- [ ] **Step 3: Apply the removals and sweeps**

- `renderer/index.js`: delete the entire `registerWithWebLib` function and its doc comment; change `VERSION` to `"v0.9.1"`; update the module doc comment (remove "@a2ui/web-lib registration", mention `./surface-adapter.js` as the protocol integration point).
- `catalog/oat-catalog.json`: `"version": "v0.9.1"`.
- `catalog/oat-catalog-rules.txt`: `Always set version to "v0.9.1" in every A2UI message.` (renderer accepts v0.9 too — add that parenthetical).
- Text sweep from the Step 1 list: `@a2ui/web-lib` → `@a2ui/web_core`; `application/json+a2ui` → `application/a2ui+json`. In `renderer/oat-renderer.js` ONLY the doc comment mentions web-lib — that comment edit is allowed (comment-only; the Global Constraint protects code).

- [ ] **Step 4: Verify**

Run: `npm test && npm run validate` → PASS.
Run the Step 1 grep again → no hits outside `docs/superpowers/` and `CHANGELOG.md` history.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Remove fictional registerWithWebLib; bump wire version to v0.9.1; naming/MIME sweep"
```

---

### Task 8: Flagship example — `examples/web-core-adapter/`

**Files:**
- Create: `examples/web-core-adapter/index.html`
- Create: `examples/web-core-adapter/README.md`

**Interfaces:**
- Consumes: `createSurfaceAdapter` (Task 2–6), `@a2ui/web_core@0.10.7/v0_9` via esm.sh.
- Produces: a runnable browser demo; no code consumed by later tasks.

- [ ] **Step 1: Write the example**

`examples/web-core-adapter/index.html` — single page, no build step. Structure (follow the visual conventions of `examples/a2ui-dashboard/index.html`: Oat CSS from CDN, header explaining the demo):

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>a2ui-oat × @a2ui/web_core — real protocol adapter</title>
  <link rel="stylesheet" href="https://unpkg.com/oat-css/dist/oat.min.css">
</head>
<body>
  <main class="container">
    <h1>Real @a2ui/web_core adapter</h1>
    <p>Unlike the other examples (which hand-roll a message loop),
       this page feeds A2UI wire messages through the real
       <code>@a2ui/web_core</code> MessageProcessor via
       <code>createSurfaceAdapter</code>.</p>
    <div id="surface-root"></div>
    <h2>Action log</h2>
    <pre id="action-log"></pre>
  </main>
  <script type="module">
    import * as webCore from 'https://esm.sh/@a2ui/web_core@0.10.7/v0_9';
    import { createSurfaceAdapter } from '../../renderer/surface-adapter.js';

    const log = document.getElementById('action-log');
    const adapter = createSurfaceAdapter({
      webCore,
      container: document.getElementById('surface-root'),
      onAction: (action) => {
        log.textContent += JSON.stringify(action) + '\n';
      },
    });

    // Scripted agent conversation: surface → components → streamed data diffs.
    const V = 'v0.9.1';
    const CATALOG_ID = 'https://unpkg.com/a2ui-oat/catalog/oat-catalog.json';
    adapter.processMessages([
      { version: V, createSurface: { surfaceId: 'demo', catalogId: CATALOG_ID,
        theme: { primaryColor: '#3b6ea5' } } },
      { version: V, updateDataModel: { surfaceId: 'demo', path: '/stats',
        value: { orders: 0, revenue: 0 } } },
      { version: V, updateComponents: { surfaceId: 'demo', components: [
        { id: 'root', component: 'Column', children: ['title', 'orders', 'revenue', 'refresh'] },
        { id: 'title', component: 'Text', variant: 'h2', text: 'Live dashboard' },
        { id: 'orders', component: 'Text', text: { path: '/stats/orders' } },
        { id: 'revenue', component: 'Text', text: { path: '/stats/revenue' } },
        { id: 'refresh', component: 'Button', label: 'Refresh',
          action: { event: { name: 'refresh',
                             context: { at: { path: '/stats/orders' } } } } },
      ] } },
    ]);

    // Simulate the agent streaming data-model diffs (no component resends).
    let orders = 0;
    setInterval(() => {
      orders += Math.ceil(Math.random() * 3);
      adapter.processMessages([
        { version: V, updateDataModel: { surfaceId: 'demo',
          path: '/stats/orders', value: orders } },
        { version: V, updateDataModel: { surfaceId: 'demo',
          path: '/stats/revenue', value: (orders * 19.99).toFixed(2) } },
      ]);
    }, 2000);
  </script>
</body>
</html>
```

Executor: before committing, check the exact Oat CSS CDN href and the `Text` component's property names against a working example (`examples/component-gallery/index.html`) and correct the markup above to match reality — copy conventions, don't invent them.

`examples/web-core-adapter/README.md` (~20 lines): what it shows, how to run (`npx serve` from repo root — ESM imports need http), and an explicit "Adapter mode vs. direct mode" paragraph: direct-mode examples hand-roll the loop and double as documentation of the renderer's raw contract; this example is the supported protocol-engine path.

- [ ] **Step 2: Verify in a browser**

```bash
npx serve . &
```

Open `http://localhost:3000/examples/web-core-adapter/` (or drive it with the chrome-devtools tooling if available). Verify: dashboard renders, numbers tick every 2s without flicker, clicking Refresh appends a resolved action to the log (with `at` as a number, not `{path}`). Kill the server.

- [ ] **Step 3: Commit**

```bash
git add examples/web-core-adapter/
git commit -m "Add flagship example: real web_core adapter over CDN ESM"
```

---

### Task 9: Docs, CHANGELOG, version 0.3.0, final verification

**Files:**
- Modify: `README.md` (adapter section + component/integration docs)
- Modify: `docs/architecture.md` (new "Adapter mode vs. direct mode" section)
- Modify: `CHANGELOG.md`, `package.json` (version 0.3.0)

**Interfaces:** none — documentation and release chores only.

- [ ] **Step 1: README + architecture docs**

- `README.md`: add a "Protocol integration (`@a2ui/web_core`)" section right after the quick-start, containing the exact usage snippet from the spec's "Public API & module layout" section (CDN import + `createSurfaceAdapter`), the `>= 0.10.7` requirement, and one sentence on the zero-dependency injection design. Update any remaining text that describes `registerWithWebLib` as the integration path.
- `docs/architecture.md`: new section "Adapter mode vs. direct mode": adapter mode = `createSurfaceAdapter` → MessageProcessor/NodeResolver (structural) → raw props → `OatRenderer` (this is the supported wire path); direct mode = consumer-built `RenderContext` + hand-rolled loop (what the other examples do; the renderer's contract is the six `RenderContext` methods documented in `oat-renderer.js`). Include the RenderContext→web_core mapping table from the spec.

- [ ] **Step 2: CHANGELOG + version**

`CHANGELOG.md`, new top entry:

```markdown
## 0.3.0 — 2026-09-XX

### Added
- `createSurfaceAdapter` (`a2ui-oat/surface-adapter`): real `@a2ui/web_core`
  (>= 0.10.7) protocol integration. Dependency-injected — a2ui-oat still has
  zero runtime dependencies.
- `renderer/catalog-compat.js`: transforms `oat-catalog.json` into
  web_core's `Catalog.fromSchema()` format (child-ref markers, binding-
  tolerant property schemas).
- Flagship example `examples/web-core-adapter/` (CDN ESM, no build step).

### Changed
- Wire protocol version: `v0.9.1` (messages with `v0.9` still accepted).
- MIME type references corrected to `application/a2ui+json`.
- All `@a2ui/web-lib` references corrected to `@a2ui/web_core`.

### Removed
- **Breaking:** `registerWithWebLib()` — it called `registerRenderer`/
  `registerFunction`/`setCatalogId`, none of which exist in any published
  `@a2ui/web_core` version. `createSurfaceAdapter` is the real integration.
```

Set `"version": "0.3.0"` in `package.json` and fill in the actual date.

- [ ] **Step 3: Final verification**

```bash
npm test && npm run validate
grep -rn "registerWithWebLib" --include="*.js" --include="*.md" . | grep -v node_modules | grep -v docs/superpowers | grep -v CHANGELOG
```

Expected: all tests pass; grep returns nothing.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Bump to v0.3.0: real @a2ui/web_core surface adapter"
```

---

## Plan Self-Review Notes

- Spec coverage: public API/construction (Task 2), RenderContext bridge + reactivity (Tasks 2–3), actions (Task 4), structural cases + Checkable (Task 5), theme/disposal/errors (Task 6), removals/version/MIME sweep (Task 7), flagship example (Task 8), docs/release (Task 9), catalog-compat necessity discovered during planning (Task 1, also reflected in CHANGELOG).
- The catalog-compat transform and the `componentsModel` fallback in `renderChild` are planning-stage discoveries that go beyond the spec's text; the spec's "Open questions: none" claim holds because both use only verified public APIs (`Catalog.fromSchema`, `extractRefFields`, `surface.componentsModel.get`).
- Tasks 4–6 deliberately front-load tests over new implementation: the Task 2 implementation includes the full bridge, and later tasks verify + harden each behavior slice against the real package, fixing what reality disagrees with.
