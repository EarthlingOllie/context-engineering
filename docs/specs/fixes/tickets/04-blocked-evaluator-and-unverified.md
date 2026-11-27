# 04: Blocked evaluator and Unverified

**What to build:** No pass without a check that ran. An evaluator that cannot run a check it needs blocks, naming the check. The orchestrator never resolves a blocked result silently; work it accepts without a passing evaluator is labelled Unverified, re-reviewed next wave and listed first in the final reply. A budget stop with a failing review reads the review and returns its blocking items. REL-08 and QUA-02.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] The evaluator stance says: if a tool needed for a criterion is denied, block with a question naming the check that could not run; never pass a criterion that could not be checked
- [x] At the dispatch seam: an evaluator scripted to block ends the dispatch `blocked` with its question; the evaluator prompt carries the new sentence
- [x] SKILL.md: a blocked result is never resolved silently in either mode; accepted work without a passing evaluator carries UNVERIFIED in its DECISIONS line, gets an evaluator-only dispatch next wave unless the budget is spent, and is listed first in the final reply
- [x] SKILL.md: a budget stop with a failing review ends with one `single` that reads the review artifact and returns its blocking items in at most 6 lines
- [x] Docs seam: the SKILL.md rules are asserted
- [ ] Its own dispatch-eval run against the frozen baseline: every sample's pass rate and false passes stay within the baseline spread; the run's scorecard is linked here
- [ ] By hand in a cloud session: an autonomous run with a check the evaluator cannot run ends with the work labelled UNVERIFIED and listed first
