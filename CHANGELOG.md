# Changelog

## v0.3.0 — 2026-09-03

### Added

- `createSurfaceAdapter` (`a2ui-oat/surface-adapter`): real `@a2ui/web_core`
  (>= 0.10.7) protocol integration — wire messages flow through a real
  `MessageProcessor`/`NodeResolver`, rendered by the existing Oat Renderer.
  Dependency-injected: a2ui-oat still declares zero runtime dependencies.
- `renderer/catalog-compat.js`: transforms `oat-catalog.json` into
  `@a2ui/web_core`'s `Catalog.fromSchema()` format (child-ref markers,
  binding-tolerant property schemas).
- Flagship example `examples/web-core-adapter/` (CDN ESM, no build step)
  demonstrating the adapter against a scripted agent conversation.
- New "Adapter mode vs. direct mode" documentation in `docs/architecture.md`
  and a "Protocol integration" section in `README.md`.

### Changed

- Wire protocol version bumped to `v0.9.1` (messages declaring `v0.9` are
  still accepted).
- MIME type references corrected to `application/a2ui+json`
  (previously the nonexistent `application/json+a2ui`).
- All `@a2ui/web-lib` references corrected to `@a2ui/web_core`.

### Removed

- **Breaking:** `registerWithWebLib()` — it called `registerRenderer`,
  `registerFunction`, and `setCatalogId`, none of which exist in any
  published `@a2ui/web_core` version. It never worked against a real
  package. `createSurfaceAdapter` is the real integration; see the
  README's Protocol integration section for the replacement usage.

## v0.2.0 — 2026-09-02

### Catalog

- Added 2 new components: FileUpload (`ot-upload`), TagInput (`ot-taginput`) — 39 components total.
- Added 1 new registered function: callMcpTool — 22 functions total.
- Fixed Badge's variant enum to match Oat's real CSS vocabulary (`secondary`/`success`/`warning`/`danger`/`outline` instead of nonexistent `info`/`error`).
- Fixed Skeleton's variant enum (`box`/`line` instead of nonexistent `text`/`circle`/`rect`).
- Renamed Tooltip's `position` property to `placement` (old name still accepted).
- Added `checks` (Checkable validation) to TextField, CheckBox, Switch, DateTimeInput, ChoicePicker, Autocomplete, FileUpload, TagInput.
- Added `anchorKey` to Tabs, `width` to Sidebar.

### Renderer

- Fixed Badge, Button, and Skeleton rendering to match current Oat CSS (several variant colors were previously rendering unstyled due to using CSS classes where Oat now expects `data-variant` attributes, or vice versa).
- Fixed Skeleton to set `role="status"` (required by current Oat CSS, previously missing).
- Fixed Tooltip to emit `data-tooltip-placement` (previously `data-tooltip-position`, which no longer matches Oat's CSS selector).
- Implemented the `checks`/Checkable validation mechanism (previously declared in the catalog but never read by any render function, including Button's existing `checks` property, which never actually gated the button's action until now).
- Fixed Breadcrumb to use Oat's `.unstyled` helper class on its list and links.

### MCP Integration

- Added `callMcpTool` registered function for invoking tools on a connected MCP server.
- Added an example demonstrating the static-template + data-diff pattern (serve the UI template once, apply subsequent updates as data-only diffs).

### Non-goals

- A2UI spec v0.9.1/v1.0 and the real `@a2ui/web_core` protocol integration adapter are tracked separately (not part of this release) — see `docs/superpowers/specs/2026-09-02-a2ui-oat-modernization-design.md`.

## v0.1.0 — 2026-03-29

Initial public release.

### Catalog

- 37 A2UI-compliant components: all 16 Basic Catalog components plus 21 Oat-native extensions (tables, pagination, progress, meter, skeleton loaders, toasts, tooltips, alerts, breadcrumbs, sidebars, accordions, switches, badges, avatars, video, audio, grid, dropdown, autocomplete, OatHTML escape hatch).
- 21 registered client-side functions: data (fetchPage, fetchAndAppend, subscribeSSE, subscribeWebSocket), navigation (openUrl, navigateTo), UI (showToast, debounce), formatting (formatDate, formatNumber, formatString, formatCurrency, pluralize), logic (and, or, not), validation (required, regex, length, numeric, email).
- 7 theme properties mapped to Oat CSS custom properties.
- Targets A2UI specification v0.9.

### Renderer

- ES module renderer mapping all 37 catalog components to semantic HTML.
- Full `@a2ui/web-lib` integration via `registerWithWebLib()`.
- Two-way data binding for form inputs.
- Action wiring for server events and function calls.

### Direct Mode

- OatHTML sanitizer for Tier 2 security (semi-trusted agents).
- Agent prompting guide for Direct Mode HTML output.

### Examples

- 9 working examples: A2UI dashboard, Direct Mode dashboard, client-side pagination, real-time SSE streaming, data explorer, ADK single agent, ADK inline catalog, ADK A2A multi-agent, browser-side A2A multi-agent.

### Tooling

- Catalog validation script (`npm run validate`): structural validation, Basic Catalog coverage, renderer cross-reference, function implementation cross-reference.
