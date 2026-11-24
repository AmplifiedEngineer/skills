# Lenses

A lens is one concern, reviewed alone. One reviewer with one lens finds more in that area than one reviewer who holds every concern at once. Each lens reports only what it owns. Duplicates across lenses are removed in the sweep.

The lists below name what is easy to miss. They are not a full checklist. Report a real problem in your lens even when no line here names it.

## Core lenses

Run these on every review that uses lenses.

### logic

- Behaviour that does not match the stated intent in the PR description, the ticket or the comments.
- Missing guards for null, empty or out-of-range input. Boundary and off-by-one errors.
- A silent fallback or default value that hides a wrong result.
- Race conditions, and a conversion that changes meaning.

### tests

- A behaviour change with no test change.
- An existing test that now reaches a real outside program, network or model because the change added that call and the test does not stub it.
- Error paths with no test. Assertions that pass when the code is wrong.
- Mocks that replace the thing under test. Tests that depend on timing or order.

### security

- A missing or weak authentication or authorisation check, including access to another user's or tenant's records.
- Untrusted input that reaches SQL, a shell, a template or a redirect.
- Secrets or personal data in source or in logs.
- Weak cryptography, and CORS, CSP or IAM rules that allow too much.

### data

- A query with no limit or no tenant filter. One query per row in a loop. A missing index for a new query.
- Wrong transaction boundaries: a partial write that survives a failure.

### types

- Outside data (request bodies, config, third-party responses, database rows) cast to a type and not parsed at run time. A cast checks nothing when the program runs.
- Escape hatches of the language in use: `any`, forced non-null, unchecked casts, `unwrap` on input.

### perf

- Unbounded result sets, large copies or allocations on a hot path, blocking I/O on an async thread.
- Polling with no backoff. Repeated serialisation. A cache, index or helper that already solves the problem and is not used.

### reliability

- No error handling on I/O or a network call, after you checked the layers above it.
- A catch that drops the error. Retries with no limit, no backoff or no idempotency.
- Connections, file handles or timers that are never released.
- A failure that would be hard to diagnose in production because nothing is logged.

## Conditional lenses

Add each one when the change shows its trigger.

| Lens | Add it when the change has | Look for |
|---|---|---|
| architecture | New modules, a dependency or layer change | A dependency on a concrete class where a service interface exists. Growth with no expiry (tables, queues, caches, logs). A trade-off accepted with no follow-up recorded. |
| migration | A schema change or data migration | A lock on a large table, no way back, old code that breaks during the rollout. |
| integration | Feature flags, events, external APIs, config or deployment changes | A consumer that breaks, a default that differs between environments, a new setting that is not documented. |
| complexity | Deep nesting, large functions | Mixed concerns in one function, values with no name, a helper that copies an existing one. |
| docs | A behaviour change a user can see, a public API change, README changes | Documentation that now states something false. Search the docs for the old behaviour, including files the change did not touch. |
| scope | A large or mixed diff | Unrelated refactors or formatting in the same change, a new dependency the description does not mention. |
