# 04: Real timestamps

**What to build:** The trace's timeline is true. Where the orchestrator supplies no time, the dispatch entry point stamps a placeholder, and the agent that writes the trace (the scribe, or the worker in `single`) replaces it with the clock's UTC time before appending, for start and end. If ticket 02 shows the script can read the clock, the script stamps directly. SKILL.md drops "you have no clock" and stops passing `now`. QUA-08.

**Blocked by:** 02 (Spike: what a Workflow script can read); fixes ticket 08 (Worker appends the trace in single)

**Status:** ready-for-agent

- [x] Dispatch seam: with no `now`, the dispatch line carries the placeholder (or a real time), and the scribe and worker prompts say how to replace it
- [x] Docs seam: SKILL.md no longer says the orchestrator has no clock or passes `now`
- [ ] By hand: a session's rendered diagram shows wave times matching the session's wall clock
