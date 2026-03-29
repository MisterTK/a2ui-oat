/**
 * or -- Logical OR over an array of conditions.
 *
 * @param {object}   args
 * @param {Array<*>} args.conditions - Array of values/expressions to evaluate.
 * @param {object}   context         - Renderer context (resolveDynamic).
 * @returns {boolean} True if any condition is truthy.
 */
export function or(args, context) {
  const resolve = context.resolveDynamic || identity;
  const conditions = args.conditions || [];
  return conditions.some((c) => Boolean(resolve(c)));
}

function identity(v) { return v; }
