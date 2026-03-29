/**
 * numeric -- Validates that a value is numeric.
 *
 * @param {object} args
 * @param {*}      args.value - Value to validate (may be data-bound).
 * @param {object} context    - Renderer context (resolveDynamic).
 * @returns {boolean} True if the value is a valid number.
 */
export function numeric(args, context) {
  const resolve = context.resolveDynamic || identity;
  const value = resolve(args.value);
  return value != null && !isNaN(Number(value));
}

function identity(v) { return v; }
