---
status: accepted
---
# Workflow names `<Topology>: <title>`, agent labels `<role> (n of m): <task>`

ADR-0003 named each dispatch's workflow for its purpose (the spec's `title`) and cut agent labels down to the role and its position (`Generator · round 1 of 3`, `Branch 2 of 4 — <sub-task>`, `Attempt 2 of 3`). The topology was never shown, the counter word changed with the topology (branch, attempt, session), and an agent's task appeared only for fan-out branches.

The topology now leads the workflow's name, and every agent label has one shape:

```
workflow:  <Topology>: <title>                  Fan-out: Map trace file access
agent:     <role> (n of m): <task>              Worker (2 of 4): parse headers
chain:     Stage <n> · <Topology>, <role> (n of m): <task>
```

- **Workflow name**: written by the orchestrator in the wrapper's `meta.name` (it must be a literal). The topology is title-cased: `Single`, `Generator-evaluator`, `Fan-out`, `Chain`, `Relay`, `Best-of-n`, `Iterative fan-out`, `Panel`, `Debate`.
- **role**: `Worker`, `Generator`, `Evaluator`, `Partition`, `Reducer`, `Judge`, `Debater`, `Trace scribe`, followed by the name of a debater or panel lens.
- **(n of m)**: this agent among the instances of its role in the dispatch: a generator-evaluator round, a fan-out branch, a best-of-n attempt, a relay session, a panel lens, or a relay done-check (`check k of ⌈sessions / check_every⌉`). It is left out when only one instance is configured. When a role has a second axis, that axis is named: `Debater pro (round 1 of 2)`, or `Worker (round 2 of 3, 1 of 2)` in an iterative fan-out.
- **task**: what the agent itself is doing: a branch's own sub-task, otherwise the dispatch's (or chain stage's) task. It is one line, at most 40 characters, ending in `…` when cut. The scribe's task is `<id> trace lines`.
- **Chain stages**: a chain's workflow name says only `Chain`, and each stage runs its own topology, so a stage agent's label names its stage and that topology: `Stage 2 · Generator-evaluator, Generator (1 of 2): write it up`. Nested stages are dotted (`Stage 3.1 · …`). Outside a chain the topology is never repeated in a label.

## Consequences

- This replaces ADR-0003's wrapper `name: '<title>'` and its label bullet; the rest of ADR-0003 stands.
- `Branch`, `Attempt` and `Session` are gone from labels; the workflow's topology says which kind of instance a `Worker (n of m)` is.
- Tests key fake agent outputs by label substrings (`"Worker (1 of 3)"`, `"w1-d3 Judge"`). `test/helpers.ts` gains `roleOf(label)`, which strips the task (and a chain stage's prefix), and `roles()`, which lists every call's role and position.
