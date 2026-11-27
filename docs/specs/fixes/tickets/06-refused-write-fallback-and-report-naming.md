# 06: Refused-write fallback and report naming

**What to build:** Refused report writes no longer lose work. Generator, worker and reducer stances say: if a write is refused, put the full content in the result and make line 1 `ARTIFACT REFUSED: <path>`. SKILL.md and the catalog examples name report artifacts `.txt`, `.json` or `.html`, not `.md`. QUA-05 (its third part is ticket 02).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] The generator, worker and reducer prompts carry the fallback sentence (dispatch seam)
- [x] SKILL.md and every catalog example name report artifacts with a non-`.md` extension (docs seam)
- [ ] Its own dispatch-eval run against the frozen baseline: every sample's pass rate and false passes stay within the baseline spread; the run's scorecard is linked here

## Dispatch-eval run (2026-11-27, claude-opus-5-5, 3 epochs, cap 2, vs frozen baseline 3035a58f6828 (5 epochs); same-day baseline rerun reproduced it)

Scorecard: `graph-orchestrator/evals/out/scorecards/f88fd56e3e42-20261127T140206Z.json` (local, gitignored; archived with its compare.py output and .eval logs outside the repo).

**Fails rule as written.** Sample 10: 1/3 correct, **2/3 false pass**; every other sample holds, dollars in band. Sample 10 false passes in post-A-02 runs share one cause: with whole results visible the dispatch completes 2 rounds and the reducer merges 13-14 facts, over the sample's `maxLines: 12`; it then writes the list to a scratch file and returns a pointer, and the check reads only the returned result. Fix sample 10 (raise maxLines to >= 16, or let the check read the named file) and re-gate. (B-06's run, which contains this change, scored 0/3 false passes.) Run cost $10.91.
