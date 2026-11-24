# Agent instructions

This repository is a plugin that ships four Agent Skills for Claude Code and Codex.

## Layout

- `plugin.json`: the Codex plugin manifest, name `ae`.
- `.claude-plugin/plugin.json`: the Claude Code plugin manifest, same name and version.
- `.claude-plugin/marketplace.json`: the Claude Code marketplace, name `amplifiedengineer`.
- `.agents/plugins/marketplace.json`: the Codex marketplace, same name.
- `skills/`: one directory per skill, each with a `SKILL.md`.
- `.github/`: workflows, checks and their tests.

## Skills

- `skills/plan`: user-facing. Discovery, design, reviews and handover.
- `skills/implement`: user-facing. Scoped code changes and verification.
- `skills/research`: user-facing. Finds project information and answers with sources. The plan and implement skills also call it.
- `skills/review`: user-facing. Reviews a pull request, a branch or a diff and reports checked findings.

The document storage contract is [skills/plan/references/document-storage.md](skills/plan/references/document-storage.md).

## Writing rule

Never use em dashes or en dashes in any text. Use commas, colons or parentheses. Write simple, plain English.

## Checks

Run these from the repository root. They need Node 26; the tests also need `git`, and the smoke script needs the `claude` and `codex` CLIs.

- `node .github/scripts/check.mjs [repo-root]`: static checks on manifests, links, old names, skills, the research brief, README, the storage contract, template Status lines and the implement stop rules. Silent and exit 0 when clean, otherwise one `FAIL` line per problem and exit 1.
- `node --test ".github/tests/**/*.test.mjs"`: plants one fault at a time in a copy of the working tree and checks that the scripts report it.
- `node .github/scripts/smoke-install.mjs [claude] [codex] [--keep]`: installs the plugin from this repository into a throwaway config folder per host and checks the four skills arrived. `--keep` leaves the folders and prints their paths.

## Evals

Evals live in `.github/evals/`. Run one with `node .github/evals/run.mjs <skill> [--case <id>] [--runs <n>] [--model <name>] [--configs with_skill,baseline]`. It runs each case with and without the skill through the `claude` CLI, grades each report against the findings the case expects, and prints a table. Results go to `.ae/evals/`, which is gitignored.

Every run calls a model and costs money, so evals run by hand and not in CI.

A case is a JSON file under `.github/evals/<skill>/cases/` with `id`, `repo`, `ref`, `commit`, `prompt` and `expected` findings. Each expected finding has an `id`, a `severity` (`blocking` or `minor`) and a `text`.

## Releases

A shared action from [AmplifiedEngineer/workflows](https://github.com/AmplifiedEngineer/workflows#version-rules) releases a PR merged to main only when it changes a file under `skills/`. Such a PR sets the next version in both `plugin.json` and `.claude-plugin/plugin.json`, and the PR title decides which version that is. A PR that touches nothing under `skills/` (ci, docs, manifests, tooling) needs no version change and releases nothing.

The rule before 1.0.0: a `feat` or `!` title bumps the minor, anything else the patch. From 1.0.0: `!` bumps the major, `feat` the minor, anything else the patch. The first release (no tag yet) is the version both manifests hold. The workflows README has the full rules.

The `release / verify` check fails when a manifest holds the wrong version. Its message names the file and the version, like `<file> has X, set it to Y`. To fix it:

1. Push the PR and read the failing line.
2. Set that version in both manifests.
3. Push again.

Open PRs conflict on the two manifests. After another PR merges, update your branch and set the version again. Do not edit a PR title after the check passes without waiting for the re-run. If a release run on main goes red, re-run it. The `release` mode repairs a missing release itself.
