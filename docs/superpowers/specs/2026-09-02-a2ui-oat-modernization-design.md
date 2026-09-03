# a2ui-oat modernization: catch up to current A2UI + Oat

Date: 2026-09-02
Status: approved for planning

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

## Track 1 — A2UI protocol: package fix + v0.9.1

- Replace all `@a2ui/web-lib` references with `@a2ui/web_core`, pinned to the
  `@a2ui/web_core/v0_9` subpath export (there is no unversioned v0.9.1
  export upstream; v0.9.1 is wire-compatible with v0.9 per the evolution
  guide, so the v0_9 build is the correct target). Touches:
  `README.md`, `renderer/index.js` (JSDoc + any identifiers), `docs/architecture.md`,
  `examples/**` (script tags / imports), `package.json` keywords/description
  if they mention the old name.
- Bump `catalog/oat-catalog.json`'s `"version"` field from `"v0.9"` to
  `"v0.9.1"`.
- Update any hardcoded MIME type strings from `application/json+a2ui` to
  `application/a2ui+json` (grep across `direct/`, `docs/`, examples).
- No message-schema code changes are required beyond the above — v0.9.1 is
  wire-compatible with v0.9 (the `version` field becomes an enum accepting
  both `"v0.9"` and `"v0.9.1"`; `surfaceId` uniqueness is relaxed to
  active-surfaces-only, which doesn't affect a stateless renderer that
  doesn't track historical surface IDs).

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
  `.badge` (literal class) and `[data-variant="secondary|success|warning|danger"]`
  (attribute, not class). Fix: `el.className = 'badge'`;
  `if (variant) el.dataset.variant = variant;`.
- **Skeleton** (`_renderSkeleton`): same `_addClass`-for-variant pattern —
  apply the same `data-variant` fix if Oat's `skeleton.css` uses the
  attribute selector (verify against current CSS during implementation;
  fix identically if so).
- **Tooltip** (`_renderTooltip`): sets `el.dataset.tooltipPosition`, but
  `oat/src/css/tooltip.css` selects on `[data-tooltip-placement]`. Fix:
  emit `data-tooltip-placement`. Rename the catalog property from
  `position` to `placement`, but keep reading the old `position` prop name
  as a fallback for one release to avoid silently breaking existing agent
  prompts that were written against the shipped v0.1.1 catalog.

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
- Sweep `oat-renderer.js` for any other bare `_addClass(el, variant)` calls
  on components whose current Oat CSS counterpart has since moved to
  `data-variant` (Alert, Toast, Progress, Meter are candidates to verify
  against current `oat/src/css/*.css` during implementation, beyond the
  three already confirmed).

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

## Testing

- Extend `tests/test-catalog.js`: new component/function entries validate
  against `scripts/validate-catalog.js`'s structural checks; catalog
  `version` field asserted as `v0.9.1`.
- Extend `tests/test-renderer.js`: DOM-shape assertions for `FileUpload`,
  `TagInput`, corrected Badge/Skeleton/Tooltip attribute output, and
  `Checkable`/`checks` → `aria-invalid` behavior (pass and fail cases).
- Extend `tests/test-functions.js`: `callMcpTool` against a mocked MCP
  client (success, error, abort).
- `npm run validate` and `npm test` must pass before calling any track done.

## Versioning / release

- Package version bump: 0.1.1 → 0.2.0 (new components + new catalog
  version + behavior changes to existing components' DOM output warrant a
  minor bump, not a patch).
- New `CHANGELOG.md` entry under `## v0.2.0` covering all four tracks.

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
