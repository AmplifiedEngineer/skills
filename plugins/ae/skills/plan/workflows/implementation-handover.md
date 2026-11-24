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
A traceable implementation plan, saved in the plans folder of the document root (default `docs/ae/plans/<slug>.md`) with `Status: draft` as the storage contract says. Ask the user to approve it. Set `Status: approved` only on their confirmation, and hand the plan to the implement skill only after that. The plan contains:
- Objective and scope
- Requirements
- Design decisions
- Components and files to investigate
- Implementation steps
- Interface and data changes
- Tests and acceptance criteria
- Risks and dependencies
- Documentation updates

Design the how, not only the what. The implement skill executes the plan and fills only small code-level gaps. For each increment name the files, the interfaces and data shapes, the order of steps, the edge cases and the tests.

Ask the right questions early. Before you write the increments, list every decision that evidence cannot settle. Walk these areas: interfaces, data shapes and migration, error and failure behaviour, security and privacy, performance limits, compatibility, rollout and rollback, and tests. Ask the user one question at a time, with your recommended answer. Skip a question the repository or the research skill already answers.

For security, settle these in every plan that adds an entry point, a link, a token or a credential:
- Who can reach the new behaviour and how the code checks it. If the repository has no sign-in or roles, that is still a decision: ask whether anyone may use it or whether access needs a new check.
- Where each secret, token or credential is created, stored, rotated and expired.
- Whether it may appear in logs, error messages, URLs or test output.

A good plan has no open decisions and no gap that could block the implement skill. Before you ask for approval, read each increment as the implement skill would and ask: can I do this with no question? Check these:
- Every file, interface and data shape the step touches is named, and you confirmed it exists or is to be created.
- The order of steps and the dependencies between them are explicit.
- Every edge case, error path and failure mode has a stated behaviour.
- Each interface, data and security change is specified, not implied.
- Each step has a test or check that proves it.
- Every fact the plan relies on is verified in the repository or by the research skill.

Close each gap with evidence or the user's answer, and write the result into the plan. Do not ask for approval while a gap remains. If one cannot be closed, say so, keep `Status: draft` and name what is missing.
