# Real @a2ui/web_core Adapter Example

A live dashboard (orders + revenue ticking every 2 seconds, plus a Refresh
button) rendered by feeding A2UI wire messages through the real,
published `@a2ui/web_core` protocol engine -- not a hand-rolled loop.

## What this demonstrates

- **`createSurfaceAdapter`** (`renderer/surface-adapter.js`) wiring
  `@a2ui/web_core`'s `MessageProcessor` + `NodeResolver` + `ComponentContext`
  to `OatRenderer`, so schema validation, the reactive data-model signals,
  and action dispatch are all the real library's code, not reimplemented.
- **CDN-only ESM**, no build step: `@a2ui/web_core` is imported directly from
  `esm.sh` as a bare-specifier ESM module; `createSurfaceAdapter` and
  `CATALOG_ID` are imported as local relative files from `../../renderer/`.
- **Streamed `updateDataModel` diffs**: after the initial component tree is
  sent once, the "agent" only ever streams data updates (`/stats/orders`,
  `/stats/revenue`) on an interval -- the bound `Text` nodes update in place
  through `@a2ui/web_core`'s signals, with no component resend and no
  full-surface rebuild.
- **Real action resolution**: clicking "Refresh" dispatches an `event`
  action whose `context.at` is declared as `{ path: '/stats/orders' }` on the
  wire. By the time `onAction` fires, `@a2ui/web_core` has already resolved
  it to a plain number -- the action log shows the resolved value, not the
  path reference.

## How to run

ESM imports require the page to be served over `http(s)://`, not opened as a
`file://` URL:

```sh
# from the repo root
npx serve .
```

Then open `http://localhost:3000/examples/web-core-adapter/`.

## Adapter mode vs. direct mode

The other A2UI-mode examples in this repo (`a2ui-dashboard`, `data-explorer`,
etc.) hand-roll their own message loop directly against `OatRenderer` --
a small `processMessages`/`render` pair that merges JSON into a plain object
and re-renders. That is deliberate: those examples double as executable
documentation of the renderer's raw contract (`RenderContext`, the shape of
`getDataModel`/`setDataModel`/`renderChild`/`dispatchAction`), useful when
embedding `OatRenderer` in a host that already owns its own protocol state.

This example is the **supported, protocol-engine path**: `createSurfaceAdapter`
delegates schema validation, the data-model, structural resolution (list
templates, child refs, placeholders), and signal-based reactivity to the real
`@a2ui/web_core` package, and only asks `OatRenderer` to turn each resolved
component into DOM. Reach for this path in production -- it is what makes an
untrusted or third-party agent's A2UI JSON safe to render (catalog-enforced
schema validation) and is the same code path a real agent-to-client transport
(SSE, WebSocket, A2A) would feed.
