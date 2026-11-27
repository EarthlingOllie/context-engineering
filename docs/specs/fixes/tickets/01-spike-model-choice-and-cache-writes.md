# 01: Spike: model choice on agent(), and the cause of cache writes

**What to build:** In a real cloud session, establish whether a Workflow script can choose an agent's model and whether the agent then runs on it. This decides whether ticket 07 ships. Also fetch per-call usage for three remote coding agents and record whether cache writes follow tool calls that outlast the cache lifetime (COST-03's measurement). Ships nothing.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Whether `agent()` accepts a model choice, and the model that served the call, recorded with run ids
- [ ] A one-line recommendation for ticket 07: build or drop
- [ ] Per-call usage (input, output, cache-read, cache-write tokens, timestamps) for three remote coding agents, recorded with how it was fetched
- [ ] A finding on whether cache writes cluster after tool calls longer than the cache lifetime; no platform ask is filed
