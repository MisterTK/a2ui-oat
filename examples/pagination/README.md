# Pagination Example

Demonstrates the **client-side pagination** pattern from the a2ui-oat architecture (Section 6.4). The agent creates a surface once with a Table and Pagination component wired to the `fetchPage` registered function. All subsequent page navigation is handled entirely by the client -- the agent is never contacted again.

## Files

| File | Purpose |
|------|---------|
| `mock-api.js` | Zero-dependency Node.js HTTP server serving 500 sample items with cursor-based pagination |
| `index.html` | A2UI Mode page with an embedded agent-output JSON surface definition |

## How to run

1. Start the mock API server:

   ```bash
   node mock-api.js
   ```

   The server starts on `http://localhost:3001`.

2. Open `index.html` in a browser. If you need to serve it over HTTP (to avoid CORS issues with `file://`), use any static file server:

   ```bash
   npx serve .
   ```

   Then open `http://localhost:3000` (or whichever port the file server reports).

## What to observe

- On page load, the table populates with the first 50 items fetched from the mock API.
- Clicking **Next** or **Previous** triggers the `fetchPage` function, which calls the mock API with the appropriate cursor, writes the response into the data model, and re-renders the table.
- The page indicator updates to show the current page out of 10 total pages (500 items / 50 per page).
- All pagination happens client-side. The agent (represented by the embedded JSON) did its work once at surface creation time. Every subsequent page fetch is a direct browser-to-API call with zero backend agent cost.

## API reference

**`GET /api/items?cursor=<cursor>&limit=<limit>`**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `cursor` | `0` | Start index (opaque string in real APIs; integer index here for simplicity) |
| `limit` | `50` | Items per page (max 100) |

Response:

```json
{
  "items": [{ "id": 1, "name": "Item 001", "status": "active", "timestamp": "..." }, ...],
  "nextCursor": "50",
  "prevCursor": null,
  "currentPage": 1,
  "totalPages": 10,
  "totalItems": 500
}
```
