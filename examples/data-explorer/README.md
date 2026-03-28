# Data Explorer Example

Demonstrates the data explorer pattern described in Section 6.6 of the a2ui-oat architecture. An agent builds a functional data exploration surface in a single interaction. The surface then runs autonomously -- tabs, search, pagination, and routing all work without further agent involvement.

## What This Shows

- **Tabs with navigateTo**: Four views (All, Active, Archived, Flagged) are client-side routed via `navigateTo` backed by tinyrouter.js. Each tab changes the URL hash and applies a different API filter.
- **Autocomplete with debounce**: A search input is wired to `/api/search` with a 250ms debounce, backed by floatype.js. Results appear as the user types.
- **Table with data binding**: The table is bound to `/tableData/items` in the data model. When data changes (from pagination or filter), the table re-renders automatically.
- **Pagination with fetchPage**: Previous/Next buttons call `fetchPage`, which reads the cursor from the data model, fetches the next page from the API, and writes results back to the data model. The agent is never contacted again.

## The Agent Output

The `index.html` file includes a `const agentOutput` variable containing the exact A2UI JSON the agent would emit. This JSON:

1. Creates a surface with the Oat Catalog
2. Sets initial data model state
3. Declares components: Tabs, Autocomplete, Table, Pagination
4. Wires Tabs to `navigateTo` with different filter paths
5. Wires Autocomplete to a debounced search
6. Wires Pagination to `fetchPage`
7. Binds the Table to the data model

After this single interaction, the surface is self-sufficient. The page manually implements the rendering to demonstrate the pattern without requiring the full Oat Renderer and @a2ui/web-lib infrastructure.

## How to Run

1. Start the mock API server:

   ```bash
   node mock-api.js
   ```

   This starts an HTTP server on port 3200 (override with `PORT` env var).

2. Open `index.html` in a browser.

3. Try these interactions (all happen client-side with no agent):
   - Click tabs to filter by status
   - Type in the search box to find items
   - Use Previous/Next to page through results
   - Note the URL hash changes when switching tabs

## API Endpoints

| Method | Path | Parameters | Description |
|--------|------|------------|-------------|
| GET | `/api/items` | `status`, `cursor`, `limit` | Paginated items with optional status filter |
| GET | `/api/search` | `q` | Search items by name or category (for autocomplete) |

## Sample Data

The mock API provides 200 items with:

- **id**: 1--200
- **name**: Descriptive names incorporating the category
- **status**: Active, Archived, or Flagged (cycled)
- **category**: Infrastructure, Application, Database, Network, Security, Monitoring, Storage, Compute
- **date**: Dates spanning January--March 2026

## What to Observe

1. **Autonomous operation**: After the page loads and fetches the first page, every subsequent interaction (tab clicks, search, pagination) goes directly to the mock API. No agent is involved.

2. **Client-side routing**: Tab clicks update the URL hash. You can bookmark or share a filtered view (e.g., `#/active`). Refreshing the page restores the filter.

3. **Cursor-based pagination**: The API returns a `nextCursor` and `prevCursor`. The client stores these in its data model and passes them to the next `fetchPage` call. This pattern scales to any dataset size.

4. **Debounced search**: The search input waits 250ms after the last keystroke before querying the API, avoiding excessive requests during fast typing.
