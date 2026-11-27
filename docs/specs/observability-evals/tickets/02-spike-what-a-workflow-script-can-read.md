# 02: Spike: what a Workflow script can read

**What to build:** Establish which per-agent figures (tokens by type, model, duration, queue time, tool calls) a Workflow script can read from an agent call's return or the runtime, and whether it can read the clock. Decides the fields of tickets 04 and 05. Ships nothing.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Each figure recorded as readable or not, with how, from a live run
- [ ] Whether a script can read the clock
- [ ] A recommendation for tickets 04 and 05

## Findings (2026-11-27, from the Workflow script API reference; live confirmation pending)

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
