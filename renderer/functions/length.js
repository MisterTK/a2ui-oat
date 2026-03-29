/**
 * length -- Validates that a string's length falls within a range.
 *
 * @param {object} args
 * @param {*}      args.value - Value to validate (may be data-bound).
 * @param {number} [args.min] - Minimum length (default: 0).
 * @param {number} [args.max] - Maximum length (default: Infinity).
 * @param {object} context    - Renderer context (resolveDynamic).
 * @returns {boolean} True if the value length is within range.
 */
export function length(args, context) {
  const resolve = context.resolveDynamic || identity;
  const value = String(resolve(args.value) ?? '');
  const min = args.min != null ? Number(args.min) : 0;
  const max = args.max != null ? Number(args.max) : Infinity;
  return value.length >= min && value.length <= max;
}

function identity(v) { return v; }
