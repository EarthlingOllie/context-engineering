# 05: Chain stage lines, not-run list and panel gate

**What to build:** A chain reports every stage, names the stages it did not run, and stops at a failing panel. Its result starts with one line per stage (`<stage id> <status>: <first line>`), then the last run stage's lines, cut to the line limit. A chain that stops early appends `not run: <stage ids and titles>`. A non-last panel stage whose result starts `FAIL` stops the chain as `exhausted`, naming the panel, unless the stage sets `gate: false`. REL-04.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] At the dispatch seam: a done chain's result has one line per stage, then the last stage's lines
- [x] At the dispatch seam: a chain whose stage 1 is exhausted lists the later stages under `not run:`
- [x] At the dispatch seam: a mid-chain panel FAIL stops the chain as `exhausted` naming the panel; with `gate: false` the chain continues
- [x] The catalog's chain section describes the gate and its opt-out
- [ ] Dispatch evals: sample 9 rises above its baseline spread, or holds if already passing, and every other sample stays within its spread

## Dispatch-eval run (2026-11-27, claude-opus-5-5, 3 epochs, cap 2, vs frozen baseline 3035a58f6828 (5 epochs); same-day baseline rerun reproduced it)

Scorecard: `graph-orchestrator/evals/out/scorecards/f50da06b51b5-20261127T140055Z.json` (local, gitignored; archived with its compare.py output and .eval logs outside the repo).

**Fails rule as written.** Sample 9 holds at 3/3 (extra condition met). Sample 10: 2/3 correct, **1/3 false pass**. Sample 10 false passes in post-A-02 runs share one cause: with whole results visible the dispatch completes 2 rounds and the reducer merges 13-14 facts, over the sample's `maxLines: 12`; it then writes the list to a scratch file and returns a pointer, and the check reads only the returned result. Sample 10 is fixed in its revision 2 (2026-11-27: `maxLines` 20, and the reducer is told to return every fact inline, never a pointer to a file); the frozen baseline `3035a58f6828` predates it, so `compare.py` reports sample 10 as not gated until a fresh baseline epoch is frozen for it, then re-gate this ticket (HUMAN-TODO D10). Run cost $11.72.
