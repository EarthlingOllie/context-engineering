# 13: Acceptance dispatch at finish

**What to build:** Per-ticket passes cannot add up to a failing spec. If the task is a spec or ticket set, the last wave before rendering is one acceptance dispatch (panel or single) that checks the spec's own acceptance criteria end to end, with countable criteria. QUA-01 part 2.

**Blocked by:** 03 (Countable pass criteria)

**Status:** ready-for-agent

- [x] SKILL.md's Finish section documents the acceptance dispatch (docs seam)
- [x] By hand: a ticket-set session ends with an acceptance dispatch whose criteria are the spec's acceptance criteria

**By-hand evidence (2026-11-27, session_016jSC3fsMfuGLacrVjUTYMU, plugin 0.5.0+eaf50f7)**

Last wave before rendering (wave 5) held exactly one dispatch: w5-d1 "Accept the toy spec end to end" (single, run wf_d3703b99-f3c, 23:51:09Z-23:51:58Z); diagram rendered after it (23:52Z).
Its criteria were the toy spec's numbered acceptance criteria A1-A5 plus R1 (full toy suite) and R2 (`npm test`, repo regression suite). Result: A1 CANNOT RUN (T2 P5 pypy), A2-A5 PASS, R1 11 tests PASS, R2 323 pass 0 fail; ended blocked on A1, recorded UNVERIFIED.
