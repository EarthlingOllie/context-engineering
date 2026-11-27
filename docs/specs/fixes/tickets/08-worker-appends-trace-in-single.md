# 08: Worker appends the trace in single

**What to build:** A `single` dispatch needs no second agent. The worker's prompt gains a final step: append the dispatch's trace lines to its trace file and report how many it appended. The scribe runs only when the worker reports none. Other topologies keep the scribe. COST-02(b).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] At the dispatch seam: a `single` whose worker reports appended lines runs no scribe; one that reports none runs the scribe
- [x] The rendered diagram of a `single` dispatch is unchanged
- [x] Its own dispatch-eval run against the frozen baseline: every sample's pass rate and false passes stay within the baseline spread; the run's scorecard is linked here
- [ ] Dispatch evals: sample 1's dollars drop below its baseline spread

The two dispatch-seam criteria are covered by `graph-orchestrator/test/single-trace.test.ts`. The two dispatch-eval criteria need a paid run (Anthropic API key, Docker) and are open.

## Dispatch-eval run (2026-11-27, claude-opus-5-5, 3 epochs, cap 2, vs frozen baseline 3035a58f6828 (5 epochs); same-day baseline rerun reproduced it)

Scorecard: `graph-orchestrator/evals/out/scorecards/87d61f1d2984-20261127T143209Z.json` (local, gitignored; archived with its compare.py output and .eval logs outside the repo).

**Meets rule; sample 1 not cheaper.** Every sample holds, dollars in band. Sample 1 mean $0.0547 vs baseline $0.0636: the drop is inside the $0.0438 band, and the same-day baseline rerun had sample 1 at $0.0475, so box 4 is not met. Run cost $11.52.
