# 01: Spike: launch, resume and usage-limit behaviour

**What to build:** Recorded answers, from a real cloud session, to the questions the launch and resume work rests on. Ships nothing; the findings go in this ticket under a Findings heading.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Launching by the registered workflow name `graph-orchestrator:dispatch` from a two-line wrapper: does the workflow show the wrapper's `meta.name`, and does the dispatch's return come back as the wrapper's? Answer recorded, with the workflow name as displayed
- [ ] The full error text of a usage-limit agent failure, and whether it carries a reset time (best-effort: from past session transcripts, or a limit met in passing); recorded verbatim, or "not found" with where was looked
- [ ] Whether the harness resumes a session by itself when a usage limit resets, or waits for the human; recorded, or "not observed"
- [ ] Whether the orchestrator can still take a turn once its agents are limited; recorded, or "not observed"
- [ ] Relaunching an already finished run with `resumeFromRunId`: wall clock to return and whether every agent replayed from cache, measured on at least one generator-evaluator run. If it takes more than about a minute or reruns agents, flag that the resume rule (ticket 04) must be rethought
- [ ] Whether a running dispatch script can learn its own run id; recorded, with how
- [ ] A one-line recommendation for ticket 03 (registered name or scratch copy) and for ticket 04 (run id in the trace or not)
