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

Run these from the repository root. They need Node 26; the tests also need `git`, and the smoke script needs the `claude` and `codex` CLIs.

- `node scripts/check.mjs [repo-root]`: static checks on manifests, links, old names, skills, the researcher brief, README, the storage contract, template Status lines and the implementer stop rules. Silent and exit 0 when clean, otherwise one `FAIL` line per problem and exit 1.
- `node --test "test/**/*.test.mjs"`: plants one fault at a time in a copy of the working tree and checks that the scripts report it.
- `node scripts/smoke-install.mjs [claude] [codex] [--keep]`: installs the plugin from this repository into a throwaway config folder per host and checks the three skills arrived. `--keep` leaves the folders and prints their paths.

## Releases

Every PR merged to main is released, docs and ci changes included. So every PR sets the next version in both `plugin.json` and `.claude-plugin/plugin.json`. Get it with `node scripts/version.mjs next "<PR title>"`. The check job verifies it.

- Before 1.0.0: a `feat` or `!` title bumps the minor, anything else the patch.
- From 1.0.0: `!` bumps the major, `feat` the minor, anything else the patch.

Open PRs conflict on the two manifests. After another PR merges, update your branch and set the version CI prints again. Do not edit a PR title after CI passes without waiting for the re-run. If a release run on main goes red, re-run it before any other PR merges. Only if the re-run reports the tag at another commit, open a PR that sets the next version.
