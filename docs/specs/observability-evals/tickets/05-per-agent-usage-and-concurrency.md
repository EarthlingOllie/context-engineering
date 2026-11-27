# 05: Per-agent usage and concurrency in trace lines

**What to build:** The next analysis needs no fitted cost model. Each dispatch line records, per agent, the role and every usage figure ticket 02 found readable (unreadable fields omitted, not zeroed), plus the agents the dispatch needed and the agents run at once.

**Blocked by:** 02 (Spike: what a Workflow script can read)

**Status:** ready-for-agent

- [x] Dispatch seam: a dispatch line carries per-agent fields matching what the fake runtime returns, and demand and concurrency counts
- [x] Render seam: old traces still render
- [ ] Dispatch evals (HUMAN-TODO: paid run vs baseline): pass rates stay within the baseline spread and dollars do not rise beyond it

## Implementation (2026-11-27)

Per ticket 02, the only readable usage figure is output tokens from a `budget.spent()` delta. Each top-level dispatch line now has
`agents: [{ role, output_tokens? }]` (call order, scribe excluded; `output_tokens` only for an agent that ran alone in the dispatch
with a readable budget, else omitted), `demand` (agentDemand) and `concurrency` (most agents running at once). Chain stage lines
carry none; a `single` whose worker writes its own line records the worker's role without usage. The bundle passes the Workflow
`budget` global to the runtime when defined; the eval harness runtime offers `budget.spent()` summed from engine call usage, and
the stub engine takes `outputTokens`. Tests: test/agent-usage.test.ts, evals/harness/usage.test.ts.
