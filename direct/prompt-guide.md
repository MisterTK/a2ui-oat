# Direct Mode Prompt Guide

A reference for LLMs generating semantic HTML in a2ui-oat Direct Mode.

---

## 1. What Is Direct Mode

Direct Mode is one of two operational modes in a2ui-oat. In this mode, the agent emits semantic HTML directly instead of A2UI JSON. The browser renders the HTML, and Oat CSS styles it automatically with no intermediary layer.

The data flow is:

```
Agent (LLM)
  |  Generates semantic HTML
  v
Transport (any)
  |  Delivers HTML string
  v
Browser DOM (innerHTML / HTMX swap)
  |  Oat CSS + JS styles it automatically
  v
Rendered UI
```

There is no catalog, no schema validation, and no protocol engine. The agent's HTML output is the final product. Oat CSS recognizes semantic elements and applies consistent, classless styling out of the box.

---

## 2. When to Use Direct Mode

Direct Mode is appropriate when:

- **The agent is trusted** and controlled by the same team operating the frontend.
- **The target is web-only** with no cross-platform rendering requirement.
- **Simplicity and speed matter** -- internal dashboards, prototypes, developer tools.
- **The development workflow favors rapid iteration** over structured contracts.
- **HTMX or vanilla JS** is the preferred client-side technology.

Do not use Direct Mode when:

- The agent is untrusted or originates from a third-party vendor via A2A.
- Cross-platform rendering is needed (the same output must render on Flutter).
- Bidirectional data binding and server-push state management are required.
- Compliance or security audit demands a declarative, non-executable UI contract.

For those scenarios, use A2UI Mode with the Oat Catalog instead.

---

## 3. Semantic HTML Patterns

Oat CSS is a classless CSS library. It styles standard HTML elements automatically. The most effective Direct Mode output uses semantic elements and avoids framework-specific markup.

### 3.1 Headings and Text

Use standard heading hierarchy (`h1` through `h6`) and paragraph elements. Oat styles them with consistent spacing and typography.

```html
<h1>Dashboard</h1>
<p>Welcome back. Here is your summary for today.</p>
<h2>Recent Activity</h2>
<p>No incidents reported in the last <strong>24 hours</strong>.</p>
```

### 3.2 Semantic Containers

Use `<article>`, `<section>`, `<aside>`, `<nav>`, `<header>`, `<footer>`, and `<main>` to give Oat structural context. Each renders with appropriate spacing and visual treatment.

```html
<main>
  <header>
    <h1>Project Status</h1>
    <nav>
      <a href="#overview">Overview</a>
      <a href="#timeline">Timeline</a>
      <a href="#team">Team</a>
    </nav>
  </header>
  <article>
    <h2>Overview</h2>
    <p>The project is on track for the March milestone.</p>
  </article>
  <aside>
    <h3>Quick Links</h3>
    <ul>
      <li><a href="/docs">Documentation</a></li>
      <li><a href="/issues">Open Issues</a></li>
    </ul>
  </aside>
</main>
```

### 3.3 The 12-Column Grid

Oat provides a 12-column responsive grid system via CSS classes. Use `container`, `row`, and `col-{n}` (where n is 1-12) for layout.

```html
<div class="container">
  <div class="row">
    <div class="col-4">
      <h3>Metric A</h3>
      <p>1,234</p>
    </div>
    <div class="col-4">
      <h3>Metric B</h3>
      <p>5,678</p>
    </div>
    <div class="col-4">
      <h3>Metric C</h3>
      <p>9,012</p>
    </div>
  </div>
</div>
```

### 3.4 Data Attributes and Roles

Oat uses data attributes and ARIA roles for component variants:

| Pattern | Purpose |
|---------|---------|
| `data-badge` | Renders an element as a badge |
| `data-tooltip="Text"` | Attaches a tooltip on hover |
| `role="alert"` | Renders an alert box |
| `role="switch"` | Renders a checkbox as a toggle switch |

```html
<span data-badge>3</span>

<button data-tooltip="Save your changes">Save</button>

<div role="alert">Deployment completed successfully.</div>

<label>
  <input type="checkbox" role="switch" checked> Dark mode
</label>
```

### 3.5 Oat Web Components

Oat ships two Web Components that require its companion JavaScript: `<oat-tabs>` and `<oat-toast>`. Use these for tabbed interfaces and toast notifications.

```html
<oat-tabs>
  <div data-title="Overview">
    <p>Overview content goes here.</p>
  </div>
  <div data-title="Details">
    <p>Detailed information goes here.</p>
  </div>
  <div data-title="Settings">
    <p>Configuration options.</p>
  </div>
</oat-tabs>
```

```html
<oat-toast data-variant="success" data-duration="3000">
  Record saved successfully.
</oat-toast>
```

### 3.6 Tables

Use standard `<table>` markup. Oat styles tables with borders, striping, and responsive behavior automatically.

```html
<table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Status</th>
      <th>Last Updated</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Service A</td>
      <td><span data-badge>Healthy</span></td>
      <td><time datetime="2026-03-28">Mar 28</time></td>
    </tr>
    <tr>
      <td>Service B</td>
      <td><span data-badge>Degraded</span></td>
      <td><time datetime="2026-03-27">Mar 27</time></td>
    </tr>
  </tbody>
</table>
```

### 3.7 Forms

Use standard form elements with `<label>`, `<fieldset>`, and `<legend>`. Oat styles them consistently.

```html
<form action="/api/submit" method="post">
  <fieldset>
    <legend>New Entry</legend>
    <label for="entry-name">Name</label>
    <input type="text" id="entry-name" name="name" placeholder="Enter name">
    <label for="entry-desc">Description</label>
    <textarea id="entry-desc" name="description" placeholder="Enter description"></textarea>
    <label for="entry-priority">Priority</label>
    <select id="entry-priority" name="priority">
      <option value="low">Low</option>
      <option value="medium" selected>Medium</option>
      <option value="high">High</option>
    </select>
    <button type="submit">Create</button>
  </fieldset>
</form>
```

### 3.8 Accordions

Use `<details>` and `<summary>` for collapsible sections. Oat styles these as accordions.

```html
<details>
  <summary>Deployment Log</summary>
  <pre><code>2026-03-28 10:00:00 Build started
2026-03-28 10:02:15 Tests passed
2026-03-28 10:03:42 Deployed to production</code></pre>
</details>
```

### 3.9 Progress and Meter

Use native `<progress>` and `<meter>` elements for indicators.

```html
<label for="upload">Upload progress</label>
<progress id="upload" value="65" max="100">65%</progress>

<label for="disk">Disk usage</label>
<meter id="disk" value="0.7" min="0" max="1" low="0.3" high="0.8" optimum="0.5">70%</meter>
```

### 3.10 Dialog (Modal)

Use the native `<dialog>` element. It can be opened with JavaScript via `.showModal()`.

```html
<dialog id="confirm-dialog">
  <h2>Confirm Action</h2>
  <p>Are you sure you want to proceed?</p>
  <form method="dialog">
    <button value="cancel">Cancel</button>
    <button value="confirm">Confirm</button>
  </form>
</dialog>
```

---

## 4. Example Patterns

### 4.1 Dashboard Layout

A three-column dashboard with a sidebar, main content area, and metrics row.

```html
<div class="container">
  <div class="row">
    <aside class="col-3">
      <nav>
        <h3>Navigation</h3>
        <ul>
          <li><a href="#overview">Overview</a></li>
          <li><a href="#incidents">Incidents</a></li>
          <li><a href="#settings">Settings</a></li>
        </ul>
      </nav>
    </aside>
    <main class="col-9">
      <h1>Operations Dashboard</h1>
      <div class="row">
        <div class="col-4">
          <article>
            <h3>Uptime</h3>
            <meter value="0.997" min="0" max="1" low="0.95" high="0.99">99.7%</meter>
          </article>
        </div>
        <div class="col-4">
          <article>
            <h3>Requests / sec</h3>
            <p><strong>12,450</strong></p>
          </article>
        </div>
        <div class="col-4">
          <article>
            <h3>Error Rate</h3>
            <p>0.3% <span data-badge>Normal</span></p>
          </article>
        </div>
      </div>
      <h2>Recent Incidents</h2>
      <table>
        <thead>
          <tr><th>ID</th><th>Severity</th><th>Summary</th><th>Time</th></tr>
        </thead>
        <tbody>
          <tr><td>INC-042</td><td>P2</td><td>Elevated latency in us-east-1</td><td>2h ago</td></tr>
          <tr><td>INC-041</td><td>P3</td><td>Cert renewal warning</td><td>6h ago</td></tr>
        </tbody>
      </table>
    </main>
  </div>
</div>
```

### 4.2 Card Grid

A responsive grid of cards using articles inside columns.

```html
<div class="container">
  <h1>Team Directory</h1>
  <div class="row">
    <div class="col-4">
      <article>
        <h3>Alice Chen</h3>
        <p>Engineering Lead</p>
        <p><a href="mailto:alice@example.com">alice@example.com</a></p>
      </article>
    </div>
    <div class="col-4">
      <article>
        <h3>Bob Martinez</h3>
        <p>Product Manager</p>
        <p><a href="mailto:bob@example.com">bob@example.com</a></p>
      </article>
    </div>
    <div class="col-4">
      <article>
        <h3>Carol Park</h3>
        <p>Designer</p>
        <p><a href="mailto:carol@example.com">carol@example.com</a></p>
      </article>
    </div>
  </div>
</div>
```

### 4.3 Data Table with Controls

A table with search and action buttons.

```html
<section>
  <h2>Inventory</h2>
  <div class="row">
    <div class="col-6">
      <input type="search" placeholder="Search items..." id="search-input">
    </div>
    <div class="col-6" style="text-align: right;">
      <button>Export CSV</button>
      <button>Add Item</button>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>SKU</th><th>Name</th><th>Qty</th><th>Status</th></tr>
    </thead>
    <tbody>
      <tr><td>A-001</td><td>Widget</td><td>142</td><td><span data-badge>In Stock</span></td></tr>
      <tr><td>A-002</td><td>Gadget</td><td>7</td><td><span data-badge>Low Stock</span></td></tr>
      <tr><td>A-003</td><td>Doohickey</td><td>0</td><td><span data-badge>Out of Stock</span></td></tr>
    </tbody>
  </table>
</section>
```

### 4.4 Form

A complete form with fieldsets and validation hints.

```html
<form action="/api/register" method="post">
  <h2>Register Account</h2>
  <fieldset>
    <legend>Personal Information</legend>
    <label for="full-name">Full Name</label>
    <input type="text" id="full-name" name="fullName" placeholder="Jane Doe">
    <label for="email">Email</label>
    <input type="email" id="email" name="email" placeholder="jane@example.com">
  </fieldset>
  <fieldset>
    <legend>Preferences</legend>
    <label>
      <input type="checkbox" role="switch"> Receive newsletter
    </label>
    <label for="language">Language</label>
    <select id="language" name="language">
      <option value="en" selected>English</option>
      <option value="es">Spanish</option>
      <option value="de">German</option>
    </select>
  </fieldset>
  <button type="submit">Register</button>
</form>
```

### 4.5 Alert and Toast

Alerts for inline feedback and toasts for transient notifications.

```html
<!-- Inline alerts -->
<div role="alert" data-variant="success">Deployment completed successfully.</div>
<div role="alert" data-variant="warning">SSL certificate expires in 7 days.</div>
<div role="alert" data-variant="error">Build failed. Check logs for details.</div>

<!-- Toast notification (requires Oat JS) -->
<oat-toast data-variant="success" data-duration="4000">Changes saved.</oat-toast>
```

---

## 5. What to Avoid

### Inline Styles

Let Oat handle styling. Inline `style` attributes bypass the design system and break visual consistency.

```html
<!-- Bad -->
<p style="color: red; font-size: 24px;">Error</p>

<!-- Good -->
<div role="alert" data-variant="error">Error</div>
```

### Framework-Specific Markup

Do not emit React JSX, Angular template syntax, Vue directives, or any framework-specific attributes. Direct Mode targets the plain browser DOM.

```html
<!-- Bad -->
<div ng-if="show" @click="handler" className="card">

<!-- Good -->
<article>
```

### Complex Inline JavaScript

Avoid embedding `<script>` blocks or `onclick` handlers in generated HTML. If interactivity is needed beyond what Oat provides, use the companion libraries (see Section 6) or wire behavior externally.

### Deeply Nested Divs

Oat styles semantic elements. A soup of `<div>` tags gives Oat nothing to work with. Prefer `<article>`, `<section>`, `<aside>`, `<nav>`, and other semantic elements.

### Custom CSS Classes (Unless Needed)

Oat's classless styling covers most use cases. Add classes only for Oat's grid system (`container`, `row`, `col-{n}`) or specific Oat utility classes. Do not invent custom class names that have no corresponding CSS.

---

## 6. Companion Libraries

a2ui-oat includes several zero-dependency micro-libraries from the Oat ecosystem. These work in Direct Mode by attaching behavior to DOM elements.

### 6.1 tinyrouter.js -- Client-Side Routing

Use tinyrouter for single-page-app navigation without a framework. It works with `window.history` and fires callbacks on route changes.

```html
<nav>
  <a href="/dashboard" data-route>Dashboard</a>
  <a href="/settings" data-route>Settings</a>
</nav>
<main id="view"></main>

<script type="module">
  import { router } from './vendor/tinyrouter.js';
  router.add('/dashboard', () => {
    document.getElementById('view').innerHTML = '<h1>Dashboard</h1>';
  });
  router.add('/settings', () => {
    document.getElementById('view').innerHTML = '<h1>Settings</h1>';
  });
  router.start();
</script>
```

### 6.2 floatype.js -- Autocomplete

Use floatype for floating autocomplete on text inputs. It fetches suggestions from a URL or a local function.

```html
<label for="search">Search users</label>
<input type="text" id="search" placeholder="Start typing...">

<script type="module">
  import { floatype } from './vendor/floatype.js';
  floatype(document.getElementById('search'), {
    source: '/api/users/search',
    minChars: 2,
    onSelect: (item) => { console.log('Selected:', item); }
  });
</script>
```

### 6.3 dragmove.js -- Draggable Elements

Use dragmove to make DOM elements draggable. Useful for movable panels or kanban-style interfaces.

```html
<div id="floating-panel">
  <h3>Notes</h3>
  <p>Drag me around.</p>
</div>

<script type="module">
  import { dragmove } from './vendor/dragmove.js';
  dragmove(document.getElementById('floating-panel'));
</script>
```

---

## 7. Sanitization

### When to Sanitize

In fully trusted scenarios (your own agent, internal tool, behind authentication), sanitization is optional. In semi-trusted scenarios -- where the agent is mostly trusted but its output might include unexpected content -- run the HTML through the a2ui-oat sanitizer before inserting it into the DOM.

The three security tiers:

| Tier | Mode | Trust Level | Sanitization |
|------|------|-------------|--------------|
| 1 (Strictest) | A2UI + Oat Catalog | Untrusted | Not needed -- catalog constrains output |
| 2 (Moderate) | A2UI + OatHTML component | Semi-trusted | Required -- sanitizer runs automatically |
| 3 (Open) | Direct Mode | Fully trusted | Optional -- recommended as defense in depth |

### How to Use the Sanitizer

The sanitizer is in `direct/sanitizer.js`. It exports two functions.

**`sanitize(html, config)`** -- Sanitize a single HTML string.

```js
import { sanitize } from './sanitizer.js';

const dirty = agentResponse.html;
const clean = sanitize(dirty);
container.innerHTML = clean;
```

**`createSanitizer(config)`** -- Create a reusable sanitizer with baked-in config.

```js
import { createSanitizer } from './sanitizer.js';

const clean = createSanitizer({
  extraTags: ['video', 'audio', 'source'],
  extraAttrs: ['controls', 'autoplay', 'loop'],
});

container.innerHTML = clean(agentResponse.html);
```

### What the Sanitizer Strips

- All `<script>` tags and their contents.
- All `<style>` tags and their contents.
- All `on*` event handler attributes (`onclick`, `onerror`, `onload`, etc.).
- `javascript:` and `vbscript:` URLs in `href`, `src`, and `action` attributes.
- `data:` URLs except for images (`data:image/*` is allowed).
- Any HTML tags not on the allowlist (their children are preserved).
- Any attributes not on the allowlist.

### Customizing the Allowlist

Pass a config object to override or extend the defaults.

```js
// Override the entire tag allowlist (only these tags are permitted).
sanitize(html, {
  allowedTags: ['p', 'a', 'strong', 'em', 'br'],
});

// Extend the default allowlist with additional tags.
sanitize(html, {
  extraTags: ['video', 'audio', 'source'],
  extraAttrs: ['controls', 'autoplay', 'muted'],
});

// Override wildcard attribute prefixes.
sanitize(html, {
  wildcardPrefixes: ['aria-', 'data-', 'x-'],
});
```
