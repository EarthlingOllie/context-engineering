# 04: Blocked evaluator and Unverified

**What to build:** No pass without a check that ran. An evaluator that cannot run a check it needs blocks, naming the check. The orchestrator never resolves a blocked result silently; work it accepts without a passing evaluator is labelled Unverified, re-reviewed next wave and listed first in the final reply. A budget stop with a failing review reads the review and returns its blocking items. REL-08 and QUA-02.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] The evaluator stance says: if a tool needed for a criterion is denied, block with a question naming the check that could not run; never pass a criterion that could not be checked
- [x] At the dispatch seam: an evaluator scripted to block ends the dispatch `blocked` with its question; the evaluator prompt carries the new sentence
- [x] SKILL.md: a blocked result is never resolved silently in either mode; accepted work without a passing evaluator carries UNVERIFIED in its DECISIONS line, gets an evaluator-only dispatch next wave unless the budget is spent, and is listed first in the final reply
- [x] SKILL.md: a budget stop with a failing review ends with one `single` that reads the review artifact and returns its blocking items in at most 6 lines
- [x] Docs seam: the SKILL.md rules are asserted
- [x] Its own dispatch-eval run against the frozen baseline: every sample's pass rate and false passes stay within the baseline spread; the run's scorecard is linked here
- [x] By hand in a cloud session: an autonomous run with a check the evaluator cannot run ends with the work labelled UNVERIFIED and listed first

## Dispatch-eval run (2026-11-27, claude-opus-5-5, 3 epochs, cap 2, vs frozen baseline 3035a58f6828 (5 epochs); same-day baseline rerun reproduced it)

Scorecard: `graph-orchestrator/evals/out/scorecards/bda34564a1f5-20261127T140102Z.json` (local, gitignored; archived with its compare.py output and .eval logs outside the repo).

**Meets rule (pass rates and false passes).** Every sample holds; sample 10 3/3. Dollar flag: sample 02 +$0.034 (band $0.024), cache writes with flat output tokens. Run cost $11.80.

**By-hand evidence (2026-11-27, session_016jSC3fsMfuGLacrVjUTYMU, plugin 0.5.0+eaf50f7)**

Autonomous run on toy set sandbox/toy-spec/ (T2 has a PyPy 3.10 criterion; pypy3.10 not installed). T2 dispatch w2-d2 (run wf_5a9148c5-8a9, 23:37:53Z-23:49:26Z) ended `blocked`, evaluator round 1 verdict blocked with a question naming P5 (`pypy3.10 -m unittest ...`), not a pass.
Not resolved silently: self intervention recorded at 23:49:43Z with 3 options, recommended (a); state-file DECISIONS line reads "T2 UNVERIFIED — accepted without passing evaluator (P5 pypy3.10 unrunnable)".
Next wave had a review-only dispatch for T2: w4-d1 (run wf_69e4a25a-be2): P1-P4 PASS, P5 CANNOT RUN, label kept. Acceptance w5-d1 (run wf_d3703b99-f3c) also kept A1 UNVERIFIED.
Box left unticked: "listed first in the final reply" is not yet evidenced (the final reply is sent after this record); variant used was a missing tool, not Bash denied.
Final reply (~23:55Z) opened with the UNVERIFIED items first: T2 with artifact paths and the pypy reason, then toy acceptance A1 with logs, before the per-check table and decisions. Every part of the observable now holds (missing tool is the "or" variant of the check that cannot run); box ticked.
