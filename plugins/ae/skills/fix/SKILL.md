---
name: fix
description: Fixes one small, well-understood bug with a failing test first, the smallest change, focused tests and project checks. Use when the user says "fix this", "fix #123", "this is broken, the cause is X" or reports a bug whose cause is known or easy to find. For an unknown cause use the debug skill first. For a bigger change use the plan skill.
---

# Fix

Fix one small bug: a failing test, the smallest change that makes it pass, and a report. This is the light path. If the fix grows past a small change, stop and point to the plan skill.

## Hard rules

1. Write a failing test before you change any code. The test must fail for the reason in the bug report, not for a typo or a missing import.
2. Make the smallest change that fixes the cause. Do not clean up nearby code. Do not fix other bugs you notice. List them in the report.
3. Stop and point to the plan skill when a stop rule below fires. Do not grow the change to fit.
4. Commit or push only when the user asks. Commit through the commit skill. Never commit on the default branch.
5. Do not claim a check passed unless you ran it and saw the result.

## Steps

1. **State the bug.** Read the input. For an issue number, run `gh issue view <N> --json number,title,body,comments`. For text, treat it as the report. State the bug in one sentence: what happens, what should happen, and where. If the report is too vague for that, ask the user one question for the missing detail. With no input, ask for an issue number or a description.
2. **Check the cause.** If you know the root cause, or it is clear after reading the code, go on. If it is unknown, load the debug skill first: `ae:debug` in Claude Code when installed as a plugin, `debug` when copied in by hand, or `$debug` in Codex. Find the cause before you change code. If the debug skill is missing, say so and test one hypothesis at a time yourself. If two tested hypotheses do not explain the failure, stop under rule 1 of the stop rules.
3. **Load the standards.** Load the engineering-standards skill: `ae:engineering-standards` in Claude Code when installed as a plugin, `engineering-standards` when copied in by hand, or `$engineering-standards` in Codex. Follow its test and code rules. If it is missing, say so and follow the conventions of the repo.
4. **Reproduce with a failing test.** Read the repo guidance and the tests near the code. Write the test in the existing style, next to the tests for the same code. Run it and confirm it fails for the right reason. If no test can show this bug, stop under rule 6 of the stop rules.
5. **Make the fix.** Change the least code that removes the cause. Check the size of the change as it grows against the stop rules.
6. **Run the focused tests.** The new test must pass. The tests around it must stay green. Run the project checks that apply to the files you touched: the linter, the type check and the build, as the repo defines them. Fix failures that your change caused. Report failures that were there before.
7. **Review the diff.** Run `git diff --stat` and read the diff. Confirm it holds only the test and the fix. Remove stray edits and debug output.
8. **Report.** Use the format below. Commit only if the user asked, and use the commit skill: `ae:commit` in Claude Code when installed as a plugin, `commit` when copied in by hand, or `$commit` in Codex. If you are on the default branch, create `fix/<short-slug>` first. Offer the pull-request skill only when the user wants a pull request.

## Stop rules

Stop making changes and point to the plan skill when any one of these is true:

1. The root cause is still unclear after two tested hypotheses.
2. The fix crosses modules or services, or touches more than about 5 files or 100 changed lines, not counting the new test.
3. The fix changes a public interface, a data shape, a schema, a config format or a security boundary.
4. The fix needs a new dependency.
5. The fix changes user-visible behavior beyond the bug itself.
6. No failing test can show the bug.

Say which rule fired and give the evidence: the files, the line count or what the tests showed. Hand over the one-sentence bug, what you tested and what you learned. Leave the tree as it is, or revert your half-made fix if it would mislead the plan. Ask the user whether to start the plan skill now.

Point to it like this: `ae:plan` in Claude Code when installed as a plugin, `plan` when copied in by hand, or `$plan` in Codex. If the plan skill is missing, say so and give the same handover in your reply.

## Writing

Before you write prose a person will read (the report, a commit message, a PR text), load the writing-style skill: `ae:writing-style` in Claude Code when installed as a plugin, `writing-style` when copied in by hand, or `$writing-style` in Codex. If it will not load, say so and write short, plain sentences. Add no AI attribution to any commit or PR text.

## Report format

Keep it short:

- The bug in one sentence, and the root cause.
- The test you added, and that it failed before the fix.
- The change: files and a one-line description.
- Checks that ran, with results. Name any that did not run and why.
- Other bugs or cleanups you noticed and left alone.
- If a stop rule fired: the rule, the evidence and the handover.
