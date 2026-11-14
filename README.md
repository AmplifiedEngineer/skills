# Amplified Engineer Skills

Three Agent Skills for Claude Code and Codex. Install them together as the `playbook` plugin, or copy one skill on its own.

- `planner`: user-facing. Requirements discovery, architecture reconstruction and design, reviews, impact and drift analysis, documentation management, and implementation handover.
- `implementer`: user-facing. Scoped code changes, focused verification, architecture compliance and implementation reporting.
- `researcher`: called by the planner and implementer. Project information retrieval and explicitly requested synchronization across configured repositories and engineering systems.

## Install

Claude Code:

```sh
claude plugin marketplace add amplifiedengineer/skills
claude plugin install playbook@amplifiedengineer-skills
```

Codex:

```sh
codex plugin marketplace add amplifiedengineer/skills
codex plugin add playbook@amplifiedengineer-skills
```

Do not install this plugin alongside `playbook@pragmatic-engineer`. Both prefix their skills with `playbook:`, so the names clash.

## Manual install

Copy `skills/<name>/` into one of these locations:

- Claude Code, project-level: `.claude/skills/<name>/`
- Codex, project-level: `.agents/skills/<name>/`
- Codex, user-level: `~/.agents/skills/<name>/`

The shared `SKILL.md` and supporting files work in both hosts. The `agents/openai.yaml` file is optional Codex UI metadata. Discover integrations actually available in the environment; example provider names do not configure access.

## Licence

Apache-2.0. See the `LICENSE` file.
