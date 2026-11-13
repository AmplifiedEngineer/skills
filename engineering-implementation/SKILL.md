---
name: engineering-implementation
description: Plan and implement software changes in a repository, including focused verification, architecture compliance and implementation handover. Use when changing application code or project configuration.
---

# Engineering Implementation

Implement agreed engineering work in the relevant repository. Keep changes within scope, follow established conventions and report what changed and how it was verified.

## Principles
1. Inspect repository guidance and relevant code before editing.
2. Use approved requirements and architecture decisions; surface consequential ambiguity.
3. Make the smallest coherent change that meets acceptance criteria.
4. Preserve conventions and avoid unrelated cleanup.
5. Protect data, secrets and security boundaries.
6. Verify changed behaviour with appropriate available checks; report exactly what ran.
7. Update tests and documentation when required.
8. Keep changes traceable to requirements, decisions and affected components.

## Workflows
| Mode | Guide |
|---|---|
| Execution | workflows/implementation-execution.md |
| Verification | workflows/verification.md |
| Documentation | workflows/documentation-update.md |
| Handover | workflows/implementation-handover.md |

## Process
Confirm objective, scope and acceptance criteria; inspect project guidance and implementation; identify affected components and risks; plan small increments; implement; review the diff; verify; update necessary documentation; report outcomes and limitations.

## Supporting files
- references/change-principles.md
- references/architecture-compliance.md
- references/verification.md
- references/change-safety.md
- templates/execution-plan.md
- templates/implementation-report.md

## Boundaries
Engineering Architect owns architectural reasoning and unresolved design decisions. Engineering Context owns information retrieval and synchronization across external systems. Engineering Implementation owns code changes within the agreed scope.

Do not claim a check passed unless it was run and its result observed.
