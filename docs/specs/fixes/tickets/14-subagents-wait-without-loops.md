# 14: Subagents wait without loops

**What to build:** Generators and workers stop spinning on long commands. Their stances say: to wait on a long command, run it in the foreground with a timeout, or start it in the background and wait once on its exit status; never loop on `pgrep -f`, which matches itself. SPD-03.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] The generator and worker prompts carry the sentence (dispatch seam)
- [ ] Its own dispatch-eval run against the frozen baseline: every sample's pass rate and false passes stay within the baseline spread; the run's scorecard is linked here

## Dispatch-eval run (2026-11-27, claude-opus-5-5, 3 epochs, cap 2, vs frozen baseline 3035a58f6828 (5 epochs); same-day baseline rerun reproduced it)

Scorecard: `graph-orchestrator/evals/out/scorecards/628167c26a4d-20261127T143234Z.json` (local, gitignored; archived with its compare.py output and .eval logs outside the repo).

**Fails rule as written.** Sample 10: 2/3 correct, **1/3 false pass**. Sample 10 false passes in post-A-02 runs share one cause: with whole results visible the dispatch completes 2 rounds and the reducer merges 13-14 facts, over the sample's `maxLines: 12`; it then writes the list to a scratch file and returns a pointer, and the check reads only the returned result. Sample 10 is fixed in its revision 2 (2026-11-27: `maxLines` 20, and the reducer is told to return every fact inline, never a pointer to a file); the frozen baseline `3035a58f6828` predates it, so `compare.py` reports sample 10 as not gated until a fresh baseline epoch is frozen for it, then re-gate this ticket (HUMAN-TODO D10). Dollar flag: sample 02 +$0.030 (band $0.024), cache writes. Run cost $12.31.
