# Roadmap

Work that has been discussed but is not covered by a spec and tickets yet, in priority order. Covered work is not repeated here:

- **Dispatch evals and the baseline**: `docs/specs/dispatch-evals/` (spec and 12 tickets).
- **Execution and lifecycle (Group 1)**: `docs/specs/execution-lifecycle/` (spec and 6 tickets).
- **Fixes (Groups 2, 3, 4)**: `docs/specs/fixes/` (spec and 16 tickets), release 0.4.0. Its ranks (1, 2, 3, 4, 8, 9, 10, 12, and rank 11's measurement) and findings left this roadmap with that release, and the remaining ranks were renumbered; the old numbers are mapped under the groups below.
- **Observability and evals (Group 5: ranks 1, 2, 3, 8; QUA-08, REL-07)**: `docs/specs/observability-evals/` (spec and 12 tickets), release 0.5.0. Its spec names these ranks 5, 7 and 16 (with old rank 6 holding QUA-08 and REL-07), their numbers before 0.4.0. They left this roadmap with that release, and the remaining ranks were renumbered again; both mappings are under the groups below. Ranks 13, 14, 15, 17, 18 and 19 of the spec's numbering stay open here as ranks 2 to 7.

Finding ids (REL-01, QUA-04 and so on) refer to the session analysis in `docs/v1/graph-orchestrator/session-analysis-2026-11-18/findings.md`, which holds the evidence, the proposed change and the file and line for each.

**How the order was set.** Fixes the dispatch evals can measure wait for the baseline, so their effect can be shown. Fixes they cannot measure (orchestrator behaviour, and anything owned by the harness or platform) do not gain from waiting, so the small P0 ones come first.

| Rank | Item | Why it matters | Size | Waits for | Measured by |
|---|---|---|---|---|---|
| 1 | **Cache-write platform ask** (COST-03). The fixes spike (`docs/specs/fixes/tickets/01-spike-model-choice-and-cache-writes.md`) measures per-call usage on a few coding agents to confirm the cause; if it does, ask the platform for a longer cache lifetime for workflow agents. | The largest cost line: 55.9% of spend. | L | The fixes spike's live run | Dispatch evals, then a platform ask |
| 2 | **A run-verification skill** (new spec). | Agreed as a later spec while scoping the dispatch evals; its design has not been discussed yet. | ? | Dispatch evals done | n/a |
| 3 | **Skill evals** (new spec). Evaluate the skills in this repo themselves, with skills and the plugin installed from this one marketplace. | The skills shape every role's work but are not measured. | L | Dispatch evals done | n/a |
| 4 | **Comparison arm.** Run the same tasks on plain Claude Code and on `lead-orchestrator`. | Shows whether the plugin is worth its overhead, not only whether a fix helps. | M | Session evals (`docs/specs/observability-evals/`) | Session evals |
| 5 | **Set up an issue tracker for specs and tickets** (`/setup-matt-pocock-skills`), then publish the dispatch-evals spec and tickets there. | Specs and tickets are repo files only for now. | S | Nothing | n/a |
| 6 | **A model grader for prose results.** | Only if the planted-fact checks prove too blunt for research dispatches. | M | Baseline | n/a |
| 7 | **Close the gaps in the session analysis**: sessions eLKq and gFUT were only partly checked, and the early waves of d6Vc and dKG5 are known at ticket level only. | Low value: nothing found so far, and gFUT predates the plugin. | S | Nothing | n/a |

## Groups

The same work, grouped by goal and dependency rather than ranked. Every rank, and every finding the roadmap still holds, appears exactly once. Group 1 (execution and lifecycle) is covered by `docs/specs/execution-lifecycle/`, Groups 2 (verification integrity) and 4 (orchestrator behaviour), with most of Group 3, by `docs/specs/fixes/`, and the first part of Group 5 by `docs/specs/observability-evals/`; the covered work is no longer listed. Ranks stay the order of work; groups say what belongs together.

| Group | Goal | Items | Measured by |
|---|---|---|---|
| **3. Cost** | Spend less per dispatch without bringing back false passes. | Rank 1 | Dispatch evals |
| **5. Observability and evals** | Every run is recorded truthfully and can be measured cheaply. | Ranks 2, 3, 4, 5, 6, 7 | n/a (this is the measuring) |

**Notes per group.**
- **Cost.** Rank 1 needs the fixes spike's per-call usage; the per-agent usage on dispatch lines that 0.5.0 ships (output tokens only, where readable) helps confirm the cause.
- **Observability and evals.** The session evals that `docs/specs/observability-evals/` builds are the hub: they re-measure the orchestrator rules shipped in 0.4.0 and gate rank 4. Rank 2 has no design yet, so its place is provisional. Rank 5 is a process chore that fits no group well.

**Links across groups.**
- Rank 1 (group 3) ties to the instrumentation shipped in 0.5.0: per-call usage is the evidence for the platform ask.

**Rank numbers before 0.5.0.** Specs written between 0.4.0 and 0.5.0 use these. Old 4 is now 1, 5 is 2, 6 is 3, 7 is 4, 9 is 5, 10 is 6 and 11 is 7. Old ranks 1, 2, 3 and 8 are covered by `docs/specs/observability-evals/`.

**Rank numbers before 0.4.0.** Specs written earlier use these. Old 5 is now 1, 6 is 2, 7 is 3, 11 is 4 (its measurement shipped in 0.4.0; the platform ask stays), 13 is 5, 14 is 6, 15 is 7, 16 is 8, 17 is 9, 18 is 10 and 19 is 11. Old ranks 1, 2, 3, 4, 8, 9, 10 and 12 are covered by `docs/specs/fixes/`. Through the 0.5.0 renumbering above, old 11 is now 1, 13 is 2, 14 is 3, 15 is 4, 17 is 5, 18 is 6 and 19 is 7; old 5, 6, 7 and 16 are covered by `docs/specs/observability-evals/`.
