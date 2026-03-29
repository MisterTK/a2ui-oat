/**
 * regex -- Validates a value against a regular expression pattern.
 *
 * @param {object} args
 * @param {*}      args.value   - Value to validate (may be data-bound).
 * @param {string} args.pattern - Regular expression pattern string.
 * @param {object} context      - Renderer context (resolveDynamic).
 * @returns {boolean} True if the value matches the pattern.
 */
export function regex(args, context) {
  const resolve = context.resolveDynamic || identity;
  const value = String(resolve(args.value) ?? '');
  const pattern = resolve(args.pattern);
  if (!pattern) return false;
  return new RegExp(pattern).test(value);
}

function identity(v) { return v; }
