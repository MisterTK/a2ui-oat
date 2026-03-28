# A2UI Dashboard Example

A self-contained example showing the Oat Renderer converting A2UI JSON into a styled dark-mode operations dashboard.

## What this demonstrates

- **A2UI Mode data flow**: an agent emits `createSurface`, `updateComponents`, and `updateDataModel` messages; the renderer turns them into live HTML.
- **Oat Catalog components**: Grid, Row, Column, Sidebar, List, Button, Text, Badge, Progress, Card, Table, Alert, and Breadcrumb -- all rendered as semantic HTML and styled with Oat CSS custom properties.
- **Data binding**: component properties reference paths in the data model (e.g. `{ "path": "/metrics/uptime" }`). When the data model changes, the UI re-renders.
- **Registered function wiring**: navigation buttons and breadcrumb links dispatch `navigateTo` function calls (logged to the console in this example).
- **Dark-mode theming**: the `createSurface` message sets theme properties that map directly to CSS custom properties.

## How to run

The page loads `agent-output.json` via `fetch`, so it must be served over HTTP:

```sh
# from this directory
npx serve .

# or from the project root
python3 -m http.server 8000 --directory examples/a2ui-dashboard
```

Then open the URL shown in your terminal.

## What to look for

1. **Header** -- title and a green "All Systems Operational" badge.
2. **Sidebar** -- four navigation buttons. Click one and check the browser console for the `navigateTo` function call.
3. **Metric cards** -- Uptime (with progress bar), Requests (with trend badge), Errors (with trend badge).
4. **Table** -- eight service rows with Name, Status, CPU, and Memory columns. Status cells are color-coded.
5. **Alert** -- a warning banner about high CPU and degraded replica.
6. **Breadcrumb** -- Home / Dashboards / Operations path in the footer.
7. **Data update button** -- click "Simulate Data Update" at the bottom. Watch the metric values, table rows, and badge text change. This demonstrates how `updateDataModel` refreshes bound components.

## How agent-output.json maps to the dashboard

| JSON message | Effect |
|---|---|
| `createSurface` | Creates the `ops-dashboard` surface, applies dark theme CSS variables |
| `updateComponents` | Registers 30+ components forming the layout tree (Grid > Rows > Columns > Cards, Table, etc.) |
| `updateDataModel` | Populates the data model with metrics, table rows, and alert text; bound components resolve their values |

The renderer walks the component tree starting from `root-grid`, resolves data bindings via path references, and emits semantic HTML elements that Oat CSS styles automatically.
