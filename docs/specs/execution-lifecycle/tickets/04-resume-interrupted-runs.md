# 04: Resume interrupted runs

**What to build:** Work interrupted by a container restart or a usage limit continues where it stopped, without anyone re-planning it. The orchestrator records each dispatch's run id on its FRONTIER line in the state file right after launch. At the start of every turn, in both modes and without asking, it relaunches with `resumeFromRunId` any dispatch on FRONTIER that has a run id but no integrated result, and any dispatch whose `failed` result reports a usage limit. A stopped run is handled by this rule; it is not a signature status.

**Blocked by:** 01 (Spike: launch, resume and usage-limit behaviour), 02 (Real status in the dispatch result and log)

**Status:** ready-for-agent

- [ ] SKILL.md: the run id goes on the dispatch's FRONTIER line right after launch, so it survives compaction
- [ ] SKILL.md: the start-of-turn resume rule, covering dispatches with no integrated result and usage-limit failures, in both modes, without asking
- [ ] SKILL.md: if a resume fails, relaunch fresh once; a second failure is treated as `failed`
- [ ] SKILL.md: a usage-limit failure is never answered by changing the spec
- [ ] The integrate table points stopped runs and usage-limit failures to the rule
- [ ] If ticket 01 found the script can learn its run id, the trace's dispatch line records it; otherwise this ticket notes that the state file alone holds it
- [ ] By hand in a cloud session: a three-round generator-evaluator is interrupted by a container restart mid-run; on its next turn the orchestrator relaunches it with `resumeFromRunId`, finished agents replay from cache, and the dispatch completes
