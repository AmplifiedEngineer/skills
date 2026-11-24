---
name: implement
description: Execute an approved plan or spec in a repository, including focused verification, architecture compliance and implementation handover. Use when an approved document is ready to implement.
---

# Implement

Implement agreed engineering work in the relevant repository. Keep changes within scope, follow established conventions and report what changed and how it was verified.

## Principles
1. Inspect repository guidance and relevant code before editing.
2. Use approved requirements and architecture decisions. Fill small gaps yourself; stop only when blocked.
3. Make the smallest coherent change that meets acceptance criteria.
4. Preserve conventions and avoid unrelated cleanup.
5. Protect data, secrets and security boundaries.
6. Verify changed behaviour with appropriate available checks; report exactly what ran.
7. Update tests and documentation when required.
8. Keep changes traceable to requirements, decisions and affected components.

## Input
The input is the path of a document whose `Status:` is `approved`. A document with no `Status:` line is not approved. Do not start from it.

The plan decides what to build and how. You execute it and fill the gaps.

Fill a gap yourself when the plan leaves a code-level choice open: names, helper structure, local control flow, test cases, error messages, or where a small piece of code lives. Follow the repository conventions and the plan's intent. List each such choice under "Gaps filled" in the report. Each one is a plan defect, so write the question the plan should have asked. Frequent entries mean the plan skill is not asking enough.

You are blocked only when one of these holds:
- The plan contradicts the code or itself.
- A step cannot be done as written.
- Filling the gap would change a public interface, a data shape, a security boundary or user-visible behaviour that the plan does not specify.
- Information or access is missing after you called the research skill.

When blocked, stop and return the question to the plan skill. Say what you tried and give the options with your recommendation. A block is also a plan defect: name the question the plan should have asked. Keep working on increments the block does not affect. Do not ask about anything else.

Call the research skill when information is missing.

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
- references/document-storage.md
- templates/execution-plan.md (save the filled plan in `.ae/`)
- templates/implementation-report.md

## Writing and code standards

Before you write prose a person will read (documents, PR text, commit messages, comments, chat replies), load the writing-style skill: `ae:writing-style` in Claude Code when installed as a plugin, `writing-style` when copied in by hand, `$writing-style` in Codex. For code, follow the engineering-standards skill: `ae:engineering-standards` in Claude Code when installed as a plugin, `engineering-standards` when copied in by hand, `$engineering-standards` in Codex.

## Calling the research skill

Use the research skill: `ae:research` in Claude Code when installed as a plugin, `research` when copied in by hand, `$research` in Codex.

If no research skill is available, do the retrieval yourself under the same rules: list the available tools first, cite sources with links and dates, and separate facts from inference. Say in your output that the research skill was not available.

## Boundaries
The plan skill owns architectural reasoning and every design decision, down to how the change is built. The research skill owns information retrieval and synchronization across external systems. The implement skill owns code changes within the agreed scope.

Do not claim a check passed unless it was run and its result observed.
