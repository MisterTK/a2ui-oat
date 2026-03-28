/**
 * subscribeSSE -- EventSource-based SSE subscription.
 *
 * Opens an EventSource connection to the specified URL, listens for events,
 * parses each event's data as JSON, and writes the parsed data to the data
 * model at the given targetPath. Returns a cleanup function that closes the
 * connection.
 *
 * Parameters (via args):
 *   url        (string, required)  -- SSE endpoint URL
 *   targetPath (string, required)  -- JSON Pointer path in data model
 *   eventName  (string, optional)  -- event type to listen for (default: "message")
 *
 * Context:
 *   setDataModel(path, value)  -- writes a value into the data model
 *   resolveDynamic(value)      -- resolves dynamic/bound values
 */
export function subscribeSSE(args, context) {
  const url = context.resolveDynamic(args.url);
  const targetPath = context.resolveDynamic(args.targetPath);
  const eventName = args.eventName
    ? context.resolveDynamic(args.eventName)
    : "message";

  if (!url || !targetPath) {
    console.warn("[subscribeSSE] missing required parameter: url or targetPath");
    return () => {};
  }

  let source;
  try {
    source = new EventSource(url);
  } catch (err) {
    console.warn("[subscribeSSE] failed to open EventSource:", err);
    return () => {};
  }

  const handler = (event) => {
    try {
      const data = JSON.parse(event.data);
      context.setDataModel(targetPath, data);
    } catch (err) {
      console.warn("[subscribeSSE] failed to parse event data:", err);
    }
  };

  source.addEventListener(eventName, handler);

  source.addEventListener("error", () => {
    // EventSource reconnects automatically; log for observability.
    console.warn("[subscribeSSE] connection error (will auto-reconnect):", url);
  });

  return () => {
    source.removeEventListener(eventName, handler);
    source.close();
  };
}
