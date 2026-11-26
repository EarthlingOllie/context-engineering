---
status: accepted
---
# Dispatch evals run the real Claude Code engine through Inspect, against the untouched plugin

The session analysis of 2026-11-18 found 27 issues, most of them about cost and reliability. Fixing them needs a baseline to measure against. The evals run under Inspect AI, and two choices in how they run would puzzle a later reader.

**Each role runs on the real Claude Code engine, not a light custom agent loop.** The eval harness loads the shipped `workflows/dispatch.js` the way the Workflow harness does and supplies a real `Runtime`. Its `agent` starts a version-pinned Claude Code engine (the Claude Agent SDK) inside an Inspect Docker sandbox, and every model call goes through Inspect's sandbox agent bridge.

A minimal loop with a few tools would be cheaper and simpler. It was rejected because:

- a real role carries Claude Code's fixed context (about 150k tokens even on a trivial dispatch, finding COST-02), and that floor is a large part of the cost the evals exist to measure;
- dispatch specs name skills for roles, and only the real engine loads them;
- cache writes are 55.9% of observed spend, and only the real engine reproduces the caching pattern.

**The baseline measures the plugin as shipped, from outside.** Token usage comes from the Inspect log, timings from the harness, statuses from the existing trace files. No logging is added to the plugin first. Instrumenting the plugin would have made scoring simpler, but the baseline would then no longer be v0.3 as the 20 analysed sessions ran it. Instrumentation is a later change, measured like any other fix.

## Consequences

- The bridge only routes model names declared to it in advance; any other name is silently served by the eval's main model. The suite must declare every model a role may request, or a per-role model fix (COST-01) would show no saving.
- Inspect does not log the engine's own tool runs. Process scoring reads the trace files and the sandbox's file state, never the Inspect transcript.
- The engine version, Inspect version and model id are pinned and recorded in every scorecard. A version bump needs a fresh baseline.
- Findings owned by the harness or platform (the scriptPath refusal, subagent write refusals, container restarts) do not reproduce in a sandbox. They are out of the suite's scope and are verified by hand in a cloud session.
- Evals are slow and cost real money per run (a $30 routine budget for the dispatch suite), so the deterministic tests under `test/` stay the first line of defence.
