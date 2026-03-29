/**
 * formatCurrency -- Currency formatting via Intl.NumberFormat.
 *
 * @param {object} args
 * @param {*}      args.value       - Numeric value to format (required, may be data-bound).
 * @param {string} [args.currency]  - ISO 4217 currency code (default: 'USD').
 * @param {string} [args.locale]    - BCP 47 locale tag (default: navigator.language).
 * @param {string} [args.targetPath]- Data-model path to write the formatted result to.
 * @param {object} context          - Renderer context (resolveDynamic, setDataModel).
 * @returns {string} The formatted currency string.
 */
export function formatCurrency(args, context) {
  const resolve = context.resolveDynamic || identity;

  const value = Number(resolve(args.value));
  if (isNaN(value)) return '';

  const currency = resolve(args.currency) || 'USD';
  const locale = args.locale
    ? resolve(args.locale)
    : (typeof navigator !== 'undefined' ? navigator.language : 'en-US');

  const result = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(value);

  writeToModel(args.targetPath, result, resolve, context.setDataModel);
  return result;
}

function writeToModel(targetPath, value, resolve, setDataModel) {
  if (targetPath && typeof setDataModel === 'function') {
    setDataModel(resolve(targetPath), value);
  }
}

function identity(v) { return v; }
