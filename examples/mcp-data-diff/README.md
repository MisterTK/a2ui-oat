# MCP Static-Template + Data-Diff Example

A self-contained example showing the "send the UI once, send data forever after" pattern for MCP-backed agents: a static A2UI component tree is applied to the DOM a single time, and every subsequent "tool call" only ever writes new values into the data model. The Oat Renderer's existing binding machinery -- `_bindValue()` / `context.subscribe()` in `renderer/oat-renderer.js` -- notices the change and patches just the bound DOM nodes in place.

## Why this matters

Re-sending a whole `createSurface`/`updateComponents` payload on every tool call is wasteful and disruptive: it costs bandwidth and latency proportional to the size of the UI (not the size of the change), and a full re-render blows away anything the browser was doing with the existing DOM -- scroll position, input focus, CSS transitions, third-party widget state. If an agent's tool only ever changes a stock price and a timestamp, only a stock price and a timestamp need to cross the wire. Everything else -- the card, the labels, the button, the layout -- was already described once and never needs to be re-described.

This example makes that concrete with a live-quote ticker card. `agent-template.json` is applied once via `renderer.renderComponent()`, walked recursively exactly like `examples/a2ui-dashboard/` does. It contains **no literal data values** -- `price`, `lastUpdated`, and `status` are all `{ "path": "/ticker/..." }` bindings; only structural chrome (labels, the ticker symbol, the button caption) is literal. From then on, every "tool call" -- including the very first one, which populates the initially-empty bindings -- calls the `callMcpTool` registered function (`renderer/functions/callMcpTool.js`) and writes its result straight into `/ticker/*` via `context.setDataModel()`. No component is ever created, removed, or re-rendered after the initial load; `index.html` never calls `renderer.renderComponent()` a second time.

## Simplification: the mock MCP server

`mock-mcp-server.js` is **not** a real Model Context Protocol server. A real one would run as a separate process speaking the MCP transport (stdio or Streamable HTTP), advertise a `getQuote` tool via `tools/list`, and be reached through `@modelcontextprotocol/sdk`'s `Client#callTool()`. Pulling that SDK into a static-HTML example would add a dependency this project otherwise has none of, so `mock-mcp-server.js` instead exposes:

- `getQuote()` -- an in-memory async function that returns a randomized `{ price, lastUpdated, status }` object after a simulated ~400ms delay, standing in for what a real MCP tool call would return.
- `mockMcpClient` -- an object with a single `callTool({ name, arguments })` method, matching the shape `renderer/functions/callMcpTool.js` expects on `context.mcpClient`, so the example can exercise the *real* `callMcpTool` function instead of bypassing it.

This is a stand-in to keep the example zero-install, not a protocol-conformance test. If you need to verify against a real MCP server, swap `mockMcpClient` for a real `@modelcontextprotocol/sdk` `Client` instance -- `callMcpTool` doesn't care which it talks to.

## Files

| File | Purpose |
|------|---------|
| `agent-template.json` | Static `createSurface` + `updateComponents` messages: a Card with a ticker symbol, price, last-updated time, status badge, and a "Refresh Quote" button whose `action` calls `callMcpTool`. Sent once. |
| `mock-mcp-server.js` | Dependency-free mock MCP tool (`getQuote()`) and mock MCP client (`mockMcpClient`). See simplification note above. |
| `index.html` | Fetches and renders the template once, wires a real `subscribe`/`setDataModel` data model (not a no-op), and dispatches the button's `action.functionCall` through the function registry returned by `createOatRenderer()`. |

## How to run

The page loads `agent-template.json` via `fetch`, so it must be served over HTTP:

```sh
# from this directory
npx serve .

# or from the project root
python3 -m http.server 8000 --directory examples/mcp-data-diff
```

Then open the URL shown in your terminal.

## What to observe

1. On load, the card appears with empty price/timestamp/status (the static template has no literal data), then a moment later the first simulated tool call fills them in -- watch the console-free "Tool call #1 ..." line under the card.
2. Click **Refresh Quote**. The price, timestamp, and status update in place with a brief highlight flash; the button disables itself while the (simulated) network call is in flight.
3. Open DevTools and inspect `[data-component-id="price-value"]` before and after clicking -- it's the same DOM node both times, not a freshly created one. `index.html` never calls `renderer.renderComponent()` again after the initial load; only `context.setDataModel()` is called on each refresh.
4. No console errors should appear (aside from the browser's own harmless `favicon.ico` 404, which every example in this repo produces since none ship a favicon).

## Verification

Manually verified in a real browser (Chrome, via chrome-devtools MCP) served over `python3 -m http.server`: confirmed the template renders once, the first simulated tool call populates the bindings, clicking "Refresh Quote" updates price/timestamp/status in place, and -- by tagging the price element with a test marker before clicking and re-querying afterward -- confirmed the *same* DOM node was mutated rather than replaced. No console errors beyond the expected favicon 404.
