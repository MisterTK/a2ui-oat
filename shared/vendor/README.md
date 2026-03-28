# Vendor Dependencies

This directory documents the third-party libraries used by a2ui-oat. All libraries are authored by Kailash Nadh, are MIT-licensed, zero-dependency micro-libraries designed for minimal footprint. The one external reference outside this set is Google's @a2ui/web-lib, required only for A2UI Mode.

**Total client-side footprint: ~13KB minified and gzipped.**

---

## Library Reference

### Oat CSS + JS (~8KB combined)

The core styling and Web Component library. Oat automatically styles semantic HTML elements, eliminating the need for utility classes or custom CSS. It also provides Web Components for Tabs, Dropdown, and Toast.

| Field       | Value                                              |
|-------------|----------------------------------------------------|
| GitHub      | https://github.com/knadh/oat                       |
| Website     | https://oat.ink/                                   |
| Components  | https://oat.ink/components/                        |
| License     | MIT                                                |
| Size        | ~8KB minified and gzipped (CSS + JS combined)      |

**CDN URLs (jsDelivr):**

```
https://cdn.jsdelivr.net/gh/knadh/oat@latest/oat.min.css
https://cdn.jsdelivr.net/gh/knadh/oat@latest/oat.min.js
```

**CDN URLs (unpkg):**

```
https://unpkg.com/@knadh/oat/oat.min.css
https://unpkg.com/@knadh/oat/oat.min.js
```

**Purpose in a2ui-oat:**
- Automatic semantic HTML styling (both A2UI Mode and Direct Mode)
- Web Components for Tabs (`<oat-tabs>`), Dropdown, and Toast (`<oat-toast>`)
- 12-column responsive grid system
- Light/dark mode via CSS custom properties

---

### tinyrouter.js (~950B)

A minimal client-side SPA router using the History API.

| Field       | Value                                              |
|-------------|----------------------------------------------------|
| GitHub      | https://github.com/knadh/tinyrouter.js             |
| License     | MIT                                                |
| Size        | ~950 bytes minified and gzipped                    |

**CDN URLs (jsDelivr):**

```
https://cdn.jsdelivr.net/gh/knadh/tinyrouter.js@latest/tinyrouter.min.js
```

**CDN URLs (unpkg):**

```
https://unpkg.com/@knadh/tinyrouter/tinyrouter.min.js
```

**Purpose in a2ui-oat:**
- Backs the `navigateTo` registered function
- Enables client-side SPA routing via `window.history` without full page reloads
- Allows agents to build multi-view surfaces with tab-based or path-based navigation

---

### floatype.js (~1.2KB)

A floating autocomplete/autosuggestion library for text inputs.

| Field       | Value                                              |
|-------------|----------------------------------------------------|
| GitHub      | https://github.com/knadh/floatype.js               |
| License     | MIT                                                |
| Size        | ~1.2KB minified and gzipped                        |

**CDN URLs (jsDelivr):**

```
https://cdn.jsdelivr.net/gh/knadh/floatype.js@latest/floatype.min.js
```

**CDN URLs (unpkg):**

```
https://unpkg.com/@knadh/floatype/floatype.min.js
```

**Purpose in a2ui-oat:**
- Backs the `Autocomplete` catalog component
- Attaches floating autocomplete behavior to `<input>` elements
- Supports remote data sources for search-as-you-type patterns

---

### dragmove.js (~500B)

A minimal library to make DOM elements draggable and movable.

| Field       | Value                                              |
|-------------|----------------------------------------------------|
| GitHub      | https://github.com/knadh/dragmove.js               |
| License     | MIT                                                |
| Size        | ~500 bytes minified and gzipped                    |

**CDN URLs (jsDelivr):**

```
https://cdn.jsdelivr.net/gh/knadh/dragmove.js@latest/dragmove.min.js
```

**CDN URLs (unpkg):**

```
https://unpkg.com/@knadh/dragmove/dragmove.min.js
```

**Purpose in a2ui-oat:**
- Reserved for a future `Draggable` catalog component
- Enables drag-and-drop element repositioning with no dependencies

---

### indexed-cache.js (~2.1KB)

An IndexedDB-based caching layer for web assets.

| Field       | Value                                              |
|-------------|----------------------------------------------------|
| GitHub      | https://github.com/knadh/indexed-cache              |
| License     | MIT                                                |
| Size        | ~2.1KB minified and gzipped                        |

**CDN URLs (jsDelivr):**

```
https://cdn.jsdelivr.net/gh/knadh/indexed-cache@latest/indexed-cache.min.js
```

**CDN URLs (unpkg):**

```
https://unpkg.com/@knadh/indexed-cache/indexed-cache.min.js
```

**Purpose in a2ui-oat:**
- Optional. Caches Oat CSS/JS assets in IndexedDB across browser sessions.
- Reduces repeat load times for returning users.
- Not required for core functionality.

---

## @a2ui/web-lib (Google)

The A2UI protocol engine. Required only for A2UI Mode (not needed for Direct Mode).

| Field       | Value                                              |
|-------------|----------------------------------------------------|
| GitHub      | https://github.com/google/A2UI                     |
| Renderers   | https://github.com/google/A2UI/tree/main/renderers |
| License     | Apache 2.0                                         |

This library handles stream parsing, surface lifecycle management, data model state, schema validation, and data binding. The Oat Renderer builds on top of it.

---

## Size Summary

| Library           | Size (min+gzip) |
|-------------------|-----------------|
| Oat CSS + JS      | ~8KB            |
| tinyrouter.js     | ~950B           |
| floatype.js       | ~1.2KB          |
| dragmove.js       | ~500B           |
| indexed-cache.js  | ~2.1KB          |
| **Total**         | **~13KB**       |

Note: @a2ui/web-lib is excluded from this total as it is a separate dependency required only for A2UI Mode.

---

## Usage Instructions

### CDN Include (Recommended)

Add the following to your HTML `<head>`:

```html
<!-- Oat CSS -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/knadh/oat@latest/oat.min.css">

<!-- Oat JS (Web Components: Tabs, Dropdown, Toast) -->
<script src="https://cdn.jsdelivr.net/gh/knadh/oat@latest/oat.min.js"></script>

<!-- tinyrouter.js (SPA routing) -->
<script src="https://cdn.jsdelivr.net/gh/knadh/tinyrouter.js@latest/tinyrouter.min.js"></script>

<!-- floatype.js (Autocomplete) -->
<script src="https://cdn.jsdelivr.net/gh/knadh/floatype.js@latest/floatype.min.js"></script>

<!-- dragmove.js (Draggable, future use) -->
<script src="https://cdn.jsdelivr.net/gh/knadh/dragmove.js@latest/dragmove.min.js"></script>

<!-- indexed-cache.js (Optional: IndexedDB asset caching) -->
<script src="https://cdn.jsdelivr.net/gh/knadh/indexed-cache@latest/indexed-cache.min.js"></script>
```

### Minimal Setup (Core Only)

If you only need basic rendering without routing, autocomplete, or caching:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/knadh/oat@latest/oat.min.css">
<script src="https://cdn.jsdelivr.net/gh/knadh/oat@latest/oat.min.js"></script>
```

This is sufficient for Direct Mode with static semantic HTML.

---

## Local Vendoring Instructions

To self-host the assets instead of using a CDN:

1. Download each library's minified files from its GitHub releases or the repository directly.

2. Place them in this directory (`shared/vendor/`):

   ```
   shared/vendor/
     oat.min.css
     oat.min.js
     tinyrouter.min.js
     floatype.min.js
     dragmove.min.js
     indexed-cache.min.js
   ```

3. Update your HTML to reference local paths:

   ```html
   <link rel="stylesheet" href="/shared/vendor/oat.min.css">
   <script src="/shared/vendor/oat.min.js"></script>
   <script src="/shared/vendor/tinyrouter.min.js"></script>
   <script src="/shared/vendor/floatype.min.js"></script>
   <script src="/shared/vendor/dragmove.min.js"></script>
   <script src="/shared/vendor/indexed-cache.min.js"></script>
   ```

4. To download all files at once using curl:

   ```sh
   cd shared/vendor
   curl -LO https://cdn.jsdelivr.net/gh/knadh/oat@latest/oat.min.css
   curl -LO https://cdn.jsdelivr.net/gh/knadh/oat@latest/oat.min.js
   curl -LO https://cdn.jsdelivr.net/gh/knadh/tinyrouter.js@latest/tinyrouter.min.js
   curl -LO https://cdn.jsdelivr.net/gh/knadh/floatype.js@latest/floatype.min.js
   curl -LO https://cdn.jsdelivr.net/gh/knadh/dragmove.js@latest/dragmove.min.js
   curl -LO https://cdn.jsdelivr.net/gh/knadh/indexed-cache@latest/indexed-cache.min.js
   ```

---

## Version Pinning

The CDN URLs above use `@latest`, which always resolves to the most recent release. For production deployments, pin to a specific version or commit hash to avoid unexpected changes:

```
https://cdn.jsdelivr.net/gh/knadh/oat@<commit-or-tag>/oat.min.css
https://cdn.jsdelivr.net/gh/knadh/oat@<commit-or-tag>/oat.min.js
```

Replace `@latest` with a specific tag (e.g., `@v1.0.0`) or a commit SHA (e.g., `@abc1234`) for all libraries. Check each library's GitHub releases page for available tags.

For unpkg, pin using an npm version:

```
https://unpkg.com/@knadh/oat@0.5.1/oat.min.css
```

---

## Attribution

All companion libraries (Oat, tinyrouter.js, floatype.js, dragmove.js, indexed-cache.js) are created and maintained by [Kailash Nadh](https://github.com/knadh) and released under the MIT License.

@a2ui/web-lib is maintained by Google and released under the Apache 2.0 License.
