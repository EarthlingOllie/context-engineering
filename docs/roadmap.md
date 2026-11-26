# Roadmap

Work that has been discussed but is not covered by a spec and tickets yet, in priority order. Covered work is not repeated here:

- **Dispatch evals and the baseline**: `docs/specs/dispatch-evals/` (spec and 12 tickets).
- **Execution and lifecycle (Group 1)**: `docs/specs/execution-lifecycle/` (spec and 6 tickets).

Finding ids (REL-01, QUA-04 and so on) refer to the session analysis in `docs/v1/graph-orchestrator/session-analysis-2026-11-18/findings.md`, which holds the evidence, the proposed change and the file and line for each.

**How the order was set.** Fixes the dispatch evals can measure wait for the baseline, so their effect can be shown. Fixes they cannot measure (orchestrator behaviour, and anything owned by the harness or platform) do not gain from waiting, so the small P0 ones come first.

| Rank | Item | Why it matters | Size | Waits for | Measured by |
|---|---|---|---|---|---|
| 1 | **Iterative fan-out evaluator sees only first lines** (new, from the dispatch evals baseline). `runIterativeFanOut` builds the evaluator's FINDINGS SO FAR with `findingsText(findings, false)` (`graph-orchestrator/src/topologies/iterative-fan-out.ts:139`), so each branch shows only the first line of its result. The evaluator never sees full coverage, re-asks for documents already covered, and the dispatch ends `exhausted`. Likely fix: pass `true`, or the full result capped per branch. | Sample 10 fails 0/5 in the baseline (`baselines/3035a58f6828.json`) and 0/3 in the routine run; every iterative fan-out that needs more than a one-line finding per branch is affected. | S | Nothing (baseline frozen) | Dispatch evals (sample 10) |
| 2 | **A hook message is never a human answer** (QUA-04). | Stop hooks drove commits and pushes, or were logged as the human's "yes" on an irreversible step, in 10 sessions. | S | Nothing | By hand; later session evals |
| 3 | **Per-role models** (COST-01). Default model per role, with scribe and partition on Haiku first; Sonnet for evaluator, reducer and judge as an opt-in. Includes deciding where the assignment lives: defaults in code plus a field on the dispatch spec (the report's proposal), not agent-definition frontmatter, which Workflow agents do not load. | About 6% of agent spend with no quality risk; up to about 13.9% if cheaper evaluators do not bring back false passes. | M | Baseline; dispatch-evals ticket 09 | Dispatch evals |
| 4 | **Countable pass criteria** (QUA-01). Part 1: a countability rule in the catalog and `failed` on missing criteria. Part 2: a spec-level acceptance dispatch before a session finishes. | 6 sessions had a reviewer pass work that was later shown wrong. | M | Baseline for part 1 | Dispatch evals (sample 4) for part 1; session evals for part 2 |
| 5 | **Session evals** (new spec). Evaluate a whole orchestrated session: planning, rule compliance, human gates. Starts with a spike that headless Claude Code runs the Workflow tool in a sandbox; `inspect_swe`'s Claude Code agent is the likely base. Agreed budget: $75 per run, for a named fix or a release. | Roughly half the findings are about orchestrator behaviour, which dispatch evals cannot see. | L | Dispatch evals done | n/a |
| 6 | **Remaining small text and one-line fixes**: QUA-02, QUA-03, REL-06, REL-08, QUA-05 (plugin part), QUA-07, QUA-08, QUA-09, QUA-10, SPD-02, SPD-03, COST-05, REL-07. | Each is small; together they remove most of the recurring friction in the analysed sessions. | S each | Baseline for QUA-08 and REL-07, which touch dispatch code; nothing for the rest | Mostly session evals or by hand |
| 7 | **Plugin instrumentation.** Structured per-dispatch logging (tokens by type, duration, model, status, queue time), as listed under "Instrumentation gaps" in the findings. | Makes every later analysis and eval cheaper. Deliberately left out of the baseline. | M | Baseline | Dispatch evals, as a change like any other |
| 8 | **Scribe and fixed per-dispatch overhead** (COST-02). Worker-appended trace for `single`, after the scribe moves to Haiku under rank 3. | A full extra agent per dispatch, and about 150k tokens on trivial dispatches. | S | Rank 3 | Dispatch evals (sample 1) |
| 9 | **Chain reporting** (REL-04). Stage summary lines, a "not run" list, and a mid-chain panel gate. | Chains lose later stages or a mid-chain verdict. | M | Baseline | Dispatch evals (sample 9) |
| 10 | **Rolling launches** (SPD-01). Start dispatches as slots free up instead of waiting for the whole wave. | 42% of slot time idles at the wave barrier. | M | Session evals | Session evals |
| 11 | **Cache writes** (COST-03). First measure per-call usage on a few coding agents to confirm the cause, then ask the platform for a longer cache lifetime for workflow agents. | The largest cost line: 55.9% of spend. | L | Baseline (it reports cache-write share) | Dispatch evals, then a platform ask |
| 12 | **Planning-model changes**: one worktree per parallel generator plus an integrate step (QUA-06); split wide fan-outs (SPD-04), informed by the concurrency sweep; one full-suite check per round (COST-04). | Parallel builders collided on one working tree; fan-outs queue behind a cap of 2; expensive checks run several times per ticket. | M | Session evals; the concurrency sweep (dispatch-evals ticket 12) | Session evals |
| 13 | **A run-verification skill** (new spec). | Agreed as a later spec while scoping the dispatch evals; its design has not been discussed yet. | ? | Dispatch evals done | n/a |
| 14 | **Skill evals** (new spec). Evaluate the skills in this repo themselves, with skills and the plugin installed from this one marketplace. | The skills shape every role's work but are not measured. | L | Dispatch evals done | n/a |
| 15 | **Comparison arm.** Run the same tasks on plain Claude Code and on `lead-orchestrator`. | Shows whether the plugin is worth its overhead, not only whether a fix helps. | M | Session evals | Session evals |
| 16 | **Run evals from GitHub Actions**, manually triggered. | Lets the suite run where Docker and the keys are known to be present. | S | Baseline frozen | n/a |
| 17 | **Set up an issue tracker for specs and tickets** (`/setup-matt-pocock-skills`), then publish the dispatch-evals spec and tickets there. | Specs and tickets are repo files only for now. | S | Nothing | n/a |
| 18 | **A model grader for prose results.** | Only if the planted-fact checks prove too blunt for research dispatches. | M | Baseline | n/a |
| 19 | **Close the gaps in the session analysis**: sessions eLKq and gFUT were only partly checked, and the early waves of d6Vc and dKG5 are known at ticket level only. | Low value: nothing found so far, and gFUT predates the plugin. | S | Nothing | n/a |

## Groups

The same work, grouped by goal and dependency rather than ranked. Rank 6's findings are placed individually. Every rank, and every finding the roadmap still holds, appears exactly once. Group 1 (execution and lifecycle) is covered by `docs/specs/execution-lifecycle/` and is no longer listed. Ranks stay the order of work; groups say what belongs together.

| Group | Goal | Items | Measured by |
|---|---|---|---|
| **2. Verification integrity** | No pass without a check that ran. | Ranks 1, 4 (both parts), 9; REL-08, QUA-02, QUA-05 | Dispatch evals; session evals for rank 4 part 2 and QUA-02 |
| **3. Cost** | Spend less per dispatch without bringing back false passes. | Ranks 3, 8, 11; COST-05 | Dispatch evals; session evals for COST-05 |
| **4. Orchestrator behaviour** | The main loop plans, waits, asks and uses context well. | Ranks 2, 10, 12; REL-06, QUA-03, QUA-07, QUA-09, QUA-10, SPD-02, SPD-03 | Session evals; by hand until they exist |
| **5. Observability and evals** | Every run is recorded truthfully and can be measured cheaply. | Ranks 5, 7, 13, 14, 15, 16, 17, 18, 19; QUA-08, REL-07 | n/a (this is the measuring) |

**Notes per group.**
- **Verification integrity.** Rank 1 and QUA-05 change the same line (`iterative-fan-out.ts:139`); do them together. REL-08 sets pass=false on a denied tool, and QUA-02 labels such work UNVERIFIED; land them as a pair.
- **Cost.** Dispatch-evals ticket 09 → rank 3 → rank 8. Rank 11 runs in parallel, but needs rank 7's per-call usage to confirm the cause.
- **Orchestrator behaviour.** Mostly SKILL.md rules, and mostly blocked on session evals for measurement, not for implementation. QUA-03 and QUA-04 (rank 2) are one rule at `SKILL.md:122`. QUA-10 relies on QUA-07. REL-06's pre-launch check is interim; revisit it with rank 10. Rank 12 also needs dispatch-evals ticket 12.
- **Observability and evals.** Rank 5 is the hub of the roadmap: it gates group 4 and rank 15. Rank 13 has no design yet, so its place is provisional. Rank 17 is a process chore that fits no group well.

**Links across groups.**
- QUA-08 (group 5) depends on rank 8's scribe decision (group 3): without a scribe in `single`, the worker stamps the time.
- Rank 5 (group 5) gates most of group 4.
- SPD-03 (group 4) ties to rank 11 (group 3): long waits outlast the cache lifetime.

**Corrections to rank 6.** Besides QUA-08 and REL-07, REL-08, QUA-03, QUA-05 and SPD-03 also change dispatch code (`run.ts`, `roles.ts`, `render.ts`). The `roles.ts` changes alter agent prompts, so measure them with the dispatch evals against the baseline. QUA-05's `iterative-fan-out.ts:139` change is rank 1; rescope QUA-05 when rank 1 lands.
