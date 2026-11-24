# Context Synchronization

Plan or perform an explicitly requested update between engineering systems.

1. Confirm the source, destination, records and intended outcome.
2. Discover the available connector and supported operations.
3. Identify the source of truth for each field and preserve identifiers.
4. Compare current destination state with the requested state.
5. Prepare the smallest change set, including links and field mappings.
6. Check for duplicates, stale values, conflicts and scope expansion.
7. Before writing, confirm the user explicitly requested the update and target is unambiguous.
8. Apply only authorized changes using the configured integration.
9. Read back changed records when supported and report actual outcomes.

Use ../templates/synchronization-plan.md for a reviewable plan. Separate proposed changes from completed changes. Never claim success without confirming the result.
