/**
 * mock-mcp-server.js -- Zero-dependency stand-in for an MCP tool server.
 *
 * IMPORTANT SIMPLIFICATION: this is NOT a real Model Context Protocol server.
 * A real MCP integration would run a separate process speaking the MCP
 * transport (stdio or Streamable HTTP), advertise a `getQuote` tool via
 * `tools/list`, and be reached through `@modelcontextprotocol/sdk`'s
 * `Client#callTool()`. Pulling that SDK into a static-HTML example would add
 * a dependency this project otherwise has none of, so this file instead
 * exposes just enough shape -- an in-memory `getQuote()` async function and
 * a `callTool({ name, arguments })` wrapper matching the shape
 * `renderer/functions/callMcpTool.js` expects on `context.mcpClient` -- to
 * make the "tool call returns fresh data, template is unchanged" pattern
 * legible without claiming to be a protocol-conformant integration.
 *
 * See the README in this directory for how this fits into the bigger
 * static-template + data-diff pattern.
 */

// A little state so consecutive quotes look like a real ticker (they walk
// from the previous price rather than jumping to a totally random one).
let lastPrice = 142.50;

/**
 * Simulates fetching a fresh stock quote from an MCP tool.
 * Returns a plain object -- exactly what a real MCP `callTool()` result's
 * content would be parsed into.
 *
 * @returns {Promise<{price: string, lastUpdated: string, status: string}>}
 */
export async function getQuote() {
  // Simulate real network/tool latency so the "Refreshing..." state is visible.
  await new Promise((resolve) => setTimeout(resolve, 400));

  const delta = (Math.random() - 0.5) * 4; // +/- $2.00 walk
  lastPrice = Math.max(1, lastPrice + delta);

  return {
    price: `$${lastPrice.toFixed(2)}`,
    lastUpdated: new Date().toLocaleTimeString(),
    status: delta >= 0 ? "Up" : "Down",
  };
}

/**
 * Minimal mock MCP client. Real MCP clients expose `callTool({ name,
 * arguments })`; this mirrors just that one method so the example can call
 * the real `callMcpTool` registered function (renderer/functions/callMcpTool.js)
 * instead of bypassing it, without depending on the MCP SDK.
 */
export const mockMcpClient = {
  async callTool({ name, arguments: args } = {}) {
    if (name === "getQuote") {
      return getQuote();
    }
    throw new Error(`mock-mcp-server: unknown tool "${name}"`);
  },
};
