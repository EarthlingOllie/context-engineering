# 09: Hooks are never answers; self interventions

**What to build:** No hook pushes on the user's behalf and the diagram never claims the user was consulted when they were not. SKILL.md's irreversible-action trigger says a hook message is never a human answer and never authorises an irreversible action; while a dispatch is running, a commit or push hook gets one line naming the dispatch that owns the tree; the main loop never runs `git add -A`. Hooks are recorded as a `hook` trace event, not an intervention. The renderer titles autonomous interventions `self` with a dashed class. SKILL.md says the mode question, status questions and hook messages are not interventions. QUA-04 and QUA-03.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Docs seam: the hook rule and the not-interventions list are in SKILL.md
- [x] Render seam: an autonomous intervention renders as `self · <trigger>` with the dashed class; an attended one as `human · <trigger>`; a `hook` event renders nothing
- [ ] By hand in a cloud session with a stop-hook git check: a hook firing mid-wave gets one line naming the running dispatch, and nothing is committed or pushed

**By-hand evidence (2026-11-27, session_016jSC3fsMfuGLacrVjUTYMU, plugin 0.5.0+eaf50f7)**

Not exercised: no Stop hook (or any hook) message reached the orchestrator at any point, although it ended its turn 5 times with dispatches running (w2-d2 ran ~11.5 min). The trace has no `hook` line, so there is nothing to check the one-line reply or the diagram against.
Box left unticked: no hook fired in this environment.
