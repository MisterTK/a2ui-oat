# A2A Multi-Agent Example

Demonstrates A2A integration with catalog negotiation as described in Section 9 of the a2ui-oat architecture.

## What This Shows

- **Agent Discovery** (Section 9.1): Two agents expose AgentCards at well-known URLs, each advertising Oat Catalog support in their `supportedCatalogIds`.
- **Catalog Negotiation** (Section 9.2): The client includes `supportedCatalogIds` in every message's metadata. Both agents and client agree on the Oat Catalog.
- **A2UI DataParts** (Section 9.3): Agents respond with `mimeType: application/json+a2ui` DataParts containing `createSurface`, `updateDataModel`, and `updateComponents` messages.
- **Inline Catalog Flow** (Section 9.4): Agent A (`acceptsInlineCatalogs: true`) receives the catalog schema at runtime. Agent B does not accept inline catalogs, demonstrating the negotiation difference.
- **Surface Ownership Isolation** (Section 9.5): Each agent creates its own surface. Surfaces are rendered in separate containers with isolated data models.

## Agents

| Agent | Surface | Components Used |
|-------|---------|----------------|
| **Metrics Agent** (A) | `metrics-surface` | Progress, Meter, Badge, Text, Row, Column |
| **Incidents Agent** (B) | `incidents-surface` | Table, Pagination, Alert, Text, Column |

## How to Run

1. Start the mock agents server:

   ```bash
   node mock-agents.js
   ```

   This starts an HTTP server on port 3100 (override with `PORT` env var).

2. Open `index.html` in a browser. The page will:
   - Discover both agents via their AgentCard endpoints
   - Negotiate catalog support
   - Send messages and receive A2UI DataParts
   - Render two independent surfaces side by side

3. Watch the log panel at the bottom for the negotiation flow.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/.well-known/agent-a.json` | AgentCard for Metrics Agent |
| GET | `/.well-known/agent-b.json` | AgentCard for Incidents Agent |
| POST | `/agents/metrics/message` | Send message to Metrics Agent |
| POST | `/agents/incidents/message` | Send message to Incidents Agent |

## Key Concepts

### Catalog Negotiation Flow

1. Client reads AgentCard and sees `supportedCatalogIds`
2. Client sends message with its own `supportedCatalogIds` in metadata
3. Agent picks the best matching catalog (Oat Catalog preferred, Basic Catalog as fallback)
4. Agent responds with components from the negotiated catalog

### Surface Ownership

Each agent creates and manages its own surface. In a production multi-agent system, the orchestrator ensures:

- Each agent only receives data model state from its own surfaces
- User actions on a surface are routed to the owning agent
- No cross-surface data leakage between agents
