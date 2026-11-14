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

## Writing rule

Never use em dashes or en dashes in any text. Use commas, colons or parentheses. Write simple, plain English.

## Install warning

Do not install this plugin alongside `playbook@pragmatic-engineer`. Both prefix their skills with `playbook:`, so the names clash.
