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
   * for the node's whole lifetime): whenever `node.props` changes, rebuild
   * this node's element and swap it in place with `replaceWith`. Covers
   * every reason `node.props` can change —
   *   - a ref-field swap (list items added/removed/reordered, a single ref
   *     replaced),
   *   - one of this node's children upgrading from a placeholder to its real
   *     component once the definition arrives (the parent re-materializes
   *     and its ref-field value becomes a *different* ComponentNode object,
   *     even though that object's instanceId is unchanged — see
   *     `node-resolver.js`'s `childNode`/`stabilize`),
   *   - a changed *static* (non-databound) literal property, resent via a
   *     fresh `updateComponents` for this component.
   * Bound (DYNAMIC, `{path: ...}`) values never touch `node.props` — they
   * update their own DOM in place through `subscribe()`/DataContext — so
   * this effect never fires for them; no signature/diff check is needed
   * beyond that, because `MutableComponentNode.setProps` already only calls
   * through to the signal when a shallow comparison shows a real change, so
   * every fire here is one this node actually needs to act on.
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
    const stop = webCore.effect(() => {
      webCore.getValue(node.props); // track
      if (first) { first = false; return; } // this run just registers the dependency
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
