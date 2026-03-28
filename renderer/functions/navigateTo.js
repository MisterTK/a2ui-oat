/**
 * navigateTo -- Client-side SPA routing backed by tinyrouter.js.
 *
 * Uses window.history.pushState to update the URL and dispatches a popstate
 * event so any listeners (including tinyrouter) pick up the change.
 *
 * @param {object} args
 * @param {string} args.path     - Route path to navigate to (required).
 * @param {object} [args.params] - Optional route parameters appended as query string.
 * @param {object} context       - Renderer context (resolveDynamic, dispatchAction, setDataModel).
 */
export function navigateTo(args, context) {
  const resolve = context.resolveDynamic || identity;

  const path = resolve(args.path);
  if (typeof path !== "string" || path === "") {
    throw new Error("navigateTo: 'path' must be a non-empty string");
  }

  const params = args.params ? resolve(args.params) : undefined;

  let url = path;
  if (params && typeof params === "object") {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value != null) {
        search.set(key, String(value));
      }
    }
    const qs = search.toString();
    if (qs) {
      url += (url.includes("?") ? "&" : "?") + qs;
    }
  }

  const state = { path: url, params };
  window.history.pushState(state, "", url);

  // pushState does not fire popstate -- dispatch manually so tinyrouter reacts.
  window.dispatchEvent(new PopStateEvent("popstate", { state }));
}

function identity(v) { return v; }
