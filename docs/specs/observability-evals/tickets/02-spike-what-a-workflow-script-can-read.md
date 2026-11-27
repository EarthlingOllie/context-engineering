# 02: Spike: what a Workflow script can read

**What to build:** Establish which per-agent figures (tokens by type, model, duration, queue time, tool calls) a Workflow script can read from an agent call's return or the runtime, and whether it can read the clock. Decides the fields of tickets 04 and 05. Ships nothing.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Each figure recorded as readable or not, with how, from a live run
- [x] Whether a script can read the clock
- [x] A recommendation for tickets 04 and 05

## Findings (2026-11-27, from the Workflow script API reference; live-confirmed 2026-11-27, run wf_532dea6b-84f)

Source: the Workflow tool's script reference (workflow-authoring skill), checked against the engine's `Runtime` type in `src/types.ts`. No live run yet: the probe below records the same facts from a real session.

| figure | readable by the script? | how |
|--------|-------------------------|-----|
| tokens by type (input, output, cache read, cache write) | no | `agent()` returns the agent's final text, or the schema-validated object, or `null`. Nothing else. |
| output tokens, in total | partly | `budget.spent()` gives output tokens spent this turn across the main loop and every workflow. The pool is shared, so a before/after delta is one agent's output only when no other agent runs at once. No input or cache figures. |
| model | no | not on the return. The script knows only the `model` it passed. An agent can report its own model id in its output, but that is self-report. |
| duration | no | the script has no clock (next row). |
| queue time | no | the runtime queues past min(16, CPUs - 2) concurrent agents without saying so. |
| tool calls | no | not on the return. They sit in the agent's transcript (`agent-<id>.jsonl`), which the main session can read after the run and the script cannot. |

**Clock:** no. `Date.now()`, `Math.random()` and argless `new Date()` throw, because they would break resume. A script gets a time only from `args` (stamped by the orchestrator at launch) or from an agent that runs `date -u` and returns it. `new Date(<fixed value>)` is deterministic and expected to work, but tells no time.

**Recommendation:**
- Ticket 04: the script cannot stamp times. Keep the placeholder in the entry and have the scribe or worker, which has a shell, replace it with the UTC clock. Drop `now` from the launch args only after this is live-confirmed.
- Ticket 05: record agents needed and agents run at once, which the script computes itself. Record per-agent usage only as `output_tokens` from a `budget.spent()` delta, and only when the agent ran alone; otherwise leave it out. Leave out token types, model, duration, queue time and tool calls. If they are wanted, the main session reads them from the run's transcript directory after the workflow returns. That is a separate change.

**Probe:** `graph-orchestrator/evals/spike/workflow_read_probe.js`. Run it once in a live cloud session with `Workflow({scriptPath})` and paste its returned JSON here. It tries each clock global, reads `budget` around two sequential agents, and prints the type and keys of a plain and a schema `agent()` return. If its result contradicts a row above, fix the row and the recommendation before ticket 04 or 05 starts.


## Live run (2026-11-27, Workflow run wf_532dea6b-84f)

Confirms every row above; no row or recommendation changes.
- Clock: `Date.now()` and argless `new Date()` throw ("unavailable in workflow scripts (breaks resume)"); `performance` and `process` are not defined; `new Date(0)` works. `setTimeout` exists.
- `budget`: `total` null, `spent()` readable; deltas 244 (plain agent) and 168 (schema agent) output tokens, agents run one at a time.
- Returns: plain call → bare string `"ok"` (no keys); schema call → plain `Object` with only the schema keys (`utc`, `model`), no symbols or hidden usage fields.
- Self-reported model `claude-opus-5-5` matched the transcript; still self-report only.

```json
{
  "clock": [
    {
      "name": "Date.now()",
      "readable": false,
      "error": "Date.now() / new Date() are unavailable in workflow scripts (breaks resume). Stamp results after the workflow returns, or pass timestamps via args."
    },
    {
      "name": "new Date()",
      "readable": false,
      "error": "Date.now() / new Date() are unavailable in workflow scripts (breaks resume). Stamp results after the workflow returns, or pass timestamps via args."
    },
    {
      "name": "new Date(0)",
      "readable": true,
      "value": "1970-01-01T00:00:00.000Z"
    },
    {
      "name": "performance.now()",
      "readable": false,
      "error": "performance is not defined"
    },
    {
      "name": "process.hrtime",
      "readable": false,
      "error": "process is not defined"
    },
    {
      "name": "setTimeout",
      "readable": true,
      "value": "function"
    }
  ],
  "globals": {
    "name": "globals",
    "readable": true,
    "value": "(list of 76 names; notable: agent, args, budget, log, parallel, phase, pipeline, workflow, setTimeout, clearTimeout, console, Temporal; no process, performance, require, fetch)"
  },
  "budgetIn": {
    "name": "budget",
    "readable": true,
    "value": "{\"total\":null,\"spent\":670603}"
  },
  "spent": [
    {
      "name": "spent0",
      "readable": true,
      "value": "670603"
    },
    {
      "name": "spent1",
      "readable": true,
      "value": "670847"
    },
    {
      "name": "spent2",
      "readable": true,
      "value": "671015"
    }
  ],
  "plain": {
    "value": "ok",
    "type": "string",
    "keys": [],
    "proto": "",
    "symbols": []
  },
  "structured": {
    "value": {
      "utc": "2026-11-27T15:29:07Z",
      "model": "claude-opus-5-5"
    },
    "type": "object",
    "keys": [
      "utc",
      "model"
    ],
    "proto": "Object",
    "symbols": []
  }
}
```
