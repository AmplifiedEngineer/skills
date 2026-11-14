# Agent instructions

This repository is a plugin that ships three Agent Skills for Claude Code and Codex.

## Layout

- `plugin.json`: the Codex plugin manifest, name `playbook`.
- `.claude-plugin/plugin.json`: the Claude Code plugin manifest, same name and version.
- `.claude-plugin/marketplace.json`: the Claude Code marketplace, name `amplifiedengineer-skills`.
- `.agents/plugins/marketplace.json`: the Codex marketplace, same name.
- `skills/`: one directory per skill, each with a `SKILL.md`.

## Skills

- `skills/planner`: user-facing. Discovery, design, reviews and handover.
- `skills/implementer`: user-facing. Scoped code changes and verification.
- `skills/researcher`: not called by users. The planner and implementer call it to fetch project information.

The document storage contract is [skills/planner/references/document-storage.md](skills/planner/references/document-storage.md).

## Writing rule

Never use em dashes or en dashes in any text. Use commas, colons or parentheses. Write simple, plain English.

## Checks

Run these from the repository root. All need `jq`; only `test-check.sh` also needs `git`, and `smoke-install.sh` needs the `claude` and `codex` CLIs.

- `sh scripts/check.sh [repo-root]`: static checks on manifests, links, old names, skills, README, the storage contract, template Status lines and the implementer stop rules. Silent and exit 0 when clean, otherwise one `FAIL` line per problem and exit 1.
- `sh scripts/test-check.sh`: plants one fault at a time in a copy of the working tree and checks that the scripts report it.
- `sh scripts/smoke-install.sh [claude] [codex] [--keep]`: installs the plugin from this repository into a throwaway config folder per host and checks the three skills arrived. `--keep` leaves the folders and prints their paths.

## Install warning

Do not install this plugin alongside `playbook@pragmatic-engineer`. Both prefix their skills with `playbook:`, so the names clash.
