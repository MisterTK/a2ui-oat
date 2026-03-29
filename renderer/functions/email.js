/**
 * email -- Validates that a value is a valid email address.
 *
 * @param {object} args
 * @param {*}      args.value - Value to validate (may be data-bound).
 * @param {object} context    - Renderer context (resolveDynamic).
 * @returns {boolean} True if the value matches a basic email pattern.
 */
export function email(args, context) {
  const resolve = context.resolveDynamic || identity;
  const value = String(resolve(args.value) ?? '');
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function identity(v) { return v; }
