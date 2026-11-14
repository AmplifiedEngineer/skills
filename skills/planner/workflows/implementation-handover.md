# Implementation Handover

## Purpose
Translate architectural decisions into actionable implementation instructions.

## Required references
- `../references/document-storage.md`
- `../references/knowledge-model.md`
- `../references/evidence.md`

## Procedure
1. Confirm scope and acceptance criteria.
2. Summarise relevant architecture and decisions.
3. Identify affected components and interfaces.
4. Define implementation increments.
5. Identify dependencies and sequencing.
6. Define expected behaviour and edge cases.
7. Specify security and quality requirements.
8. Define testing and validation requirements.
9. Identify documentation changes.
10. Identify unresolved decisions and risks.

## Output
A traceable implementation plan, saved in the plans folder of the document root (default `docs/playbook/plans/<slug>.md`) with `Status: draft` as the storage contract says. Ask the user to approve it. Set `Status: approved` only on their confirmation, and hand the plan to the implementer only after that. The plan contains:
- Objective and scope
- Requirements
- Design decisions
- Components and files to investigate
- Implementation steps
- Interface and data changes
- Tests and acceptance criteria
- Risks and dependencies
- Documentation updates

Do not silently make unresolved architectural decisions.
