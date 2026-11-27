# 04: Real timestamps

**What to build:** The trace's timeline is true. Where the orchestrator supplies no time, the dispatch entry point stamps a placeholder, and the agent that writes the trace (the scribe, or the worker in `single`) replaces it with the clock's UTC time before appending, for start and end. If ticket 02 shows the script can read the clock, the script stamps directly. SKILL.md drops "you have no clock" and stops passing `now`. QUA-08.

**Blocked by:** 02 (Spike: what a Workflow script can read); fixes ticket 08 (Worker appends the trace in single)

**Status:** ready-for-agent

- [x] Dispatch seam: with no `now`, the dispatch line carries the placeholder (or a real time), and the scribe and worker prompts say how to replace it
- [x] Docs seam: SKILL.md no longer says the orchestrator has no clock or passes `now`
- [x] By hand: a session's rendered diagram shows wave times matching the session's wall clock

**By-hand evidence (2026-11-27, session_016jSC3fsMfuGLacrVjUTYMU, plugin 0.5.0+eaf50f7)**

Trace lines carry real UTC `at`/`ended` (no `{{START_UTC}}`/`{{END_UTC}}` left; no `now` in any args file). Rendered diagram (SCRATCH/session.mmd, 23:52Z) wave times vs wall clock (args-file mtime at launch):
wave 1 23:36:27Z (w1-d1 args 23:36:27Z); wave 2 23:37:46Z (w2-d1 args 23:37:46Z); wave 3 23:39:16Z (w3-d1 args 23:39:16Z); wave 4 23:49:43Z (w4-d1 args 23:49:43Z); wave 5 23:51:09Z (w5-d1 args 23:51:09Z) — all within 1 s.
Durations agree with the orchestrator's clock: T2 w2-d2 23:37:53Z-23:49:26Z = 693 s vs 678 s observed; acceptance w5-d1 ended 23:51:58Z vs ~23:51:50Z observed — within a minute.
