# Oat Catalog Sync (Plan A: Tracks 2-4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new Oat components (FileUpload, TagInput), fix five confirmed rendering regressions against current Oat CSS, implement the previously-inert `checks`/Checkable validation mechanism, and add an MCP integration function — all without touching the A2UI protocol integration layer (that's Plan B, tracked separately).

**Architecture:** All changes are additive or corrective within the existing `catalog/oat-catalog.json` + `renderer/oat-renderer.js` + `renderer/functions/*.js` structure. No changes to `renderer/index.js`'s `VERSION` constant or the catalog's `"version"` field (those move with Plan B). Every existing render method keeps its current signature; new behavior is added via new methods and small, targeted edits to existing ones.

**Tech Stack:** Vanilla JS (ES modules), `node --test` (Node's built-in test runner), zero runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-02-a2ui-oat-modernization-design.md` (Tracks 2, 3, 4; Track 1 is out of scope for this plan)

## Global Constraints

- No changes to `catalog/oat-catalog.json`'s `"version"` field (stays `"v0.9"` in this plan) or `renderer/index.js`'s `VERSION` constant (stays `"v0.9"`).
- No changes to `renderer/index.js`'s `registerWithWebLib()` — it's fictional/broken but replacing it is Plan B's job.
- Every new catalog component/function must pass `npm run validate` (`scripts/validate-catalog.js`) and `npm test`.
- Match existing catalog type-vocabulary conventions exactly: bindable properties (regardless of underlying JS type) are typed `"DynamicString"`; non-bindable literals use `"string"`/`"boolean"`/`"array"`; component IDs use `"ComponentId"`; actions use `"Action"` (verified against `Table.rows`, `ChoicePicker.selections`, `CheckBox.value`/`.disabled` in `catalog/oat-catalog.json`).
- Package version bumps from 0.1.1 to 0.2.0 only in the final task, after all other tests pass.

---

### Task 1: Fix Badge rendering regression

**Files:**
- Modify: `catalog/oat-catalog.json` (Badge component's `variant` property, around the `components.Badge` entry)
- Modify: `renderer/oat-renderer.js:392-398` (`_renderBadge`)
- Modify: `tests/test-catalog.js` (no structural change needed — cross-reference tests are generic)
- Modify: `tests/test-renderer.js` (add assertions)

**Interfaces:**
- Consumes: `_resolve`, `_asBinding`, `_addClass`, `_bindValue` (existing `OatRenderer` helpers, unchanged signatures).
- Produces: `_renderBadge(c, ctx)` now emits `class="badge"` plus either a `data-variant` attribute or an `.outline` class, matching `oat/src/css/badge.css`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/test-renderer.js`, inside the `describe('component output correctness', ...)` block (after the existing `Table renders <table>` test, matching the file's existing style):

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/test-renderer.js`
Expected: FAIL — `el.className` is currently `''` (no `.badge` class is ever set; `_renderBadge` only sets `el.dataset.badge = ''`).

- [ ] **Step 3: Fix `_renderBadge`**

Replace the body of `_renderBadge` in `renderer/oat-renderer.js` (currently lines 392-398):

```js
  /** @returns {HTMLElement} */
  _renderBadge(c, ctx) {
    const el = document.createElement('span');
    el.className = 'badge';
    const variant = this._resolve(this._asBinding(c.variant), ctx);
    if (variant === 'outline') {
      this._addClass(el, 'outline');
    } else if (variant && variant !== 'default') {
      el.dataset.variant = variant;
    }
    this._bindValue(this._asBinding(c.text), ctx, (val) => { el.textContent = val ?? ''; });
    return el;
  }
```

- [ ] **Step 4: Fix the catalog's Badge variant enum**

In `catalog/oat-catalog.json`, find `components.Badge.properties.variant` and replace its `enum` array (currently `["default", "info", "success", "warning", "error"]`, which doesn't match Oat's real CSS vocabulary at all) with:

```json
"enum": ["default", "secondary", "success", "warning", "danger", "outline"]
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/test-renderer.js && node scripts/validate-catalog.js`
Expected: PASS. `validate-catalog.js` should show no new warnings for Badge.

- [ ] **Step 6: Commit**

```bash
git add catalog/oat-catalog.json renderer/oat-renderer.js tests/test-renderer.js
git commit -m "Fix Badge rendering to match current Oat CSS (class + data-variant)"
```

---

### Task 2: Fix Button rendering regression

**Files:**
- Modify: `renderer/oat-renderer.js:487-494` (`_renderButton`)
- Modify: `tests/test-renderer.js`

**Interfaces:**
- Consumes: `_resolve`, `_asBinding`, `_addClass`, `_renderSingleChild`, `_wireAction`.
- Produces: `_renderButton(c, ctx)` now splits `variant` into class-based (`outline`, `ghost`) vs. attribute-based (`secondary`, `danger`) styling; `primary`/`default` remain no-ops (Oat's base button style is already "primary"-colored). No catalog change — Button's existing enum (`["default","primary","secondary","danger","outline","ghost"]`) already matches Oat's real vocabulary.

- [ ] **Step 1: Write the failing tests**

Add to `tests/test-renderer.js`'s `describe('component output correctness', ...)` block:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/test-renderer.js`
Expected: FAIL — current `_renderButton` adds `variant` as a bare class for every variant, so `secondary`/`danger` incorrectly get `className: 'secondary'`/`'danger'` instead of `data-variant`.

- [ ] **Step 3: Fix `_renderButton`**

Replace the body of `_renderButton` (currently lines 487-494):

```js
  /** @returns {HTMLElement} */
  _renderButton(c, ctx) {
    const el = document.createElement('button');
    const variant = this._resolve(this._asBinding(c.variant), ctx);
    if (variant === 'outline' || variant === 'ghost') {
      this._addClass(el, variant);
    } else if (variant === 'secondary' || variant === 'danger') {
      el.dataset.variant = variant;
    }
    if (c.disabled) el.disabled = true;
    this._renderSingleChild(el, c.child, ctx);
    this._wireAction(el, 'click', c.action, ctx);
    return el;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/test-renderer.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add renderer/oat-renderer.js tests/test-renderer.js
git commit -m "Fix Button rendering to match current Oat CSS (class vs data-variant split)"
```

---

### Task 3: Fix Skeleton rendering regression

**Files:**
- Modify: `catalog/oat-catalog.json` (Skeleton's `variant` enum)
- Modify: `renderer/oat-renderer.js:433-439` (`_renderSkeleton`)
- Modify: `catalog/oat-catalog-rules.txt:83` and `:697-698`
- Modify: `tests/test-renderer.js`

**Interfaces:**
- Consumes: `_resolve`, `_asBinding`, `_addClass` (unchanged).
- Produces: `_renderSkeleton` now sets `role="status"` (missing today, so `oat/src/css/skeleton.css`'s `[role="status"].skeleton` selector never matched); variant enum changes from `["text","circle","rect"]` (matches no real Oat class) to `["box","line"]` (matches `.box`/`.line` in `skeleton.css`).

- [ ] **Step 1: Write the failing tests**

Add to `tests/test-renderer.js`'s `describe('component output correctness', ...)` block:

```js
  it('Skeleton sets role="status"', () => {
    const el = renderer.renderComponent(
      { id: 'sk1', component: 'Skeleton', variant: 'box' },
      makeContext()
    );
    assert.equal(el.attributes.role, 'status');
    assert.equal(el.className, 'skeleton box');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/test-renderer.js`
Expected: FAIL — `el.attributes.role` is `undefined`.

- [ ] **Step 3: Fix `_renderSkeleton`**

Replace the body of `_renderSkeleton` (currently lines 433-439):

```js
  /** @returns {HTMLElement} */
  _renderSkeleton(c, ctx) {
    const el = document.createElement('div');
    el.className = 'skeleton';
    el.setAttribute('role', 'status');
    if (c.width) el.style.width = c.width;
    if (c.height) el.style.height = c.height;
    this._addClass(el, this._resolve(this._asBinding(c.variant), ctx));
    return el;
  }
```

- [ ] **Step 4: Fix the catalog enum**

In `catalog/oat-catalog.json`, `components.Skeleton.properties.variant.enum`: replace `["text", "circle", "rect"]` with `["box", "line"]`.

- [ ] **Step 5: Fix the two agent-facing doc references**

In `catalog/oat-catalog-rules.txt`:
- Line 83: change `optional: width (string), height (string), variant ("text"|"circle"|"rect")` to `optional: width (string), height (string), variant ("box"|"line")`.
- Lines 697-698 (Pattern 6 example): change `"variant": "text"` to `"variant": "line"` and `"variant": "rect"` to `"variant": "box"`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test tests/test-renderer.js && node scripts/validate-catalog.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add catalog/oat-catalog.json catalog/oat-catalog-rules.txt renderer/oat-renderer.js tests/test-renderer.js
git commit -m "Fix Skeleton rendering: add role=status, correct variant enum to box/line"
```

---

### Task 4: Fix Tooltip rendering regression

**Files:**
- Modify: `catalog/oat-catalog.json` (Tooltip component's properties)
- Modify: `renderer/oat-renderer.js:825-830` (`_renderTooltip`)
- Modify: `catalog/oat-catalog-rules.txt:153`
- Modify: `tests/test-renderer.js`

**Interfaces:**
- Consumes: `_resolve`, `_bindValue`, `_renderSingleChild` (unchanged).
- Produces: `_renderTooltip` now emits `data-tooltip-placement` (matches `oat/src/css/tooltip.css`) instead of `data-tooltip-position`. Catalog property renamed `position` → `placement`, with `position` still read as a fallback for one release.

- [ ] **Step 1: Write the failing tests**

Add to `tests/test-renderer.js`'s `describe('component output correctness', ...)` block:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/test-renderer.js`
Expected: FAIL — current code sets `el.dataset.tooltipPosition`, never `el.dataset.tooltipPlacement`.

- [ ] **Step 3: Fix `_renderTooltip`**

Find the current implementation at `renderer/oat-renderer.js:825-830`:

```js
  _renderTooltip(c, ctx) {
    const el = document.createElement('span');
    el.dataset.tooltip = this._resolve(c.text, ctx) ?? '';
    if (c.position) el.dataset.tooltipPosition = c.position;
```

Replace the `if (c.position)` line with:

```js
    const placement = c.placement ?? c.position;
    if (placement) el.dataset.tooltipPlacement = placement;
```

(Leave the rest of the method, including `_renderSingleChild(el, c.child, ctx); return el;`, unchanged.)

- [ ] **Step 4: Rename the catalog property**

In `catalog/oat-catalog.json`, `components.Tooltip.properties`: rename the `position` key to `placement` (keep its `enum`/`description` as-is, just update the description to say "Supports the deprecated `position` property name as a fallback.").

- [ ] **Step 5: Update the agent-facing doc**

In `catalog/oat-catalog-rules.txt:153`, change `optional: position ("top"|"bottom"|"left"|"right")` to `optional: placement ("top"|"bottom"|"left"|"right") -- "position" is accepted as a deprecated alias`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test tests/test-renderer.js && node scripts/validate-catalog.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add catalog/oat-catalog.json catalog/oat-catalog-rules.txt renderer/oat-renderer.js tests/test-renderer.js
git commit -m "Fix Tooltip to emit data-tooltip-placement, rename position to placement"
```

---

### Task 5: Small Oat drift fixes (Tabs anchor, Sidebar width, Breadcrumb unstyled)

**Files:**
- Modify: `catalog/oat-catalog.json` (Tabs, Sidebar components)
- Modify: `renderer/oat-renderer.js` (`_renderTabs` at line 768, `_renderSidebar` at line 337, `_renderBreadcrumb` at line 1028)
- Modify: `tests/test-renderer.js`

**Interfaces:**
- Consumes: existing helpers, unchanged.
- Produces: `Tabs` gains optional `anchorKey` property → `data-anchor` attribute (URL deep-linking, per `oat/src/js/tabs.js`). `Sidebar` gains optional `width` property → `--sidebar-width` CSS custom property override. `Breadcrumb`'s `<ol>` and `<a>` elements get Oat's `.unstyled` helper class so they render as a breadcrumb trail instead of a bulleted list of blue links.

- [ ] **Step 1: Write the failing tests**

Add to `tests/test-renderer.js`'s `describe('component output correctness', ...)` block:

```js
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
```

- [ ] **Step 2: Extend the MiniElement DOM shim for `style.setProperty`/`getPropertyValue`**

`tests/test-renderer.js`'s `MiniElement.style` is currently a plain `{}` object (`this.style = {};`). Change it to a minimal CSS-custom-property-capable object by replacing `this.style = {};` in the `MiniElement` constructor with:

```js
    this.style = {
      _props: {},
      setProperty(name, value) { this._props[name] = value; },
      getPropertyValue(name) { return this._props[name] ?? ''; },
    };
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/test-renderer.js`
Expected: FAIL — none of `anchorKey`, `width`, or `.unstyled` are implemented yet.

- [ ] **Step 4: Implement the three fixes**

In `renderer/oat-renderer.js`, `_renderTabs` (currently starting at line 768), add after `const el = document.createElement('ot-tabs');`:

```js
    if (c.anchorKey) el.dataset.anchor = c.anchorKey;
```

`_renderSidebar` (currently lines 337-346), add after `wrapper.dataset.sidebarLayout = '';`:

```js
    if (c.width) wrapper.style.setProperty('--sidebar-width', c.width);
```

`_renderBreadcrumb` (currently lines 1028-1050): add `ol.className = 'unstyled';` right after `const ol = document.createElement('ol');`, and inside the `if (item.action)` branch, add `a.className = 'unstyled';` right after `const a = document.createElement('a');`.

- [ ] **Step 5: Add catalog properties**

In `catalog/oat-catalog.json`:
- `components.Tabs.properties`: add
  ```json
  "anchorKey": {
    "type": "string",
    "description": "When set, deep-links the active tab's id into the URL hash under this key."
  }
  ```
- `components.Sidebar.properties`: add
  ```json
  "width": {
    "type": "string",
    "description": "CSS length value overriding the sidebar's default width (--sidebar-width)."
  }
  ```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test tests/test-renderer.js && node scripts/validate-catalog.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add catalog/oat-catalog.json renderer/oat-renderer.js tests/test-renderer.js
git commit -m "Add Tabs anchorKey, Sidebar width, and Breadcrumb unstyled-link Oat sync"
```

---

### Task 6: Implement Checkable/`checks` core helper, wire into TextField/CheckBox/Switch

**Context:** The catalog already declares a `checks` property on `Button` (array of `{functionCall: {call, args}, message?}`, per `catalog/oat-catalog-rules.txt` Pattern 5), but **no renderer code has ever read `c.checks`** — it's completely inert today, for Button and every other component. This task implements the mechanism and wires it into the three most common field-validation targets; Task 7 extends it to the rest.

**Files:**
- Modify: `renderer/oat-renderer.js` (new helper methods; `_renderTextField` at line 497, `_renderToggle` at line 535)
- Modify: `tests/test-renderer.js` (add `removeAttribute` to `MiniElement`; add a richer test context; add tests)

**Interfaces:**
- Produces:
  - `_renderChecks(controlEl, errorContainerEl, checks, ctx)` — new `OatRenderer` method. `controlEl`: the input/control element to mark `aria-invalid` on. `errorContainerEl`: an element to append a `.error` message span into, or `null` to skip message display (used by Task 7's non-field components). `checks`: raw `c.checks` array (each `{functionCall: {call, args}, message?}`) or `undefined`. `ctx`: `RenderContext`.
  - `_evaluateCheck(check, ctx)` — new private helper, returns `boolean`.
  - `_extractCheckPaths(checks)` — new private helper, returns `string[]` of data-model paths referenced in any check's `args`.

- [ ] **Step 1: Extend the MiniElement DOM shim**

In `tests/test-renderer.js`, add a `removeAttribute` method to `MiniElement` right after the existing `getAttribute` method:

```js
  removeAttribute(k) { delete this.attributes[k]; }
```

- [ ] **Step 2: Add a reactive test context helper**

The existing `makeContext()` in `tests/test-renderer.js` has a no-op `subscribe: () => () => {}`, which can't test reactivity. Add a new factory function right after `makeContext`, for tests that need to simulate data-model changes and registered functions:

```js
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
```

- [ ] **Step 3: Write the failing tests**

Add a new `describe` block to `tests/test-renderer.js`, after `describe('component output correctness', ...)`:

```js
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
    const ctx = makeReactiveContext({ agree: false }, { required: requiredFn });
    const wrapper = renderer.renderComponent(
      {
        id: 'cb1', component: 'CheckBox', label: 'Agree', value: { path: '/agree' },
        checks: [{ functionCall: { call: 'required', args: { value: { path: '/agree' } } }, message: 'You must agree' }],
      },
      ctx
    );
    const input = wrapper.children.find((c) => c.tagName === 'INPUT');
    assert.equal(input.attributes['aria-invalid'], 'true');
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `node --test tests/test-renderer.js`
Expected: FAIL — `checks` is never read, so `aria-invalid` is never set and no `.error` element exists.

- [ ] **Step 5: Implement the Checkable helpers**

Add these three methods to `OatRenderer` in `renderer/oat-renderer.js`, right after the existing `_wireTwoWay` method (around line 281):

```js
  /**
   * Evaluate one CheckRule-style check: { functionCall: { call, args }, message? }.
   *
   * @param {Object} check
   * @param {RenderContext} ctx
   * @returns {boolean}
   */
  _evaluateCheck(check, ctx) {
    const fc = check?.functionCall;
    if (!fc) return true;
    const fn = ctx.getRegisteredFunction(fc.call);
    if (!fn) return true;
    const args = {};
    for (const [k, v] of Object.entries(fc.args || {})) {
      args[k] = this._resolve(this._asBinding(v), ctx);
    }
    return Boolean(fn(args, { resolveDynamic: (v) => this._resolve(this._asBinding(v), ctx) }));
  }

  /**
   * Collect every data-model path referenced in an array of checks, so callers
   * can subscribe to them and re-evaluate on change.
   *
   * @param {Array} checks
   * @returns {string[]}
   */
  _extractCheckPaths(checks) {
    const paths = [];
    for (const check of checks || []) {
      const args = check?.functionCall?.args || {};
      for (const v of Object.values(args)) {
        const bound = this._asBinding(v);
        if (this._isBound(bound)) paths.push(bound.path);
      }
    }
    return paths;
  }

  /**
   * Wire a Checkable component's `checks` array to `aria-invalid` (and,
   * optionally, a visible `.error` message) on `controlEl`, re-evaluating
   * whenever a referenced data-model path changes.
   *
   * @param {HTMLElement} controlEl - Element to mark aria-invalid.
   * @param {HTMLElement|null} errorContainerEl - Wrapper to append a `.error`
   *   message element into, or null to skip message display.
   * @param {Array|undefined} checks
   * @param {RenderContext} ctx
   */
  _renderChecks(controlEl, errorContainerEl, checks, ctx) {
    if (!Array.isArray(checks) || checks.length === 0) return;

    let errorEl = null;
    if (errorContainerEl) {
      errorEl = document.createElement('small');
      errorEl.className = 'error';
      errorContainerEl.appendChild(errorEl);
    }

    const evaluate = () => {
      let failedMessage = null;
      for (const check of checks) {
        if (!this._evaluateCheck(check, ctx)) {
          failedMessage = check.message || 'This field is invalid.';
          break;
        }
      }
      if (failedMessage !== null) {
        controlEl.setAttribute('aria-invalid', 'true');
      } else {
        controlEl.removeAttribute('aria-invalid');
      }
      if (errorEl) errorEl.textContent = failedMessage || '';
    };

    evaluate();
    for (const path of this._extractCheckPaths(checks)) {
      ctx.subscribe(path, evaluate);
    }
  }
```

- [ ] **Step 6: Wire into `_renderTextField`**

In `_renderTextField` (currently lines 497-523), add `wrapper.dataset.field = '';` is already there; before the final `return wrapper;`, add:

```js
    this._renderChecks(el, wrapper, c.checks, ctx);
```

- [ ] **Step 7: Wire into `_renderToggle` (CheckBox/Switch)**

In `_renderToggle` (currently lines 535-548), add `wrapper.dataset.field = '';` right after `const wrapper = document.createElement('label');`, and before the final `return wrapper;`, add:

```js
    this._renderChecks(el, wrapper, c.checks, ctx);
```

- [ ] **Step 8: Add `checks` to the catalog's Checkable component definitions**

In `catalog/oat-catalog.json`, add a `checks` property (copy the existing shape from `components.Button.properties.checks`) to `components.TextField.properties`, `components.CheckBox.properties`, and `components.Switch.properties`:

```json
"checks": {
  "type": "array",
  "description": "Validation checks to run against this field's value. On failure, sets aria-invalid and shows the first failing check's message.",
  "items": {
    "type": "object"
  }
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `node --test tests/test-renderer.js && node scripts/validate-catalog.js`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add catalog/oat-catalog.json renderer/oat-renderer.js tests/test-renderer.js
git commit -m "Implement Checkable/checks validation, wire into TextField/CheckBox/Switch"
```

---

### Task 7: Extend Checkable to Button (gating), DateTimeInput, ChoicePicker, Autocomplete

**Files:**
- Modify: `renderer/oat-renderer.js` (`_renderButton`, `_renderDateTimeInput` at line 574, `_renderChoicePicker` at line 591, `_renderAutocomplete` at line 661)
- Modify: `tests/test-renderer.js`

**Interfaces:**
- Consumes: `_renderChecks`, `_evaluateCheck`, `_extractCheckPaths` from Task 6, unchanged.
- Produces: Button's `checks` now actually gates the action (disables the button while any check fails — previously completely inert). DateTimeInput/ChoicePicker/Autocomplete get `aria-invalid` support (no message display, since these components don't have a `[data-field]` wrapper and adding one would change their existing DOM shape).

- [ ] **Step 1: Write the failing tests**

Add to `tests/test-renderer.js`'s `describe('Checkable / checks validation', ...)` block:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/test-renderer.js`
Expected: FAIL — `btn.disabled` stays `undefined`/falsy regardless of checks; DateTimeInput never sets `aria-invalid`.

- [ ] **Step 3: Wire Button gating**

In `_renderButton` (as fixed in Task 2), replace `if (c.disabled) el.disabled = true;` with:

```js
    if (c.disabled) el.disabled = true;
    if (Array.isArray(c.checks) && c.checks.length > 0) {
      const evaluate = () => {
        const allPass = c.checks.every((check) => this._evaluateCheck(check, ctx));
        el.disabled = !allPass || Boolean(c.disabled);
      };
      evaluate();
      for (const path of this._extractCheckPaths(c.checks)) {
        ctx.subscribe(path, evaluate);
      }
    }
```

- [ ] **Step 4: Wire DateTimeInput, ChoicePicker, Autocomplete**

In `_renderDateTimeInput` (lines 574-588), before `return el;`, add:

```js
    this._renderChecks(el, null, c.checks, ctx);
```

In `_renderChoicePicker` (lines 591-655), there are two branches with two `return` statements. In the `<select>` branch, immediately before `return el;` (currently line 619), add:

```js
      this._renderChecks(el, null, c.checks, ctx);
```

In the radio-group branch, immediately before `return fieldset;` (currently line 655), add:

```js
    this._renderChecks(fieldset, null, c.checks, ctx);
```

In `_renderAutocomplete` (lines 661 onward), before `return wrapper;`, add:

```js
    this._renderChecks(el, null, c.checks, ctx);
```

(Note: `el` here is the inner `<input>`, not `wrapper` — matches the existing pattern in this method where `el` is the control being wired.)

- [ ] **Step 5: Add `checks` to the three catalog entries**

In `catalog/oat-catalog.json`, add the same `checks` property block from Task 6 Step 8 to `components.DateTimeInput.properties`, `components.ChoicePicker.properties`, and `components.Autocomplete.properties`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test tests/test-renderer.js && node scripts/validate-catalog.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add catalog/oat-catalog.json renderer/oat-renderer.js tests/test-renderer.js
git commit -m "Wire Checkable/checks into Button (gating), DateTimeInput, ChoicePicker, Autocomplete"
```

---

### Task 8: Add FileUpload component

**Files:**
- Modify: `catalog/oat-catalog.json` (new `FileUpload` component entry)
- Modify: `renderer/oat-renderer.js` (register + new `_renderFileUpload` method)
- Modify: `tests/test-catalog.js`, `tests/test-renderer.js`
- Modify: `catalog/oat-catalog-rules.txt` (component list + property docs)

**Interfaces:**
- Produces: `FileUpload` component mapping to Oat's `<ot-upload>` (`oat/src/js/upload.js`). Properties: `accept` (string), `multiple` (boolean), `disabled` (boolean), `hint` (string), `files` (`DynamicString`-typed per catalog convention, actually an array of `{name, size, type}` objects, two-way bound), `action` (`Action`, fires on file-selection change), `checks` (array, same Checkable mechanism as Task 6/7 — no message display, matching DateTimeInput's pattern).

- [ ] **Step 1: Write the failing tests**

Add to `tests/test-renderer.js`. First, add `'FileUpload': {}` to the `overrides` object in `makeMinimalComponent` (in the `Table:`/`Pagination:` alphabetical neighborhood), and add `'FileUpload'` to the `allComponents` array in the `describe('renderer has all 37 component types registered', ...)` block. Leave that describe's title string as-is for now (it's just a label, not an assertion) — Task 9 will update it to `'renders all 39 component types'` once `TagInput` is also added.

Then add to `describe('component output correctness', ...)`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/test-renderer.js`
Expected: FAIL — `FileUpload` isn't registered, `renderComponent` returns the "Unknown component" fallback `<div>`.

- [ ] **Step 3: Implement `_renderFileUpload`**

Register it in `_registerAll()` (add to the "Interactive" section, after `this.renderers.set('Autocomplete', ...)` around line 107):

```js
    this.renderers.set('FileUpload', (c, ctx) => this._renderFileUpload(c, ctx));
```

Add the method (place it after `_renderAutocomplete`'s closing brace):

```js
  /** @returns {HTMLElement} */
  _renderFileUpload(c, ctx) {
    const el = document.createElement('ot-upload');

    const input = document.createElement('input');
    input.type = 'file';
    if (c.accept) input.accept = c.accept;
    if (c.multiple) input.multiple = true;
    input.hidden = true;
    if (this._resolve(this._asBinding(c.disabled), ctx)) input.disabled = true;

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Choose files';

    const out = document.createElement('div');
    out.setAttribute('data-files', '');
    const hint = document.createElement('small');
    hint.setAttribute('data-hint', '');
    hint.textContent = c.hint || 'Drop files here or click to choose';
    out.appendChild(hint);

    el.append(input, button, out);

    const filesBinding = this._asBinding(c.files);
    input.addEventListener('change', () => {
      const files = [...input.files].map((f) => ({ name: f.name, size: f.size, type: f.type }));
      if (this._isBound(filesBinding)) {
        ctx.setDataModel(filesBinding.path, files);
      }
    });
    this._wireAction(input, 'change', c.action, ctx);
    this._renderChecks(input, null, c.checks, ctx);

    return el;
  }
```

- [ ] **Step 4: Add the catalog entry**

In `catalog/oat-catalog.json`, add to `components` (alphabetically near `Dropdown`/`List`, or wherever fits the file's existing ordering — check current ordering before inserting):

```json
"FileUpload": {
  "description": "A file picker with drag-and-drop support, rendered as an ot-upload web component wrapping a native file input.",
  "htmlElement": "ot-upload",
  "properties": {
    "accept": {
      "type": "string",
      "description": "Comma-separated list of accepted file types (MIME types or extensions)."
    },
    "multiple": {
      "type": "boolean",
      "description": "Whether multiple files can be selected."
    },
    "disabled": {
      "type": "boolean",
      "description": "Whether the upload control is disabled."
    },
    "hint": {
      "type": "string",
      "description": "Hint text shown when no files are selected."
    },
    "files": {
      "type": "DynamicString",
      "description": "Selected files, written as an array of {name, size, type} objects. Two-way bound to the data model."
    },
    "action": {
      "type": "Action",
      "description": "Action to execute when the file selection changes."
    },
    "checks": {
      "type": "array",
      "description": "Validation checks to run against the selected files. On failure, sets aria-invalid on the file input.",
      "items": {
        "type": "object"
      }
    }
  },
  "requiredProperties": []
}
```

- [ ] **Step 5: Update `tests/test-catalog.js` component count**

Change `assert.equal(componentNames.length, 37);` to `38` (Task 9 will bump it to `39`).

- [ ] **Step 6: Update the agent-facing rules doc**

In `catalog/oat-catalog-rules.txt`, add a `FileUpload` entry alongside the other Interactive components (near the `Autocomplete` entry):

```
  FileUpload
    optional: accept (string), multiple (boolean), disabled (boolean), hint (string), files (data binding, array of {name, size, type}), action (action object), checks (array of check objects)
```

Also add `FileUpload` to the component-count summary line (line 17's `Interactive` count, if one exists — check the file's header summary and increment accordingly).

- [ ] **Step 7: Run tests to verify they pass**

Run: `node --test tests/test-catalog.js tests/test-renderer.js && node scripts/validate-catalog.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add catalog/oat-catalog.json catalog/oat-catalog-rules.txt renderer/oat-renderer.js tests/test-catalog.js tests/test-renderer.js
git commit -m "Add FileUpload component (ot-upload)"
```

---

### Task 9: Add TagInput component

**Files:**
- Modify: `catalog/oat-catalog.json` (new `TagInput` component entry)
- Modify: `renderer/oat-renderer.js` (register + new `_renderTagInput` method)
- Modify: `tests/test-catalog.js`, `tests/test-renderer.js`
- Modify: `catalog/oat-catalog-rules.txt`

**Interfaces:**
- Produces: `TagInput` component mapping to Oat's `<ot-taginput>` (`oat/src/js/taginput.js`). Properties: `value` (`DynamicString`-typed, array of tags, two-way bound), `placeholder` (string), `disabled` (boolean), `suggestions` (`DynamicString`-typed, array of strings), `checks` (array, aria-invalid only, no message — same pattern as FileUpload).

- [ ] **Step 1: Write the failing tests**

Add `'TagInput': {}` to `makeMinimalComponent`'s `overrides`, add `'TagInput'` to `allComponents`, and change the describe title to `'renders all 39 component types'`.

Add to `describe('component output correctness', ...)`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/test-renderer.js`
Expected: FAIL — `TagInput` isn't registered yet.

- [ ] **Step 3: Implement `_renderTagInput`**

Register it in `_registerAll()`, right after the `FileUpload` line added in Task 8:

```js
    this.renderers.set('TagInput', (c, ctx) => this._renderTagInput(c, ctx));
```

Add the method after `_renderFileUpload`:

```js
  /** @returns {HTMLElement} */
  _renderTagInput(c, ctx) {
    const el = document.createElement('ot-taginput');

    const suggestions = this._resolve(this._asBinding(c.suggestions), ctx);
    if (Array.isArray(suggestions) && suggestions.length > 0) {
      const listId = `taginput-list-${c.id || Math.random().toString(36).slice(2, 8)}`;
      const datalist = document.createElement('datalist');
      datalist.id = listId;
      for (const s of suggestions) {
        const option = document.createElement('option');
        option.value = s;
        datalist.appendChild(option);
      }
      el.appendChild(datalist);
    }

    const input = document.createElement('input');
    if (c.placeholder) input.placeholder = c.placeholder;
    el.appendChild(input);

    const initialValue = this._resolve(this._asBinding(c.value), ctx);
    if (Array.isArray(initialValue) && initialValue.length > 0) {
      el.setAttribute('value', initialValue.join(','));
    }
    if (this._resolve(this._asBinding(c.disabled), ctx)) el.setAttribute('disabled', '');

    this._wireTwoWay(el, this._asBinding(c.value), 'input', (e) => e.value, ctx);
    this._renderChecks(el, null, c.checks, ctx);

    return el;
  }
```

- [ ] **Step 4: Add the catalog entry**

In `catalog/oat-catalog.json`, add to `components`:

```json
"TagInput": {
  "description": "A tag/chip input for entering multiple short values, rendered as an ot-taginput web component with optional autocomplete.",
  "htmlElement": "ot-taginput",
  "properties": {
    "value": {
      "type": "DynamicString",
      "description": "Current array of tags. Two-way bound to the data model."
    },
    "placeholder": {
      "type": "string",
      "description": "Placeholder text for the tag entry input."
    },
    "disabled": {
      "type": "boolean",
      "description": "Whether the tag input is disabled."
    },
    "suggestions": {
      "type": "DynamicString",
      "description": "Array of suggested tag values shown via autocomplete."
    },
    "checks": {
      "type": "array",
      "description": "Validation checks to run against the current tags. On failure, sets aria-invalid.",
      "items": {
        "type": "object"
      }
    }
  },
  "requiredProperties": []
}
```

- [ ] **Step 5: Update `tests/test-catalog.js` component count**

Change `assert.equal(componentNames.length, 38);` (from Task 8) to `39`.

- [ ] **Step 6: Update the agent-facing rules doc**

In `catalog/oat-catalog-rules.txt`, add a `TagInput` entry next to `FileUpload`:

```
  TagInput
    optional: value (data binding, array of tag strings), placeholder (string), disabled (boolean), suggestions (data binding, array of strings), checks (array of check objects)
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `node --test tests/test-catalog.js tests/test-renderer.js && node scripts/validate-catalog.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add catalog/oat-catalog.json catalog/oat-catalog-rules.txt renderer/oat-renderer.js tests/test-catalog.js tests/test-renderer.js
git commit -m "Add TagInput component (ot-taginput)"
```

---

### Task 10: Add `callMcpTool` registered function

**Files:**
- Create: `renderer/functions/callMcpTool.js`
- Create: `catalog/functions/callMcpTool.json`
- Modify: `catalog/oat-catalog.json` (`functions` map)
- Modify: `renderer/index.js` (import, register, re-export)
- Modify: `tests/test-functions.js`, `tests/test-catalog.js`, `tests/test-renderer.js`

**Interfaces:**
- Produces: `callMcpTool(args, context)` where `args = {name: string, arguments?: object}` and `context.mcpClient` is either an object with a `callTool({name, arguments})` method, or a zero-arg function returning one. Returns a `Promise` resolving to the MCP tool's result. Throws if no client is available. Deliberately simpler than the reference `@a2ui/web_core` TS implementation (`catalogs/mcp/v0_9/src/functions/callMcpTool.ts`) — no `AbortSignal`/progress-heartbeat support, since none of a2ui-oat's other async functions (`fetchPage`, `subscribeSSE`, etc.) support cancellation either; adding it here alone would be inconsistent, not more correct.

- [ ] **Step 1: Write the failing tests**

Add to `tests/test-functions.js`, with the import `import { callMcpTool } from '../renderer/functions/callMcpTool.js';` added near the top alongside the other function imports:

```js
describe('callMcpTool', () => {
  it('calls client.callTool with name and arguments', async () => {
    let called;
    const client = { callTool: async (params) => { called = params; return { content: [{ type: 'text', text: 'ok' }] }; } };
    const result = await callMcpTool({ name: 'search', arguments: { q: 'test' } }, { mcpClient: client });
    assert.deepEqual(called, { name: 'search', arguments: { q: 'test' } });
    assert.deepEqual(result, { content: [{ type: 'text', text: 'ok' }] });
  });

  it('defaults arguments to an empty object', async () => {
    let called;
    const client = { callTool: async (params) => { called = params; return {}; } };
    await callMcpTool({ name: 'ping' }, { mcpClient: client });
    assert.deepEqual(called, { name: 'ping', arguments: {} });
  });

  it('supports a client getter function', async () => {
    let called;
    const client = { callTool: async (params) => { called = params; return {}; } };
    await callMcpTool({ name: 'ping' }, { mcpClient: () => client });
    assert.deepEqual(called, { name: 'ping', arguments: {} });
  });

  it('throws when no client is available', async () => {
    await assert.rejects(() => callMcpTool({ name: 'ping' }, {}), /no MCP client/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/test-functions.js`
Expected: FAIL — `renderer/functions/callMcpTool.js` doesn't exist yet (import error).

- [ ] **Step 3: Implement `renderer/functions/callMcpTool.js`**

```js
/**
 * callMcpTool -- Executes a tool on a connected Model Context Protocol (MCP) server.
 *
 * @param {object} args
 * @param {string} args.name         - The name of the MCP tool to execute.
 * @param {object} [args.arguments]  - Arguments to pass to the MCP tool.
 * @param {object} context
 * @param {object|function(): object} [context.mcpClient] - An MCP Client instance
 *   (exposing `callTool({name, arguments})`), or a getter function returning one.
 * @returns {Promise<*>} The MCP tool's result.
 */
export async function callMcpTool(args, context) {
  const client = typeof context.mcpClient === 'function' ? context.mcpClient() : context.mcpClient;
  if (!client) {
    throw new Error('callMcpTool: no MCP client is available on the renderer context.');
  }
  return client.callTool({ name: args.name, arguments: args.arguments ?? {} });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/test-functions.js`
Expected: PASS.

- [ ] **Step 5: Add the catalog function schema**

Create `catalog/functions/callMcpTool.json`:

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "name": "callMcpTool",
  "description": "Executes a tool on a connected Model Context Protocol (MCP) server and returns its result.",
  "parameters": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "The name of the MCP tool to execute."
      },
      "arguments": {
        "type": "object",
        "description": "Arguments to pass to the MCP tool."
      }
    },
    "required": ["name"],
    "additionalProperties": false
  }
}
```

- [ ] **Step 6: Add the catalog function entry**

In `catalog/oat-catalog.json`'s `functions` map, add:

```json
"callMcpTool": {
  "description": "Executes a tool on a connected Model Context Protocol (MCP) server and returns its result. Requires an MCP client to be supplied via the renderer context.",
  "parameters": {
    "name": {
      "type": "string",
      "description": "The name of the MCP tool to execute."
    },
    "arguments": {
      "type": "object",
      "description": "Arguments to pass to the MCP tool."
    }
  },
  "requiredParameters": ["name"]
}
```

- [ ] **Step 7: Wire it into `renderer/index.js`**

Add the import (alphabetically near the other function imports):

```js
import { callMcpTool } from "./functions/callMcpTool.js";
```

Add `callMcpTool,` to the `functions` object literal inside `createOatRenderer()`, and to the final `export { ... }` re-export list.

- [ ] **Step 8: Update test count assertions**

In `tests/test-renderer.js`, change both occurrences of `assert.equal(Object.keys(result.functions).length, 21);` (in the `createOatRenderer` and `registerWithWebLib` describe blocks) to `22`.

In `tests/test-catalog.js`, change `assert.equal(functionNames.length, 21);` to `22`.

- [ ] **Step 9: Run the full test suite and validator**

Run: `npm test && npm run validate`
Expected: PASS, with no cross-reference warnings for `callMcpTool` (the schema/implementation cross-reference tests in `test-catalog.js` will automatically pick it up).

- [ ] **Step 10: Commit**

```bash
git add renderer/functions/callMcpTool.js catalog/functions/callMcpTool.json catalog/oat-catalog.json renderer/index.js tests/test-functions.js tests/test-catalog.js tests/test-renderer.js
git commit -m "Add callMcpTool registered function for MCP tool invocation"
```

---

### Task 11: Add MCP static-template + data-diff example

**Files:**
- Create: `examples/mcp-data-diff/index.html`
- Create: `examples/mcp-data-diff/agent-template.json`
- Create: `examples/mcp-data-diff/mock-mcp-server.js`
- Create: `examples/mcp-data-diff/README.md`

**Interfaces:**
- Consumes: `createOatRenderer` from `renderer/index.js`, `callMcpTool` (registered automatically as part of the function set).
- Produces: a runnable, self-contained example demonstrating the pattern from Track 4: a static A2UI template (a `createSurface`-shaped JSON payload with data bindings, no literal values) is applied once, and subsequent "tool calls" only send `updateDataModel`-shaped diffs, re-rendering just the bound values rather than the whole surface.

- [ ] **Step 1: Look at an existing example for structure**

Read `examples/function-demo/` (closest existing analog — a self-contained function-focused example, not a full A2A agent example) to match its file layout and README format before writing the new example.

- [ ] **Step 2: Write `agent-template.json`**

A static A2UI `createSurface` message rendering a card with two data-bound fields (e.g., a stock ticker's `price` and `lastUpdated`), with no literal values — every displayed value is a `{path: ...}` binding into `/ticker/*`.

- [ ] **Step 3: Write `mock-mcp-server.js`**

A tiny in-memory mock (no real MCP SDK dependency, to keep the example zero-install) exposing one async function, `getQuote()`, that returns a plain `{price, lastUpdated}` object with a randomized price on each call — standing in for what a real MCP tool call would return via `callMcpTool`.

- [ ] **Step 4: Write `index.html`**

Load `renderer/index.js` via `createOatRenderer()`, apply `agent-template.json` once on load (via `renderer.renderComponent` walking the static tree into the DOM, matching the pattern in `examples/a2ui-dashboard/`), then on a button click (or interval), call `mock-mcp-server.js`'s `getQuote()` and apply only an `updateDataModel`-style patch (write the new values into the same data model object and let the existing `_bindValue`/`subscribe` mechanism from Task 6 propagate the change to the already-rendered DOM) — no full surface re-render.

- [ ] **Step 5: Write `README.md`**

Explain the pattern in 2-3 paragraphs: template-once + data-diffs-after, why it matters (bandwidth, latency, preserves scroll/focus state vs. full re-render), and how to run the example (`open index.html` or a one-line static server command, matching whatever convention the other examples use — check `examples/a2ui-dashboard/README.md` for the exact run instructions and mirror them).

- [ ] **Step 6: Manually verify in a browser**

Open the example, click the refresh control, confirm the price/timestamp update in place without any console errors, using the project's existing manual-verification convention for examples (there's no automated test harness for the `examples/` directory today, matching the existing 12 examples).

- [ ] **Step 7: Commit**

```bash
git add examples/mcp-data-diff/
git commit -m "Add MCP static-template + data-diff example"
```

---

### Task 12: Update documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`

**Interfaces:** None (documentation only).

- [ ] **Step 1: Update `README.md`'s component tables**

In the `### Interactive` table (line ~116), add two rows:

```
| FileUpload | `<ot-upload>` | Oat Upload WC |
| TagInput | `<ot-taginput>` | Oat TagInput WC |
```

Update the `**Total: 37 components.**` line (after the `### Data & Feedback` table) to `**Total: 39 components.**`.

- [ ] **Step 2: Update `README.md`'s function list and MCP mention**

In `### Data` under `## Registered Functions` (or add a new `### MCP` subsection after `### Validation`), add:

```
| callMcpTool | MCP Client | Executes a tool on a connected MCP server and returns its result. |
```

- [ ] **Step 3: Update `docs/architecture.md`'s component tables**

Mirror the same additions in Section 5.3 ("Components: Interactive") with the fuller `Key Properties`/`Source` columns:

```
| FileUpload | `<ot-upload>` | accept, multiple, disabled, hint, files, action, checks | Oat Upload WC |
| TagInput | `<ot-taginput>` | value, placeholder, disabled, suggestions, checks | Oat TagInput WC |
```

Update Section 5.6 ("Component Summary")'s `**Total: 37 components.**` to `**Total: 39 components.**` and adjust "The additional 21 are native Oat primitives" to "23".

- [ ] **Step 4: Add a Checkable/validation subsection**

In Section 6 ("Registered Functions") of `docs/architecture.md`, after 6.6 ("Validation Functions"), add a new "6.6a Checkable Fields" (or renumber as appropriate) subsection documenting the `checks` mechanism implemented in Tasks 6-7: the `{functionCall: {call, args}, message?}` shape, which components support it, and the `aria-invalid`/`.error` DOM contract it produces.

- [ ] **Step 5: Add an MCP Integration section**

Add a new numbered section to `docs/architecture.md` (after Section 9, "A2A Integration", renumbering subsequent sections) documenting: the `callMcpTool` function, the static-template + data-diff pattern from Track 4 of the spec, and a link/reference to `examples/mcp-data-diff/`.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/architecture.md
git commit -m "Update docs for FileUpload, TagInput, Checkable validation, and MCP integration"
```

---

### Task 13: Version bump, changelog, final verification

**Files:**
- Modify: `package.json`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Run the full test suite and validator one more time**

Run: `npm test && npm run validate`
Expected: PASS, zero failures, zero new warnings.

- [ ] **Step 2: Bump the package version**

In `package.json`, change `"version": "0.1.1"` to `"version": "0.2.0"` (note: this repo's `package.json` doesn't currently have a `version` field visible in the earlier read — if it's absent, check whether version is tracked only in `CHANGELOG.md`/git tags, and skip this step if there's no `version` field to bump; otherwise add/update it to `0.2.0`).

- [ ] **Step 3: Add the CHANGELOG entry**

In `CHANGELOG.md`, add a new section above `## v0.1.0`:

```markdown
## v0.2.0 — 2026-09-02

### Catalog

- Added 2 new components: FileUpload (`ot-upload`), TagInput (`ot-taginput`) — 39 components total.
- Added 1 new registered function: callMcpTool — 22 functions total.
- Fixed Badge's variant enum to match Oat's real CSS vocabulary (`secondary`/`success`/`warning`/`danger`/`outline` instead of nonexistent `info`/`error`).
- Fixed Skeleton's variant enum (`box`/`line` instead of nonexistent `text`/`circle`/`rect`).
- Renamed Tooltip's `position` property to `placement` (old name still accepted).
- Added `checks` (Checkable validation) to TextField, CheckBox, Switch, DateTimeInput, ChoicePicker, Autocomplete, FileUpload, TagInput.
- Added `anchorKey` to Tabs, `width` to Sidebar.

### Renderer

- Fixed Badge, Button, and Skeleton rendering to match current Oat CSS (several variant colors were previously rendering unstyled due to using CSS classes where Oat now expects `data-variant` attributes, or vice versa).
- Fixed Skeleton to set `role="status"` (required by current Oat CSS, previously missing).
- Fixed Tooltip to emit `data-tooltip-placement` (previously `data-tooltip-position`, which no longer matches Oat's CSS selector).
- Implemented the `checks`/Checkable validation mechanism (previously declared in the catalog but never read by any render function, including Button's existing `checks` property, which never actually gated the button's action until now).
- Fixed Breadcrumb to use Oat's `.unstyled` helper class on its list and links.

### MCP Integration

- Added `callMcpTool` registered function for invoking tools on a connected MCP server.
- Added an example demonstrating the static-template + data-diff pattern (serve the UI template once, apply subsequent updates as data-only diffs).

### Non-goals

- A2UI spec v0.9.1/v1.0 and the real `@a2ui/web_core` protocol integration adapter are tracked separately (not part of this release) — see `docs/superpowers/specs/2026-09-02-a2ui-oat-modernization-design.md`.
```

- [ ] **Step 4: Final full verification**

Run: `npm test && npm run validate`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json CHANGELOG.md
git commit -m "Bump to v0.2.0"
```
