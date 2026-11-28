# acli top-level surface

Checked with `acli --help` and the group helps on 1.3.39-stable.

| Command | What it is | Use |
|---|---|---|
| `jira` | Jira Cloud commands, see acli-jira.md | Use |
| `confluence` | Confluence Cloud commands (`auth`, `blog`, `page`, `space`), see acli-confluence.md | Use |
| `auth` | OAuth to multiple Atlassian accounts: `login`, `logout`, `status`, `switch` | Use |
| `admin` | Organization admin: `auth`, and `user` with `activate`, `cancel-delete`, `deactivate`, `delete` (all write) | Only when the user asks. It manages users |
| `guard` | Atlassian Guard CLI. It may answer `Plugin guard not found` | Only when the user asks and the plugin exists |
| `rovodev` | Rovo Dev, Atlassian's AI coding agent (Beta). Needs its own scoped API token and `acli rovodev auth login` | Skip |
| `config` | Configuration. Only `gov-cloud` was seen | Skip |
| `feedback` | Sends a request or problem report to Atlassian | Skip |
| `help` | Help about any command | Use freely |

## Authentication

- `acli auth login` signs in to Jira and Confluence sites with OAuth and supports several accounts. `acli auth status` shows OAuth status and `acli auth switch` changes the active account. `acli auth logout` logs out of all OAuth accounts.
- Each product also has its own `acli jira auth` and `acli confluence auth`, with `login` (OAuth or API token), `logout`, `status` and `switch`. Jira and Confluence authenticate separately, so a passing Jira status says nothing about Confluence.
- `acli admin auth` is a third, separate login for organization admin tasks.
