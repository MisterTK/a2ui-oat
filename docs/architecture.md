# a2ui-oat

**A Lightweight A2UI Renderer & Catalog for Agent-Driven Web Interfaces**

Design & Architecture Document | Version 1.0 | March 2026

Thomas Kraus
SVP & Global Head of AI, Onix | Google Cloud Premier Partner

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [Architecture](#4-architecture)
5. [Oat Catalog Specification](#5-oat-catalog-specification)
6. [Registered Functions](#6-registered-functions)
7. [Oat Renderer Implementation](#7-oat-renderer-implementation)
8. [Security Model](#8-security-model)
9. [A2A Integration](#9-a2a-integration)
10. [Companion Libraries](#10-companion-libraries)
11. [Theming](#11-theming)
12. [Project Structure](#12-project-structure)
13. [Implementation Roadmap](#13-implementation-roadmap)
14. [Competitive Position](#14-competitive-position)
15. [Appendix: Key References](#15-appendix-key-references)

---

## 1. Executive Summary

a2ui-oat is an open-source A2UI community renderer that pairs Google's A2UI protocol with Kailash Nadh's Oat CSS library and its companion micro-libraries. It consists of two artifacts: the **Oat Catalog**, a custom A2UI catalog JSON schema exposing 37 UI components, and the **Oat Renderer**, a minimal JavaScript renderer built on @a2ui/web-lib that converts A2UI JSON messages into semantic HTML styled automatically by Oat.

The project addresses a gap in the A2UI renderer ecosystem. Every maintained renderer today targets a framework: React, Angular, Lit, or Flutter. There is no lightweight, framework-free option for web-only deployments. a2ui-oat fills this gap with a total client-side footprint of approximately 13KB while delivering more component coverage than any existing renderer.

In addition to A2UI-compliant mode, the project documents a **Direct HTML mode** for trusted-agent scenarios where the LLM emits semantic HTML directly and Oat styles it with zero intermediary. Both modes share the same CSS, JS, and companion libraries. The choice between them is a security architecture decision.

By combining A2UI's data binding and registered function system with Oat's full component set and companion libraries, a2ui-oat enables patterns that go beyond static rendering. An agent can build a surface once — with client-side pagination, live-streaming data subscriptions, in-app routing, and autocomplete — and the surface continues to function autonomously after the agent disconnects. The agent does the setup; the client does the work.

This document specifies the architecture, component catalog, registered functions, security model, A2A integration, and implementation roadmap.

---

## 2. Problem Statement

### 2.1 The Ecosystem Gap

A2UI is a streaming JSON protocol for agent-driven user interfaces. Agents emit declarative JSON; renderers convert it to native UI. The protocol is transport-agnostic (A2A, MCP, WebSocket, SSE) and catalog-driven, meaning the set of available components is defined per-deployment.

The maintained renderers are:

| Renderer | Platform | Runtime Size | v0.9 Support |
|----------|----------|-------------|--------------|
| React | Web | ~45KB+ (React + renderer) | Planned |
| Lit (Web Components) | Web | ~15KB+ (Lit + renderer) | Stable |
| Angular | Web | ~60KB+ (Angular + renderer) | Stable |
| Flutter (GenUI SDK) | Mobile/Desktop/Web | Framework-dependent | Stable |

No option exists for developers who want agent-driven UI on the web without a framework dependency. Internal tools, dashboards, prototypes, and embedded agent surfaces often do not justify the complexity of React or Angular.

### 2.2 The Component Gap

The A2UI Basic Catalog defines 16 components: Row, Column, List, Text, Image, Icon, Divider, Button, TextField, CheckBox, Slider, DateTimeInput, ChoicePicker, Card, Modal, and Tabs. This is intentionally sparse to remain easily implementable across platforms.

Production web applications require more: tables, pagination, progress indicators, skeleton loaders, toasts, tooltips, alerts, breadcrumbs, sidebars, accordions, switches, badges, avatars, and a grid system.

### 2.3 The Interactivity Gap

Existing renderers focus on rendering and data binding. They implement the Basic Catalog's registered functions and leave advanced client-side behavior as a custom exercise. Patterns like cursor-based API pagination, live data stream subscriptions, and client-side SPA routing are left to each implementation to figure out. There is no renderer that ships these as first-class catalog capabilities.

---

## 3. Solution Overview

### 3.1 Dual-Mode Architecture

a2ui-oat supports two operational modes. Both share the same client-side assets.

| Aspect | A2UI Mode (Structured) | Direct Mode (HTML-native) |
|--------|----------------------|--------------------------|
| Agent output | A2UI JSON (catalog-constrained) | Semantic HTML |
| Security model | Catalog allowlist + schema validation | Trust the agent |
| Best for | Multi-agent, multi-vendor, A2A, Agentspace | Internal tools, single-agent, prototyping |
| Intermediary | @a2ui/web-lib + Oat Renderer | None. Browser renders directly. |
| Data binding | A2UI data model with path resolution | Manual (vanilla JS or HTMX) |
| Streaming updates | updateDataModel messages | SSE/WebSocket to DOM directly |
| Client footprint | ~13KB (Oat) + @a2ui/web-lib | ~13KB (Oat only) |
| Transport | A2A, MCP, WebSocket, SSE, REST | Any (no protocol constraint) |

### 3.2 When to Use Which

**Use A2UI Mode when:**

- The agent is untrusted or originates from a third-party vendor via A2A
- Cross-platform rendering is needed (same agent output to web + Flutter)
- Bidirectional data binding and server-push state management are required
- The deployment involves Agentspace, Vertex AI agents, or multi-agent orchestration
- Compliance or security audit requires a declarative, non-executable UI contract

**Use Direct Mode when:**

- The agent is trusted and controlled by the same team operating the frontend
- The target is web-only with no cross-platform requirement
- Maximum simplicity and minimum latency matter (internal dashboards, prototypes)
- The development workflow favors rapid iteration over structured contracts
- HTMX or vanilla JS is the preferred client-side technology

---

## 4. Architecture

### 4.1 System Layers

The a2ui-oat system is composed of four layers. The first two are authored by this project. The latter two already exist.

| Layer | Artifact | Author | Role |
|-------|----------|--------|------|
| Oat Catalog | oat-catalog.json | a2ui-oat project | Defines 37 components and 22 functions as A2UI-compliant JSON Schema |
| Oat Renderer | oat-renderer.js | a2ui-oat project | Maps catalog components to semantic HTML elements |
| Protocol Engine | @a2ui/web-lib | Google (existing) | Stream parsing, state management, data binding, validation |
| Styling | Oat CSS + JS + companions | Kailash Nadh (existing) | Automatic semantic styling, Web Components for dynamic elements |

### 4.2 Data Flow: A2UI Mode

```
Agent (LLM)
  │  Generates A2UI JSON against Oat Catalog schema
  ▼
Transport (A2A / MCP / WebSocket / SSE)
  │  Delivers DataParts with mimeType: application/json+a2ui
  ▼
@a2ui/web-lib (Protocol Engine)
  │  Parses JSONL stream, manages surfaces, resolves data bindings
  ▼
Oat Renderer
  │  Maps component types → semantic HTML elements
  ▼
Oat CSS + JS (~8KB)
  │  Styles semantic HTML automatically
  ▼
Browser DOM
```

### 4.3 Data Flow: Direct Mode

```
Agent (LLM)
  │  Generates semantic HTML directly
  ▼
Transport (any)
  │  Delivers HTML string
  ▼
Browser DOM (innerHTML / HTMX swap)
  │  Oat CSS + JS styles it automatically
  ▼
Rendered UI
```

---

## 5. Oat Catalog Specification

The Oat Catalog is a JSON Schema file conforming to the A2UI Catalog schema. It defines components, registered functions, and theme properties. The catalog includes the full Basic Catalog and extends it with components native to Oat and its companion repositories.

### 5.1 Components: Layout

| Component | HTML Output | Key Properties | Source |
|-----------|------------|----------------|--------|
| Row | `<div class="row">` | children, justify, align | Basic Catalog + Oat Grid |
| Column | `<div class="col-{n}">` | children, justify, align, weight | Basic Catalog + Oat Grid |
| Grid | `<div class="container"><div class="row">` | columns (1–12), gap | Oat 12-column grid |
| List | `<ul>` / `<ol>` | children/template, direction | Basic Catalog |
| Sidebar | `<aside>` | child, position, collapsible | Oat Sidebar |

### 5.2 Components: Display

| Component | HTML Output | Key Properties | Source |
|-----------|------------|----------------|--------|
| Text | `<h1>`–`<h6>`, `<p>` | text, variant | Basic Catalog |
| Image | `<img>` | url, fit, variant | Basic Catalog |
| Icon | `<span>` (icon class) | name | Basic Catalog |
| Divider | `<hr>` | axis | Basic Catalog |
| Badge | `<span data-badge>` | text, variant | Oat Badge |
| Avatar | `<img class="avatar">` | url, size, initials | Oat Avatar |
| Spinner | `<div class="spinner">` | size | Oat Spinner |
| Skeleton | `<div class="skeleton">` | width, height, variant | Oat Skeleton |
| Progress | `<progress>` | value, max | Oat Progress |
| Meter | `<meter>` | value, min, max, low, high | Oat Meter |
| Video | `<video>` | src, poster, controls, autoplay, loop, muted, alt | HTML5 Video |
| AudioPlayer | `<audio>` | src, controls, autoplay, loop | HTML5 Audio |

### 5.3 Components: Interactive

| Component | HTML Output | Key Properties | Source |
|-----------|------------|----------------|--------|
| Button | `<button>` | child, variant, action, checks | Basic Catalog |
| TextField | `<input>` / `<textarea>` | label, value, textFieldType | Basic Catalog |
| CheckBox | `<input type="checkbox">` | label, value | Basic Catalog |
| Switch | `<input type="checkbox" role="switch">` | label, value | Oat Switch |
| Slider | `<input type="range">` | value, minValue, maxValue | Basic Catalog |
| DateTimeInput | `<input type="date/time">` | value, enableDate, enableTime | Basic Catalog |
| ChoicePicker | `<select>` / radio group | options, selections, maxSelections | Basic Catalog |
| Autocomplete | `<input>` + floatype.js | source, minChars, action | Oat + floatype.js |

### 5.4 Components: Container

| Component | HTML Output | Key Properties | Source |
|-----------|------------|----------------|--------|
| Card | `<article>` / `<section>` | child | Basic Catalog |
| Modal | `<dialog>` | entryPointChild, contentChild | Basic Catalog + Oat Dialog |
| Tabs | `<oat-tabs>` | tabItems [{title, child}] | Basic Catalog + Oat Tabs WC |
| Accordion | `<details><summary>` | items [{title, child}], grouped | Oat Accordion |
| Tooltip | `<span data-tooltip>` | child, text, position | Oat Tooltip |
| Dropdown | `<ot-dropdown>` | child (trigger), items [{label, action}] | Oat Dropdown WC |

### 5.5 Components: Data & Feedback

| Component | HTML Output | Key Properties | Source |
|-----------|------------|----------------|--------|
| Table | `<table>` | columns, rows (template), sortable, striped | Oat Table |
| Pagination | `<nav>` (pagination) | currentPage, totalPages, action | Oat Pagination |
| Alert | `<div role="alert">` | text, variant (success/warning/error) | Oat Alert |
| Toast | `<oat-toast>` | text, variant, duration, position | Oat Toast WC |
| Breadcrumb | `<nav aria-label="breadcrumb">` | items [{label, action}] | Oat Breadcrumb |

### 5.6 Component Summary

**Total: 37 components.** The Basic Catalog's 16 are fully included. The additional 21 are native Oat primitives that require no custom implementation beyond semantic HTML mapping.

---

## 6. Registered Functions

The Oat Catalog defines registered functions that execute entirely on the client within A2UI's sandboxed security model. Agents can only invoke pre-registered functions, never arbitrary code.

### 6.1 Data Functions

| Function | Backed By | Parameters | Purpose |
|----------|-----------|------------|---------|
| fetchPage | fetch API | url, cursor, targetPath, method | Client-side pagination. Fetches next page and writes to data model. |
| fetchAndAppend | fetch API | url, cursor, targetPath, method | Infinite scroll. Appends results to existing array in data model. |
| subscribeSSE | EventSource | url, targetPath, eventName | Opens SSE stream. Writes each event to data model path. |
| subscribeWebSocket | WebSocket | url, targetPath, messageParser | Opens WebSocket. Writes parsed messages to data model. |

### 6.2 Navigation Functions

| Function | Backed By | Parameters | Purpose |
|----------|-----------|------------|---------|
| openUrl | window.open | url, target | Opens URL in browser. Standard A2UI function. |
| navigateTo | tinyrouter.js | path, params | Client-side SPA routing via window.history. |

### 6.3 UI Functions

| Function | Backed By | Parameters | Purpose |
|----------|-----------|------------|---------|
| showToast | Oat Toast WC | text, variant, duration | Triggers a toast notification from any action. |
| debounce | vanilla JS | targetAction, delayMs | Wraps another action with a debounce delay. |

### 6.4 Formatting Functions

| Function | Backed By | Parameters | Purpose |
|----------|-----------|------------|---------|
| formatDate | Intl.DateTimeFormat | value, locale, options | Locale-aware date formatting. |
| formatNumber | Intl.NumberFormat | value, locale, options | Locale-aware number formatting. |
| formatString | vanilla JS | template, targetPath | String interpolation using `${/data/model/path}` placeholders. Resolves paths from the data model and writes result to `targetPath`. |
| formatCurrency | Intl.NumberFormat | value, currency, locale, targetPath | Currency formatting. `currency` is an ISO 4217 code (default `USD`). Writes result to `targetPath`. |
| pluralize | vanilla JS | count, singular, plural, targetPath | Returns `singular` when count is 1, `plural` otherwise (default: `singular + 's'`). Writes result to `targetPath`. |

### 6.5 Logic Functions

Logic functions return a boolean. They are used in `checks` arrays on Button and other components to conditionally enable actions.

| Function | Parameters | Purpose |
|----------|------------|---------|
| and | conditions (array) | Returns `true` if every value in the array is truthy. |
| or | conditions (array) | Returns `true` if any value in the array is truthy. |
| not | value | Returns the boolean negation of `value`. |

### 6.6 Validation Functions

Validation functions return a boolean. They are used in `checks` arrays on Button to gate form submission.

| Function | Parameters | Purpose |
|----------|------------|---------|
| required | value | Returns `true` if value is non-null and non-empty. |
| regex | value, pattern | Returns `true` if value matches the regular expression `pattern`. |
| length | value, min, max | Returns `true` if string length falls within `[min, max]`. |
| numeric | value | Returns `true` if value is a valid number. |
| email | value | Returns `true` if value matches a basic email address pattern. |

### 6.7 Client-Side Pagination Pattern

The agent sets up the surface once. The client handles all subsequent pagination autonomously.

**Step 1:** Agent creates surface with initial data including API endpoint and cursor.

**Step 2:** Agent wires the Pagination component to a local fetchPage function call:

```json
{
  "id": "next-page-btn",
  "component": "Button",
  "child": "next-text",
  "action": {
    "functionCall": {
      "call": "fetchPage",
      "args": {
        "url": { "path": "/api/endpoint" },
        "cursor": { "path": "/pagination/nextCursor" },
        "targetPath": "/tableData/rows"
      }
    }
  }
}
```

**Step 3:** On click, fetchPage reads the cursor from the data model, calls the API from the browser, writes the response to the data model, and updates the cursor. The Table re-renders via data binding. The agent is never contacted again.

For a 10,000-row dataset with 50-row pages, the agent does work once. The user browses 200 pages at zero backend cost.

### 6.8 Real-Time Streaming Pattern

The agent registers a streaming endpoint once. The client subscribes and keeps components updated indefinitely.

**Step 1:** Agent creates surface with bound components (Progress, Meter, Badge, Table, Alert).

**Step 2:** Agent triggers subscribeSSE as a local action on surface creation:

```json
{
  "id": "root",
  "component": "Column",
  "children": ["metrics-panel", "alerts-panel"],
  "action": {
    "functionCall": {
      "call": "subscribeSSE",
      "args": {
        "url": "https://api.example.com/metrics/stream",
        "targetPath": "/liveMetrics"
      }
    }
  }
}
```

**Step 3:** The client opens an EventSource. Each event is written to the data model. Bound components re-render automatically. No middleware, no agent involvement.

### 6.9 What These Patterns Enable

The combination of registered functions, data binding, and Oat's component set means an agent can build surfaces that outlive the agent's involvement. A few examples of what falls out naturally:

**An operations dashboard.** The agent creates a surface with a Table bound to `/incidents`, a Meter bound to `/uptime`, Badge components bound to `/alertCounts`, and a Toast wired to fire on threshold crossings. It registers subscribeSSE pointed at the monitoring pipeline's existing SSE endpoint. The agent disconnects. The dashboard runs indefinitely, updating in real time, with no backend compute per update. The Pagination component lets operators page through historical incidents via cursor-based API calls that never touch the agent.

**A data explorer.** The agent builds a Table + Pagination surface against a paginated REST API. It wires Autocomplete (backed by floatype.js) to a search endpoint for filtering. It adds Tabs with navigateTo (backed by tinyrouter.js) to switch between "Active," "Archived," and "Flagged" views — each a different API filter, all client-side routed. The user gets a functional internal tool from a single agent interaction.

**A live leaderboard.** The agent creates a sorted Table bound to `/scores`, subscribes to a WebSocket that pushes score updates, and wires a Toast to announce when a leader changes. The entire surface is autonomous after setup.

These are not special features. They are the natural result of combining A2UI's data binding and function system with Oat's component coverage and Kailash's companion libraries. The catalog simply exposes what already exists.

---

## 7. Oat Renderer Implementation

The Oat Renderer is the JavaScript layer that maps A2UI catalog components to semantic HTML elements. It is intentionally minimal because @a2ui/web-lib handles all protocol concerns and Oat CSS handles all styling.

### 7.1 Renderer Responsibilities

- **Component mapping:** For each component type in the Oat Catalog, emit the correct semantic HTML element(s) with appropriate attributes.
- **Child wiring:** Read child/children properties and recursively render referenced components from the surface's component buffer.
- **Data binding output:** For bound values, read from the data model and set element text/attributes. Subscribe to model changes for re-rendering.
- **Action wiring:** For components with actions, attach event listeners that dispatch to either the server event handler or the registered function executor.
- **Registered function execution:** Implement the 22 registered functions with error handling and data model writes.

### 7.2 What the Renderer Does NOT Do

- Stream parsing (handled by @a2ui/web-lib)
- Surface lifecycle management (handled by @a2ui/web-lib)
- Data model state management (handled by @a2ui/web-lib)
- Schema validation (handled by @a2ui/web-lib)
- Visual styling (handled by Oat CSS)
- Dynamic component behavior for Tabs, Dropdown, Toast (handled by Oat JS Web Components)

### 7.3 Component Mapping Examples

| A2UI Component | Renderer Output |
|---------------|----------------|
| `Text {variant: "h1", text: "Hello"}` | `<h1>Hello</h1>` |
| `Button {child: "btn-text", variant: "primary"}` | `<button class="primary">[render btn-text]</button>` |
| `Table {columns: [...], rows: template}` | `<table><thead>...</thead><tbody>[render per row]</tbody></table>` |
| `Toast {text: "Saved", variant: "success"}` | `<div role="alert" data-variant="success">Saved</div>` |
| `Alert {text: "Warning", variant: "warning"}` | `<div role="alert" data-variant="warning">Warning</div>` |
| `Card {child: "content"}` | `<article>[render content]</article>` |
| `Accordion {items: [...]}` | `<details><summary>Title</summary>[render child]</details>` |
| `Modal {contentChild: "mc"}` | `<dialog>[render mc]</dialog>` |
| `Sidebar {child: "nav"}` | `<aside>[render nav]</aside>` |
| `Pagination {currentPage: 1, totalPages: 10}` | `<nav>[page links with action bindings]</nav>` |
| `Progress {value: 75, max: 100}` | `<progress value="75" max="100"></progress>` |
| `Spinner {size: "medium"}` | `<div class="spinner"></div>` |
| `Skeleton {variant: "text"}` | `<div class="skeleton"></div>` |
| `Badge {text: "3", variant: "info"}` | `<span data-badge>3</span>` |
| `Breadcrumb {items: [...]}` | `<nav aria-label="breadcrumb"><ol>...</ol></nav>` |
| `Switch {label: "Dark mode", value: path}` | `<label><input type="checkbox" role="switch"> Dark mode</label>` |
| `Meter {value: 0.7, low: 0.3, high: 0.8}` | `<meter value="0.7" low="0.3" high="0.8"></meter>` |
| `Autocomplete {source: url}` | `<input>[floatype.js attached]</input>` |
| `Grid {columns: 12}` | `<div class="container"><div class="row">...</div></div>` |

The mapping is deliberately straightforward. Oat styles semantic HTML automatically, so the renderer's primary job is emitting the correct element type and wiring attributes. Estimated renderer size: 400–600 lines of JavaScript.

---

## 8. Security Model

Security is the primary differentiator between A2UI Mode and Direct Mode. a2ui-oat inherits A2UI's security architecture in structured mode and documents the trust assumptions of direct mode.

### 8.1 A2UI Mode: Defense in Depth

**Catalog as Allowlist.** The Oat Catalog defines exactly which components and functions the agent may use. The agent cannot emit arbitrary HTML, inject scripts, or invoke undefined behavior. Unrecognized component types are ignored or rendered as fallback placeholders.

**Two-Phase Validation.** Agent-side validation catches hallucinated properties before transmission. Client-side validation ensures the payload conforms to the catalog schema.

**Sandboxed Functions.** Registered functions execute only pre-defined logic. The agent provides parameters; the function controls what happens. No eval, no arbitrary code execution.

**Data Model Isolation.** In multi-agent A2A scenarios, the orchestrator strips data model metadata so each sub-agent only receives state from surfaces it owns.

### 8.2 Direct Mode: Trust Assumptions

Direct Mode has no catalog, no schema validation, and no sandboxing. This is appropriate only when:

- The agent is controlled by the same organization operating the frontend
- The agent's output is sanitized before DOM insertion (recommended: DOMPurify or equivalent)
- The deployment does not involve third-party agents or multi-vendor A2A scenarios
- The application is internal-facing or behind authentication

Direct Mode is not suitable for untrusted-agent scenarios. This is the security design.

### 8.3 The OatHTML Escape Hatch

For scenarios that need A2UI's security but require HTML flexibility, the Oat Catalog includes an **OatHTML** component. This accepts a sanitized HTML string as a property. The renderer passes it through a configurable sanitizer before injecting it into the DOM.

| Tier | Mode | Trust Level | Validation | Use Case |
|------|------|-------------|------------|----------|
| 1 (Strictest) | A2UI + Oat Catalog | Untrusted | Catalog allowlist + schema validation + sandboxed functions | Multi-vendor A2A, Agentspace, regulated environments |
| 2 (Moderate) | A2UI + OatHTML component | Semi-trusted | Catalog allowlist + HTML sanitizer | Internal agents needing layout flexibility |
| 3 (Open) | Direct Mode | Fully trusted | Optional sanitizer | Internal tools, prototypes, single-agent |

---

## 9. A2A Integration

a2ui-oat integrates with the A2A protocol through the standard A2UI extension mechanism.

### 9.1 Agent Discovery

A remote agent advertises Oat Catalog support in its AgentCard:

```json
{
  "uri": "https://a2ui.org/a2a-extension/a2ui/v0.9",
  "description": "A2UI with Oat Catalog",
  "params": {
    "supportedCatalogIds": [
      "https://unpkg.com/a2ui-oat/catalog/oat-catalog.json",
      "https://a2ui.org/specification/v0_9/basic_catalog.json"
    ],
    "acceptsInlineCatalogs": true
  }
}
```

### 9.2 Catalog Negotiation

The A2A client running the Oat Renderer includes the Oat Catalog ID in every message's metadata:

```json
{
  "v0.9": {
    "supportedCatalogIds": [
      "https://unpkg.com/a2ui-oat/catalog/oat-catalog.json"
    ]
  }
}
```

If the remote agent supports the Oat Catalog, it uses it. If not, it falls back to the Basic Catalog, which the Oat Renderer also supports since the 37 Oat components are a superset of the Basic Catalog's 16. If the agent accepts inline catalogs, the client can send the full Oat Catalog schema at runtime, enabling any conformant agent to generate Oat components without prior configuration.

### 9.3 Message Encoding

A2UI messages are encoded as A2A DataParts with `mimeType: application/json+a2ui`. Multiple messages can be batched in a single DataPart:

```json
{
  "kind": "data",
  "metadata": {
    "mimeType": "application/json+a2ui"
  },
  "data": [
    {
      "version": "v0.9",
      "createSurface": {
        "surfaceId": "dashboard",
        "catalogId": "https://unpkg.com/a2ui-oat/catalog/oat-catalog.json",
        "theme": { "primaryColor": "#1A73E8" },
        "sendDataModel": true
      }
    },
    {
      "version": "v0.9",
      "updateComponents": {
        "surfaceId": "dashboard",
        "components": [ ]
      }
    }
  ]
}
```

### 9.4 Inline Catalog Flow

For agents that accept inline catalogs but have never encountered the Oat Catalog:

1. Client detects `acceptsInlineCatalogs: true` in the agent's AgentCard
2. Client includes the Oat Catalog schema in `a2uiClientCapabilities.inlineCatalogs`
3. Agent reads the schema on the fly, sees 37 component definitions with descriptions
4. Agent generates valid Oat Catalog JSON without prior configuration
5. Client renders using the Oat Renderer as normal

This means a2ui-oat works with any conformant A2A agent without pre-deployment catalog setup.

### 9.5 Multi-Agent Surface Ownership

In multi-agent orchestration, multiple remote agents may each create their own surfaces. The orchestrator maintains a mapping of surfaceId to owning agent and routes user actions accordingly. When `sendDataModel: true` is enabled, the orchestrator strips metadata to ensure each agent only receives data model state from its own surfaces.

---

## 10. Companion Libraries

The Oat ecosystem includes several zero-dependency micro-libraries by Kailash Nadh. a2ui-oat integrates these as backing implementations for registered functions and catalog components.

| Library | Size | Integration Point | Role |
|---------|------|-------------------|------|
| Oat CSS + JS | ~8KB | Core styling | Automatic semantic styling, Web Components for Tabs, Dropdown, Toast |
| tinyrouter.js | ~950B | navigateTo function | Client-side SPA routing via window.history |
| floatype.js | ~1.2KB | Autocomplete component | Floating autocomplete/autosuggestion for text inputs |
| dragmove.js | ~500B | Draggable component (future) | Make DOM elements draggable and movable |
| indexed-cache.js | ~2.1KB | Asset caching (optional) | IndexedDB caching for Oat assets across sessions |

**Total shared footprint: ~13KB minified and gzipped.** This is the complete client-side runtime for both modes, excluding @a2ui/web-lib which is only required for A2UI Mode.

---

## 11. Theming

The Oat Catalog's theme schema exposes Oat CSS custom properties as A2UI theme parameters. Agents set these in the createSurface message.

| Theme Property | CSS Variable | Default | Description |
|---------------|-------------|---------|-------------|
| primaryColor | --color-primary | #1a73e8 | Primary action and accent color |
| backgroundColor | --color-bg | #ffffff | Page/surface background |
| textColor | --color-text | #202124 | Default text color |
| fontFamily | --font-family | system-ui | Base font stack |
| borderRadius | --border-radius | 4px | Component corner radius |
| spacing | --spacing | 1rem | Base spacing unit |

Oat supports light/dark mode via CSS media queries. The theme includes a **mode** property (light, dark, auto) applied as a data attribute on the surface root.

```json
{
  "version": "v0.9",
  "createSurface": {
    "surfaceId": "analytics-dashboard",
    "catalogId": "https://unpkg.com/a2ui-oat/catalog/oat-catalog.json",
    "theme": {
      "primaryColor": "#D97706",
      "backgroundColor": "#FFFBEB",
      "borderRadius": "8px",
      "mode": "light"
    }
  }
}
```

---

## 12. Project Structure

```
a2ui-oat/
├── catalog/
│   ├── oat-catalog.json              # A2UI catalog JSON Schema (37 components)
│   ├── oat-catalog-rules.txt          # Natural language prompt rules for LLMs
│   └── functions/                     # Function schema definitions
├── renderer/
│   ├── oat-renderer.js                # Component mapping (A2UI JSON → HTML)
│   ├── functions/                     # Registered function implementations
│   │   ├── fetchPage.js
│   │   ├── fetchAndAppend.js
│   │   ├── subscribeSSE.js
│   │   ├── subscribeWebSocket.js
│   │   ├── navigateTo.js
│   │   ├── showToast.js
│   │   ├── debounce.js
│   │   ├── formatDate.js
│   │   └── formatNumber.js
│   └── index.js                       # Entry point, catalog registration
├── direct/
│   ├── prompt-guide.md                # LLM prompt patterns for Oat HTML
│   └── sanitizer.js                   # HTML sanitizer for OatHTML component
├── shared/
│   └── vendor/                        # Oat CSS/JS + tinyrouter + floatype + dragmove
├── examples/
│   ├── a2ui-dashboard/                # Dashboard via A2UI Mode
│   ├── direct-dashboard/              # Same dashboard via Direct Mode
│   ├── a2a-multiagent/                # Multi-agent A2A with catalog negotiation
│   ├── realtime-streaming/            # SSE streaming dashboard
│   ├── pagination/                    # Client-side pagination
│   └── data-explorer/                 # Table + Autocomplete + Tabs + routing
├── docs/
│   ├── architecture.md                # This document
│   └── when-to-use-which.md           # Decision guide for mode selection
├── LICENSE
└── README.md
```

---

## 13. Implementation Roadmap

### Phase 1: Foundation (Weeks 1–2)

- Author oat-catalog.json with all 37 component definitions
- Author oat-catalog-rules.txt prompt fragment
- Implement Oat Renderer core with component mapping for all 37 components
- Integrate with @a2ui/web-lib for protocol handling
- Build basic example: single-surface dashboard rendering via A2UI Mode

### Phase 2: Functions & Patterns (Weeks 3–4)

- Implement all 22 registered functions
- Build pagination example with client-side cursor management
- Build real-time streaming example with SSE subscription
- Document Direct Mode with prompt guide and examples
- Implement OatHTML escape hatch component with sanitizer

### Phase 3: A2A Integration (Weeks 5–6)

- Build multi-agent A2A example with catalog negotiation
- Test inline catalog flow with generic A2A agents
- Validate security model: catalog allowlisting, schema validation, data model isolation
- Submit as community renderer to the A2UI ecosystem page

### Phase 4: Ecosystem & Advocacy (Ongoing)

- Engage A2UI team at Google for review and potential listing
- Collaborate with Kailash Nadh on alignment and potential co-maintenance
- Build comparison examples (same dashboard: Oat vs. Lit vs. React renderer)
- Explore companion catalog extensions for domain-specific components (charts, maps)

---

## 14. Competitive Position

| Attribute | a2ui-oat | Lit Renderer | React Renderer | Angular Renderer |
|-----------|---------|-------------|---------------|-----------------|
| Client footprint | ~13KB | ~15KB+ | ~45KB+ | ~60KB+ |
| Components | 37 | 16 | 16 | 16 |
| Registered functions | 22 | Basic set | Basic set | Basic set |
| Framework dependency | None | Lit | React | Angular |
| Build tooling required | No | Yes | Yes | Yes |
| Shadow DOM | No (open DOM) | Yes | No | No |
| v0.9 support | Planned | Stable | Planned | Stable |
| Client-side pagination | Native | Custom | Custom | Custom |
| Real-time streaming | Native | Custom | Custom | Custom |
| Client-side SPA routing | Native | Custom | Custom | Custom |
| Autocomplete | Native | Custom | Custom | Custom |
| Direct HTML mode | Yes | No | No | No |
| Inline catalog support | Yes | Varies | Varies | Varies |
| Zero-build deployment | Yes (CDN include) | No | No | No |

---

## 15. Appendix: Key References

| Resource | URL |
|----------|-----|
| A2UI Specification (v0.9) | https://a2ui.org/specification/v0.9-a2ui/ |
| A2UI Component Gallery | https://a2ui.org/reference/components/ |
| A2UI Catalog Guide | https://a2ui.org/guides/defining-your-own-catalog/ |
| A2UI Renderer Development | https://a2ui.org/guides/renderer-development/ |
| A2UI A2A Extension | https://a2ui.org/specification/v0.8-a2a-extension/ |
| A2UI Client-to-Server Actions | https://a2ui.org/concepts/client_to_server_actions/ |
| A2A Protocol | https://a2a-protocol.org/latest/ |
| Oat UI | https://oat.ink/ |
| Oat GitHub | https://github.com/knadh/oat |
| Oat Components Reference | https://oat.ink/components/ |
| tinyrouter.js | https://github.com/knadh/tinyrouter.js |
| floatype.js | https://github.com/knadh/floatype.js |
| dragmove.js | https://github.com/knadh/dragmove.js |
| indexed-cache.js | https://github.com/knadh/indexed-cache |
| @a2ui/web-lib | https://github.com/google/A2UI/tree/main/renderers |
