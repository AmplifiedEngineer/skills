# Hints file

`context.yaml` at the document root (default `docs/ae/context.yaml`) is an optional file that tells the researcher where to look first. A person writes it by hand. The skill never writes or changes it unless the user asks.

## Fields
- `project`: name, repository and default branch.
- `sources`: maps a request type, such as `requirements`, `architecture` or `implementation`, to a list of sources.
- `integrations`: hints about the tools the project uses, such as the issue tracker or documentation system.

## Ranking
In `sources.<request type>`, list order is the ranking. Earlier entries are preferred. Try them first, then move down the list.

## Rules
- The file holds no secrets. Never put tokens, passwords or keys in it.
- It is never proof of access. Check the tools and MCP servers available in the run before using any source.
- If the file is missing, discover sources from the available tools.

See `../examples/project-context.example.yaml` for the format.
