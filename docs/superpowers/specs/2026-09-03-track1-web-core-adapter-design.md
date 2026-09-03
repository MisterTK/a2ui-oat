# Track 1 — Real `@a2ui/web_core` Surface Adapter (Plan B)

Date: 2026-09-03
Status: Approved design, pending implementation plan

## Problem

`renderer/index.js` ships `registerWithWebLib()`, which calls
`registerRenderer`, `registerFunction`, and `setCatalogId` on a passed-in
"web-lib" object. None of these methods exist anywhere in the real
`@a2ui/web_core` package (verified by extracting the published 0.9.2 and
0.10.7 npm tarballs and grepping every `.d.ts`). The function is a contract
against a fictional API and has never worked against the real protocol
engine. Every example instead hand-rolls a message loop and a fake
`RenderContext` inline in its `index.html`.

This design replaces the fiction with a real integration adapter,
`renderer/surface-adapter.js`, verified line-by-line against the published
`@a2ui/web_core@0.10.7` package.

## Verified API facts (published 0.10.7 tarball)

All findings below were verified against extracted npm tarballs of 0.9.2 and
0.10.7 (not the monorepo source checkout):

- Exports: `.` (v0.8!), `./v0_8`, `./v0_9`, `./v0_9/basic_catalog`,
  `./data/*`, `./types/*`, `./styles/*`. **No `./v0_9_1` subpath** — protocol
  v0.9.1 is selected via `MessageProcessorOptions.version: 'v0.9' | 'v0.9.1'`
  on the `v0_9` module (option added in 0.10.x; both versions accepted when
  parsing since 0.10.5). 0.10.7's `src/v1_0/` is JSON-schema-only and not
  wired into `exports` — there is no usable v1.0 runtime.
- **`NodeResolver` exists only in 0.10.7+** (the `nodes/` directory does not
  exist in 0.9.2). `new NodeResolver(surface, catalog)`; exposes
  `rootNode: Signal<ComponentNode | undefined>`, `activeNodeCount`,
  `disposed`, `dispose()`. Handles child-ref resolution, list-template
  expansion, and cyclic/pending/unknown-type placeholder states. Its
  `Catalog<C, F>` bound requires `F extends FunctionImplementation` —
  schema-only catalogs are rejected at compile time.
- `MessageProcessor<T extends ComponentApi>`:
  `constructor(catalogs: Catalog<T>[], actionHandler?: ActionListener,
  options?: MessageProcessorOptions)`;
  `processMessages(messages: A2uiMessage[] | A2uiMessageListWrapper): void`.
  Surfaces enumerate via `processor.model.surfacesMap`
  (`ReadonlyMap<string, SurfaceModel>`), with `onSurfaceCreated(handler)` /
  `onSurfaceDeleted(handler)` events on both the processor and
  `processor.model`. `getClientDataModel(version?)` returns
  `{version, surfaces}` for surfaces with `sendDataModel` true.
- Root component id is the hardcoded convention `'root'`
  (`nodes/node-resolver.js:23`); there is no `beginRendering` message —
  rendering starts once `updateComponents` creates a component with id
  `'root'` (`surface.componentsModel.get('root')`).
- `Catalog`: `constructor(id, components: T[], functions?: F[],
  themeSchema?)`; public `components: ReadonlyMap<string, T>` and
  `functions: ReadonlyMap<string, F>`; static
  `fromSchema(catalogSchema): Catalog<ComponentApi, FunctionApi>` builds a
  schema-only catalog from raw catalog JSON (0.10.7+).
- `createFunctionImplementation({name, returnType, schema},
  execute(args, dataContext, abortSignal?))` — exists in both versions,
  wraps a function for catalog registration.
- `ComponentContext` is exported from the `v0_9` barrel:
  `new ComponentContext(surface, componentId, dataModelBasePath = '/')`;
  `componentModel.properties` is the raw, pre-resolution properties object;
  `dispatchAction(action)` delegates to
  `surface.dispatchAction(action, componentId)`.
- Reads: `dataContext.resolveDynamicValue(value)` (synchronous; takes a
  `DynamicValue` — literal, `{path}`, or `{call}`);
  `dataModel.get(path)` for raw path reads; **`dataModel.get('/')` is the
  whole-surface snapshot** (the exact pattern `getClientDataModel()` uses
  internally).
- Writes: **`dataContext.set(path, value)`** → `dataModel.set(path, value)`
  is the single write primitive; `GenericBinder`'s generated `set*` methods
  and `NodeResolver`'s `WritableBinding.set` both bottom out there.
- Subscriptions: `dataContext.subscribeDynamicValue({path}, cb)` returns
  `DataSubscription {value, unsubscribe()}` (`value` is a snapshot field).
  `{path: string}` is a valid `DynamicValue`; web_core's own
  `GenericBinder` uses exactly that shorthand internally.
- Action chain (`GenericBinder.bindAction`, functionally identical in both
  versions): deep-walk the raw action JSON, synchronously resolving any
  nested object containing a `path` or `call` key via
  `resolveDynamicValue` (local `functionCall` actions execute as a side
  effect of this resolution), then call
  `surface.dispatchAction(resolved, componentId)` — which validates and
  emits only `event`-wrapped actions to the action listener; already-run
  local function calls hit its no-op branch.
- Packaging: pure ESM (`"type": "module"`, no CJS), ships full `.d.ts` +
  unbundled source, Apache-2.0. Dependencies: `@preact/signals-core`,
  `date-fns`, `zod`, `zod-to-json-schema` (no `lit`). CDN use requires an
  ESM CDN that resolves bare specifiers (esm.sh, jsdelivr `+esm`).
- Confirmed absent in both versions: `registerRenderer`, `registerFunction`,
  `setCatalogId`.

## Decisions (made with Thomas during brainstorming)

1. **Dependency posture: zero runtime dependencies, dependency-injected.**
   a2ui-oat keeps an empty `dependencies` map. The adapter takes the
   imported `@a2ui/web_core/v0_9` module as a parameter (`webCore`), so it
   works identically from an ESM CDN or a consumer's npm install. No hard
   or peer dependency is declared.
2. **Architecture: NodeResolver hybrid, minimum web_core 0.10.7.**
   `MessageProcessor` per adapter, `NodeResolver` per surface for
   structural shape only; the adapter reads raw pre-resolution properties
   and builds the `RenderContext` itself, so all 39 component renderers and
   all existing tests are untouched.
3. **Examples: one flagship adapter example**; existing examples keep their
   hand-rolled loops as direct-mode documentation.
4. **Testing: `@a2ui/web_core@^0.10.7` as a devDependency** so the test
   suite exercises the adapter against the real published package — the
   structural fix for how `registerWithWebLib()` went wrong.

## Design

### Public API & module layout

New file `renderer/surface-adapter.js`, new subpath export
`"./surface-adapter": "./renderer/surface-adapter.js"` in `package.json`.
The module imports nothing from `@a2ui/web_core` at module level.

```js
import * as webCore from "https://esm.sh/@a2ui/web_core@0.10.7/v0_9";
import { createSurfaceAdapter } from "a2ui-oat/surface-adapter";

const adapter = createSurfaceAdapter({
  webCore,                     // required: the imported v0_9 module
  container: document.body,    // required: default mount point
  onAction: (action) => {},    // server-bound event actions → transport
  resolveContainer: (surfaceId) => HTMLElement, // optional per-surface mount
  onError: (err, info) => {},  // optional; default console.error
  catalogJson: undefined,      // optional: pre-loaded oat-catalog.json object
  rendererOptions: {},         // forwarded to OatRenderer
});

adapter.processMessages(messages); // wire input (array or wrapper object)
adapter.processor;                 // escape hatch: the MessageProcessor
adapter.dispose();                 // full teardown
```

Capability check at construction: if `webCore.NodeResolver` or
`webCore.ComponentContext` is missing, throw
`Error("a2ui-oat surface adapter requires @a2ui/web_core >= 0.10.7")`.
Missing `webCore` or `container` also throw immediately.

### Construction sequence

1. `createOatRenderer(rendererOptions)` (existing, unchanged) → renderer +
   the 23 registered function implementations.
2. Obtain the catalog JSON: from the optional `catalogJson` option if the
   consumer supplies one, otherwise via
   `import("../catalog/oat-catalog.json", { with: { type: "json" } })`
   (supported in Node 20+ and current browsers; the flagship example uses
   the default). Then
   `schemaCatalog = webCore.Catalog.fromSchema(catalogJson)` to derive
   `ComponentApi` entries for all 39 components.
3. Wrap each of our functions with `webCore.createFunctionImplementation(
   {name, returnType, schema}, execute)` (schemas from the catalog's
   `functions` map; `execute` closes over our existing
   `renderer/functions/*.js` implementation). Then build the executable
   catalog: `new webCore.Catalog(CATALOG_ID,
   [...schemaCatalog.components.values()], wrappedFunctions,
   schemaCatalog.themeSchema)` — satisfying `NodeResolver`'s
   `F extends FunctionImplementation` bound.
4. `new webCore.MessageProcessor([catalog], actionListener,
   { version: "v0.9.1" })`, where `actionListener` forwards validated
   `event` actions to `onAction`.
5. Subscribe `processor.onSurfaceCreated` / `onSurfaceDeleted`.

### Surface lifecycle

Per surface created: create `new webCore.NodeResolver(surface, catalog)`,
subscribe (via `webCore` signals `effect`) to `resolver.rootNode`, and when
the root `ComponentNode` appears or is replaced, render it into
`resolveContainer(surface.id) ?? container`. Per surface deleted: dispose
the resolver, unsubscribe, remove the surface's DOM.

`NodeResolver` is used **only** for structural shape: which components
exist, child-ref wiring, list-template expansion (one node per array item,
`instanceId` suffixes), and cyclic/pending/unknown-type placeholders. The
adapter never consumes resolved `node.props` for property values.

### Rendering a node — the RenderContext bridge

For each `ComponentNode` with `state === 'resolved'`, the adapter builds
`new webCore.ComponentContext(surface, node.componentId, node.dataPath)`
(`dataPath` scopes relative bindings inside list-template items) and calls
`renderer.renderComponent({ id: node.componentId, component: node.type,
...componentContext.componentModel.properties }, renderContext)` — raw,
pre-resolution properties, exactly the shape every `_render*` method and
test consumes today.

The `RenderContext` the adapter supplies (`dc` =
`componentContext.dataContext`):

| Method | Implementation |
|---|---|
| `getDataModel()` | `surface.dataModel.get('/')` — whole-surface snapshot (the same pattern `getClientDataModel()` uses internally) |
| `setDataModel(path, val)` | `dc.set(path, val)` — the one write primitive; two-way bindings flow through it |
| `subscribe(path, cb)` | `sub = dc.subscribeDynamicValue({path}, cb)`; returns `() => sub.unsubscribe()`; tracked for disposal |
| `renderChild(id)` | Find the child `ComponentNode` among the current node's structural children (resolved child refs / template items); recurse with a child `ComponentContext`. Placeholder states (`pending`, `unknown-type`, `cyclic`) render `OatRenderer`'s existing `[Unknown component]` fallback element |
| `dispatchAction(action)` | Mirror of `GenericBinder.bindAction`: deep-walk the raw action JSON, synchronously resolving nested `{path}`/`{call}` objects via `dc.resolveDynamicValue` (local `functionCall`s execute here), then `surface.dispatchAction(resolved, node.componentId)` — `event` actions reach `onAction`; resolved local calls hit the documented no-op branch |
| `getRegisteredFunction(name)` | Returns our raw `renderer/functions/*.js` implementation directly (not via `Catalog.invoker`), preserving Checkable `checks` evaluation exactly as shipped in v0.2.0 |

Re-render granularity is unchanged from today's philosophy: per-path data
updates flow through `subscribe` callbacks with no DOM replacement;
structural changes (root replaced; list items added/removed, observed via
the resolver's node tree) re-render the affected subtree, keyed by
`node.instanceId`.

### Error handling

- Construction errors throw synchronously (see capability check).
- Malformed wire messages: `MessageProcessor`'s zod validation rejects
  them; the adapter surfaces the thrown error via `onError` and continues
  (one bad batch does not tear down existing surfaces).
- Unknown/cyclic/pending components: rendered as placeholder fallbacks (no
  throw), matching `OatRenderer`'s existing unknown-component behavior.
- A registered-function failure during action resolution is caught, passed
  to `onError`, and that single action is dropped — the surface lives on.

### Disposal

Every `subscribeDynamicValue` subscription created while rendering a node
is registered with that node via `node.addCleanup()`, so web_core's own
node-destruction path releases them. `adapter.dispose()`: dispose every
`NodeResolver`, unsubscribe processor-level event subscriptions, remove all
surface DOM. Tests assert `resolver.disposed === true` and
`activeNodeCount === 0` after disposal.

### Removals & text sweep

- `registerWithWebLib()` deleted from `renderer/index.js` (not deprecated:
  it never worked against any real package, so no working consumer exists).
  `createOatRenderer()`, `OatRenderer`, and all function exports unchanged.
- All `@a2ui/web-lib` references → `@a2ui/web_core` (`README.md`,
  `docs/architecture.md`, code comments, examples).
- `catalog/oat-catalog.json` `"version"`: `"v0.9"` → `"v0.9.1"`;
  `catalog/oat-catalog-rules.txt` version guidance updated to match.
- MIME type strings `application/json+a2ui` → `application/a2ui+json`
  wherever they appear.

### Testing

New `tests/test-surface-adapter.js`, run against the real
`@a2ui/web_core@^0.10.7` devDependency (added to `package.json`
`devDependencies` and the `npm test` file list):

- Wire-in: real `createSurface` / `updateComponents` / `updateDataModel`
  sequences (with both `"v0.9"` and `"v0.9.1"` version strings) through
  `adapter.processMessages`; assert rendered DOM shape in the same style
  as `test-renderer.js`.
- Reactivity: `updateDataModel` after render updates bound text and input
  values through the real signals pipeline without DOM replacement.
- Two-way binding: simulated input on a `TextField` lands in the real
  `DataModel` (read back via `surface.dataModel.get(path)`).
- Actions: a Button `event` action reaches `onAction` with nested dynamic
  values resolved; a local `functionCall` action executes the registered
  function and does not reach `onAction`.
- Structure: list-template expansion renders one child per data item and
  tracks item add/remove; a cyclic-ref payload renders the fallback.
- Checkable: a failing `checks` rule sets `aria-invalid` when driven
  through the adapter (regression guard for the Track 3 feature).
- Disposal: `dispose()` leaves no live subscriptions
  (`activeNodeCount === 0`, container emptied).
- Invariant: the existing test files pass unmodified.

Note: tests run under Node with the existing DOM shim used by
`test-renderer.js`; if web_core's `MessageProcessor`/`NodeResolver` paths
require additional globals, extend the shim rather than mocking web_core.

### Flagship example

`examples/web-core-adapter/`: a single page importing
`@a2ui/web_core@0.10.7/v0_9` from esm.sh and `a2ui-oat/surface-adapter`,
replaying a scripted agent conversation (createSurface → updateComponents →
streamed updateDataModel diffs) through the real protocol engine, with an
`onAction` log panel. Its README states explicitly how adapter mode differs
from the hand-rolled direct-mode examples, which remain unchanged.

### Docs & release

- `README.md` + `docs/architecture.md`: new "Adapter mode vs. direct mode"
  section; integration snippet using the CDN import shown above.
- `CHANGELOG.md`: v0.3.0 — "Added: real `@a2ui/web_core` surface adapter.
  Removed: `registerWithWebLib()` (called APIs that do not exist in
  `@a2ui/web_core`; replaced by `createSurfaceAdapter`)."
- Version bump to 0.3.0.

## Non-goals

- A2UI v1.0 support: 0.10.7 ships v1.0 JSON schemas only, unexported and
  unreachable — there is still no v1.0 runtime to integrate with.
  Unchanged from the parent spec's non-goals.
- Supporting web_core 0.9.2: `NodeResolver` does not exist there, and
  supporting it would mean hand-rolling template expansion and cycle
  detection — the exact duplication this design avoids.
- Migrating existing examples to the adapter (they document direct mode).
- TypeScript conversion of a2ui-oat (the adapter is plain ESM JS with
  JSDoc, matching the rest of the repo).

## Open questions

None — every API named in this design was verified against the published
0.10.7 tarball (exports map, `.d.ts` signatures, and source), including the
`Catalog.fromSchema` → `new Catalog(...)` reconstruction path
(`Catalog.components` is a public `ReadonlyMap`).
