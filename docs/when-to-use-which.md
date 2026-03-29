# When to Use Which: A2UI Mode vs Direct Mode

A decision guide for choosing the right a2ui-oat operational mode.

---

## Decision Tree

Start here:

1. **Is the agent untrusted or from a third-party vendor?**
   - Yes --> **A2UI Mode** (Tier 1 or Tier 2)
   - No --> Continue to question 2

2. **Do you need cross-platform rendering (web + Flutter)?**
   - Yes --> **A2UI Mode** (structured JSON works across renderers)
   - No --> Continue to question 3

3. **Is this a multi-agent or multi-vendor A2A deployment?**
   - Yes --> **A2UI Mode** (catalog allowlisting + data model isolation are required)
   - No --> Continue to question 4

4. **Does compliance or security audit require a declarative, non-executable UI contract?**
   - Yes --> **A2UI Mode**
   - No --> Continue to question 5

5. **Do you need bidirectional data binding and server-push state management?**
   - Yes --> **A2UI Mode** (built into the protocol via `@a2ui/web-lib`)
   - No --> Continue to question 6

6. **Is the agent controlled by the same team operating the frontend?**
   - Yes --> **Direct Mode** is viable. Continue to question 7.
   - No --> **A2UI Mode**

7. **Is maximum simplicity and minimum latency the priority (internal dashboard, prototype)?**
   - Yes --> **Direct Mode**
   - No --> Either mode works. Consider whether you want structured contracts (A2UI Mode) or rapid iteration (Direct Mode).

### When to Use the OatHTML Escape Hatch

If you have chosen A2UI Mode but need more HTML flexibility than the 37 catalog components provide, use the **OatHTML component**. This is a Tier 2 approach: you remain within A2UI's catalog allowlist and security model, but the OatHTML component accepts a sanitized HTML string that the renderer passes through a configurable sanitizer before DOM insertion.

Use OatHTML when:
- You need A2UI's security guarantees but a specific layout requires raw HTML
- The agent is semi-trusted (internal but not fully controlled)
- You want catalog-level auditability with selective HTML flexibility

---

## Trade-Off Matrix

| Aspect | A2UI Mode (Structured) | Direct Mode (HTML-native) | OatHTML Escape Hatch |
|--------|----------------------|--------------------------|---------------------|
| **Security** | Catalog allowlist + schema validation + sandboxed functions | Trust the agent; optional sanitizer | Catalog allowlist + HTML sanitizer |
| **Complexity** | Higher (catalog schema, protocol engine, renderer) | Lower (semantic HTML + Oat CSS) | Moderate (A2UI infrastructure + sanitizer config) |
| **Flexibility** | Constrained to 37 catalog components + 22 registered functions | Unconstrained HTML | Catalog components + arbitrary sanitized HTML |
| **Performance** | ~13KB (Oat) + @a2ui/web-lib overhead | ~13KB (Oat only) | Same as A2UI Mode |
| **Data binding** | Built-in via A2UI data model with path resolution | Manual (vanilla JS or HTMX) | Built-in for catalog components; manual within OatHTML blocks |
| **Streaming updates** | `updateDataModel` messages via protocol | SSE/WebSocket to DOM directly | Mixed |
| **Cross-platform** | Yes (same JSON to web + Flutter renderers) | No (web only) | Partially (OatHTML blocks are web-specific) |
| **Build tooling** | None required | None required | None required |
| **Agent constraint** | Agent must emit valid catalog JSON | Agent emits any HTML | Agent emits catalog JSON; OatHTML blocks contain sanitized HTML |
| **Auditability** | Full (every component and function is schema-defined) | Limited (HTML is opaque) | Moderate (catalog-level audit + sanitizer logs) |

---

## Scenario Recommendations

### Multi-Agent A2A Orchestration

**Recommended: A2UI Mode (Tier 1)**

When multiple remote agents from different vendors contribute UI surfaces, A2UI Mode is the only safe choice. The catalog acts as an allowlist preventing agents from emitting arbitrary HTML or scripts. Data model isolation ensures each agent only receives state from its own surfaces. Catalog negotiation lets the orchestrator discover which components each agent supports.

### Agentspace / Vertex AI Agents

**Recommended: A2UI Mode (Tier 1)**

Google's Agentspace and Vertex AI agent deployments operate in structured, catalog-driven environments. A2UI Mode aligns with these platforms' security and rendering expectations. The Oat Catalog ID (`https://unpkg.com/a2ui-oat/catalog/oat-catalog.json`) can be advertised in agent cards for discovery.

### Regulated Environments (Finance, Healthcare, Government)

**Recommended: A2UI Mode (Tier 1)**

Compliance audits benefit from a declarative UI contract. Every component and function the agent can invoke is defined in the catalog schema. Two-phase validation (agent-side and client-side) provides defense in depth. No arbitrary code execution is possible through registered functions.

### Internal Tools and Dashboards

**Recommended: Direct Mode (Tier 3) or A2UI Mode (Tier 2)**

If the agent is controlled by the same team running the frontend, Direct Mode offers the simplest path: the agent emits semantic HTML, Oat styles it, done. For internal agents that need some structure but also HTML flexibility, the OatHTML escape hatch (Tier 2) provides a middle ground.

### Rapid Prototyping

**Recommended: Direct Mode (Tier 3)**

When iterating quickly on agent-driven interfaces, Direct Mode removes all intermediary layers. The agent generates HTML; Oat styles it. No catalog, no schema, no protocol engine. This is the fastest path from agent output to rendered UI.

### Single-Agent, Web-Only Applications

**Recommended: Direct Mode (Tier 3) or A2UI Mode depending on trust**

If the agent is trusted and the target is web-only, Direct Mode is simpler. If the agent may later be replaced or augmented with third-party agents, starting with A2UI Mode provides a migration-free path to multi-agent support.

### Real-Time Streaming Dashboards

**Recommended: A2UI Mode (Tier 1)**

The `subscribeSSE` and `subscribeWebSocket` registered functions enable autonomous real-time surfaces. The agent sets up the subscription once; the client handles all subsequent updates via data binding. This pattern requires A2UI Mode's data model and registered function infrastructure.

---

## Security Tier Comparison

| Tier | Mode | Trust Level | Validation | Arbitrary HTML | Script Injection | Function Sandboxing | Data Model Isolation | Use Case |
|------|------|-------------|------------|---------------|-----------------|--------------------|--------------------|----------|
| 1 (Strictest) | A2UI + Oat Catalog | Untrusted | Catalog allowlist + schema validation + sandboxed functions | Blocked | Blocked | Yes | Yes | Multi-vendor A2A, Agentspace, regulated environments |
| 2 (Moderate) | A2UI + OatHTML | Semi-trusted | Catalog allowlist + HTML sanitizer | Sanitized only | Blocked by sanitizer | Yes (for catalog functions) | Yes | Internal agents needing layout flexibility |
| 3 (Open) | Direct Mode | Fully trusted | Optional sanitizer | Allowed | Allowed (unless sanitizer configured) | N/A (no registered functions) | N/A (no data model) | Internal tools, prototypes, single-agent |

### Tier 1: A2UI + Oat Catalog

- The agent can only use components and functions defined in the catalog.
- Unrecognized component types are ignored or rendered as fallback placeholders.
- Agent-side validation catches hallucinated properties before transmission.
- Client-side validation ensures payloads conform to the catalog schema.
- Registered functions execute only pre-defined logic; no eval, no arbitrary code.

### Tier 2: A2UI + OatHTML Component

- All Tier 1 protections apply to catalog components.
- The OatHTML component accepts an HTML string property.
- The renderer passes it through a configurable sanitizer (recommended: DOMPurify) before DOM insertion.
- Scripts, event handlers, and dangerous attributes are stripped by the sanitizer.
- This provides HTML flexibility without abandoning catalog-level security for the rest of the surface.

### Tier 3: Direct Mode

- No catalog, no schema validation, no sandboxing.
- The agent's HTML is inserted into the DOM directly.
- A sanitizer (DOMPurify or equivalent) is recommended but not enforced.
- Appropriate only when the agent is controlled by the same organization operating the frontend.
- Not suitable for untrusted-agent scenarios.

---

## Summary

The choice between modes is fundamentally a trust decision:

- **Do not trust the agent?** Use A2UI Mode (Tier 1).
- **Partially trust the agent but need flexibility?** Use A2UI Mode with OatHTML (Tier 2).
- **Fully trust the agent?** Use Direct Mode (Tier 3).

Both modes share the same Oat CSS, Oat JS, and companion libraries. Switching from Direct Mode to A2UI Mode does not require changing the styling layer -- only adding the protocol engine and renderer.
