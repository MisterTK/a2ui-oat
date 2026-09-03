# a2ui-oat modernization: catch up to current A2UI + Oat

Date: 2026-09-02
Status: approved for planning — split into two implementation plans (see
"Plan split" below). This document covers both; Track 1 is scoped here but
planned and executed separately, after Tracks 2-4.

## Context

a2ui-oat v0.1.1 was built against a snapshot of A2UI (spec v0.9) and Oat CSS
from around 2026-03-29. Both upstream projects have since moved:

- A2UI now has spec v0.9.1 (trivial refinement) and a v1.0 candidate spec
  (major: renderer/agent terminology rename, bidirectional RPC, multi-catalog
  mixing, `Checkable`/validation changes, removal of protocol-level theming).
  The reference JS protocol engine, renamed from `@a2ui/web-lib` to
  `@a2ui/web_core` (now v0.10.7), only ships `v0_8` and `v0_9` entry points —
  **no `v1_0` export exists yet in any official renderer** (web_core, lit,
  react, angular all lack a `v1_0` source directory).
- Oat gained two new web components (`ot-upload`, `ot-taginput`) and shipped
  several CSS/attribute changes that our renderer never picked up, some of
  which are outright regressions against current Oat CSS.

This spec scopes the update to what's practical today (v0.9.1 + Oat parity)
while explicitly tracking v1.0 as future work blocked on upstream.

## Goals

1. Fix a real bug: every reference to the renamed `@a2ui/web-lib` package.
2. Adopt A2UI spec v0.9.1.
3. Add the two new Oat components (`FileUpload`, `TagInput`) to the catalog
   and renderer.
4. Fix three confirmed rendering regressions (Badge, Skeleton, Tooltip) and
   sync the renderer with other Oat CSS/behavior drift.
5. Implement the previously-unhandled `Checkable`/`checks` validation
   mechanism from the v0.9 spec, wiring it to Oat's `aria-invalid` pattern.
6. Add the generic `callMcpTool` catalog function and an example
   demonstrating the MCP static-template + data-diff pattern.

## Non-goals

- A2UI v1.0 support. No official renderer (including the reference
  `@a2ui/web_core`) has shipped v1.0 protocol support yet, so a2ui-oat
  implementing it now would mean hand-rolling protocol-engine logic that
  contradicts its "thin layer over web_core" design, against a spec that is
  still a candidate. This is recorded as tracked future work (see
  "Future work" below), revisited once `@a2ui/web_core` ships a `v1_0` export.

## Plan split

Researching Track 1 revealed it's both bigger and more independent than
originally scoped: a2ui-oat's `registerWithWebLib()` calls methods
(`registerRenderer`, `registerFunction`, `setCatalogId`) that **do not exist
anywhere in the real `@a2ui/web_core`** package — the actual v0.9 API surface
(`renderers/web_core/src/v0_9/index.ts`) is a lower-level toolkit
(`MessageProcessor`, `GenericBinder`, `NodeResolver`, `Catalog`/
`FunctionImplementation`, a signals-based reactivity system). Fixing this
properly means building a real integration adapter, not a find-and-replace.
That work doesn't block or get blocked by Tracks 2-4 (new components,
regression fixes, Checkable, MCP function all operate on `oat-catalog.json`
and `oat-renderer.js`'s DOM-mapping methods, independent of how messages get
into the renderer). So:

- **Plan A** (written and executed first): Tracks 2, 3, 4 below.
- **Plan B** (written after Plan A ships): Track 1, the real web_core
  adapter — re-verified against the published `@a2ui/web_core` npm package
  (not just the `/Users/tk/dev/a2ui` source checkout) before implementation,
  since published package internals can lag or diverge slightly from the
  monorepo source at HEAD.

## Track 1 — A2UI protocol: real web_core adapter + v0.9.1 (Plan B, later)

Replace the fictional `registerWithWebLib()` contract with a real adapter,
`renderer/surface-adapter.js`, built on `@a2ui/web_core`'s actual v0.9 API:

- One `MessageProcessor<OatFunctionApi>` per app
  (`processing/message-processor.ts`), constructed with a `Catalog` whose
  function entries are our 22 (→23, see Track 4) `renderer/functions/*.js`
  implementations wrapped via `createFunctionImplementation()`. Wire
  messages arrive via `processor.processMessages(messages)`.
- `NodeResolver(surface, catalog)` (`nodes/node-resolver.ts`) per surface,
  used **only to resolve structural shape** — child references and
  list-template expansion — since reimplementing that (cyclic-ref detection,
  template instantiation) would duplicate real, non-trivial logic.
- For each resolved `ComponentNode`, the adapter reads the **raw,
  pre-resolution properties** from `ComponentContext.componentModel.properties`
  (not the fully-resolved `node.props`) and hands them to
  `OatRenderer.renderComponent()` completely unchanged — every existing
  `_render*` method and all 382 existing tests keep working exactly as they
  do today. Concretely:
  - `RenderContext.subscribe(path, cb)` delegates to
    `dataContext.subscribeDynamicValue({path}, cb)` — a real, existing
    per-path reactive primitive, so `_bindValue`/`_isBound`/`_resolve` in
    `oat-renderer.js` need zero changes.
  - `RenderContext.dispatchAction(action)` resolves nested dynamic values in
    the raw action JSON synchronously, then calls `surface.dispatchAction(...)`
    for event actions or the catalog's function invoker for local
    `functionCall` actions — mirroring what `GenericBinder.bindAction` does
    internally (`generic-binder.ts:286-307`), reimplemented directly since
    it's simple enough not to need the full binder.
  - `RenderContext.renderChild(id)` looks up the child's raw properties the
    same way and recurses.
  - `RenderContext.getRegisteredFunction(name)` returns our own
    `renderer/functions/*.js` implementations directly (not routed through
    `Catalog.invoker`), so `Checkable`/`checks` evaluation (Track 3) keeps
    working exactly as speced there, with no dependency on `GenericBinder`'s
    own `isValid`/`validationErrors` injection.
- Replace all `@a2ui/web-lib` text references with `@a2ui/web_core`
  (`README.md`, `docs/architecture.md`, examples, `package.json`).
  `registerWithWebLib()` is removed — there's no such surface upstream to
  register with; the adapter above is the one real integration path.
- Bump `catalog/oat-catalog.json`'s `"version"` field from `"v0.9"` to
  `"v0.9.1"`, and update hardcoded MIME type strings from
  `application/json+a2ui` to `application/a2ui+json`. v0.9.1 is
  wire-compatible with v0.9 (version field becomes an enum accepting both),
  so no other message-schema changes are needed.

## Track 2 — New Oat components

### FileUpload

Maps to Oat's `<ot-upload>` (`oat/src/js/upload.js`). Catalog component:

- Properties: `accept` (string, MIME/extension filter), `multiple` (bool),
  `disabled` (bool, bindable), `hint` (string, placeholder text shown when
  empty), `files` (bindable array — two-way bound to the data model,
  populated from `input.files` on the native `change` event), `action`
  (optional, fired on `change`).
- Renderer emits the exact structure from `ot-upload`'s usage doc: a hidden
  native `<input type="file">`, a trigger `<button>`, and a `[data-files]`
  container that shows selected files as removable badges (the web
  component handles the badge rendering itself — the renderer just needs to
  supply the right markup skeleton and bind `files` on `change`).

### TagInput

Maps to Oat's `<ot-taginput>` (`oat/src/js/taginput.js`). Catalog component:

- Properties: `value` (bindable array of strings — two-way bound), `placeholder`
  (string), `disabled` (bool, bindable), `suggestions` (optional array of
  strings, rendered into a `<datalist>` wired to the inner `<input>` for
  autocomplete).
- Renderer wires the component's `input` event (bubbles, `detail` = current
  tag array) back to the data model path bound to `value`.

Both get entries in `catalog/oat-catalog.json` (bringing total components to
39), render functions in `renderer/oat-renderer.js`, rows in the README
component tables, coverage in `tests/test-catalog.js` / `test-renderer.js`,
and at least one example each (can extend an existing example rather than
adding new ones, except where Track 4 needs a new one).

## Track 3 — Renderer regression fixes + Oat parity sync

### Confirmed regressions (fix required, not optional)

- **Badge** (`_renderBadge`, `oat-renderer.js`): currently sets
  `el.dataset.badge = ''` and adds the variant as a bare CSS class via
  `_addClass`. Current Oat CSS (`oat/src/css/badge.css`) selects on
  `.badge` (literal class), `.outline` (literal class), and
  `[data-variant="secondary|success|warning|danger"]` (attribute, not
  class). Fix: `el.className = 'badge'`; if variant is `"outline"`, add it
  as a class; if it's `secondary`/`success`/`warning`/`danger`, set
  `el.dataset.variant`. The catalog's variant enum
  (`["default","info","success","warning","error"]`) doesn't match Oat's
  real vocabulary at all — `info` and `error` don't exist in `badge.css`.
  Fix the enum to `["default","secondary","success","warning","danger","outline"]`
  (`default` = no attribute/class, matching Badge's base look).
- **Button** (`_renderButton`): same `_addClass(el, variant)` bug. Per
  `oat/src/css/button.css`, a bare `<button>` is already styled as
  "primary" by default (no class needed), `secondary`/`danger` require
  `data-variant`, and `outline`/`ghost` are literal classes. Fix:
  `primary`/`default` → no-op; `secondary`/`danger` → `el.dataset.variant`;
  `outline`/`ghost` → `_addClass`. No catalog enum change needed (Button's
  existing enum `["default","primary","secondary","danger","outline","ghost"]`
  already matches Oat's real vocabulary — only the renderer logic is wrong).
- **Skeleton** (`_renderSkeleton`): two separate bugs, not a `data-variant`
  issue. (1) Oat's `skeleton.css` selects on `[role="status"].skeleton`,
  but the renderer never sets `role="status"` — add
  `el.setAttribute('role', 'status')`. (2) The catalog's variant enum
  (`["text","circle","rect"]`) doesn't match Oat's real shape classes
  (`.box`, `.line`) at all — fix the enum to `["box","line"]`; the existing
  `_addClass(el, variant)` call is otherwise correct (Oat uses classes here,
  not `data-variant`).
- **Tooltip** (`_renderTooltip`): sets `el.dataset.tooltipPosition`, but
  `oat/src/css/tooltip.css` selects on `[data-tooltip-placement]`. Fix:
  emit `data-tooltip-placement`. Rename the catalog property from
  `position` to `placement`, but keep reading the old `position` prop name
  as a fallback for one release to avoid silently breaking existing agent
  prompts that were written against the shipped v0.1.1 catalog.
- **Confirmed correct, no fix needed**: Alert and Toast already emit
  `el.dataset.variant` correctly (matching `alert.css`/`toast.css`).
  Progress and Meter use native `<progress>`/`<meter>` elements with
  browser pseudo-elements and have no variant/class mechanism at all in
  Oat CSS. Image's `rounded`/`circle` variant classes have no corresponding
  Oat CSS either, but that's a pre-existing a2ui-oat design gap unrelated to
  any upstream Oat change, so it's out of scope for this "sync with Oat
  drift" track.

### `Checkable` / validation wiring (spec feature, never implemented)

The v0.9(.1) spec defines a `Checkable` mixin (`common_types.json#/$defs/Checkable`):
components may carry a `checks: CheckRule[]` array, each `{condition, message}`
where `condition` is a `DynamicBoolean` (typically a call to `required`,
`regex`, `length`, `numeric`, or `email`). This is currently unhandled —
those five validation functions exist but nothing in the renderer ever
reads `checks` or reflects a failure in the DOM.

Implementation: for any component render function handling a
`Checkable`-eligible type (`TextField`, `CheckBox`, `Switch`, `DateTimeInput`,
`ChoicePicker`, `Autocomplete`, and now `FileUpload`/`TagInput`), evaluate
`c.checks` after render and on every relevant data-model change:

- If any condition resolves false, set `aria-invalid="true"` on the control
  and render/update a sibling error element carrying the failing rule's
  `message`, matching Oat's existing `[aria-invalid] ~ .error` /
  `:has([aria-invalid="true"]) .error` CSS pattern in `form.css`.
- If all conditions pass, remove `aria-invalid` and clear the error element.

This is additive (new helper `_renderChecks(el, c, ctx)` called from the
relevant render functions) and doesn't change any existing method signatures.

### Other Oat drift to pick up

- **Tabs**: add optional `anchorKey` catalog property → sets
  `el.dataset.anchor = c.anchorKey` on the `<ot-tabs>` element for URL
  deep-linking (`oat/src/js/tabs.js`).
- **Sidebar**: confirm/expose the sidebar-width CSS variable if the theme
  schema should surface it (check `oat/src/css/sidebar.css` for the exact
  variable name during implementation).
- **Breadcrumb**: use Oat's `.unstyled` helper class where the current
  renderer hand-rolls equivalent link-reset styling, if applicable.

## Track 4 — MCP integration: `callMcpTool` + data-diff pattern

A2UI's ecosystem (not the core protocol — this pattern lives in
`a2ui/samples/community/mcp/a2ui-over-mcp-recipe/` and
`a2ui/catalogs/mcp/v0_9/`) has generalized a pattern where an MCP server
serves a **static A2UI template** (a `createSurface`/`updateComponents`
payload with data bindings, no literal values) once as an MCP **resource**,
and MCP **tools** return only `updateDataModel` diffs thereafter — avoiding
re-sending the whole UI tree on every data refresh. Tools advertise their
template via `_meta.ui: {resourceUri, mimeType: "application/a2ui+json"}`.

For a2ui-oat:

- Add a registered function `callMcpTool(name, arguments)` in
  `renderer/functions/callMcpTool.js`, mirroring the reusable
  `catalogs/mcp/v0_9/src/functions/callMcpTool.ts` implementation: takes an
  MCP `Client` (or a getter for one, injected at renderer setup — not
  hardcoded), calls `client.callTool()`, supports an abort signal, and
  returns the result so it can be bound into the data model or an action
  chain. Register it in `catalog/oat-catalog.json`'s `functions` map
  (`args: {name, arguments}`, `returnType: "any"`) alongside the existing
  22 functions.
- Add one new example, `examples/mcp-data-diff/`, demonstrating: an MCP
  server exposing a template resource + a tool that returns only data
  updates, and the Oat renderer fetching the template once and applying
  subsequent `updateDataModel` messages without re-rendering the whole
  surface.
- Document the pattern in a new "MCP integration" section of
  `docs/architecture.md`.

## Testing (Plan A: Tracks 2-4)

- Extend `tests/test-catalog.js`: new component/function entries validate
  against `scripts/validate-catalog.js`'s structural checks.
- Extend `tests/test-renderer.js`: DOM-shape assertions for `FileUpload`,
  `TagInput`, corrected Badge/Button/Skeleton/Tooltip attribute output, and
  `Checkable`/`checks` → `aria-invalid` behavior (pass and fail cases).
- Extend `tests/test-functions.js`: `callMcpTool` against a mocked MCP
  client (success, error, abort).
- `npm run validate` and `npm test` must pass before calling any track done.

Note: `catalog/oat-catalog.json`'s `"version"` field bump to `v0.9.1` and
the `@a2ui/web-lib` → `@a2ui/web_core` naming fix live in Track 1 (Plan B),
not Plan A — Plan A ships against the existing `v0.9` catalog version.

## Versioning / release

- Plan A (Tracks 2-4) version bump: 0.1.1 → 0.2.0 (new components + behavior
  changes to existing components' DOM output warrant a minor bump). New
  `CHANGELOG.md` entry under `## v0.2.0` covering Tracks 2-4.
- Plan B (Track 1, the real web_core adapter + v0.9.1) ships separately as
  0.3.0 once planned and implemented.

## Future work (explicitly deferred)

- A2UI v1.0: bidirectional RPC (`callRendererFunction`/`callAgentFunction`),
  multi-catalog mixing with per-component `catalogId`, `Surface` composition
  constraints (`allowedParents`/`allowedChildren`), `ValidationResult`-typed
  validation functions, `@index` template function, protocol-level theme
  removal. Blocked on `@a2ui/web_core` (or another official renderer)
  shipping a `v1_0` export to implement against — no reference exists today.
  Revisit when that lands; a2ui-oat would otherwise be implementing an
  unstable candidate spec with no reference implementation to validate
  against.
