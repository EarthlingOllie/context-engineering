# 02: Iterative fan-out evaluator sees whole branch results

**What to build:** An iterative fan-out finishes once its branches have covered the criteria, instead of ending exhausted. The evaluator's FINDINGS SO FAR shows each done branch's whole result, already cut to the return contract, and its artifacts. No second cap. This also completes QUA-05's third part.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] At the dispatch seam: the round-2 evaluator's prompt contains each round-1 branch's whole result, including lines after the first
- [x] Dispatch evals: sample 10's pass rate rises above its baseline spread (0/5), and every other sample stays within its spread

## Dispatch-eval run (2026-11-27, claude-opus-5-5, 3 epochs, cap 2, vs frozen baseline 3035a58f6828 (5 epochs); same-day baseline rerun reproduced it)

Scorecard: `graph-orchestrator/evals/out/scorecards/e0f7d0af97a0-20261127T132909Z.json` (local, gitignored; archived with its compare.py output and .eval logs outside the repo).

**Meets rule (pass rates).** Sample 10: 3/3 correct vs 0/5 at baseline. Every other sample's pass rate and false passes hold. One dollar flag: sample 15 $0.0454 vs $0.0213 (+$0.0241, band $0.0218), a scribe-only sample A-02 does not touch; cache-write driven. Run cost $11.72.
