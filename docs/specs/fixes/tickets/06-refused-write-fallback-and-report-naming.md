# 06: Refused-write fallback and report naming

**What to build:** Refused report writes no longer lose work. Generator, worker and reducer stances say: if a write is refused, put the full content in the result and make line 1 `ARTIFACT REFUSED: <path>`. SKILL.md and the catalog examples name report artifacts `.txt`, `.json` or `.html`, not `.md`. QUA-05 (its third part is ticket 02).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] The generator, worker and reducer prompts carry the fallback sentence (dispatch seam)
- [x] SKILL.md and every catalog example name report artifacts with a non-`.md` extension (docs seam)
- [ ] Its own dispatch-eval run against the frozen baseline: every sample's pass rate and false passes stay within the baseline spread; the run's scorecard is linked here
