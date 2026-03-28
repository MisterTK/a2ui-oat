/**
 * formatNumber -- Locale-aware number formatting using Intl.NumberFormat.
 *
 * @param {object} args
 * @param {*}      args.value       - Number value (required, may be data-bound).
 * @param {string} [args.locale]    - BCP 47 locale tag (default: navigator.language).
 * @param {object} [args.options]   - Intl.NumberFormat options (style, currency, etc.).
 * @param {string} [args.targetPath]- Data-model path to write the formatted string to.
 * @param {object} context          - Renderer context (resolveDynamic, setDataModel).
 * @returns {string} The formatted number string.
 */
export function formatNumber(args, context) {
  const resolve = context.resolveDynamic || identity;

  const raw = resolve(args.value);
  if (raw == null) {
    throw new Error("formatNumber: 'value' is required");
  }

  const num = Number(raw);
  if (Number.isNaN(num)) {
    throw new Error("formatNumber: 'value' must be numeric");
  }

  const locale = resolveLocale(args.locale, resolve);
  const options = args.options ? resolve(args.options) : undefined;
  const formatted = new Intl.NumberFormat(locale, options).format(num);

  writeToModel(args.targetPath, formatted, resolve, context.setDataModel);
  return formatted;
}

function resolveLocale(raw, resolve) {
  if (raw) return resolve(raw);
  return typeof navigator !== "undefined" ? navigator.language : "en";
}

function writeToModel(targetPath, value, resolve, setDataModel) {
  if (targetPath && typeof setDataModel === "function") {
    setDataModel(resolve(targetPath), value);
  }
}

function identity(v) { return v; }
