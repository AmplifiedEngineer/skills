# Amplified Engineer Skills

Agent Skills for Claude Code and Codex. Install them together as the `ae` plugin, or copy one skill on its own.

- `plan`: user-facing. Requirements discovery, architecture reconstruction and design, reviews, impact and drift analysis, documentation management, and implementation handover.
- `implement`: user-facing. Scoped code changes, focused verification, architecture compliance and implementation reporting.
- `research`: finds project information and answers with sources. You can call it, and the plan and implement skills call it too. Project information retrieval and explicitly requested synchronization across configured repositories and engineering systems.
- `review`: user-facing. Reviews a pull request, a branch or a diff and reports findings that are checked against the source. Call it with `/ae:review` in Claude Code or `$review` in Codex.
- `commit`: user-facing. Commits finished work with a conventional message and pushes the branch, using plain git. Call it with `/ae:commit` in Claude Code or `$commit` in Codex.
- `pull-request`: user-facing. Opens a draft pull request with a conventional-commit title and a short body, using plain git and gh. Call it with `/ae:pull-request` in Claude Code or `$pull-request` in Codex.
- `fix`: user-facing. Fixes one small, well-understood bug: a failing test first, the smallest change, then the checks. Call it with `/ae:fix` in Claude Code or `$fix` in Codex.
- `writing-style`: loaded by other skills and by the agent, not called by users. The plain, simple-English rules for PR text, commit messages, review comments, tickets, docs and chat replies.
- `engineering-standards`: loaded by other skills and by the agent, not called by users. Guard rails for code design, commits, PRs, testing and deployment. For language rules, it defers to the project's own conventions and linters.

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
