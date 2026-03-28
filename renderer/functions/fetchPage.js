import { fetchBase } from "./fetchBase.js";

/**
 * Client-side pagination registered function.
 *
 * Fetches a page of data from an API endpoint using an optional cursor,
 * then REPLACES the data at targetPath in the data model with the response.
 *
 * @param {object} args
 * @param {string}        args.url        - API endpoint URL.
 * @param {string|object} args.cursor     - Current cursor/page token (DynamicString).
 * @param {string}        args.targetPath - JSON Pointer path in the data model to write results.
 * @param {string}        [args.method]   - HTTP method (default: "GET").
 * @param {object} context
 * @param {function} context.getDataModel  - Returns the current data model value at a path.
 * @param {function} context.setDataModel  - Writes a value to the data model at a path.
 * @param {function} context.resolveDynamic - Resolves a DynamicString (literal or data-model path).
 */
export async function fetchPage(args, context) {
  return fetchBase("fetchPage", args, context, (_existing, incoming) => incoming);
}
