# 10: Rolling launches and the dependsOn pre-launch check

**What to build:** Ready work no longer idles at the wave barrier. When a dispatch returns and a FRONTIER item depends only on finished dispatches, it may launch at once as the next wave number; the state file is rewritten before each launch; wave budgets count launches. Before launching, every `dependsOn` id must be in a lower-numbered wave, else the dispatch moves to the next wave or the pair becomes one chain; `dependsOn` is never cleared. SPD-01 and REL-06 (ADR-0006).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] SKILL.md documents the rolling launch, the state-file rewrite, budgets counting launches, the pre-launch check and never clearing `dependsOn` (docs seam)
- [x] No document still says a wave is waited on in full before planning again (docs seam)
- [x] ADR-0006's status is accepted
- [ ] By hand in a cloud session: a dispatch depending only on a finished dispatch launches before its wave's slow dispatch returns, with its `dependsOn` kept
