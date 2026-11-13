# Document storage

This file says where documents go, what status line they carry and which ones the implementer may execute. Every skill that saves or reads a plan, spec, PRD, ADR, report or discovery state follows it.

## Location

- The default document root is `docs/playbook/`. It has one subfolder per type, as listed in the table below: `plans/`, `specs/`, `prd/`, `adr/`, `reports/` and `discovery/`.
- The user may name another root. When the request leaves the root unclear, ask.
- Temporary working files go in `.playbook/` at the repo root. Delete them when the work ends.
- The implementer's own outputs are working files. Its filled execution plan lives in `.playbook/`. Its implementation report goes in its final output and the PR body. It is never saved under `docs/playbook/` unless the user asks.

## Status line

Every document has exactly one status line.

- It is the first non-blank line after the H1 title.
- The form is `Status: <value>`, on one line, with no bullet and no bold.
- A new document starts with the first value in its row below, whether or not a template exists for its type. The first values are `draft`, `Proposed` and `Draft`.

Values and owners by type:

| Type | Folder | Status values | Who sets them | Implementer may execute it |
|---|---|---|---|---|
| Plan | `plans/` | `draft`, `approved`, `done` | The planner writes `draft`. The planner sets `approved` only on the user's confirmation. The implementer sets `done`. | Yes, when `approved` |
| Spec | `specs/` | `draft`, `approved`, `done` | Same as plan | Yes, when `approved` |
| PRD | `prd/` | `draft`, `approved` | The planner. `approved` only on the user's confirmation. | No, context only |
| ADR | `adr/` | `Proposed`, `Accepted`, `Rejected`, `Superseded` | The planner. `Accepted` only on the user's confirmation. | No, context only |
| Assessment, findings, drift and impact reports | `reports/` | `draft`, `done` | The planner writes `draft`. The planner sets `done` when the user accepts the report. | No, context only |
| Discovery state | `discovery/` | `Draft`, `In review`, `Accepted`, `Superseded` | The planner | No, context only |

An ADR's blueprint is executed only after the planner turns it into a plan.

## Implementer rule

The implementer executes only plans and specs marked `approved`. It sets `done` when the work is finished, in the same change (commit or PR) that completes the work. It reads every other type as context only, for example an `Accepted` ADR.

A document with no `Status:` line counts as not approved. The implementer stops and asks.

## Convention

This follows the obra/superpowers convention: `docs/superpowers/<type>/` for documents and `.superpowers/` for temporary state. It was verified by GitHub code search on 2026-11-12.
