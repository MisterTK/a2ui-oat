# ADK Inline Catalog -- Basic vs Oat Comparison

Demonstrates that the same agent can produce dramatically different UIs depending on the catalog injected at runtime. Sends the same prompt to two agents side-by-side: one with Basic Catalog (18 components) and one with the full Oat Catalog (35 components).

## Architecture

```
Browser  <-->  FastAPI server
                  |
          +-------+-------+
          |               |
    Basic Agent      Oat Agent
    (18 components)  (35 components)
          |               |
    Basic A2UI       Rich A2UI
    (left panel)     (right panel)
```

## Running

```bash
cd examples/adk-inline-catalog
source ../../.venv/bin/activate
python server.py
# Open http://localhost:8082
```

## What This Demonstrates

1. **Catalog as configuration**: The same `A2uiSchemaManager` + `CatalogConfig` pattern works with any catalog JSON file.
2. **Runtime catalog injection**: The catalog is part of the system prompt, so it can be swapped without changing agent code.
3. **Output richness scales with catalog**: The Oat Catalog agent produces richer UIs using Badge, Progress, Table, Alert, Accordion, Tabs, and other components not available in Basic.
4. **Component statistics**: The stats bar shows how many components and unique types each agent used.

## Try These Prompts

- "Build a server monitoring dashboard"
- "Show project status with team info"
- "Create a data analytics overview"
