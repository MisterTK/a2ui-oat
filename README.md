# a2ui-oat

**A lightweight A2UI renderer and catalog for agent-driven web interfaces.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Client Size: ~13KB](https://img.shields.io/badge/client_size-~13KB-green.svg)](#companion-libraries)

---

## Overview

a2ui-oat is an open-source community renderer that pairs [Google's A2UI protocol](https://a2ui.org/specification/v0.9-a2ui/) with [Kailash Nadh's Oat CSS library](https://oat.ink/) and its companion micro-libraries. It fills a gap in the A2UI renderer ecosystem: every maintained renderer today targets a framework (React, Angular, Lit, or Flutter). There is no lightweight, framework-free option for web-only deployments.

a2ui-oat provides two artifacts:

- **Oat Catalog** -- A custom A2UI catalog JSON schema exposing 37 UI components and 22 registered functions.
- **Oat Renderer** -- A minimal JavaScript renderer built on `@a2ui/web-lib` that converts A2UI JSON messages into semantic HTML styled automatically by Oat.

The project supports a **dual-mode architecture**: A2UI Mode for structured, catalog-constrained rendering with full security guarantees, and Direct Mode for trusted-agent scenarios where the LLM emits semantic HTML and Oat styles it with zero intermediary. Both modes share the same CSS, JS, and companion libraries. The choice between them is a security architecture decision.

## Features

- **37 components** -- Full Basic Catalog (16) plus 21 Oat-native components: tables, pagination, progress, meter, skeleton loaders, toasts, tooltips, alerts, breadcrumbs, sidebars, accordions, switches, badges, avatars, video, audio, grid, dropdown, and more.
- **22 registered functions** -- Data (`fetchPage`, `fetchAndAppend`, `subscribeSSE`, `subscribeWebSocket`), navigation (`openUrl`, `navigateTo`), UI (`showToast`, `debounce`), formatting (`formatDate`, `formatNumber`, `formatString`, `formatCurrency`, `pluralize`), logic (`and`, `or`, `not`), and validation (`required`, `regex`, `length`, `numeric`, `email`).
- **~13KB total client footprint** -- Oat CSS + JS + companion libraries, minified and gzipped.
- **Zero framework dependencies** -- No React, Angular, Lit, or build tooling required. Deploy via CDN include.
- **Dual-mode architecture** -- A2UI Mode (structured, validated) and Direct Mode (HTML-native, zero intermediary).
- **A2A integration** -- Catalog negotiation, inline catalog support, multi-agent surface ownership.
- **Autonomous surfaces** -- Agents build a surface once; registered functions keep it running (pagination, streaming, routing) after the agent disconnects.

## Quick Start

### A2UI Mode

Include Oat CSS, `@a2ui/web-lib`, and the Oat Renderer. The agent emits A2UI JSON against the Oat Catalog schema. The protocol engine parses the stream, manages state, and delegates to the renderer for HTML output.

```html
<!-- Oat CSS + JS -->
<link rel="stylesheet" href="https://unpkg.com/@knadh/oat/oat.min.css">
<script src="https://unpkg.com/@knadh/oat/oat.min.js"></script>

<!-- A2UI Protocol Engine -->
<script src="https://unpkg.com/@a2ui/web-lib"></script>

<!-- Oat Renderer -->
<script src="renderer/index.js"></script>

<script>
  const renderer = new OatRenderer({
    catalogId: "https://a2ui-oat.dev/catalog/v1/oat-catalog.json"
  });
  // Connect to your agent transport (A2A, MCP, WebSocket, SSE)
</script>
```

### Direct Mode

Include only Oat CSS + JS. The agent emits semantic HTML directly. Oat styles it automatically.

```html
<link rel="stylesheet" href="https://unpkg.com/@knadh/oat/oat.min.css">
<script src="https://unpkg.com/@knadh/oat/oat.min.js"></script>

<div id="agent-output"></div>

<script>
  // Agent sends semantic HTML; insert it into the DOM.
  // Oat CSS styles it automatically based on element semantics.
  document.getElementById("agent-output").innerHTML = agentHtml;
</script>
```

See [docs/when-to-use-which.md](docs/when-to-use-which.md) for guidance on choosing between modes.

## Components

### Layout

| Component | HTML Output | Source |
|-----------|------------|--------|
| Row | `<div class="row">` | Basic Catalog + Oat Grid |
| Column | `<div class="col-{n}">` | Basic Catalog + Oat Grid |
| Grid | `<div class="container"><div class="row">` | Oat 12-column grid |
| List | `<ul>` / `<ol>` | Basic Catalog |
| Sidebar | `<aside>` | Oat Sidebar |

### Display

| Component | HTML Output | Source |
|-----------|------------|--------|
| Text | `<h1>`--`<h6>`, `<p>` | Basic Catalog |
| Image | `<img>` | Basic Catalog |
| Icon | `<span>` (icon class) | Basic Catalog |
| Divider | `<hr>` | Basic Catalog |
| Badge | `<span data-badge>` | Oat Badge |
| Avatar | `<img class="avatar">` | Oat Avatar |
| Spinner | `<div class="spinner">` | Oat Spinner |
| Skeleton | `<div class="skeleton">` | Oat Skeleton |
| Progress | `<progress>` | Oat Progress |
| Meter | `<meter>` | Oat Meter |
| Video | `<video>` | Oat / HTML5 |
| AudioPlayer | `<audio>` | Oat / HTML5 |

### Interactive

| Component | HTML Output | Source |
|-----------|------------|--------|
| Button | `<button>` | Basic Catalog |
| TextField | `<input>` / `<textarea>` | Basic Catalog |
| CheckBox | `<input type="checkbox">` | Basic Catalog |
| Switch | `<input type="checkbox" role="switch">` | Oat Switch |
| Slider | `<input type="range">` | Basic Catalog |
| DateTimeInput | `<input type="date/time">` | Basic Catalog |
| ChoicePicker | `<select>` / radio group | Basic Catalog |
| Autocomplete | `<input>` + floatype.js | Oat + floatype.js |

### Container

| Component | HTML Output | Source |
|-----------|------------|--------|
| Card | `<article>` / `<section>` | Basic Catalog |
| Modal | `<dialog>` | Basic Catalog + Oat Dialog |
| Tabs | `<oat-tabs>` | Basic Catalog + Oat Tabs WC |
| Accordion | `<details><summary>` | Oat Accordion |
| Tooltip | `<span data-tooltip>` | Oat Tooltip |
| Dropdown | `<ot-dropdown>` | Oat Dropdown WC |

### Data & Feedback

| Component | HTML Output | Source |
|-----------|------------|--------|
| Table | `<table>` | Oat Table |
| Pagination | `<nav>` (pagination) | Oat Pagination |
| Alert | `<div role="alert">` | Oat Alert |
| Toast | `<oat-toast>` | Oat Toast WC |
| Breadcrumb | `<nav aria-label="breadcrumb">` | Oat Breadcrumb |

**Total: 37 components.** The Basic Catalog's 16 are fully included. The additional 21 are native Oat primitives.

## Registered Functions

### Data

| Function | Backed By | Purpose |
|----------|-----------|---------|
| fetchPage | fetch API | Client-side cursor pagination. Fetches next page and writes to data model. |
| fetchAndAppend | fetch API | Infinite scroll. Appends results to existing array in data model. |
| subscribeSSE | EventSource | Opens SSE stream. Writes each event to data model path. |
| subscribeWebSocket | WebSocket | Opens WebSocket. Writes parsed messages to data model. |

### Navigation

| Function | Backed By | Purpose |
|----------|-----------|---------|
| openUrl | window.open | Opens URL in browser (`target`: `"_blank"` or `"_self"`). |
| navigateTo | tinyrouter.js | Client-side SPA routing via window.history. |

### UI

| Function | Backed By | Purpose |
|----------|-----------|---------|
| showToast | Oat Toast WC | Triggers a toast notification from any action. |
| debounce | vanilla JS | Wraps another action with a debounce delay. |

### Formatting

| Function | Backed By | Purpose |
|----------|-----------|---------|
| formatDate | Intl.DateTimeFormat | Locale-aware date formatting. |
| formatNumber | Intl.NumberFormat | Locale-aware number formatting. |
| formatString | vanilla JS | String interpolation using `${/data/model/path}` placeholders. |
| formatCurrency | Intl.NumberFormat | Currency formatting with ISO 4217 currency codes. |
| pluralize | vanilla JS | Returns singular or plural form based on count. |

### Logic

| Function | Backed By | Purpose |
|----------|-----------|---------|
| and | vanilla JS | Returns `true` if all conditions in an array are truthy. |
| or | vanilla JS | Returns `true` if any condition in an array is truthy. |
| not | vanilla JS | Returns the boolean negation of a value. |

### Validation

| Function | Backed By | Purpose |
|----------|-----------|---------|
| required | vanilla JS | Validates that a value is non-null and non-empty. |
| regex | vanilla JS | Validates a value against a regular expression pattern. |
| length | vanilla JS | Validates that a string's length falls within min/max bounds. |
| numeric | vanilla JS | Validates that a value is a valid number. |
| email | vanilla JS | Validates that a value matches a basic email address pattern. |

## Architecture

```
Agent (LLM)
  |  Generates A2UI JSON against Oat Catalog schema
  v
Transport (A2A / MCP / WebSocket / SSE)
  |  Delivers DataParts with mimeType: application/json+a2ui
  v
@a2ui/web-lib (Protocol Engine)
  |  Parses JSONL stream, manages surfaces, resolves data bindings
  v
Oat Renderer
  |  Maps component types -> semantic HTML elements
  v
Oat CSS + JS (~8KB)
  |  Styles semantic HTML automatically
  v
Browser DOM
```

| Layer | Artifact | Author | Role |
|-------|----------|--------|------|
| Oat Catalog | oat-catalog.json | a2ui-oat project | Defines 37 components and 22 registered functions as A2UI-compliant JSON Schema |
| Oat Renderer | oat-renderer.js | a2ui-oat project | Maps catalog components to semantic HTML elements |
| Protocol Engine | @a2ui/web-lib | Google (existing) | Stream parsing, state management, data binding, validation |
| Styling | Oat CSS + JS + companions | Kailash Nadh (existing) | Automatic semantic styling, Web Components for dynamic elements |

For the full architecture document, see [docs/architecture.md](docs/architecture.md).

## Companion Libraries

| Library | Size | Role |
|---------|------|------|
| [Oat CSS + JS](https://oat.ink/) | ~8KB | Automatic semantic styling, Web Components for Tabs, Dropdown, Toast |
| [tinyrouter.js](https://github.com/knadh/tinyrouter.js) | ~950B | Client-side SPA routing via window.history |
| [floatype.js](https://github.com/knadh/floatype.js) | ~1.2KB | Floating autocomplete/autosuggestion for text inputs |
| [dragmove.js](https://github.com/knadh/dragmove.js) | ~500B | Make DOM elements draggable and movable |
| [indexed-cache.js](https://github.com/knadh/indexed-cache) | ~2.1KB | IndexedDB caching for Oat assets across sessions |

**Total shared footprint: ~13KB minified and gzipped.** This is the complete client-side runtime for both modes, excluding `@a2ui/web-lib` which is only required for A2UI Mode.

## Security Model

a2ui-oat provides three security tiers. The choice depends on the trust level of the agent producing UI.

| Tier | Mode | Trust Level | Validation | Use Case |
|------|------|-------------|------------|----------|
| 1 (Strictest) | A2UI + Oat Catalog | Untrusted | Catalog allowlist + schema validation + sandboxed functions | Multi-vendor A2A, Agentspace, regulated environments |
| 2 (Moderate) | A2UI + OatHTML component | Semi-trusted | Catalog allowlist + HTML sanitizer | Internal agents needing layout flexibility |
| 3 (Open) | Direct Mode | Fully trusted | Optional sanitizer | Internal tools, prototypes, single-agent |

**A2UI Mode** provides defense in depth: the catalog acts as an allowlist, two-phase validation catches hallucinated properties, registered functions are sandboxed, and data model isolation protects multi-agent scenarios.

**Direct Mode** has no catalog, no schema validation, and no sandboxing. It is appropriate only for trusted, internally-controlled agents.

**OatHTML** is an escape hatch that accepts sanitized HTML within A2UI's security model, bridging the gap between strict catalog constraints and full HTML freedom.

See [docs/when-to-use-which.md](docs/when-to-use-which.md) for a detailed decision guide.

## Competitive Position

| Attribute | a2ui-oat | Lit Renderer | React Renderer | Angular Renderer |
|-----------|---------|-------------|---------------|-----------------|
| Client footprint | ~13KB | ~15KB+ | ~45KB+ | ~60KB+ |
| Components | 37 | 16 | 16 | 16 |
| Registered functions | 22 | Basic set | Basic set | Basic set |
| Framework dependency | None | Lit | React | Angular |
| Build tooling required | No | Yes | Yes | Yes |
| Client-side pagination | Native | Custom | Custom | Custom |
| Real-time streaming | Native | Custom | Custom | Custom |
| Direct HTML mode | Yes | No | No | No |
| Zero-build deployment | Yes (CDN) | No | No | No |

## Links

- [A2UI Specification (v0.9)](https://a2ui.org/specification/v0.9-a2ui/)
- [A2UI Component Gallery](https://a2ui.org/reference/components/)
- [Oat UI](https://oat.ink/)
- [Oat GitHub](https://github.com/knadh/oat)
- [Architecture Document](docs/architecture.md)
- [Mode Decision Guide](docs/when-to-use-which.md)
- [Oat Catalog](https://a2ui-oat.dev/catalog/v1/oat-catalog.json)

## License

MIT
