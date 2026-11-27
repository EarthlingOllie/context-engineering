# 02: Iterative fan-out evaluator sees whole branch results

**What to build:** An iterative fan-out finishes once its branches have covered the criteria, instead of ending exhausted. The evaluator's FINDINGS SO FAR shows each done branch's whole result, already cut to the return contract, and its artifacts. No second cap. This also completes QUA-05's third part.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] At the dispatch seam: the round-2 evaluator's prompt contains each round-1 branch's whole result, including lines after the first
- [ ] Dispatch evals: sample 10's pass rate rises above its baseline spread (0/5), and every other sample stays within its spread
