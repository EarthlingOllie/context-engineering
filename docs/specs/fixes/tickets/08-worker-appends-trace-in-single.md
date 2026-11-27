# 08: Worker appends the trace in single

**What to build:** A `single` dispatch needs no second agent. The worker's prompt gains a final step: append the dispatch's trace lines to its trace file and report how many it appended. The scribe runs only when the worker reports none. Other topologies keep the scribe. COST-02(b).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] At the dispatch seam: a `single` whose worker reports appended lines runs no scribe; one that reports none runs the scribe
- [ ] The rendered diagram of a `single` dispatch is unchanged
- [ ] - [ ] Its own dispatch-eval run against the frozen baseline: every sample's pass rate and false passes stay within the baseline spread; the run's scorecard is linked here
- [ ] Dispatch evals: sample 1's dollars drop below its baseline spread
