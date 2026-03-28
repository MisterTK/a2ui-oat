/**
 * debounce -- Action wrapper that debounces another action.
 *
 * Maintains a per-action timer keyed by the stringified targetAction.
 * If called again before the delay expires, the previous timer is cleared
 * and a new one is started. Useful for search-as-you-type with Autocomplete.
 *
 * @param {object} args
 * @param {object} args.targetAction   - The action to debounce (functionCall object, required).
 * @param {number} [args.delayMs=300]  - Debounce delay in milliseconds.
 * @param {object} context             - Renderer context (resolveDynamic, dispatchAction, setDataModel).
 */

/** @type {Map<string, number>} */
const timers = new Map();

export function debounce(args, context) {
  const resolve = context.resolveDynamic || identity;
  const { dispatchAction } = context;

  const targetAction = args.targetAction;
  if (!targetAction || typeof targetAction !== "object") {
    throw new Error("debounce: 'targetAction' must be an action object");
  }
  if (typeof dispatchAction !== "function") {
    throw new Error("debounce: context.dispatchAction is required");
  }

  const delayMs = args.delayMs != null ? Number(resolve(args.delayMs)) : 300;

  let key;
  try {
    key = JSON.stringify(targetAction);
  } catch (_) {
    key = String(targetAction);
  }

  const existing = timers.get(key);
  if (existing != null) {
    clearTimeout(existing);
  }

  const timer = setTimeout(function () {
    timers.delete(key);
    dispatchAction(targetAction);
  }, delayMs);

  timers.set(key, timer);
}

function identity(v) { return v; }
