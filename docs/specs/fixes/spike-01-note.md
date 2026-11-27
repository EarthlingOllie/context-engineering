# Ticket 01 spike: model choice on agent(), and the cause of cache writes

**Verdict: BUILD (Part 1 run 2026-11-27, Workflow run wf_80d0ef6f-bd7; Part 2 partly recorded 2026-11-27).** `agent()` accepts a `model` option and the agent is served by it; ticket 07 is go.

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
| probe-default | wf_80d0ef6f-bd7 / agent af977ef26e1f9acde | yes | claude-opus-5-5 (session model) | assistant event a45d7912-8e45-4bb4-a3c2-6934fc2d8700 |
| probe-haiku | wf_80d0ef6f-bd7 / agent a0fea1392e87580ad | yes | claude-haiku-5-5 | assistant event 9bfa3828-728d-444c-a5a7-2dc6623b228a |
| probe-bogus | wf_80d0ef6f-bd7 / agent a4b3c1156c8353946 | no: agent failed, `agent()` returned `null` (not a throw); runtime error "There's an issue with the selected model (claude-undeclared-spike). It may not exist or you may not have access to it." | none (`<synthetic>` error message) | assistant event bc1ec116-be32-48cf-8747-8d87854dcf0d |

Served models read from each agent's transcript (`subagents/workflows/wf_80d0ef6f-bd7/agent-<id>.jsonl`, assistant `message.model`), not from the agents' replies. Note: an unknown model does not throw in the script; the call yields `null`, so callers must treat `null` as failure.

**Recommendation for ticket 07:** **build** — probe-haiku was served by claude-haiku-5-5 and probe-default by the session model.

## Part 2: do cache writes follow tool calls that outlast the cache lifetime?

Choose three remote coding agents that ran long test suites (the coding sessions in `session-analysis-2026-11-18/sessions-inventory.md`, such as d6Vc and eznd, are candidates). For each one, page its assistant events with `list_events` (`kinds: ["assistant"]`) and read each event's `usage` with `get_event`. Record how the usage was fetched, including any field that was missing.

For each API call, record input, output, cache-read and cache-write tokens and the timestamp. Then take the gap since the previous call: a gap over 5 minutes means the tool call in between outlasted the subagent cache lifetime. Compare cache writes on calls after a long gap with writes on calls after a short gap.

| Agent (session, agent id) | How fetched | Calls | Calls after a >5 min gap | Mean cache write after a long gap | Mean cache write after a short gap |
|---|---|---|---|---|---|
| eznd orchestrator (session_016jSC3ezndKqpWLvw6rubcK) | `list_events` kinds assistant; usage on each event (`message.usage`, incl. 1h/5m split, `cache_miss_reason`); no `get_event` needed | 8 | 1 (2h57m) | 249,301 | 829 (6 calls; a 19-min gap wrote 420) |
| efwY orchestrator (session_016jSC3efwYsrqKGWpoahfXf) | same | 2 | 1 (13h48m) | 144,843 | 1,622 (1 call) |
| d6Vc whole session (session_016jSC3d6VcueRR7JYyZJPGP) | `/usage` event aggregate only (subagent per-call rows are not in the parent's events) | 33,335 requests / 7d | n/a | n/a | n/a: 269.0M of 274.1M write tokens (98.1%) on the 5m TTL |
| w15 worker (this session, a56b2a0c6d4cfeb18) | local transcript `subagents/workflows/wf_beb741d7-051/agent-<id>.jsonl` (`list_events` cannot reach subagent per-call rows); `message.usage` on each assistant event, deduped to one row per `message.id`; 5m/1h split present | 71 | 12 (551-609 s) | 144,292 | 1,747 (58 calls; max 14,269) |
| w15 worker (this session, a94d5e4a450733de2) | same | 26 | 1 (435 s) | 96,655 | 1,584 (24 calls; max 3,975) |
| w15 worker (this session, a794523fd390e2a55) | same | 16 | 0 (max gap 34 s) | n/a | 3,015 (15 calls; max 10,999) |

Keep the per-call rows (input, output, cache-read, cache-write, timestamp, gap) in a CSV next to this note, named `spike-01-usage.csv`. (2026-11-27: written; 113 calls from the three Workflow subagents above, the three of six w15 workers with the longest gaps between assistant messages, extracted by script from their local transcripts. Columns: agent, message_id, model, timestamp, gap_s, input, output, cache-read, cache-write, cache_write_5m, cache_write_1h. The first call of each agent has no gap.)

**Finding (2026-11-27, per call):** yes, cache writes follow gaps longer than the 5-minute cache lifetime. In the Workflow subagents every cache write is on the 5m TTL (1h writes: 0). All 13 calls after a >5 min gap rewrote the whole context (70k-165k tokens; 12 of 13 read 0 from cache), mean 144,292 and 96,655, against 1,584-3,015 mean after short gaps; no short-gap call wrote more than 14,269. This confirms COST-03's 5-minute hypothesis per call for subagents (113 calls, 3 agents of one wave; one agent had no long gap). The orchestrator thread, on the 1h TTL, shows the same pattern only after >1h gaps (earlier partial finding: 145k-249k rewrites after 2h57m and 13h48m). This spec files no platform ask either way.
