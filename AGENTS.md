# Agent instructions

This repository is a plugin that ships three Agent Skills for Claude Code and Codex.

## Layout

- `plugin.json`: the Codex plugin manifest, name `ae`.
- `.claude-plugin/plugin.json`: the Claude Code plugin manifest, same name and version.
- `.claude-plugin/marketplace.json`: the Claude Code marketplace, name `amplifiedengineer`.
- `.agents/plugins/marketplace.json`: the Codex marketplace, same name.
- `skills/`: one directory per skill, each with a `SKILL.md`.

## Skills

- `skills/planner`: user-facing. Discovery, design, reviews and handover.
- `skills/implementer`: user-facing. Scoped code changes and verification.
- `skills/researcher`: user-facing. Finds project information and answers with sources. The planner and implementer also call it.

The document storage contract is [skills/planner/references/document-storage.md](skills/planner/references/document-storage.md).

## Writing rule

Never use em dashes or en dashes in any text. Use commas, colons or parentheses. Write simple, plain English.

## Checks

Run these from the repository root. They need Node 24 and a prior `npm ci`; `npm test` also needs `git`, and `npm run smoke` needs the `claude` and `codex` CLIs.

- `npm run check [-- repo-root]`: static checks on manifests, links, old names, skills, the researcher brief, README, the storage contract, template Status lines and the implementer stop rules. Silent and exit 0 when clean, otherwise one `FAIL` line per problem and exit 1.
- `npm test`: plants one fault at a time in a copy of the working tree and checks that the scripts report it.
- `npm run smoke -- [claude] [codex] [--keep]`: installs the plugin from this repository into a throwaway config folder per host and checks the three skills arrived. `--keep` leaves the folders and prints their paths.
- `npm run typecheck`: type checks the scripts and tests.

## Releases

Releases come from release-please. Merging the release PR tags the version, writes `CHANGELOG.md` and bumps `package.json` and both `plugin.json` files.
