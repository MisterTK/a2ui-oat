# Changelog

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
