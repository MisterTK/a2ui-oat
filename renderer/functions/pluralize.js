/**
 * pluralize -- Basic pluralization based on count.
 *
 * @param {object} args
 * @param {*}      args.count       - Numeric count (required, may be data-bound).
 * @param {string} args.singular    - Singular form of the word (required).
 * @param {string} [args.plural]    - Plural form (default: singular + 's').
 * @param {string} [args.targetPath]- Data-model path to write the result to.
 * @param {object} context          - Renderer context (resolveDynamic, setDataModel).
 * @returns {string} The singular or plural form.
 */
export function pluralize(args, context) {
  const resolve = context.resolveDynamic || identity;

  const count = Number(resolve(args.count));
  const singular = resolve(args.singular) || '';
  const plural = resolve(args.plural) || singular + 's';
  const result = count === 1 ? singular : plural;

  writeToModel(args.targetPath, result, resolve, context.setDataModel);
  return result;
}

function writeToModel(targetPath, value, resolve, setDataModel) {
  if (targetPath && typeof setDataModel === 'function') {
    setDataModel(resolve(targetPath), value);
  }
}

function identity(v) { return v; }
