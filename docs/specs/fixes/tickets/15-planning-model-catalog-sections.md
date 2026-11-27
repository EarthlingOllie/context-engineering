# 15: Planning-model catalog sections

**What to build:** The catalog tells the orchestrator how to plan parallel code changes and expensive checks. Parallel code changes: each generator in its own git worktree on a ticket branch, followed by an integrate generator-evaluator that merges and runs the full suite; SKILL.md's wave planning points to it. Tests per round: generators run targeted tests, the evaluator runs the full suite once per round and logs it to the scratch directory, and a later stage at the same commit cites that log. Split fan-outs: added only if one concurrency-sweep run shows sibling fan-outs of width at most 2 finish faster than one wide fan-out. QUA-06, COST-04, SPD-04.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The catalog has the parallel-code-changes and tests-per-round sections, and SKILL.md's wave planning has the one-line pointer (docs seam)
- [ ] One concurrency-sweep run is recorded here; the split-fan-out note is added only if it shows the gain, otherwise the result is recorded and the note left out
