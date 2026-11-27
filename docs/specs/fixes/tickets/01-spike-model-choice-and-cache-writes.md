# 01: Spike: model choice on agent(), and the cause of cache writes

**What to build:** In a real cloud session, establish whether a Workflow script can choose an agent's model and whether the agent then runs on it. This decides whether ticket 07 ships. Also fetch per-call usage for three remote coding agents and record whether cache writes follow tool calls that outlast the cache lifetime (COST-03's measurement). Ships nothing.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Whether `agent()` accepts a model choice, and the model that served the call, recorded with run ids
- [x] A one-line recommendation for ticket 07: build or drop
- [x] Per-call usage (input, output, cache-read, cache-write tokens, timestamps) for three remote coding agents, recorded with how it was fetched
- [x] A finding on whether cache writes cluster after tool calls longer than the cache lifetime; no platform ask is filed

## Run 2026-11-27

Part 2 partly recorded in `../spike-01-note.md` (10 orchestrator calls from 2 sessions plus one session aggregate; subagent per-call usage not reachable, so box 3 stays open). Part 1 not run (no Workflow tool in the running agent), so **ticket 07: unknown, neither build nor drop yet**; run spike-01 Part 1 from a top-level cloud session.

Box 3 done 2026-11-27: per-call rows for three Workflow subagents (w15 workers, 113 calls) read from local transcripts into `../spike-01-usage.csv`; see Part 2 of `../spike-01-note.md`.
