/**
 * openUrl -- Opens a URL in a new browser tab or window.
 *
 * @param {object} args
 * @param {string} args.url      - URL to open (required, may be data-bound).
 * @param {string} [args.target] - Browsing context target (default: '_blank').
 * @param {object} context       - Renderer context (resolveDynamic).
 */
export function openUrl(args, context) {
  const resolve = context.resolveDynamic || identity;

  const url = resolve(args.url);
  if (!url) return;

  const target = args.target ? resolve(args.target) : '_blank';
  window.open(url, target);
}

function identity(v) { return v; }
