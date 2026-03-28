/**
 * Shared implementation for fetchPage and fetchAndAppend.
 *
 * @param {string}   name     - Function name used in error messages.
 * @param {object}   args     - Registered function arguments (url, cursor, targetPath, method).
 * @param {object}   context  - A2UI context (getDataModel, setDataModel, resolveDynamic).
 * @param {function} merge    - (existing, incoming) => value to write at targetPath.
 * @returns {Promise<object|null>} The raw response data, or null on error.
 */
export async function fetchBase(name, args, context, merge) {
  try {
    const { getDataModel, setDataModel, resolveDynamic } = context;

    const url = resolveDynamic(args.url);
    const cursor = args.cursor != null ? resolveDynamic(args.cursor) : null;
    const targetPath = args.targetPath;
    const method = (args.method || "GET").toUpperCase();

    if (!url) {
      console.error(name + ": url parameter is required");
      return null;
    }

    if (!targetPath) {
      console.error(name + ": targetPath parameter is required");
      return null;
    }

    const requestUrl = buildUrl(url, cursor);
    const response = await fetch(requestUrl, { method });

    if (!response.ok) {
      console.error(name + ": HTTP " + response.status + " " + response.statusText);
      return null;
    }

    const data = await response.json();
    const items = data.data ?? data.results ?? data.items ?? data;

    setDataModel(targetPath, merge(getDataModel(targetPath), items));

    const nextCursor = data.nextCursor ?? data.next_cursor ?? data.nextPageToken;
    if (nextCursor !== undefined) {
      const cursorPath = deriveCursorPath(args.cursor) || "/pagination/nextCursor";
      setDataModel(cursorPath, nextCursor);
    }

    return data;
  } catch (err) {
    console.error(name + ":", err);
    return null;
  }
}

/**
 * Builds a request URL, appending cursor as a query parameter when present.
 */
function buildUrl(url, cursor) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    // Relative path -- fall back to string manipulation.
    if (!cursor) return url;
    const separator = url.includes("?") ? "&" : "?";
    return url + separator + "cursor=" + encodeURIComponent(cursor);
  }

  if (cursor) {
    parsed.searchParams.set("cursor", cursor);
  }
  return parsed.toString();
}

/**
 * Extracts a data-model path from a DynamicString cursor parameter.
 * A DynamicString with a "path" property (e.g. {"path": "/pagination/nextCursor"})
 * indicates where the cursor lives in the data model.
 */
function deriveCursorPath(cursorArg) {
  if (cursorArg != null && typeof cursorArg === "object" && typeof cursorArg.path === "string") {
    return cursorArg.path;
  }
  return null;
}
