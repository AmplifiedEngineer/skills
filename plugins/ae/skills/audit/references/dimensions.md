# Audit dimensions and severity

Check each dimension. Skip a bullet that does not apply. If a dimension is healthy, say so in one sentence.

## Severity

- **Critical**: exploitable now, loses or corrupts data, or breaks the main path. Fix before anything else.
- **High**: likely to cause an incident or block work soon.
- **Medium**: real cost, but it can wait for a planned slot.
- **Low**: small cost or style. Report it only if it is cheap to fix.

## Architecture and design

- Module boundaries, coupling and cohesion
- Circular dependencies
- Leaky abstractions
- God objects and god files
- Layering violations
- Scalability bottlenecks

## Code quality

- Duplication and dead code
- Complexity hotspots (the longest and most-branched functions)
- Inconsistent patterns
- Error handling gaps: swallowed exceptions, missing edge cases
- Type safety holes

## Security

- Hardcoded secrets or credentials
- Injection risks
- Unsafe deserialization
- Missing input validation
- Auth and authorization weaknesses
- Outdated dependencies with known CVEs
- Overly permissive configs

Read the code and config. Do not run scanners that install or write anything. Report a CVE only when you can cite the manifest line and the advisory, otherwise mark it `[unverified]`.

## Testing

- Coverage gaps, especially around core business logic
- Test quality: do tests assert behavior or only run the code?
- Missing test types: unit, integration, end to end
- Flaky patterns
- Code that cannot be tested

## Performance

- N+1 queries
- Needless allocations or copies
- Blocking calls in async paths
- Missing caching or indexes
- Unbounded growth: memory, files, queues

## Dependencies

- Outdated, unmaintained, duplicated or needlessly heavy packages
- License risks
- Lockfile hygiene

## Developer experience and operations

- Build and setup friction
- CI/CD gaps
- Missing lint and format enforcement
- Logging and observability quality
- Error reporting
- Deployment story

## Documentation

- README accuracy
- Onboarding path
- Undocumented critical behavior
- Stale docs that contradict the code
