/**
 * formatDate -- Locale-aware date formatting using Intl.DateTimeFormat.
 *
 * @param {object} args
 * @param {*}      args.value       - Date value or ISO string (required, may be data-bound).
 * @param {string} [args.locale]    - BCP 47 locale tag (default: navigator.language).
 * @param {object} [args.options]   - Intl.DateTimeFormat options.
 * @param {string} [args.targetPath]- Data-model path to write the formatted string to.
 * @param {object} context          - Renderer context (resolveDynamic, setDataModel).
 * @returns {string} The formatted date string.
 */
export function formatDate(args, context) {
  const resolve = context.resolveDynamic || identity;

  const raw = resolve(args.value);
  if (raw == null) {
    throw new Error("formatDate: 'value' is required");
  }

  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error("formatDate: unable to parse value as a date");
  }

  const locale = resolveLocale(args.locale, resolve);
  const options = args.options ? resolve(args.options) : undefined;
  const formatted = new Intl.DateTimeFormat(locale, options).format(date);

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
