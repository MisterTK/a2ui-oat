/**
 * not -- Logical NOT of a value.
 *
 * @param {object} args
 * @param {*}      args.value - Value to negate (may be data-bound).
 * @param {object} context    - Renderer context (resolveDynamic).
 * @returns {boolean} The negated boolean value.
 */
export function not(args, context) {
  const resolve = context.resolveDynamic || identity;
  return !Boolean(resolve(args.value));
}

function identity(v) { return v; }
