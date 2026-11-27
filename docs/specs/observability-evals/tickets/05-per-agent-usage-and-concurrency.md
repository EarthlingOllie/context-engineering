# 05: Per-agent usage and concurrency in trace lines

**What to build:** The next analysis needs no fitted cost model. Each dispatch line records, per agent, the role and every usage figure ticket 02 found readable (unreadable fields omitted, not zeroed), plus the agents the dispatch needed and the agents run at once.

**Blocked by:** 02 (Spike: what a Workflow script can read)

**Status:** ready-for-agent

- [ ] Dispatch seam: a dispatch line carries per-agent fields matching what the fake runtime returns, and demand and concurrency counts
- [ ] Render seam: old traces still render
- [ ] Dispatch evals: pass rates stay within the baseline spread and dollars do not rise beyond it
