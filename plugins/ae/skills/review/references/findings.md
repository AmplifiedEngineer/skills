# Findings

## Evidence rules

1. Open the file before you make a claim about it. Read it at the head commit under review.
2. Copy the exact code into the `Evidence` line. Do not rebuild it from memory.
3. Confirm every name you use (function, type, table, variable) by reading where it is defined.
4. Cite only paths that exist and line numbers you read. Leave a line number out when you cannot confirm it.
5. Before you report missing error handling, follow the call up. Report it only when no layer above handles the error.
6. Tag a claim you could not confirm `[unverified]`, or drop it.

## Ways to find what a read-through misses

Reading a diff top to bottom confirms that the code does what the author meant. These three checks look for what the author did not think of.

1. **Attack every check the change adds.** For each validator, pattern, parser, filter or guard, write two inputs the author would want rejected and decide from the code whether each one is. Vary the small things: no space, extra space, different case, an empty value, a second line. A check that only stops the polite form of bad input is a finding.
2. **Follow each new side effect to its other callers.** When the change makes a function call a network, a model, a program or a disk, find who else calls that function. Existing tests and other commands now do the same thing without knowing it.
3. **Search for the old behaviour in words.** When behaviour a user can see changes, search the docs, help text and comments for a description of the old behaviour, including files the change did not touch.

## Proof by kind of claim

| Claim | Proof it needs |
|---|---|
| Code defect | Path, line, and the exact code that has the defect. |
| Performance | A concrete case: how many loop turns, how many queries, how much data. |
| Failure | The steps: what triggers it, how it fails, what the user or operator sees. |
| "X is better than Y" | One measured difference: call count, lines touched, coupling. |
| Third-party behaviour | A link to the vendor's documentation. "It likely sends a header" is not proof. |

## Shape of a finding

```
N. <label> [(decorations)]: <one line that names the consequence>
   `<file>:<line>` · <category> · <HIGH|MEDIUM|LOW>
   Evidence: `<exact code at that line>`
   <one sentence, two at most: the problem and the failure it causes>
   Fix: <one fix, in plain words>
```

- The subject names what happens, not the rule. Write "User input runs as SQL", not "SQL injection". Write "Each order fires its own query", not "N+1 pattern detected".
- Give one fix, the smallest that works. Do not give a menu.
- Category is the lens: security, logic, tests, data, types, perf and so on. The last field is your confidence.
- When the evidence is not on a changed line, end with `Report-only: not on a changed line.` It stays in the report and gets no inline comment.
- Use "this" and "we", not "you". Skip praise. Use plain words and no em or en dashes.

## Labels

Findings and posted comments use [Conventional Comments](https://conventionalcomments.org/): `<label> [(decorations)]: <subject>`.

| Label | Meaning | Default |
|---|---|---|
| issue | A specific problem. | blocking |
| todo | A small change that is needed. | blocking |
| chore | A step a process requires before merge. Link the process. | blocking |
| typo | A misspelling. | blocking |
| question | A concern you are not sure about. | needs an answer |
| suggestion | An improvement. Say what and why. | judge it |
| polish | Nothing is wrong, and this makes the code better now. | non-blocking |
| thought | An idea for later. | non-blocking |
| nitpick | A small preference. | non-blocking |

Add `(blocking)` or `(non-blocking)` when the default does not fit, and a lens after it when useful: `issue (blocking, security): ...`. When you are not sure a problem exists, use `question`, not `issue`.

## What blocks a merge

A blocking finding stops the author's work, so each one must earn it. When five findings block and two matter, the author stops trusting the label.

Mark a finding blocking only when one of these is true:

- A user or operator meets the failure in normal use: wrong results, a crash, a hang, lost work.
- Data is lost, corrupted or shown to someone who should not see it.
- The change breaks something that works today: an existing caller, an existing test, a documented contract.

These are real findings and they do not block by default. Mark them `(non-blocking)`:

- Documentation that is out of date, unless it would lead a user to a harmful action.
- A missing or weak test for code that is correct.
- A failure that needs a rare environment, such as a machine with no home directory. An ordinary sequence of events is not a rare environment: two sessions in one folder, a retry, a resume or a slow network happen every day.
- Speed or size concerns with no measured or counted cost.
- Behaviour the change states it chose on purpose. Ask about it with `question` if the choice looks wrong.

A wrong result that a user sees or that is stored as data blocks, even when it takes a few steps to reach. When you cannot decide between blocking and non-blocking for a wrong result, choose blocking and say what fact would lower it. Do not use `question` for a defect you have traced: `question` is for what you could not settle.

## Shortcuts that produce false findings

| Thought | What to do |
|---|---|
| "The file is probably at..." | Find it. |
| "The function likely does X." | Read the function. |
| "I can see from the diff that..." | The diff is not the file. Read the file. |
| "This is a common anti-pattern." | Show the code here that has the problem and what it breaks. |
| "This is obviously a bug." | Write the trigger, the mechanism and what the user sees. |
