/**
 * subscribeWebSocket -- WebSocket-based subscription.
 *
 * Opens a WebSocket connection to the specified URL, listens for incoming
 * messages, parses each message, and writes the parsed data to the data model
 * at the given targetPath. Implements reconnection with exponential backoff.
 * Returns a cleanup function that closes the connection.
 *
 * Parameters (via args):
 *   url           (string, required)  -- WebSocket URL (ws:// or wss://)
 *   targetPath    (string, required)  -- JSON Pointer path in data model
 *   messageParser (string, optional)  -- "json" (default), "text"
 *
 * Context:
 *   setDataModel(path, value)  -- writes a value into the data model
 *   resolveDynamic(value)      -- resolves dynamic/bound values
 */

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const BACKOFF_MULTIPLIER = 2;

export function subscribeWebSocket(args, context) {
  const url = context.resolveDynamic(args.url);
  const targetPath = context.resolveDynamic(args.targetPath);
  const parserType = args.messageParser
    ? context.resolveDynamic(args.messageParser)
    : "json";

  if (!url || !targetPath) {
    console.warn("[subscribeWebSocket] missing required parameter: url or targetPath");
    return () => {};
  }

  const parse = buildParser(parserType);

  let socket = null;
  let backoff = INITIAL_BACKOFF_MS;
  let reconnectTimer = null;
  let disposed = false;

  function connect() {
    if (disposed) return;

    try {
      socket = new WebSocket(url);
    } catch (err) {
      console.warn("[subscribeWebSocket] failed to create WebSocket:", err);
      scheduleReconnect();
      return;
    }

    socket.addEventListener("open", () => {
      backoff = INITIAL_BACKOFF_MS;
    });

    socket.addEventListener("message", (event) => {
      try {
        const data = parse(event.data);
        context.setDataModel(targetPath, data);
      } catch (err) {
        console.warn("[subscribeWebSocket] failed to parse message:", err);
      }
    });

    socket.addEventListener("error", () => {
      console.warn("[subscribeWebSocket] connection error:", url);
    });

    socket.addEventListener("close", () => {
      if (!disposed) {
        scheduleReconnect();
      }
    });
  }

  function scheduleReconnect() {
    if (disposed) return;
    console.warn(
      "[subscribeWebSocket] reconnecting in " + backoff + "ms:",
      url
    );
    reconnectTimer = setTimeout(() => {
      backoff = Math.min(backoff * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
      connect();
    }, backoff);
  }

  connect();

  return () => {
    disposed = true;
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (socket) {
      socket.close();
      socket = null;
    }
  };
}

function buildParser(parserType) {
  if (parserType === "text") {
    return (raw) => String(raw);
  }
  return (raw) => JSON.parse(raw);
}
