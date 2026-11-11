---
name: forge-diff
description: Works through a set of findings on a diff (code review comments, PR feedback, a bug list) one by one, validating each, fixing it test-first, and keeping each fix cohesive with the rest of the diff. Use when asked to address, resolve or work through review findings.
---

# Forge diff

Take a set of findings against the current diff and resolve each one, so the diff ends up the way the codebase would have written it from the start. The findings come from the user: review output, PR comments, a pasted list. When no findings are given, ask for them.

## For each finding, in turn

1. **Investigate.** Read the code the finding points at, and the code around it, until you can say whether the finding is **valid**, **partially valid** or **invalid**, and what its real **shape** is: the actual defect may be broader (the same pattern elsewhere in the diff) or narrower (one case of what the finding generalised) than it was described. Reproduce it when it is behavioural. Done when the verdict and shape are stated with evidence: file:line, a command and its output, or a failing test.
   - **Invalid**: record why, with the evidence, and move to the next finding. No code changes.

2. **Fix test-first.** Use the `test-driven-development` skill. The first test is the finding's reproduction, red before the fix. Fix every instance the shape covers, not just the line the finding named.

3. **Check cohesion.** Read the fix against the whole diff, not just the hunk:
   - It uses the same names, abstractions, error handling and patterns as the rest of the diff and the surrounding code.
   - It doesn't duplicate a helper the diff or the codebase already has, or contradict another change in the diff.
   - An earlier fix in this session isn't now redundant or at odds with it.

   Adjust until the fix reads as if the diff's author had written it.

4. **Resolve.** Repeat steps 2–3 until the finding is resolved **idiomatically**: its reproduction is green, the full test suite is green, and the fix is native to the codebase. Then take the next finding.

## Report

End with a table: finding → verdict → shape → change (files) → test. List anything left open, with why. Commit or push only when the user has asked to; if committing, one commit per finding keeps each fix reviewable.
