# Implementation Execution

1. Read applicable repository instructions and identify the working tree state.
2. Read the approved document, its requirements, decisions and acceptance criteria.
   Take the path from the user and run only documents whose Status is approved.
   If the Status is not approved or the line is missing, stop and ask.
   Storage rules are in [document-storage](../references/document-storage.md).
3. Inspect relevant implementation, tests and neighbouring conventions.
4. Map requirements to components and identify unresolved design choices.
5. If a design decision is needed and the document does not give it, stop and return the question to the plan skill.
   Do not decide it yourself.
6. Plan small increments that preserve a coherent, reviewable diff.
7. Implement while preserving compatibility and consistent failure handling.
8. Review the diff for scope, security, correctness, omissions and accidental changes.
9. Apply the verification workflow and report remaining risks.
10. When the acceptance criteria pass, set the document Status to `done`.
    Make this change in the same commit or PR that completes the work.

Do not overwrite unrelated user work, expand into speculative refactoring or make assumptions that silently change interfaces, data or user-visible behaviour.
