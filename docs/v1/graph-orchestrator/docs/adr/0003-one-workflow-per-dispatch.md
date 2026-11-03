---
status: accepted
---
# One Workflow run per dispatch, named for its purpose

ADR-0002 put a whole wave into one Workflow run: `wave.js` took every dispatch spec of the wave and ran them in parallel inside that run. Whoever watched saw one workflow called `wave`, with each dispatch's agents told apart only by long labels ("Wave 1 · d2 Generator, round 1 of 3 — Add a retry policy to…").

We now run each dispatch as its own Workflow run. The orchestrator launches all of a wave's dispatches in one message, one `Workflow` call each, so they run in parallel, and integrates once every one has reported. Each call is a two-line inline wrapper:

```
export const meta = { name: '<title>', description: '<id> · <topology>' }
return await workflow({ scriptPath: '<plugin root>/workflows/dispatch.js' }, args)
```

A workflow's displayed name is its `meta.name`, which must be a literal, so naming each run for its goal needs a script per dispatch. The wrapper costs the orchestrator two lines, where pasting the 60 KB bundle would cost its window. The topology code stays in one built file, `dispatch.js`, reached through the nested `workflow()` call. The spec gains a `title`: two to six plain words saying what the dispatch is for. It is the workflow's name and the first line of the dispatch's node in the diagram.

## Consequences

- Watching a wave shows its goals: "Wave 1 dispatched" and one workflow per task, each with its own name.
- Agent labels drop everything the workflow's name already says: no wave, no dispatch id, no task excerpt. A label is the role and its position: `Generator · round 1 of 3`, `Branch 2 of 4 — <its own sub-task>`, `Attempt 2 of 3`, `Stage 2 · Worker`, `Trace scribe`. Agents no longer get a phase. (Labels superseded by ADR-0004: `<topology>, <role> (n of m): <task>`.)
- Dispatches in one wave cannot wait on each other. `dependsOn` names earlier waves only; a same-wave id makes the dispatch `failed` unrun, and ordered steps within a wave are a `chain`. ADR-0002's same-wave waiting is gone.
- Each run has its own scribe and writes its own trace file, `<scratch>/trace/<id>.jsonl`, so parallel runs never append to the same file. The renderer reads the directory in dispatch order (wave, then dispatch number). There are no `wave_start` or `wave_end` lines. A wave's time comes from its dispatch lines and its status counts from their statuses. The renderer still reads v0.2 single-file traces.
- The 1,000-agent limit is checked per dispatch (its demand plus the scribe), not summed across a wave. Each run has its own concurrency cap, so a wide wave's agents may run more at once than under ADR-0002.
- One scribe agent per dispatch, not per wave.
- Interventions since the last wave travel in the `humans` args of the next wave's first dispatch.

## To verify in a live session

These rest on the Workflow tool's documented behaviour; no live session has run them yet:

- Several `Workflow` calls in one message run concurrently, and each notifies on completion.
- An inline `script` wrapper may call `workflow({ scriptPath })` on a plugin file, and the child's return comes back as the wrapper's.
- A `meta.name` with spaces and capitals is accepted and shown as written.
