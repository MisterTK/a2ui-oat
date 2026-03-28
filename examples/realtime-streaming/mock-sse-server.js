/**
 * mock-sse-server.js -- SSE metrics stream for the a2ui-oat realtime example.
 *
 * Runs a zero-dependency Node.js HTTP server on port 3002.
 * Endpoint: GET /metrics/stream  (text/event-stream)
 *
 * Emits a JSON event every 2 seconds with fluctuating CPU, memory,
 * request count, error count, and uptime values.
 */

import { createServer } from "node:http";

// ---------------------------------------------------------------------------
// Metric simulation helpers
// ---------------------------------------------------------------------------

let uptimeSeconds = 0;
let cumulativeRequests = 14_832;
let cumulativeErrors = 42;

/** Return a value that drifts from `current` by up to `maxDelta`, clamped. */
function drift(current, maxDelta, min, max) {
  const delta = (Math.random() - 0.5) * 2 * maxDelta;
  return Math.min(max, Math.max(min, current + delta));
}

let cpu = 45;
let memory = 62;

function generateMetrics() {
  uptimeSeconds += 2;
  cpu = Math.round(drift(cpu, 8, 2, 98));
  memory = Math.round(drift(memory, 3, 30, 95));
  cumulativeRequests += Math.floor(Math.random() * 120);
  cumulativeErrors += Math.random() < 0.3 ? Math.floor(Math.random() * 5) : 0;

  return {
    cpu,
    memory,
    requests: cumulativeRequests,
    errors: cumulativeErrors,
    uptime: uptimeSeconds,
  };
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

function handleRequest(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname !== "/metrics/stream") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  // SSE response
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Send initial event immediately
  const initial = generateMetrics();
  res.write(`data: ${JSON.stringify(initial)}\n\n`);

  // Then every 2 seconds
  const interval = setInterval(() => {
    const metrics = generateMetrics();
    res.write(`data: ${JSON.stringify(metrics)}\n\n`);
  }, 2000);

  // Clean up when the client disconnects
  req.on("close", () => {
    clearInterval(interval);
  });
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const PORT = 3002;

createServer(handleRequest).listen(PORT, () => {
  console.log(`Mock SSE metrics server running at http://localhost:${PORT}/metrics/stream`);
  console.log("  Emitting CPU, memory, requests, errors, uptime every 2 seconds");
});
