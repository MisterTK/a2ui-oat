/**
 * required -- Validates that a value is non-null and non-empty.
 *
 * @param {object} args
 * @param {*}      args.value - Value to validate (may be data-bound).
 * @param {object} context    - Renderer context (resolveDynamic).
 * @returns {boolean} True if the value is present and non-empty.
 */
export function required(args, context) {
  const resolve = context.resolveDynamic || identity;
  const value = resolve(args.value);
  return value != null && value !== '';
}

function identity(v) { return v; }
