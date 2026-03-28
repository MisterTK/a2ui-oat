# Direct Mode Dashboard Example

An operations dashboard built with semantic HTML and Oat CSS -- no A2UI JSON, no renderer, no framework.

## What this demonstrates

**Direct Mode** is one of two operational modes in a2ui-oat. Instead of the agent emitting A2UI JSON that gets parsed, validated, and rendered, the agent emits semantic HTML directly. Oat CSS styles it automatically with zero intermediary.

This example builds the same operations dashboard content as the `a2ui-dashboard` example (metric cards, data table, alerts, sidebar navigation, breadcrumbs, progress bars, meters, badges, accordions) but does so with plain HTML.

## A2UI Mode vs Direct Mode

| Aspect | A2UI Mode (`a2ui-dashboard`) | Direct Mode (this example) |
|--------|------------------------------|---------------------------|
| Agent output | A2UI JSON constrained by the Oat Catalog | Semantic HTML |
| Security | Catalog allowlist + schema validation | Agent must be trusted |
| Intermediary | `@a2ui/web-lib` + Oat Renderer | None |
| Data binding | A2UI data model with path resolution | Manual (vanilla JS, SSE, HTMX) |
| Client footprint | ~13KB (Oat) + `@a2ui/web-lib` | ~13KB (Oat only) |
| Live updates | `subscribeSSE` registered function | `EventSource` or HTMX directly |

## Trust assumptions

Direct Mode has no catalog validation and no sandboxed function system. The agent's HTML is inserted into the DOM as-is. This is appropriate only when:

- The agent is controlled by the same team operating the frontend
- The target is web-only (no cross-platform requirement)
- The deployment is internal or behind authentication
- HTML sanitization (e.g., DOMPurify) is applied if there is any risk of injection

Direct Mode is **not** suitable for untrusted agents, multi-vendor A2A, or Agentspace deployments. Use A2UI Mode for those scenarios.

## How to run

Open `index.html` in a browser. No build step, no server, no dependencies beyond the Oat CSS/JS CDN links in the page.

```sh
open index.html
# or
python3 -m http.server 8080   # then visit http://localhost:8080
```

## When to use which mode

**Use Direct Mode** for internal tools, prototypes, single-agent systems, and anywhere maximum simplicity matters.

**Use A2UI Mode** for untrusted agents, multi-agent orchestration, cross-platform rendering, and deployments requiring a declarative security contract.

Both modes share the same Oat CSS, JS, and companion libraries. The choice is a security architecture decision, not a capability one.
