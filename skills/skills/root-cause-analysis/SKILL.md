---
name: root-cause-analysis
description: Root cause analysis of a bug, failure or regression. Tests competing hypotheses in isolated git worktrees by reproducing each locally, rates confidence in a proposed fix, and writes a findings report. Use when asked for an RCA, a root cause, or why something broke.
---

# Root cause analysis

Find *why* something broke, prove it with a local reproduction, and say how sure you are that a fix addresses the cause and not the symptom. Each hypothesis is tested in its own git worktree, so experiments never touch the user's working tree or each other.

## Steps

1. **Frame the symptom.** From the context given (report, logs, stack trace, failing CI, recent diff), write down: expected behaviour, actual behaviour, where and when it happens, and when it last worked. Pull the evidence yourself: `git log` around the regression window, the failing output, the code on the failing path. Done when the symptom is stated precisely enough that a test could check it.

2. **Generate hypotheses.** List every plausible cause, aiming for at least three distinct ones (code change, data/input, environment/config, timing/concurrency, dependency). For each, write the **prediction** that would distinguish it from the others: "if H2, the bug disappears when X is pinned to 1.4". Done when each hypothesis has a prediction a reproduction can confirm or refute.

3. **Reproduce in a worktree.** For each hypothesis, create a worktree off the relevant commit:

   ```bash
   git worktree add ../rca-<slug>-h<n> <commit>
   ```

   Independent hypotheses can run in parallel, one subagent per worktree. In each worktree:
   - Build a reproduction that goes **red** on the symptom: a failing test where possible, otherwise a script with a clear pass/fail exit.
   - Test the prediction: change only the suspected cause and rerun. The hypothesis is **confirmed** when changing the cause flips the reproduction red → green (and back), **refuted** when the reproduction is unmoved, **inconclusive** when you could not reproduce, with the reason.

   Done when every hypothesis has a verdict backed by a command and its output.

4. **Propose the fix.** In the confirming worktree, write the fix the way the codebase would (use the `test-driven-development` skill: the reproduction is the red test). Run the reproduction and the tests around the changed code. Then rate confidence:
   - **High**: reproduced locally; the fix flips the reproduction; competing hypotheses refuted; related tests green.
   - **Medium**: reproduced, but an alternative cause is unrefuted, or the fix was only verified under narrower conditions than production.
   - **Low**: not reproduced locally; the fix rests on reasoning from code and logs.

   State which conditions are met and which are missing.

5. **Write the report.** Save it where the user asks; otherwise to `rca-<slug>.md` in the scratchpad or a temp directory, and give the full path. Sections:
   - **Summary**: root cause and fix in two sentences, with the confidence rating.
   - **Symptom**: expected vs actual, scope, first bad commit if found.
   - **Hypotheses**: table of hypothesis, prediction, verdict, evidence (command + result).
   - **Reproduction**: the exact commands to see it go red, and green with the fix.
   - **Root cause**: the causal chain from the cause to the symptom, with file:line references.
   - **Proposed fix**: the diff, and the branch it lives on.
   - **Confidence**: the rating and the conditions behind it.
   - **Open questions / follow-ups**: anything unrefuted, untested, or worth guarding against elsewhere.

6. **Clean up.** Remove the worktrees of refuted and inconclusive hypotheses (`git worktree remove`). Keep the fix's worktree and branch, and name them in the report. The user's working tree is left exactly as it was found; applying the fix there is the user's call.
