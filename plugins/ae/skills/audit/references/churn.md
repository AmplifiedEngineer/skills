# Change history

Complex code that changes often is where a fix pays off. Collect this in Phase 1 with read-only git commands.

1. Most-changed files in the last year: `git log --since="1 year ago" --name-only --pretty=format: | sort | uniq -c | sort -rn | head -30`
2. Who touches what, to find single-owner risk: `git shortlog -sn --since="1 year ago"` and `git log --format='%an' -- <path> | sort | uniq -c`
3. Files fixed often: `git log --since="1 year ago" -i --grep="fix" --name-only --pretty=format: | sort | uniq -c | sort -rn | head -20`
4. Files that change together: pick the top files and read `git log --name-only` for them.

Then cross the list with complexity. A file that is both long or branchy and in the top of the churn list is a hotspot. Report it as a finding with its `file:line`. A complex file with no recent changes is lower priority.

If the repo has no history (a shallow clone or a fresh export), say so and skip the churn cross-check. Do not fetch more history if that would change the checkout. Read-only reads only.
