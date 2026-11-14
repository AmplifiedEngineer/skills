# Example Architecture Finding

> Illustrative example only. The scenario and evidence below are fictional and must not be treated as repository facts.

## ARCH-001: A synchronous dependency can extend request availability risk

- **Classification:** INFERRED
- **Severity:** Medium
- **Confidence:** Medium
- **Affected components:** Example API service; example downstream service

### Finding
The example API waits synchronously for a downstream service before completing a request. If that dependency becomes slow or unavailable, requests may also become slow or fail.

### Evidence
- Illustrative evidence: `src/example/handler.ts` awaits `exampleClient.fetchRecord()`.
- Illustrative evidence: `src/example/client.ts` has no visible timeout or fallback in the reviewed path.
- No load-test or production availability data was reviewed.

### Consequences
A downstream incident may affect the API's latency or availability. The extent depends on timeout behaviour, concurrency limits, retries and deployment topology that have not been verified.

### Recommendation
Confirm the client timeout, retry and concurrency behaviour. Add a bounded timeout if absent, and define a fallback or failure response appropriate to the product requirement. Validate with a dependency-failure test.

### Limitations
This example demonstrates finding structure only. Replace all illustrative paths and observations with evidence from the target system.
