# 10: Rolling launches and the dependsOn pre-launch check

**What to build:** Ready work no longer idles at the wave barrier. When a dispatch returns and a FRONTIER item depends only on finished dispatches, it may launch at once as the next wave number; the state file is rewritten before each launch; wave budgets count launches. Before launching, every `dependsOn` id must be in a lower-numbered wave, else the dispatch moves to the next wave or the pair becomes one chain; `dependsOn` is never cleared. SPD-01 and REL-06 (ADR-0006).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] SKILL.md documents the rolling launch, the state-file rewrite, budgets counting launches, the pre-launch check and never clearing `dependsOn` (docs seam)
- [x] No document still says a wave is waited on in full before planning again (docs seam)
- [x] ADR-0006's status is accepted
- [x] By hand in a cloud session: a dispatch depending only on a finished dispatch launches before its wave's slow dispatch returns, with its `dependsOn` kept

**By-hand evidence (2026-11-27, session_016jSC3fsMfuGLacrVjUTYMU, plugin 0.5.0+eaf50f7)**

Wave 2 launched T1 (w2-d1, run wf_4f5d5cfa-1ef) at 23:37:46Z and slow T2 (w2-d2, run wf_5a9148c5-8a9) at 23:37:53Z. T1 ended 23:39:08Z; T3 (w3-d1, run wf_38d61220-cf9, `dependsOn: ["w2-d1"]`) launched as wave 3 at 23:39:16Z while T2 was still running (T2 ended 23:49:26Z).
Pre-launch check held (w2-d1 in wave 2 < 3); T3's trace line keeps `"dependsOn":["w2-d1"]`; the orchestrator rewrote the state file with the w3-d1 line before launching it. Wave 2 itself also rolled on w1-d2 (ended 23:37:31Z) while w1-d1 was still running (ended 23:37:48Z).
