# ADK A2A Multi-Agent -- Metrics + Incidents

Two ADK agents communicating via an orchestrator, each generating independent A2UI surfaces rendered side-by-side.

## Architecture

```
Browser  <-->  FastAPI  <-->  Orchestrator Agent
                                 |           |
                          Metrics Agent   Incidents Agent
                          (Oat Catalog)   (Oat Catalog)
                                |              |
                          A2UI surface    A2UI surface
                          (left panel)    (right panel)
```

## Running

```bash
cd examples/adk-a2a-agents
source ../../.venv/bin/activate
python server.py
# Open http://localhost:8081
```

## How It Works

1. The orchestrator receives the user message and delegates to sub-agents.
2. Each sub-agent has its own system prompt with the full Oat Catalog schema.
3. The server collects events grouped by author (agent name).
4. Each agent's A2UI JSON is parsed separately and sent to the frontend.
5. The frontend renders each agent's surface in its own panel (metrics left, incidents right).

## Surface Isolation

Per A2UI spec Section 9.5, each agent's surface is isolated -- the metrics agent's components cannot access the incidents agent's data model and vice versa. This is enforced by rendering each surface in its own container with its own data scope.

## Try These Prompts

- "Show me the full dashboard" (triggers both agents)
- "Show system metrics" (metrics agent only)
- "Show active incidents" (incidents agent only)
