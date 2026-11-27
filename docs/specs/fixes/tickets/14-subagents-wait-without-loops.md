# 14: Subagents wait without loops

**What to build:** Generators and workers stop spinning on long commands. Their stances say: to wait on a long command, run it in the foreground with a timeout, or start it in the background and wait once on its exit status; never loop on `pgrep -f`, which matches itself. SPD-03.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] The generator and worker prompts carry the sentence (dispatch seam)
- [ ] Its own dispatch-eval run against the frozen baseline: every sample's pass rate and false passes stay within the baseline spread; the run's scorecard is linked here
