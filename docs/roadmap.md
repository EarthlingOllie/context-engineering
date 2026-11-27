# Roadmap

Work that has been discussed but is not covered by a spec and tickets yet, in priority order. Covered work is not repeated here:

- **Dispatch evals and the baseline**: `docs/specs/dispatch-evals/` (spec and 12 tickets).
- **Execution and lifecycle (Group 1)**: `docs/specs/execution-lifecycle/` (spec and 6 tickets).
- **Fixes (Groups 2, 3, 4)**: `docs/specs/fixes/` (spec and 16 tickets), release 0.4.0. Its ranks (1, 2, 3, 4, 8, 9, 10, 12, and rank 11's measurement) and findings left this roadmap with that release, and the remaining ranks were renumbered; the old numbers are mapped under the groups below.
- **Observability and evals (Group 5: ranks 1, 3, 8; QUA-08, REL-07)**: `docs/specs/observability-evals/` (spec and 12 tickets), release 0.5.0. Its spec names these ranks 5, 7 and 16, their numbers before 0.4.0. Ranks 5, 6, 7, 9, 10 and 11 remain open below, and so does rank 4.

Finding ids (REL-01, QUA-04 and so on) refer to the session analysis in `docs/v1/graph-orchestrator/session-analysis-2026-11-18/findings.md`, which holds the evidence, the proposed change and the file and line for each.

**How the order was set.** Fixes the dispatch evals can measure wait for the baseline, so their effect can be shown. Fixes they cannot measure (orchestrator behaviour, and anything owned by the harness or platform) do not gain from waiting, so the small P0 ones come first.

| Rank | Item | Why it matters | Size | Waits for | Measured by |
|---|---|---|---|---|---|
| 1 | **Session evals** (new spec). Evaluate a whole orchestrated session: planning, rule compliance, human gates. Starts with a spike that headless Claude Code runs the Workflow tool in a sandbox; `inspect_swe`'s Claude Code agent is the likely base. Agreed budget: $75 per run, for a named fix or a release. | Roughly half the findings are about orchestrator behaviour, which dispatch evals cannot see. | L | Dispatch evals done | n/a |
| 2 | **Remaining small text and one-line fixes**: QUA-08, REL-07. | Each is small; together with the fixes shipped in 0.4.0 they remove most of the recurring friction in the analysed sessions. | S each | Baseline, since both touch dispatch code | Dispatch evals |
| 3 | **Plugin instrumentation.** Structured per-dispatch logging (tokens by type, duration, model, status, queue time), as listed under "Instrumentation gaps" in the findings. | Makes every later analysis and eval cheaper. Deliberately left out of the baseline. | M | Baseline | Dispatch evals, as a change like any other |
| 4 | **Cache-write platform ask** (COST-03). The fixes spike (`docs/specs/fixes/tickets/01-spike-model-choice-and-cache-writes.md`) measures per-call usage on a few coding agents to confirm the cause; if it does, ask the platform for a longer cache lifetime for workflow agents. | The largest cost line: 55.9% of spend. | L | The fixes spike's live run | Dispatch evals, then a platform ask |
| 5 | **A run-verification skill** (new spec). | Agreed as a later spec while scoping the dispatch evals; its design has not been discussed yet. | ? | Dispatch evals done | n/a |
| 6 | **Skill evals** (new spec). Evaluate the skills in this repo themselves, with skills and the plugin installed from this one marketplace. | The skills shape every role's work but are not measured. | L | Dispatch evals done | n/a |
| 7 | **Comparison arm.** Run the same tasks on plain Claude Code and on `lead-orchestrator`. | Shows whether the plugin is worth its overhead, not only whether a fix helps. | M | Rank 1 | Session evals |
| 8 | **Run evals from GitHub Actions**, manually triggered. | Lets the suite run where Docker and the keys are known to be present. | S | Baseline frozen | n/a |
| 9 | **Set up an issue tracker for specs and tickets** (`/setup-matt-pocock-skills`), then publish the dispatch-evals spec and tickets there. | Specs and tickets are repo files only for now. | S | Nothing | n/a |
| 10 | **A model grader for prose results.** | Only if the planted-fact checks prove too blunt for research dispatches. | M | Baseline | n/a |
| 11 | **Close the gaps in the session analysis**: sessions eLKq and gFUT were only partly checked, and the early waves of d6Vc and dKG5 are known at ticket level only. | Low value: nothing found so far, and gFUT predates the plugin. | S | Nothing | n/a |

## Groups

The same work, grouped by goal and dependency rather than ranked. Rank 2's findings are placed individually. Every rank, and every finding the roadmap still holds, appears exactly once. Group 1 (execution and lifecycle) is covered by `docs/specs/execution-lifecycle/`, and Groups 2 (verification integrity) and 4 (orchestrator behaviour), with most of Group 3, by `docs/specs/fixes/`; they are no longer listed. Ranks stay the order of work; groups say what belongs together.

| Group | Goal | Items | Measured by |
|---|---|---|---|
| **3. Cost** | Spend less per dispatch without bringing back false passes. | Rank 4 | Dispatch evals |
| **5. Observability and evals** | Every run is recorded truthfully and can be measured cheaply. | Ranks 1, 3, 5, 6, 7, 8, 9, 10, 11; QUA-08, REL-07 | n/a (this is the measuring) |

**Notes per group.**
- **Cost.** Rank 4 needs the fixes spike's per-call usage, and rank 3's per-call usage helps confirm the cause.
- **Observability and evals.** Rank 1 is the hub of the roadmap: it re-measures the orchestrator rules shipped in 0.4.0 and gates rank 7. Rank 5 has no design yet, so its place is provisional. Rank 9 is a process chore that fits no group well.

**Links across groups.**
- QUA-08 (group 5) builds on the worker-appended trace in `single` that 0.4.0 ships (fixes ticket 08): the worker stamps the time.
- Rank 4 (group 3) ties to rank 3 (group 5): per-call usage is the evidence for the platform ask.

**Corrections to rank 2.** QUA-08 and REL-07 both change dispatch code, so measure them with the dispatch evals against the baseline.

**Rank numbers before 0.4.0.** Specs written earlier use these. Old 5 is now 1, 6 is 2, 7 is 3, 11 is 4 (its measurement shipped in 0.4.0; the platform ask stays), 13 is 5, 14 is 6, 15 is 7, 16 is 8, 17 is 9, 18 is 10 and 19 is 11. Old ranks 1, 2, 3, 4, 8, 9, 10 and 12 are covered by `docs/specs/fixes/`.
