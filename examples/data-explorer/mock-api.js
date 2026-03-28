/**
 * mock-api.js -- Mock REST API for the data explorer example.
 *
 * Provides paginated, filterable item data that the A2UI surface
 * queries autonomously via fetchPage and Autocomplete.
 *
 * Usage:  node mock-api.js
 * Endpoints:
 *   GET /api/items?status=active&cursor=0&limit=50  -- paginated items
 *   GET /api/search?q=<query>                       -- search for autocomplete
 *
 * Port: 3200 (override with PORT env var)
 */

import { createServer } from "node:http";

const PORT = parseInt(process.env.PORT || "3200", 10);

// ---------------------------------------------------------------------------
// Sample data: 200 items
// ---------------------------------------------------------------------------

const STATUSES = ["Active", "Archived", "Flagged"];
const CATEGORIES = [
  "Infrastructure",
  "Application",
  "Database",
  "Network",
  "Security",
  "Monitoring",
  "Storage",
  "Compute",
];

const items = Array.from({ length: 200 }, (_, i) => {
  const id = i + 1;
  return {
    id,
    name: `Item ${String(id).padStart(3, "0")} - ${CATEGORIES[i % CATEGORIES.length]} Resource`,
    status: STATUSES[i % STATUSES.length],
    category: CATEGORIES[i % CATEGORIES.length],
    date: new Date(2026, 0, 1 + (i % 90)).toISOString().split("T")[0],
  };
});

// ---------------------------------------------------------------------------
// GET /api/items -- paginated items with optional status filter
// ---------------------------------------------------------------------------

function handleItems(url) {
  const status = url.searchParams.get("status") || "";
  const cursor = parseInt(url.searchParams.get("cursor") || "0", 10);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || "50", 10),
    100
  );

  // Filter by status (case-insensitive) if provided
  let filtered = items;
  if (status) {
    const s = status.toLowerCase();
    filtered = items.filter((item) => item.status.toLowerCase() === s);
  }

  // Cursor-based pagination: cursor is the offset index
  const page = filtered.slice(cursor, cursor + limit);
  const nextCursor = cursor + limit < filtered.length ? cursor + limit : null;
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / limit);
  const currentPage = Math.floor(cursor / limit) + 1;

  return {
    items: page,
    pagination: {
      currentPage,
      totalPages,
      totalItems,
      nextCursor,
      prevCursor: cursor - limit >= 0 ? cursor - limit : null,
      limit,
    },
  };
}

// ---------------------------------------------------------------------------
// GET /api/search -- search for autocomplete
// ---------------------------------------------------------------------------

function handleSearch(url) {
  const query = (url.searchParams.get("q") || "").toLowerCase().trim();
  if (!query) return [];

  return items
    .filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
    )
    .slice(0, 10)
    .map((item) => ({
      id: item.id,
      name: item.name,
      status: item.status,
      category: item.category,
    }));
}

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------

function json(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(payload);
}

const server = createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/api/items") {
    return json(res, 200, handleItems(url));
  }

  if (req.method === "GET" && url.pathname === "/api/search") {
    return json(res, 200, handleSearch(url));
  }

  json(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`Mock API running at http://localhost:${PORT}`);
  console.log(`  GET /api/items?status=active&cursor=0&limit=50`);
  console.log(`  GET /api/search?q=infra`);
});
