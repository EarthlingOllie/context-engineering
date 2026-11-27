# 15: Planning-model catalog sections

**What to build:** The catalog tells the orchestrator how to plan parallel code changes and expensive checks. Parallel code changes: each generator in its own git worktree on a ticket branch, followed by an integrate generator-evaluator that merges and runs the full suite; SKILL.md's wave planning points to it. Tests per round: generators run targeted tests, the evaluator runs the full suite once per round and logs it to the scratch directory, and a later stage at the same commit cites that log. Split fan-outs: added only if one concurrency-sweep run shows sibling fan-outs of width at most 2 finish faster than one wide fan-out. QUA-06, COST-04, SPD-04.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] The catalog has the parallel-code-changes and tests-per-round sections, and SKILL.md's wave planning has the one-line pointer (docs seam)
- [ ] One concurrency-sweep run is recorded here; the split-fan-out note is added only if it shows the gain, otherwise the result is recorded and the note left out

## Concurrency sweep

**Status:** not yet run for this ticket (a paid run, left to a human). The split-fan-out note is not in the catalog, and `test/planning-model-docs.test.ts` asserts it stays out until this section records a run that shows the gain.

**The run.** One pass of the existing sweep, defaults (samples 6 and 7, caps 2, 4, 8, 4 CPUs, 8g, 1 epoch; about $1.21 at the last pass):

```sh
env -u ANTHROPIC_BASE_URL .venv/bin/python graph-orchestrator/evals/sweep.py
```

It writes `graph-orchestrator/evals/out/sweeps/<plugin commit>-<UTC time>.md`; paste its table below. The free dry run (`--stub --stub-delay-ms 300`) completed on 2026-11-27 at commit `747cbc7`, so the command and its output path work.

**Reading it.** The sweep varies one run's concurrency cap; it does not launch sibling fan-outs. Each workflow run has its own cap (ADR-0003), so in the cloud, where the cap is 2, ⌈w/2⌉ sibling fan-outs of width at most 2 run all w branches at once, as one run does at a cap of at least w. Sample 7 (width 6, partitioned) therefore stands for the comparison: its cap-2 row is one wide fan-out, its cap-8 row is the split's best case, before the extra reduce dispatch the split needs in the next wave. **The gain is shown** when sample 7's wall clock at cap 8 is below its wall clock at cap 2 by more than 10% (compare.py's noise band for one epoch) plus one reducer agent's wall clock (sample 6's reducer, from the scorecard rows in the sweep's `.json`). Otherwise record the result and leave the note out. Either way, tick the second checkbox once the table below is filled.

**If the gain is shown,** add to the catalog's fan-out entry: "Width above 2 queues in the cloud. When branches need no shared partition or reducer, launch them as ⌈w/2⌉ sibling fan-outs of width at most 2 in one wave and reduce in the next." Then turn the docs test's "no split-fan-out note" case into one that asserts the note.

**Earlier evidence (not this ticket's run).** The pass recorded in `graph-orchestrator/evals/README.md` (2026-11-26, plugin commit `3035a58f6828`, before this spec's changes): sample 7's wall clock fell from 39.2 s at cap 2 to 28.4 s at cap 8 (-28%), queue time from 37.5 s to 0.2 s.

| sample | cap | wall clock s | queue s | $ | epochs |
|---|---|---|---|---|---|
| (to fill from the run) | | | | | |
