/**
 * callMcpTool -- Executes a tool on a connected Model Context Protocol (MCP) server.
 *
 * @param {object} args
 * @param {string} args.name         - The name of the MCP tool to execute.
 * @param {object} [args.arguments]  - Arguments to pass to the MCP tool.
 * @param {object} context
 * @param {object|function(): object} [context.mcpClient] - An MCP Client instance
 *   (exposing `callTool({name, arguments})`), or a getter function returning one.
 * @returns {Promise<*>} The MCP tool's result.
 */
export async function callMcpTool(args, context) {
  const client = typeof context.mcpClient === 'function' ? context.mcpClient() : context.mcpClient;
  if (!client) {
    throw new Error('callMcpTool: no MCP client is available on the renderer context.');
  }
  return client.callTool({ name: args.name, arguments: args.arguments ?? {} });
}
