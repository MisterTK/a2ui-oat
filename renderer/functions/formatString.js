/**
 * formatString -- String interpolation with ${/path} syntax.
 *
 * Replaces `${/data/model/path}` references in a template with values
 * resolved from the data model.
 *
 * @param {object} args
 * @param {string} args.template    - Template string with ${/path} placeholders (required).
 * @param {string} [args.targetPath]- Data-model path to write the result to.
 * @param {object} context          - Renderer context (resolveDynamic, getDataModel, setDataModel).
 * @returns {string} The interpolated string.
 */
export function formatString(args, context) {
  const resolve = context.resolveDynamic || identity;

  const template = resolve(args.template);
  if (!template) return '';

  const model = typeof context.getDataModel === 'function'
    ? context.getDataModel()
    : {};

  const result = template.replace(/\$\{([^}]+)\}/g, (_, expr) => {
    const path = expr.trim();
    if (path.startsWith('/')) {
      const segments = path.replace(/^\//, '').split(/[/.]/);
      let current = model;
      for (const seg of segments) {
        if (current == null) return '';
        current = current[seg];
      }
      return current ?? '';
    }
    return expr;
  });

  writeToModel(args.targetPath, result, resolve, context.setDataModel);
  return result;
}

function writeToModel(targetPath, value, resolve, setDataModel) {
  if (targetPath && typeof setDataModel === 'function') {
    setDataModel(resolve(targetPath), value);
  }
}

function identity(v) { return v; }
