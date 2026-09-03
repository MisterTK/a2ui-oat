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
   *
   * Reads `node.props` via `getValue` (not `peekValue`): the caller runs
   * inside the surface's top-level render effect, and this is a deliberate
   * dependency registration. NodeResolver resolves ref-field children
   * asynchronously relative to the *first* materialization of a parent (a
   * child that hasn't arrived yet renders as a placeholder, then the parent
   * re-materializes once it does) — without tracking `node.props` here, the
   * render effect would only ever re-fire when the *root* node identity
   * itself changes, and would miss every subsequent placeholder → resolved
   * upgrade happening deeper in the tree within the same message batch.
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
