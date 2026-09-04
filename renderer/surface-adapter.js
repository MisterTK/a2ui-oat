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
    // Tracks resolver.rootNode's own identity (undefined -> first root, or a
    // full teardown/rebuild of root itself, e.g. its type changes). Because
    // `normalizeRefFields` reads every visited node's `props` via `getValue`
    // (see its docstring), this effect also transitively re-fires on *any*
    // change anywhere in the tree, not just root replacement — but every
    // resolved node already gets its own fine-grained `watchNode` effect
    // (installed in `renderNode`) that reacts to exactly its own subtree's
    // changes. So once the root element exists, a re-fire whose root
    // identity is unchanged means some deeper node's own watcher already
    // handled it, and re-running the full `replaceChildren` here would just
    // discard unrelated DOM state (e.g. input focus) elsewhere in the tree
    // for no benefit.
    let lastRoot;
    const stopEffect = webCore.effect(() => {
      const root = webCore.getValue(resolver.rootNode);
      if (!root) return;
      if (root === lastRoot) return;
      lastRoot = root;
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

  /**
   * ComponentNode -> { el }, for every resolved node that currently has a
   * live element + watcher. NodeResolver reuses the same node object across
   * a re-materialize when its edge is unchanged (see node-resolver.js's
   * `childNode`), so looking a node up here — instead of unconditionally
   * rendering it again — is what lets an ancestor's re-render skip rebuilding
   * (and re-watching) descendants that did not themselves change.
   */
  const liveNodes = new WeakMap();

  function renderNode(node, surface) {
    if (node.state !== 'resolved') {
      // pending / unknown-type / cyclic → OatRenderer's unknown-component
      // fallback element (type is 'Placeholder' for pending/cyclic). Never
      // memoized: a placeholder's whole point is to be superseded once its
      // parent re-materializes with a real (differently-identified) node.
      return renderer.renderComponent(
        { id: node.componentId, component: node.type },
        makeRenderContext(node, surface, null, new Map()),
      );
    }
    const existing = liveNodes.get(node);
    if (existing) return existing.el;
    const entry = { el: renderOnce(node, surface) };
    liveNodes.set(node, entry);
    watchNode(node, surface, entry);
    return entry.el;
  }

  /** Builds a resolved node's element fresh from its current props. */
  function renderOnce(node, surface) {
    const componentContext =
      new webCore.ComponentContext(surface, node.componentId, node.dataPath);
    const raw = componentContext.componentModel.properties;
    const { props, childMap } = normalizeRefFields(raw, node);
    const ctx = makeRenderContext(node, surface, componentContext, childMap);
    return renderer.renderComponent(
      { id: node.componentId, component: node.type, ...props }, ctx);
  }

  /**
   * One persistent effect per live node (created once in `renderNode` above,
   * for the node's whole lifetime): tracks `node.props` and, ONLY when the
   * change is structural, rebuilds this node's element and swaps it in
   * place with `replaceWith`. A plain bound-VALUE change (case 3 below)
   * leaves the element alone — `context.subscribe()` (wired in
   * `makeRenderContext`, already exercised by every `_bindValue` call in
   * oat-renderer.js) patches its DOM in place instead, preserving element
   * identity (and, for a focused `<input>`, focus/cursor position).
   *
   * `node.props`'s identity changes for THREE distinct reasons, and only two
   * of them need a rebuild:
   *   1. STRUCTURAL: a ref-field child is added/removed/reordered/swapped,
   *      or one of this node's children upgrades from a placeholder to its
   *      real component once the definition arrives (the parent
   *      re-materializes and its ref-field value becomes a *different*
   *      ComponentNode object — see `node-resolver.js`'s
   *      `childNode`/`stabilize`). Needs a rebuild.
   *   2. STATIC LITERAL RESEND: a changed, non-databound literal property
   *      resent via a fresh `updateComponents` for this component (e.g. an
   *      agent re-sending `{id:'root', component:'Text', text:'v2'}`).
   *      Needs a rebuild — this has no `subscribe()` path to patch it in
   *      place, since a literal was never subscribed to anything.
   *   3. BOUND VALUE ONLY: the wire-level property definition is unchanged
   *      (still e.g. `{path: '/form/name'}`) and only the value behind that
   *      path changed, via `updateDataModel`. `NodeResolver.materialize`
   *      wraps every DYNAMIC property in a `ResolvedBinding`, and
   *      `stabilize`/`sameBinding` (nodes/resolved-binding.js) compare THAT
   *      wrapper by value — so a bound value changing produces a new
   *      `ResolvedBinding` and changes `node.props` too, exactly like cases
   *      1 and 2 do. Must NOT rebuild: `subscribe()` already patches this.
   *
   * Distinguishing them: `surface.componentsModel.get(node.componentId)
   * .properties` (the RAW, pre-resolution wire payload for this node's own
   * component — see `ComponentContext`/`ComponentModel`) only changes
   * *identity* when an `updateComponents` message resends this exact id
   * (`processUpdateComponentsMessage`'s `existing.properties = properties`
   * always assigns a fresh object) — cases 1 (when the resend is what
   * carries the ref-field change) and 2. It is completely untouched by
   * `updateDataModel` (case 3), which only ever calls `surface.dataModel
   * .set(...)`. That alone would miss the "placeholder → resolved" flavor
   * of case 1, where nothing about *this* node's own wire properties is
   * resent (only a *child's* component arrives) — so this also tracks a
   * ref-field signature: the resolved value of every property
   * `webCore.extractRefFields` classifies as a child pointer. NodeResolver's
   * own `stabilize` keeps a ref-field's resolved value reference-identical
   * across a `materialize()` pass whenever every child it points to is
   * unchanged, and changes it (new array or a new ComponentNode) whenever a
   * child is added/removed/reordered/upgraded — exactly the structural
   * signal case 1 needs, independent of whether *this* node's own
   * properties were resent. A rebuild fires when either signal changed;
   * when neither did, the fresh `node.props` value is left for
   * `context.subscribe()` (already reacting to the same underlying data
   * change) to patch in place.
   *
   * Exactly one of these effects ever exists per live node (never disposed
   * and recreated): `renderNode`'s memoization above is what prevents a
   * second one — an ancestor's rebuild calls `renderNode` again for every
   * child, and an unchanged child (the *same* ComponentNode object) is
   * returned from `liveNodes` instead of being re-rendered and re-watched.
   * Without that memoization, every ancestor-triggered rebuild would attach
   * one more still-live watcher to each stable descendant, stacking
   * subscriptions that all fire (and all rebuild+replace) on the next change
   * to that descendant.
   */
  function watchNode(node, surface, entry) {
    let first = true;
    let lastRawProps;
    let lastRefSignature;
    const stop = webCore.effect(() => {
      const resolved = webCore.getValue(node.props); // track
      if (first) {
        first = false; // this run just registers the dependency
        lastRawProps = rawPropsOf(node, surface);
        lastRefSignature = refSignatureOf(node, resolved);
        return;
      }
      const rawProps = rawPropsOf(node, surface);
      const refSignature = refSignatureOf(node, resolved);
      const structural = rawProps !== lastRawProps
        || !sameRefSignature(refSignature, lastRefSignature);
      lastRawProps = rawProps;
      lastRefSignature = refSignature;
      if (!structural) return; // bound-value-only change: subscribe() already patched it
      try {
        const replacement = renderOnce(node, surface);
        entry.el.replaceWith(replacement);
        entry.el = replacement;
      } catch (err) {
        onError(err);
      }
    });
    node.addCleanup(stop);
  }

  /** The RAW, pre-resolution properties object for `node`'s own component
   *  (or `undefined` if it has since been deleted from the model). Its
   *  *identity* changes only when an `updateComponents` message resends
   *  this exact id — never on `updateDataModel`. See `watchNode`'s
   *  docstring for why this is one of the two structural-change signals. */
  function rawPropsOf(node, surface) {
    return surface.componentsModel.get(node.componentId)?.properties;
  }

  /**
   * Snapshot of `node`'s own ref-field (child-pointer) values, keyed by
   * property name, taken from the already-resolved `node.props`. Returns
   * `null` for a component type with no ref fields (e.g. `Text`,
   * `TextField`) — such a node's rebuild trigger relies entirely on
   * `rawPropsOf`. See `watchNode`'s docstring for why comparing these by
   * reference (not deep equality) is the correct structural-change check.
   */
  function refSignatureOf(node, resolvedProps) {
    const api = catalog.components.get(node.type);
    const refFields = api ? webCore.extractRefFields(api.schema) : null;
    if (!refFields || refFields.size === 0) return null;
    const sig = new Map();
    for (const key of refFields.keys()) sig.set(key, resolvedProps?.[key]);
    return sig;
  }

  /** Reference-equality comparison of two `refSignatureOf` snapshots. */
  function sameRefSignature(a, b) {
    if (a === b) return true;
    if (!a || !b || a.size !== b.size) return false;
    for (const [key, value] of a) {
      if (!Object.is(value, b.get(key))) return false;
    }
    return true;
  }

  /** componentId -> Map<node, surface> of nodes whose `renderChild` fallback
   *  is waiting on it (see `waitForRawChild` / `settlePendingRawChildren`). */
  const pendingRawChildren = new Map();

  /**
   * Registers `node` to be rebuilt (via the same rebuild-and-`replaceWith`
   * step `watchNode` uses) once `id` appears in the surface's component
   * model. `renderChild`'s componentsModel fallback is a one-shot lookup
   * with no NodeResolver-managed placeholder/upgrade lifecycle behind it
   * (that lifecycle only exists for ref shapes `extractRefFields`
   * classifies — see catalog-compat.js's note on why an array-of-objects
   * shape like Tabs' `tabs: [{title, child}]` never gets one, even after
   * cataloging `child` as a ComponentId: schema_loader.js's own
   * `convertPropertyToZod` collapses every nested `type: 'object'` to an
   * untyped `z.record(z.any())`, so `extractRefFields`'s nested-ComponentId
   * detection — which requires a real `ZodObject` — can never fire for it
   * regardless of what shape this catalog declares), so without this, a
   * forward reference to a component sent later would never be discovered.
   *
   * Deliberately does not subscribe to `surface.componentsModel.onCreated`:
   * that emitter's own `emit` is `async` and iterates its listener Set with
   * `await` between each one (see @a2ui/web_core's `common/events.js`), and
   * `addComponent` never awaits it — so only the *first* listener ever
   * registered (NodeResolver's own) runs before `addComponent` returns;
   * every listener added afterwards (like one registered here, from inside
   * that first listener's own synchronous call chain) is only reached on a
   * later microtask, well after `processMessages` has already returned to
   * its caller. `settlePendingRawChildren` below is called synchronously at
   * the end of every `processMessages` batch instead, re-reading
   * `componentsModel.get(id)` directly — a plain, synchronous Map read that
   * is already up to date by then regardless of that emitter's async fan-out.
   */
  function waitForRawChild(id, node, surface) {
    let waiters = pendingRawChildren.get(id);
    if (!waiters) { waiters = new Map(); pendingRawChildren.set(id, waiters); }
    if (waiters.has(node)) return;
    waiters.set(node, surface);
    node.addCleanup(() => {
      const stillWaiting = pendingRawChildren.get(id);
      if (!stillWaiting) return;
      stillWaiting.delete(node);
      if (stillWaiting.size === 0) pendingRawChildren.delete(id);
    });
  }

  /** Rebuilds every node whose awaited raw-child id has since appeared in
   *  its surface's component model. Called once per `processMessages` batch. */
  function settlePendingRawChildren() {
    for (const [id, waiters] of [...pendingRawChildren]) {
      for (const [node, surface] of [...waiters]) {
        if (!surface.componentsModel.get(id)) continue;
        waiters.delete(node);
        if (waiters.size === 0) pendingRawChildren.delete(id);
        const entry = liveNodes.get(node);
        if (!entry) continue; // node's own element was itself replaced/disposed meanwhile
        try {
          const replacement = renderOnce(node, surface);
          entry.el.replaceWith(replacement);
          entry.el = replacement;
        } catch (err) {
          onError(err);
        }
      }
    }
  }

  /**
   * Replace child-reference property values (which NodeResolver resolves to
   * live ComponentNode objects) with plain id strings/arrays so every
   * existing _render* method keeps consuming ids exactly as in direct mode.
   * Everything else stays the raw pre-resolution value.
   *
   * Reads `node.props` via `getValue` (not `peekValue`): this is a
   * deliberate dependency registration, needed by whichever effect is
   * currently rendering (the surface's top-level effect on first mount, or
   * a node's own `watchNode` effect on a targeted re-render) so it re-fires
   * on every subsequent change, including a placeholder → resolved upgrade
   * arriving later for one of this node's children (the parent's ref-field
   * value becomes a *different* ComponentNode object once that happens —
   * see `watchNode`'s docstring).
   */
  function normalizeRefFields(raw, node) {
    const props = { ...raw };
    const childMap = new Map();
    const api = catalog.components.get(node.type);
    if (!api) return { props, childMap };
    const refFields = webCore.extractRefFields(api.schema);
    const resolved = webCore.getValue(node.props);
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
      // OatRenderer's `_getByPath` (renderer/oat-renderer.js) has no notion
      // of "scope" of its own: it unconditionally strips any leading '/' off
      // a binding's path and indexes straight into whatever this returns —
      // unlike `DataContext.resolvePath`, which treats a leading '/' as
      // root-anchored regardless of the calling context's own scope, and
      // anything else as relative to it. A List template item's own
      // `node.dataPath` is its per-element base path (e.g. '/items/0'), so
      // serving *either* the surface root alone (relative item paths like
      // `{path: 'label'}` resolve to the wrong, root-level object) or the
      // item's own scope alone (absolute paths like `{path: '/global/msg'}`,
      // legitimately reaching outside the item's own subtree, resolve to
      // undefined) breaks one of the two path styles. Shallow-merging both —
      // item-scope keys winning — lets `_getByPath`'s single unconditional
      // strip-and-index serve both: a bare `'label'` finds the item's own
      // key (present only in the item scope for a normal, non-colliding
      // template), and a leading-`/` path like `/global/msg` strips to
      // `global/msg` and finds it via the root scope, since a template
      // item's own fields don't ordinarily share a name with a root-level
      // data key. (A field that *does* collide with a root-level key of the
      // same name — e.g. an item shaped `{global: ...}` used alongside a
      // root `/global/...` path from the same item's subtree — would still
      // resolve to the item's own value; this is a narrow, accepted
      // limitation of `_getByPath` having no real absolute/relative
      // distinction, not something fixable without touching it.)
      getDataModel: () => {
        try {
          const root = surface.dataModel.get('/') ?? {};
          if (node.dataPath === '/') return root;
          const scoped = surface.dataModel.get(node.dataPath);
          return scoped && typeof scoped === 'object' && !Array.isArray(scoped)
            ? { ...root, ...scoped }
            : root;
        } catch { return {}; }
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
        // Not yet in the surface's component model. This happens whenever a
        // ref shape `extractRefFields` cannot classify (e.g. Tabs' array-of-
        // objects `tabs[].child` — see catalog-compat.js's comment on
        // relaxing array/object properties to a permissive schema) points at
        // a component sent later in the *same* updateComponents batch: the
        // batch applies components in array order and fires
        // componentsModel.onCreated synchronously per component (see
        // message-processor.js's processUpdateComponentsMessage), so a
        // forward reference is genuinely absent from the model at the moment
        // this parent first renders. Unlike a ref-classified child (whose
        // placeholder/upgrade lifecycle NodeResolver itself manages via
        // pendingParents), nothing else ever retries this lookup — wait for
        // the id to arrive and then rebuild this node in place, the same way
        // `watchNode` reacts to a `node.props` change.
        waitForRawChild(id, node, surface);
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
      } finally {
        settlePendingRawChildren();
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
