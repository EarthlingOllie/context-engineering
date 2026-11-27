# Ticket 01 spike: model choice on agent(), and the cause of cache writes

**Verdict: PENDING (Part 1 not run; Part 2 partly recorded 2026-11-27).** Part 1 needs a Workflow launch from a top-level cloud session; the 2026-11-27 attempt ran in a subagent without the Workflow tool, so no run ids exist and ticket 07 stays build-or-drop unknown. This note holds the probe and the empty result tables. Whoever runs it in a cloud session fills the tables, sets the verdict, and ticks the ticket's boxes.

What is known from disk (2026-11-27):
- `AgentOptions` in `graph-orchestrator/src/types.ts` has `label`, `phase`, `schema` and `effort`, and no `model`. Today nothing in the plugin passes a model.
- COST-03 (`docs/v1/graph-orchestrator/session-analysis-2026-11-18/findings.md`) puts cache writes at 55.9% of session dollars. It infers the cause, tool calls that outlast the 5-minute subagent cache lifetime, from token ratios. No per-call data backs it yet.

## Part 1: does agent() accept a model, and does the agent run on it?

Run in a cloud session. Paste this as a Workflow tool script:

```js
export const meta = { name: 'spike-model-choice', description: 'Ticket 01 spike: does agent() honour a model option' }
export default async function (rt) {
  const ask = 'Reply with the single word ok. Use no tools.'
  const plain = await rt.agent(ask, { label: 'probe-default' })
  const haiku = await rt.agent(ask, { label: 'probe-haiku', model: 'haiku' })
  const bogus = await rt.agent(ask, { label: 'probe-bogus', model: 'claude-undeclared-spike' })
  return { plain, haiku, bogus }
}
```

Then, for each of the three agents, take the served model from its transcript events (the assistant message's `model` field, read with `list_events` / `get_event`). An agent's own claim about its model does not count as evidence. Record the run id for each call.

Pass: the `probe-haiku` call runs and is served by a Haiku model, and `probe-default` is served by the session model. If the option is rejected, silently ignored (Haiku call served by the session model), or the run errors, the spike fails.

| Call | Run id | Accepted? (error text if not) | Served model | Evidence (event id) |
|---|---|---|---|---|
| probe-default | | | | |
| probe-haiku | | | | |
| probe-bogus | | | | |

**Recommendation for ticket 07:** _fill in one line: "build" if probe-haiku passes, else "drop" (model routing and scribe-on-Haiku leave the spec)._

## Part 2: do cache writes follow tool calls that outlast the cache lifetime?

Choose three remote coding agents that ran long test suites (the coding sessions in `session-analysis-2026-11-18/sessions-inventory.md`, such as d6Vc and eznd, are candidates). For each one, page its assistant events with `list_events` (`kinds: ["assistant"]`) and read each event's `usage` with `get_event`. Record how the usage was fetched, including any field that was missing.

For each API call, record input, output, cache-read and cache-write tokens and the timestamp. Then take the gap since the previous call: a gap over 5 minutes means the tool call in between outlasted the subagent cache lifetime. Compare cache writes on calls after a long gap with writes on calls after a short gap.

| Agent (session, agent id) | How fetched | Calls | Calls after a >5 min gap | Mean cache write after a long gap | Mean cache write after a short gap |
|---|---|---|---|---|---|
| eznd orchestrator (session_016jSC3ezndKqpWLvw6rubcK) | `list_events` kinds assistant; usage on each event (`message.usage`, incl. 1h/5m split, `cache_miss_reason`); no `get_event` needed | 8 | 1 (2h57m) | 249,301 | 829 (6 calls; a 19-min gap wrote 420) |
| efwY orchestrator (session_016jSC3efwYsrqKGWpoahfXf) | same | 2 | 1 (13h48m) | 144,843 | 1,622 (1 call) |
| d6Vc whole session (session_016jSC3d6VcueRR7JYyZJPGP) | `/usage` event aggregate only (subagent per-call rows are not in the parent's events) | 33,335 requests / 7d | n/a | n/a | n/a: 269.0M of 274.1M write tokens (98.1%) on the 5m TTL |

Keep the per-call rows (input, output, cache-read, cache-write, timestamp, gap) in a CSV next to this note, named `spike-01-usage.csv`. (2026-11-27: not written; only 10 orchestrator calls were reachable, and Workflow-subagent calls do not appear in `list_events`. Missing field: per-call usage of subagents.)

**Finding (2026-11-27, partial):** cache writes do cluster after gaps longer than the cache lifetime: both >1h gaps rewrote the whole context (145k-249k tokens, `cache_miss_reason: previous_message_not_found`), while short-gap calls wrote 285-2,068 tokens. But the orchestrator thread caches on the 1h TTL, not 5m (a 19-minute gap still read 315k from cache). The 5m TTL belongs to Workflow subagents, which carry 98.1% of d6Vc's cache-write tokens, and their per-call rows are not reachable this way, so COST-03's 5-minute hypothesis is consistent but not proven per call. Small sample (10 calls). This spec files no platform ask either way.
