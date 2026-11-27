# Atlassian MCP server

Atlassian offers the Rovo MCP server. Hosts expose its tools under names like `mcp__atlassian__*` or under the name the user gave the server. Tool names vary by server version, so look them up instead of assuming.

## Find the tools

List the tools your host has and look for names with Atlassian, Jira or Confluence in them. Use your host's tool search if it has one. If nothing matches, the server is not connected. Go to acli, then twg.

## Notes

- Auth is OAuth handled by the host. Do not ask for tokens.
- The server covers Jira, Confluence and search. It is the only route that works with no local binary.
- Judge read tools and write tools from the tool name and description. Create, edit, transition, comment and delete tools write. Confirm with the user before you call one, unless they asked for that write.
