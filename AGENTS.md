# Agent instructions

This repository is a plugin that ships six Agent Skills for Claude Code and Codex.

## Layout

Only the `plugins/ae/` folder ships to people who install the plugin. Checks, tests, evals and workflows stay at the repository root and are never installed.

- `plugins/ae/`: the plugin, name `ae`. This is the whole install.
- `plugins/ae/plugin.json`: the Codex plugin manifest.
- `plugins/ae/.claude-plugin/plugin.json`: the Claude Code plugin manifest, same name and version.
- `plugins/ae/skills/`: one directory per skill, each with a `SKILL.md`.
- `plugins/ae/LICENSE`: a copy of the root `LICENSE`, so the installed plugin carries its licence. The check fails if the two differ.
- `.claude-plugin/marketplace.json`: the Claude Code marketplace, name `amplifiedengineer`. Its plugin source is `./plugins/ae`.
- `.agents/plugins/marketplace.json`: the Codex marketplace, same name and the same source.
- `.github/`: workflows, checks, tests and evals.
- `README.md`, `LICENSE`, `AGENTS.md`, `CLAUDE.md`: repository files, not shipped.

Do not put development files inside `plugins/ae/`. The smoke test fails if an installed plugin holds a `.github` or `evals` folder.

## Skills

- `plugins/ae/skills/plan`: user-facing. Discovery, design, reviews and handover.
- `plugins/ae/skills/implement`: user-facing. Scoped code changes and verification.
- `plugins/ae/skills/research`: user-facing. Finds project information and answers with sources. The plan and implement skills also call it.
- `plugins/ae/skills/review`: user-facing. Reviews a pull request, a branch or a diff and reports checked findings.
- `plugins/ae/skills/writing-style`: loaded by other skills and by the agent, not called by users. The plain, simple-English rules for any prose a person will read. The plan, implement, research and review skills load it.
- `plugins/ae/skills/engineering-standards`: loaded by other skills and by the agent, not called by users. Guard rails for code design, commits, PRs, testing and deployment. The implement and review skills follow it.

The document storage contract is [plugins/ae/skills/plan/references/document-storage.md](plugins/ae/skills/plan/references/document-storage.md).

## Writing rule

Never use em dashes or en dashes in any text. Use commas, colons or parentheses. Write simple, plain English.

## Checks

Run these from the repository root. They need Node 26; the tests also need `git`, and the smoke script needs the `claude` and `codex` CLIs.

- `node .github/scripts/check.mjs [repo-root]`: static checks on manifests, marketplace sources, the plugin licence copy, links, old names, skills, the research brief, README, the storage contract, template Status lines and the implement stop rules. Silent and exit 0 when clean, otherwise one `FAIL` line per problem and exit 1.
- `node --test ".github/tests/**/*.test.mjs"`: plants one fault at a time in a copy of the working tree and checks that the scripts report it.
- `node .github/scripts/smoke-install.mjs [claude] [codex] [--keep]`: installs the plugin from this repository into a throwaway config folder per host, checks the six skills arrived and checks no `.github` or `evals` folder came with them. `--keep` leaves the folders and prints their paths.

## Evals

Evals live in `.github/evals/`. Run one with `node .github/evals/run.mjs <skill> [--case <id>] [--runs <n>] [--model <name>] [--configs with_skill,baseline]`. It runs each case with and without the skill through the `claude` CLI, grades each report against the findings the case expects, and prints a table. Results go to `.ae/evals/`, which is gitignored.

Every run calls a model and costs money, so evals run by hand and not in CI.

A case is a JSON file under `.github/evals/<skill>/cases/` with `id`, `repo`, `ref`, `commit`, `prompt` and `expected` findings. Each expected finding has an `id`, a `severity` (`blocking` or `minor`) and a `text`.

The `plan` and `implement` evals work on a small fixture project in `.github/evals/fixtures/`. A case names the `fixture`, may seed `files` (for example an approved plan), gives the `prompt`, and lists `expected` situations. Each situation has an `id`, a `text` and a `want` list of acceptable handlings: `asked`, `decided_with_evidence`, `assumed`, `missing`, `filled_and_reported`, `filled_not_reported`, `not_done` or `proceeded`. A grader model picks one handling per situation. `checks` are shell commands run in the fixture copy after the run, such as `node --test`. The plan cases measure whether the plan skill asks about decisions the repository cannot settle. The implement cases measure whether it fills small gaps and reports them, and stops on a real block.

## Releases

A shared action from [AmplifiedEngineer/workflows](https://github.com/AmplifiedEngineer/workflows#version-rules) releases a PR merged to main only when it changes a file under `plugins/ae/skills/`. Such a PR sets the next version in both `plugins/ae/plugin.json` and `plugins/ae/.claude-plugin/plugin.json`, and the PR title decides which version that is. A PR that touches nothing under `plugins/ae/skills/` (ci, docs, manifests, tooling) needs no version change and releases nothing.

The rule before 1.0.0: a `feat` or `!` title bumps the minor, anything else the patch. From 1.0.0: `!` bumps the major, `feat` the minor, anything else the patch. The first release (no tag yet) is the version both manifests hold. The workflows README has the full rules.

The `release / verify` check fails when a manifest holds the wrong version. Its message names the file and the version, like `<file> has X, set it to Y`. To fix it:

1. Push the PR and read the failing line.
2. Set that version in both manifests.
3. Push again.

Open PRs conflict on the two manifests. After another PR merges, update your branch and set the version again. Do not edit a PR title after the check passes without waiting for the re-run. If a release run on main goes red, re-run it. The `release` mode repairs a missing release itself.
