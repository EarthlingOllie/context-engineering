# 11: Evidence vs housekeeping; waiting on external state

**What to build:** The main loop stays small without paying a dispatch for a push. Evidence work (after a restart, a user question about results) is a `single` with at most 6 lines. Housekeeping (cleanup, commit, push, PR) may run in the main loop only when no dispatch is running and an authorisation is recorded in the state file; an irreversible step still asks. Waiting on a PR, CI or another session uses a subscription or a scheduled message in the main loop, not dispatches. QUA-07 and COST-05.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] SKILL.md's exceptions name evidence work as a small `single` and housekeeping under the two conditions (docs seam)
- [x] A rationalisations row: "It's only a git push" (docs seam)
- [x] SKILL.md's "when not to use" and the rule's exception cover waiting on external state (docs seam)
- [x] By hand: a session asked a question about results after finishing dispatches a `single` rather than reading files in the main loop

**By-hand evidence (2026-11-27, session_016jSC3fsMfuGLacrVjUTYMU, plugin 0.5.0+eaf50f7)**

Pending: the user's question about results arrives after this session's dispatches finish (after the final reply), so the `single` that answers it has not happened yet. Box left unticked until that dispatch and its trace line are recorded.
Question from the owner session at 23:56:14Z, after finish: how many tests cover reverse_words, and the exact reason w4-d1 kept T2 UNVERIFIED. The orchestrator did no reads itself and dispatched w7-d1 (single, returns.maxLines 6, run wf_c7e6716f-7fb; trace line wave 7, 23:56:34Z-23:57:02Z).
w7-d1 returned 0 tests (no reverse_words in the repo, grep count 0) and that w4-d1's trace line holds no reason; the reason came from state (P5 CANNOT RUN, pypy3.10 not installed). Answer sent ~23:58Z. Every part of the observable holds; box ticked.
