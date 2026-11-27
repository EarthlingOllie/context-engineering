# 07: Refusal counts and the WAITING line

**What to build:** Refusals and idle time are visible without reading transcripts. Working and evaluator stances ask the agent to report how many writes were refused and tools denied, as part of its structured output, and the count reaches the dispatch line. SKILL.md: while waiting on a human, CI or a restart, the state file holds one `WAITING: <cause> since <time>` line, removed when the wait ends.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Dispatch seam: refusal counts returned by scripted agents appear on the dispatch line
- [x] Docs seam: SKILL.md documents the WAITING line
- [ ] Its own dispatch-eval run against the frozen baseline: every sample's pass rate stays within its spread (paid run: left to a human)

## Dispatch-eval run (2026-11-27, claude-opus-5-5, 3 epochs, cap 2, vs frozen baseline 3035a58f6828 (5 epochs); same-day baseline rerun reproduced it)

Scorecard: `graph-orchestrator/evals/out/scorecards/97f1a6b416d4-20261127T150246Z.json` (local, gitignored; archived with its compare.py output and .eval logs outside the repo).

**Partial: 2 valid epochs of 3** (credit ran out in epoch 3). On the 2 valid epochs every sample's pass rate holds. Dollar flags: sample 01 +$0.046 (band $0.044) and sample 11 +$0.174 (band $0.132), both cache-write driven (01: 18k vs ~1k cache-write tokens, output flat). Re-run epoch 3 after a credit top-up. Run cost $10.90.
