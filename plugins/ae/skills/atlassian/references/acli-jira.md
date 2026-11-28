# Jira with acli

Checked against acli 1.3.22-stable and 1.3.39-stable. Trust `acli jira --help` over this table if they differ.

| Group | Commands |
|---|---|
| `workitem` | `search`, `view`, `create`, `create-bulk`, `edit`, `clone`, `assign`, `transition`, `archive`, `unarchive`, `delete`, `comment`, `attachment`, `link`, `watcher`, `list-watchers` |
| others | `board`, `dashboard`, `field`, `filter`, `project`, `sprint`, `auth` |

Jira has `workitem search`, so start there. Do not walk anything. Add `--json` to read commands for scripting.

Read only: `workitem search`, `workitem view`, and the read commands under `board`, `project`, `sprint`, `filter` and `dashboard`. Every other `workitem` verb writes. Confirm with the user before you run one, unless they asked for that write.
