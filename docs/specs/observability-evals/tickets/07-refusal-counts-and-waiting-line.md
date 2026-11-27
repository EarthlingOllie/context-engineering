# 07: Refusal counts and the WAITING line

**What to build:** Refusals and idle time are visible without reading transcripts. Working and evaluator stances ask the agent to report how many writes were refused and tools denied, as part of its structured output, and the count reaches the dispatch line. SKILL.md: while waiting on a human, CI or a restart, the state file holds one `WAITING: <cause> since <time>` line, removed when the wait ends.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Dispatch seam: refusal counts returned by scripted agents appear on the dispatch line
- [x] Docs seam: SKILL.md documents the WAITING line
- [ ] Its own dispatch-eval run against the frozen baseline: every sample's pass rate stays within its spread (paid run: left to a human)
