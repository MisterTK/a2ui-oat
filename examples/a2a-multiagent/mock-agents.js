/**
 * mock-agents.js -- Simulates two A2A agents for the multi-agent example.
 *
 * Agent A: "Metrics Agent" -- creates a metrics surface with Progress, Meter, Badge
 * Agent B: "Incidents Agent" -- creates an incidents surface with Table, Pagination, Alert
 *
 * Each agent advertises Oat Catalog support in its AgentCard (Section 9.1).
 * The server simulates the catalog negotiation flow (Section 9.2).
 *
 * Usage:  node mock-agents.js
 * Endpoints:
 *   GET  /.well-known/agent-a.json   -- AgentCard for Metrics Agent
 *   GET  /.well-known/agent-b.json   -- AgentCard for Incidents Agent
 *   POST /agents/metrics/message     -- Send message to Metrics Agent
 *   POST /agents/incidents/message   -- Send message to Incidents Agent
 *
 * Port: 3100 (override with PORT env var)
 */

import { createServer } from "node:http";

const PORT = parseInt(process.env.PORT || "3100", 10);

const OAT_CATALOG_ID = "https://unpkg.com/a2ui-oat/catalog/oat-catalog.json";
const BASIC_CATALOG_ID =
  "https://a2ui.org/specification/v0_9/basic_catalog.json";

// ---------------------------------------------------------------------------
// AgentCards (Section 9.1)
// ---------------------------------------------------------------------------

const agentCardA = {
  name: "Metrics Agent",
  description:
    "Provides real-time system metrics including CPU, memory, and request latency.",
  url: "/agents/metrics/message",
  extensions: [
    {
      uri: "https://a2ui.org/a2a-extension/a2ui/v0.9",
      description: "A2UI with Oat Catalog",
      params: {
        supportedCatalogIds: [OAT_CATALOG_ID, BASIC_CATALOG_ID],
        acceptsInlineCatalogs: true,
      },
    },
  ],
};

const agentCardB = {
  name: "Incidents Agent",
  description:
    "Manages incident records with pagination and severity alerts.",
  url: "/agents/incidents/message",
  extensions: [
    {
      uri: "https://a2ui.org/a2a-extension/a2ui/v0.9",
      description: "A2UI with Oat Catalog",
      params: {
        supportedCatalogIds: [OAT_CATALOG_ID, BASIC_CATALOG_ID],
        // This agent does NOT accept inline catalogs -- demonstrates the
        // negotiation difference described in Section 9.4.
        acceptsInlineCatalogs: false,
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// A2UI DataPart helpers
// ---------------------------------------------------------------------------

/** Wrap an array of A2UI messages into an A2A DataPart (Section 9.3). */
function makeDataPart(messages) {
  return {
    kind: "data",
    metadata: { mimeType: "application/json+a2ui" },
    data: messages,
  };
}

// ---------------------------------------------------------------------------
// Catalog negotiation (Section 9.2)
// ---------------------------------------------------------------------------

/**
 * Checks the incoming message metadata for supportedCatalogIds.
 * Returns the best catalog ID to use, or null if none match.
 */
function negotiateCatalog(requestBody, agentCard) {
  const clientCatalogs =
    requestBody?.metadata?.["v0.9"]?.supportedCatalogIds ?? [];
  const agentCatalogs =
    agentCard.extensions[0]?.params?.supportedCatalogIds ?? [];

  // Prefer the Oat Catalog; fall back to Basic Catalog.
  for (const id of [OAT_CATALOG_ID, BASIC_CATALOG_ID]) {
    if (clientCatalogs.includes(id) && agentCatalogs.includes(id)) {
      return id;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Metrics Agent response (Agent A)
// ---------------------------------------------------------------------------

function metricsAgentResponse(catalogId) {
  const createSurface = {
    version: "v0.9",
    createSurface: {
      surfaceId: "metrics-surface",
      catalogId,
      theme: { primaryColor: "#1A73E8", mode: "light" },
      sendDataModel: true,
    },
  };

  const updateDataModel = {
    version: "v0.9",
    updateDataModel: {
      surfaceId: "metrics-surface",
      data: {
        cpu: 72,
        memory: 58,
        latencyMs: 142,
        requestsPerSec: 1_240,
        status: "healthy",
      },
    },
  };

  const updateComponents = {
    version: "v0.9",
    updateComponents: {
      surfaceId: "metrics-surface",
      components: [
        {
          id: "metrics-root",
          component: "Column",
          children: [
            "metrics-title",
            "metrics-status-row",
            "cpu-section",
            "memory-section",
            "latency-section",
          ],
        },
        {
          id: "metrics-title",
          component: "Text",
          variant: "h2",
          text: "System Metrics",
        },
        {
          id: "metrics-status-row",
          component: "Row",
          children: ["status-badge", "rps-badge"],
          justify: "start",
        },
        {
          id: "status-badge",
          component: "Badge",
          text: { path: "/status" },
          variant: "success",
        },
        {
          id: "rps-badge",
          component: "Badge",
          text: "1,240 req/s",
          variant: "info",
        },
        {
          id: "cpu-section",
          component: "Column",
          children: ["cpu-label", "cpu-progress"],
        },
        {
          id: "cpu-label",
          component: "Text",
          variant: "body",
          text: "CPU Usage",
        },
        {
          id: "cpu-progress",
          component: "Progress",
          value: { path: "/cpu" },
          max: 100,
        },
        {
          id: "memory-section",
          component: "Column",
          children: ["memory-label", "memory-meter"],
        },
        {
          id: "memory-label",
          component: "Text",
          variant: "body",
          text: "Memory Usage",
        },
        {
          id: "memory-meter",
          component: "Meter",
          value: { path: "/memory" },
          min: 0,
          max: 100,
          low: 30,
          high: 80,
        },
        {
          id: "latency-section",
          component: "Column",
          children: ["latency-label", "latency-meter"],
        },
        {
          id: "latency-label",
          component: "Text",
          variant: "body",
          text: "Request Latency (ms)",
        },
        {
          id: "latency-meter",
          component: "Meter",
          value: { path: "/latencyMs" },
          min: 0,
          max: 500,
          low: 100,
          high: 300,
        },
      ],
    },
  };

  return makeDataPart([createSurface, updateDataModel, updateComponents]);
}

// ---------------------------------------------------------------------------
// Incidents Agent response (Agent B)
// ---------------------------------------------------------------------------

function incidentsAgentResponse(catalogId) {
  const incidentRows = [
    {
      id: "INC-1042",
      title: "Database connection pool exhausted",
      severity: "critical",
      status: "open",
      created: "2026-03-28T08:12:00Z",
    },
    {
      id: "INC-1041",
      title: "Elevated error rate on /api/checkout",
      severity: "high",
      status: "investigating",
      created: "2026-03-28T07:45:00Z",
    },
    {
      id: "INC-1040",
      title: "SSL certificate expiring in 7 days",
      severity: "medium",
      status: "open",
      created: "2026-03-27T16:30:00Z",
    },
    {
      id: "INC-1039",
      title: "Memory leak in worker process",
      severity: "high",
      status: "resolved",
      created: "2026-03-27T11:00:00Z",
    },
    {
      id: "INC-1038",
      title: "CDN cache hit ratio below threshold",
      severity: "low",
      status: "resolved",
      created: "2026-03-26T14:20:00Z",
    },
  ];

  const createSurface = {
    version: "v0.9",
    createSurface: {
      surfaceId: "incidents-surface",
      catalogId,
      theme: { primaryColor: "#D32F2F", mode: "light" },
      sendDataModel: true,
    },
  };

  const updateDataModel = {
    version: "v0.9",
    updateDataModel: {
      surfaceId: "incidents-surface",
      data: {
        incidents: incidentRows,
        pagination: {
          currentPage: 1,
          totalPages: 4,
          nextCursor: "cursor_page2",
        },
        alertMessage: "1 critical incident requires immediate attention",
      },
    },
  };

  const updateComponents = {
    version: "v0.9",
    updateComponents: {
      surfaceId: "incidents-surface",
      components: [
        {
          id: "incidents-root",
          component: "Column",
          children: [
            "incidents-title",
            "incidents-alert",
            "incidents-table",
            "incidents-pagination",
          ],
        },
        {
          id: "incidents-title",
          component: "Text",
          variant: "h2",
          text: "Active Incidents",
        },
        {
          id: "incidents-alert",
          component: "Alert",
          text: { path: "/alertMessage" },
          variant: "error",
        },
        {
          id: "incidents-table",
          component: "Table",
          columns: [
            { header: "ID", field: "id" },
            { header: "Title", field: "title" },
            { header: "Severity", field: "severity" },
            { header: "Status", field: "status" },
            { header: "Created", field: "created" },
          ],
          rows: { path: "/incidents" },
          striped: true,
          sortable: true,
        },
        {
          id: "incidents-pagination",
          component: "Pagination",
          currentPage: { path: "/pagination/currentPage" },
          totalPages: { path: "/pagination/totalPages" },
          action: {
            functionCall: {
              call: "fetchPage",
              args: {
                url: "/api/incidents",
                cursor: { path: "/pagination/nextCursor" },
                targetPath: "/incidents",
              },
            },
          },
        },
      ],
    },
  };

  return makeDataPart([createSurface, updateDataModel, updateComponents]);
}

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString();
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function json(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(payload);
}

const server = createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // --- Agent discovery endpoints ---
  if (req.method === "GET" && url.pathname === "/.well-known/agent-a.json") {
    return json(res, 200, agentCardA);
  }
  if (req.method === "GET" && url.pathname === "/.well-known/agent-b.json") {
    return json(res, 200, agentCardB);
  }

  // --- Agent message endpoints ---
  if (req.method === "POST" && url.pathname === "/agents/metrics/message") {
    const body = await parseBody(req);
    const catalogId = negotiateCatalog(body, agentCardA);

    if (!catalogId) {
      return json(res, 400, {
        error: "No common catalog found during negotiation",
      });
    }

    console.log(
      `[Metrics Agent] Negotiated catalog: ${catalogId}`
    );

    // If the client sent an inline catalog, acknowledge it (Section 9.4).
    if (body?.metadata?.["v0.9"]?.inlineCatalogs?.length) {
      console.log(
        "[Metrics Agent] Received inline catalog -- using it at runtime"
      );
    }

    return json(res, 200, metricsAgentResponse(catalogId));
  }

  if (req.method === "POST" && url.pathname === "/agents/incidents/message") {
    const body = await parseBody(req);
    const catalogId = negotiateCatalog(body, agentCardB);

    if (!catalogId) {
      return json(res, 400, {
        error: "No common catalog found during negotiation",
      });
    }

    console.log(
      `[Incidents Agent] Negotiated catalog: ${catalogId}`
    );

    return json(res, 200, incidentsAgentResponse(catalogId));
  }

  // --- Fallback ---
  json(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`Mock A2A agents running at http://localhost:${PORT}`);
  console.log(`  Agent A (Metrics):   GET  /.well-known/agent-a.json`);
  console.log(`                       POST /agents/metrics/message`);
  console.log(`  Agent B (Incidents): GET  /.well-known/agent-b.json`);
  console.log(`                       POST /agents/incidents/message`);
});
