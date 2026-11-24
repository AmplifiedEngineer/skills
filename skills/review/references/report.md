# Sweep and report

## Sweep

Reviewers can be wrong, and a wrong finding in front of the author costs trust in every other finding. Check each finding yourself, against the code at the head commit, before you show, post or act on the list.

For each finding:

1. **True.** Read the cited lines again. Follow the failure where that is cheap. Confirm an `[unverified]` finding, drop it, or keep it with the tag stated.
2. **Label.** The label and its decorations match the real impact.
3. **Place.** The file and line are right. In a stack of PRs, the finding sits on the PR that owns the code.

Drop a finding that does not hold. Relabel one with the wrong label. Move one in the wrong place. Merge duplicates from different lenses and keep the clearest. Drop praise and asides that ask for no change.

Check the label of every blocking finding against "What blocks a merge" in `findings.md`, and lower the ones that do not meet it. Re-read the test yourself for any finding that says what a test does or does not cover. Those claims are wrong more often than claims about the code under test.

Read the cited lines and what the trace needs, not whole files. Then work out the verdict, the confidence and the order again from the swept list.

## Report

```
## <PR number or branch>: <title>
<N> files · +<added> -<removed> · <VERDICT> · confidence <HIGH|MEDIUM|LOW>
Mode: <lenses with separate reviewers | lenses in one session | one pass> · <N> changed lines · <why, when one pass>

### Overview
<one to three sentences: why this verdict>
Sweep: <N> kept, <N> dropped, <N> relabelled, <N> moved

### Reviewers
<lens reviews only: each lens with its result, for example "security: 2 · tests: 0 · perf: not run">

### Findings
<numbered findings in full: every blocking finding, then questions, then at most five non-blocking findings, the most useful first>

### Also noted
<the remaining non-blocking findings, one line each: `file:line` and the point. Group ones that share a cause.>

### Verification
| File | Read | Lines | Findings |
|---|---|---|---|
| src/orders/export.ts | Yes | 12, 40 | 1, 3 |
| src/orders/price.ts | No | - | - |

Verdict: <APPROVE | REQUEST_CHANGES | COMMENT | INCONCLUSIVE> · confidence <HIGH|MEDIUM|LOW>
```

Confidence:

- **HIGH:** you read the source for every finding.
- **MEDIUM:** one or two findings rest on the diff alone and carry `[unverified]`.
- **LOW:** several findings are unconfirmed. Tag each one.

The author reads the top of the report and may stop there. A report with sixteen full findings hides the two that matter, which is why the full form is kept for blocking findings and a few others.

List every changed file in the verification table, including the ones you did not read. The author can then see what the review did not cover.
