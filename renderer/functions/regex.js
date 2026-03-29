/**
 * regex -- Validates a value against a regular expression pattern.
 *
 * @param {object} args
 * @param {*}      args.value   - Value to validate (may be data-bound).
 * @param {string} args.pattern - Regular expression pattern string.
 * @param {string} [args.flags] - Optional regex flags (e.g., 'i', 'g', 'm').
 * @param {object} context      - Renderer context (resolveDynamic).
 * @returns {boolean} True if the value matches the pattern.
 */
export function regex(args, context) {
  const resolve = context.resolveDynamic || identity;
  const value = String(resolve(args.value) ?? '');
  const pattern = resolve(args.pattern);
  if (!pattern) return false;
  const flags = args.flags ? resolve(args.flags) : undefined;
  try {
    return new RegExp(pattern, flags).test(value);
  } catch (_) {
    console.warn('regex: invalid pattern or flags', pattern, flags);
    return false;
  }
}

function identity(v) { return v; }
