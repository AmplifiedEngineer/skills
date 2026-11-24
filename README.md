# Amplified Engineer Skills

Four Agent Skills for Claude Code and Codex. Install them together as the `ae` plugin, or copy one skill on its own.

- `plan`: user-facing. Requirements discovery, architecture reconstruction and design, reviews, impact and drift analysis, documentation management, and implementation handover.
- `implement`: user-facing. Scoped code changes, focused verification, architecture compliance and implementation reporting.
- `research`: finds project information and answers with sources. You can call it, and the plan and implement skills call it too. Project information retrieval and explicitly requested synchronization across configured repositories and engineering systems.
- `review`: user-facing. Reviews a pull request, a branch or a diff and reports findings that are checked against the source. Call it with `/ae:review` in Claude Code or `$review` in Codex.

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

Copy `plugins/ae/skills/<name>/` into one of these locations:

- Claude Code, project-level: `.claude/skills/<name>/`
- Codex, project-level: `.agents/skills/<name>/`
- Codex, user-level: `~/.agents/skills/<name>/`

The shared `SKILL.md` and supporting files work in both hosts. The `agents/openai.yaml` file is optional Codex UI metadata. Discover integrations actually available in the environment; example provider names do not configure access.

## Releases

Each merge to main is a release. Release notes are on the [releases page](https://github.com/AmplifiedEngineer/skills/releases).

## Licence

Apache-2.0. See the `LICENSE` file.
