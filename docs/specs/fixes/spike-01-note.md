# Ticket 01 spike: model choice on agent(), and the cause of cache writes

**Verdict: PENDING.** Every acceptance item needs a live cloud session, so none is recorded yet. This note holds the probe and the empty result tables. Whoever runs it in a cloud session fills the tables, sets the verdict, and ticks the ticket's boxes.

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
| | | | | | |
| | | | | | |
| | | | | | |

Keep the per-call rows (input, output, cache-read, cache-write, timestamp, gap) in a CSV next to this note, named `spike-01-usage.csv`.

**Finding:** _fill in: whether cache writes cluster after tool calls longer than the cache lifetime, with the numbers above._ This spec files no platform ask either way.
