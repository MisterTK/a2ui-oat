# Realtime Streaming Example

Demonstrates the **real-time streaming** pattern from the a2ui-oat architecture (Section 6.5). The agent creates a surface once with components bound to live metric paths. On surface creation, the `subscribeSSE` registered function opens an EventSource. Incoming events are written to the data model and bound components re-render automatically -- no agent involvement after setup.

## Files

| File | Purpose |
|------|---------|
| `mock-sse-server.js` | Zero-dependency Node.js SSE server emitting metric events every 2 seconds |
| `index.html` | A2UI Mode page with bound Progress, Meter, Badge, Text, and Alert components |

## How to run

1. Start the mock SSE server:

   ```bash
   node mock-sse-server.js
   ```

   The server starts on `http://localhost:3002`.

2. Open `index.html` in a browser. If you need to serve it over HTTP:

   ```bash
   npx serve .
   ```

   Then open `http://localhost:3000` (or whichever port the file server reports).

## What to observe

- **CPU (Progress):** A `<progress>` bar that fluctuates as CPU values arrive.
- **Memory (Meter):** A `<meter>` element that shifts between low/optimum/high zones as memory values change.
- **Error Count (Badge):** A badge that changes color -- green when low, yellow when moderate, red when the threshold is reached.
- **Total Requests (Text):** A counter that increments with each event.
- **Uptime (Text):** A formatted duration that ticks up every 2 seconds.
- **Alert:** A red alert banner appears automatically when the error count exceeds the threshold (60 errors). It disappears when the count is below the threshold.

All updates happen in real time via the SSE stream. The agent (represented by the embedded JSON) set up the surface once and is never contacted again.

## SSE event format

Each event on `/metrics/stream` is a JSON object:

```json
{
  "cpu": 47,
  "memory": 64,
  "requests": 15012,
  "errors": 43,
  "uptime": 120
}
```

Values fluctuate realistically: CPU drifts with moderate variance, memory drifts slowly, requests increment, and errors increase occasionally.
