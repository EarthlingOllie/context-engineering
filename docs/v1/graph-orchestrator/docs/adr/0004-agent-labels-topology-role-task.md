---
status: accepted
---
# Agent labels: `<topology>, <role> (n of m): <task>`

ADR-0003 cut agent labels down to the role and its position (`Generator · round 1 of 3`, `Branch 2 of 4 — <sub-task>`, `Attempt 2 of 3`), on the grounds that the workflow's name already says what the dispatch is for. In practice the counter word changed with the topology (branch, attempt, session), the topology itself was never shown, and an agent's task appeared only for fan-out branches.

Every agent label now has one shape, formatted in `src/labels.ts`:

```
<topology>, <role> (n of m): <task>
```

- **topology**: the dispatch's topology, title-cased: `Single`, `Generator-evaluator`, `Fan-out`, `Relay`, `Best-of-n`, `Iterative fan-out`, `Panel`, `Debate`. A chain stage is prefixed with its stage: `Chain stage 2 · Single`, nested stages dotted (`Chain stage 3.1 · …`).
- **role**: `Worker`, `Generator`, `Evaluator`, `Partition`, `Reducer`, `Judge`, `Debater`, `Trace scribe`, followed by the name of a debater or panel lens.
- **(n of m)**: this agent among the instances of its role in the dispatch: a generator-evaluator round, a fan-out branch, a best-of-n attempt, a relay session, a panel lens, a relay done-check (`check k of ⌈sessions / check_every⌉`). It is left out when only one instance is configured. When a role has a second axis, that axis is named: `Debater pro (round 1 of 2)`, `Worker (round 2 of 3, 1 of 2)` in an iterative fan-out.
- **task**: what the agent itself is doing: a branch's own sub-task, otherwise the dispatch's (or chain stage's) task. One line, at most 40 characters, ending in `…` when cut. The scribe's task is `<id> trace lines`.

Examples: `Single, Worker: Add the HTTP retry policy`, `Fan-out, Worker (2 of 4): parse headers`, `Generator-evaluator, Evaluator (1 of 3): Add the HTTP retry…`, `Best-of-n, Judge: Pick the parser`, `Chain stage 2 · Generator-evaluator, Generator (1 of 2): write it up`, `Fan-out, Trace scribe: w1-d3 trace lines`.

## Consequences

- This replaces the label bullet in ADR-0003; the rest of ADR-0003 stands.
- Labels are longer, but the start of a label is always the topology and role, so agents sort and scan by role.
- `Branch`, `Attempt` and `Session` are gone from labels; the topology says which kind of instance a `Worker (n of m)` is.
- Tests key fake agent outputs by label substrings (`"Worker (1 of 3)"`, `"w1-d3 Best-of-n, Judge"`). `test/helpers.ts` gains `roleOf(label)`, which strips the topology and task, and `roles()`, which lists every call's role and position.
