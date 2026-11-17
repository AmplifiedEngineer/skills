# Amplified Engineer Skills

Three Agent Skills for Claude Code and Codex. Install them together as the `ae` plugin, or copy one skill on its own.

- `planner`: user-facing. Requirements discovery, architecture reconstruction and design, reviews, impact and drift analysis, documentation management, and implementation handover.
- `implementer`: user-facing. Scoped code changes, focused verification, architecture compliance and implementation reporting.
- `researcher`: finds project information and answers with sources. You can call it, and the planner and implementer call it too. Project information retrieval and explicitly requested synchronization across configured repositories and engineering systems.

## Install

Claude Code:

```sh
claude plugin marketplace add amplifiedengineer/skills
claude plugin install ae@amplifiedengineer
```

Codex:

```sh
codex plugin marketplace add amplifiedengineer/skills
codex plugin add ae@amplifiedengineer
```

## Manual install

Copy `skills/<name>/` into one of these locations:

- Claude Code, project-level: `.claude/skills/<name>/`
- Codex, project-level: `.agents/skills/<name>/`
- Codex, user-level: `~/.agents/skills/<name>/`

The shared `SKILL.md` and supporting files work in both hosts. The `agents/openai.yaml` file is optional Codex UI metadata. Discover integrations actually available in the environment; example provider names do not configure access.

## Releases

Release notes are on the [releases page](https://github.com/AmplifiedEngineer/skills/releases). The full history is in the [changelog](https://github.com/AmplifiedEngineer/skills/blob/main/CHANGELOG.md).

## Licence

Apache-2.0. See the `LICENSE` file.
