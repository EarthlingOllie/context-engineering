# End-to-end findings — graph orchestrator v0.1

Three use cases (see `use-cases.md`) driven through the real Workflow runtime on a 4-CPU cloud session (effective cap 2), one wave per Workflow call, following `SKILL.md` as the orchestrator. Each directory holds the trace, the rendered diagram, the final state file and the main artifact.

| run | waves | agents | wall clock | statuses seen | outcome |
|---|---|---|---|---|---|
| UC1 build with review loop | 2 | 7 | ~5 min | done | CLI, 8 tests, idempotent, README accurate (verified independently) |
| UC2 wide research | 2 | 12 | ~21 min | done | 33 cited inconsistencies across the orchestrator documents |
| UC3 control flow | 3 | 10 | ~3 min + human time | done, blocked, exhausted, failed | stopped at the wave budget with the tag one commit behind the changelog |

## What held

- **Review loops stay inside the dispatch.** UC1's generator-evaluator and the chain's review stage each returned a path and PASS; the orchestrator never saw a round.
- **Fan-out with a partition instruction.** The partition agent split into the five requested branches; the reducer merged them and the single ran alongside. Nine agents through a cap of two took fifteen minutes: slow, not broken, as ADR-0002 says.
- **Blocked is clean.** The changelog generator stopped before writing anything, returned one question, and the evaluator was not spent. The answer travelled in `context` with `dependsOn` on the blocked id and the re-dispatch finished in one round.
- **Both always-ask triggers worked as prose.** The tag was asked about before dispatch (trigger 4) and the blocked question reached the human (trigger 2); both are `human` lines in the trace and nodes in the diagram.
- **Exhausted carries the evidence.** The evaluator's mechanical counts came back in the exhausted result's feedback line, enough to decide without opening the file.
- **The same-wave short-circuit (C9) ran live.** The verification dispatch depending on the exhausted one came back `failed` with zero iterations and no agent spent.
- **The renderer survives a real session.** Nested chain, cross-wave edges, four interventions, per-wave counts.

## What to change or watch

1. **Pass criteria must be mechanical.** In UC3 wave 2 the criteria "every commit as one entry, under 10 lines" were contradictory; the generator packed nineteen SHAs onto three semicolon-separated lines and the evaluator accepted that reading. Restated as "exactly one SHA per line", the loop behaved. The catalog should say: write `pass_criteria` as checks an evaluator can count, not as intent.
2. **"Gap" drifted.** The UC2 reducer reported "12 gaps (no branch was blocked)", using the word for unverifiable items rather than blocked branches. The reducer stance should define the word or use "blocked branch".
3. **A renderer imprecision, fixed in this commit.** The dotted "resumed after" edge was drawn from a later intervention to a same-wave dispatch that had already run. Edges now only reach dispatches that follow the intervention in the trace; UC3's trace is the fixture.
4. **The spec itself has contradictions.** UC2's report (`uc2/report.md`) is worth reading: for instance `spec.md:76` says blocked results are handled by "ask or guess" while the trigger table, the glossary and the skill say blocked always asks; and the spec uses "pattern" and "prompt" against the glossary's own avoid-lists.
5. **Not exercised live** (unit-tested only): `over_budget`, a scribe failure, every branch blocked, a reducer returning nothing, and debate (unbuilt by design).
