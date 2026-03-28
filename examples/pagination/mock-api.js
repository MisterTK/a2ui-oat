/**
 * mock-api.js -- Paginated data API for the a2ui-oat pagination example.
 *
 * Runs a zero-dependency Node.js HTTP server on port 3001.
 * Endpoint: GET /api/items?cursor=<cursor>&limit=<limit>
 *
 * Generates 500 sample items and serves them with cursor-based pagination.
 */

import { createServer } from "node:http";

// ---------------------------------------------------------------------------
// Data generation
// ---------------------------------------------------------------------------

const TOTAL_ITEMS = 500;
const DEFAULT_LIMIT = 50;

const STATUSES = ["active", "pending", "archived", "error"];

function generateItems(count) {
  const items = [];
  for (let i = 1; i <= count; i++) {
    items.push({
      id: i,
      name: `Item ${String(i).padStart(3, "0")}`,
      status: STATUSES[i % STATUSES.length],
      timestamp: new Date(
        Date.now() - (count - i) * 60_000
      ).toISOString(),
    });
  }
  return items;
}

const allItems = generateItems(TOTAL_ITEMS);

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

function handleRequest(req, res) {
  // CORS headers so the HTML page can fetch from a different origin/port.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname !== "/api/items") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  const cursor = parseInt(url.searchParams.get("cursor") || "0", 10);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || String(DEFAULT_LIMIT), 10),
    100
  );

  const startIndex = cursor;
  const endIndex = Math.min(startIndex + limit, allItems.length);
  const items = allItems.slice(startIndex, endIndex);
  const nextCursor =
    endIndex < allItems.length ? String(endIndex) : null;
  const totalPages = Math.ceil(allItems.length / limit);
  const currentPage = Math.floor(startIndex / limit) + 1;

  const body = JSON.stringify({
    items,
    nextCursor,
    prevCursor: startIndex > 0 ? String(Math.max(0, startIndex - limit)) : null,
    currentPage,
    totalPages,
    totalItems: allItems.length,
  });

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(body);
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const PORT = 3001;

createServer(handleRequest).listen(PORT, () => {
  console.log(`Mock pagination API running at http://localhost:${PORT}/api/items`);
  console.log(`  ${TOTAL_ITEMS} items, default page size ${DEFAULT_LIMIT}`);
  console.log(`  Example: http://localhost:${PORT}/api/items?cursor=0&limit=50`);
});
