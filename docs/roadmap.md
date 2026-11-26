# Roadmap

Work that has been discussed but is not covered by a spec and tickets yet, in priority order. Covered work is not repeated here:

- **Dispatch evals and the baseline**: `docs/specs/dispatch-evals/` (spec and 12 tickets).

Finding ids (REL-01, QUA-04 and so on) refer to the session analysis in `docs/v1/graph-orchestrator/session-analysis-2026-11-18/findings.md`, which holds the evidence, the proposed change and the file and line for each.

**How the order was set.** Fixes the dispatch evals can measure wait for the baseline, so their effect can be shown. Fixes they cannot measure (orchestrator behaviour, and anything owned by the harness or platform) do not gain from waiting, so the small P0 ones come first.

| Rank | Item | Why it matters | Size | Waits for | Measured by |
|---|---|---|---|---|---|
| 1 | **Iterative fan-out evaluator sees only first lines** (new, from the dispatch evals baseline). `runIterativeFanOut` builds the evaluator's FINDINGS SO FAR with `findingsText(findings, false)` (`graph-orchestrator/src/topologies/iterative-fan-out.ts:139`), so each branch shows only the first line of its result. The evaluator never sees full coverage, re-asks for documents already covered, and the dispatch ends `exhausted`. Likely fix: pass `true`, or the full result capped per branch. | Sample 10 fails 0/5 in the baseline (`baselines/3035a58f6828.json`) and 0/3 in the routine run; every iterative fan-out that needs more than a one-line finding per branch is affected. | S | Nothing (baseline frozen) | Dispatch evals (sample 10) |
| 2 | **Fix the launch path** (REL-01, REL-02). Make the scratch copy of the workflows the documented launch, and say "wave dispatched" only after the launch returns. | The documented launch was refused in 15 of 20 sessions. | S | Nothing | By hand in a cloud session |
| 3 | **A hook message is never a human answer** (QUA-04). | Stop hooks drove commits and pushes, or were logged as the human's "yes" on an irreversible step, in 10 sessions. | S | Nothing | By hand; later session evals |
| 4 | **Per-role models** (COST-01). Default model per role, with scribe and partition on Haiku first; Sonnet for evaluator, reducer and judge as an opt-in. Includes deciding where the assignment lives: defaults in code plus a field on the dispatch spec (the report's proposal), not agent-definition frontmatter, which Workflow agents do not load. | About 6% of agent spend with no quality risk; up to about 13.9% if cheaper evaluators do not bring back false passes. | M | Baseline; dispatch-evals ticket 09 | Dispatch evals |
| 5 | **Countable pass criteria** (QUA-01). Part 1: a countability rule in the catalog and `failed` on missing criteria. Part 2: a spec-level acceptance dispatch before a session finishes. | 6 sessions had a reviewer pass work that was later shown wrong. | M | Baseline for part 1 | Dispatch evals (sample 4) for part 1; session evals for part 2 |
| 6 | **Session evals** (new spec). Evaluate a whole orchestrated session: planning, rule compliance, human gates. Starts with a spike that headless Claude Code runs the Workflow tool in a sandbox; `inspect_swe`'s Claude Code agent is the likely base. Agreed budget: $75 per run, for a named fix or a release. | Roughly half the findings are about orchestrator behaviour, which dispatch evals cannot see. | L | Dispatch evals done | n/a |
| 7 | **Remaining small text and one-line fixes**: QUA-02, QUA-03, REL-03 (plugin part), REL-05 (plugin part), REL-06, REL-08, QUA-05 (plugin part), QUA-07, QUA-08, QUA-09, QUA-10, SPD-02, SPD-03, COST-05, REL-07. | Each is small; together they remove most of the recurring friction in the analysed sessions. | S each | Baseline for QUA-08 and REL-07, which touch dispatch code; nothing for the rest | Mostly session evals or by hand |
| 8 | **Plugin instrumentation.** Structured per-dispatch logging (tokens by type, duration, model, status, queue time), as listed under "Instrumentation gaps" in the findings. | Makes every later analysis and eval cheaper. Deliberately left out of the baseline. | M | Baseline | Dispatch evals, as a change like any other |
| 9 | **Scribe and fixed per-dispatch overhead** (COST-02). Worker-appended trace for `single`, after the scribe moves to Haiku under rank 4. | A full extra agent per dispatch, and about 150k tokens on trivial dispatches. | S | Rank 4 | Dispatch evals (sample 1) |
| 10 | **Chain reporting** (REL-04). Stage summary lines, a "not run" list, and a mid-chain panel gate. | Chains lose later stages or a mid-chain verdict. | M | Baseline | Dispatch evals (sample 9) |
| 11 | **Rolling launches** (SPD-01). Start dispatches as slots free up instead of waiting for the whole wave. | 42% of slot time idles at the wave barrier. | M | Session evals | Session evals |
| 12 | **Cache writes** (COST-03). First measure per-call usage on a few coding agents to confirm the cause, then ask the platform for a longer cache lifetime for workflow agents. | The largest cost line: 55.9% of spend. | L | Baseline (it reports cache-write share) | Dispatch evals, then a platform ask |
| 13 | **Planning-model changes**: one worktree per parallel generator plus an integrate step (QUA-06); split wide fan-outs (SPD-04), informed by the concurrency sweep; one full-suite check per round (COST-04). | Parallel builders collided on one working tree; fan-outs queue behind a cap of 2; expensive checks run several times per ticket. | M | Session evals; the concurrency sweep (dispatch-evals ticket 12) | Session evals |
| 14 | **Asks of the harness and platform**: accept a plugin-root `scriptPath`; make the notification status the script's returned status; allow subagent writes under the session scratchpad; a restart notice or drain; classifier availability; faster or visible plugin sync. | 10 of the 27 findings are owned, fully or partly, outside the plugin. | n/a | Nothing | By hand in a cloud session |
| 15 | **A run-verification skill** (new spec). | Agreed as a later spec while scoping the dispatch evals; its design has not been discussed yet. | ? | Dispatch evals done | n/a |
| 16 | **Skill evals** (new spec). Evaluate the skills in this repo themselves, with skills and the plugin installed from this one marketplace. | The skills shape every role's work but are not measured. | L | Dispatch evals done | n/a |
| 17 | **Comparison arm.** Run the same tasks on plain Claude Code and on `lead-orchestrator`. | Shows whether the plugin is worth its overhead, not only whether a fix helps. | M | Session evals | Session evals |
| 18 | **Port to LangGraph TypeScript** (new spec). Replace the Workflow-script engine: the topologies run on `@langchain/langgraph`. The orchestrator stays a Claude Code plugin skill, which invokes the LangGraph program instead of the Workflow tool. Supersedes the dual-engine design drafted in session dQHS (2026-11-14, `design/langgraph-design.md`, not committed), which kept Workflow as default; its shim spike, resume tests and migration phases may still apply. Spike 01 (designed, local part passes) checks LangGraph inside a Workflow script with the UI intact. Then recover or redo that note as a spec, and decide what a node runs (the API directly, or the Agent SDK): that sets tools, permissions and cache control. | Graphs, state and routing as a maintained library instead of hand-written loops, and a graph definition that can later run outside Claude Code (the standalone program). To keep the Workflow UI, LangGraph runs inside the Workflow script (`docs/specs/langgraph-port/spike-01-langgraph-in-workflow.md`), so REL-01 still applies and resume stays the harness's `resumeFromRunId`; LangGraph checkpoints have no filesystem there. Decides how much Workflow-specific work below is worth doing. | L | Dispatch evals done (baseline to compare the new engine against); ranks 1–2 | Dispatch evals: new-engine scorecard against the frozen baseline |
| 19 | **Run evals from GitHub Actions**, manually triggered. | Lets the suite run where Docker and the keys are known to be present. | S | Baseline frozen | n/a |
| 20 | **Set up an issue tracker for specs and tickets** (`/setup-matt-pocock-skills`), then publish the dispatch-evals spec and tickets there. | Specs and tickets are repo files only for now. | S | Nothing | n/a |
| 21 | **A model grader for prose results.** | Only if the planted-fact checks prove too blunt for research dispatches. | M | Baseline | n/a |
| 22 | **Close the gaps in the session analysis**: sessions eLKq and gFUT were only partly checked, and the early waves of d6Vc and dKG5 are known at ticket level only. | Low value: nothing found so far, and gFUT predates the plugin. | S | Nothing | n/a |

## Groups

The same work, grouped by goal and dependency rather than ranked. Rank 7's findings are placed individually. Every rank and all 27 findings appear exactly once. Ranks stay the order of work; groups say what belongs together.

| Group | Goal | Items | Measured by |
|---|---|---|---|
| **1. Execution and lifecycle** | Dispatches launch, survive restarts and report their real status. | Ranks 2, 14, 18; REL-03, REL-05 | By hand in a cloud session; dispatch evals for rank 18 |
| **2. Verification integrity** | No pass without a check that ran. | Ranks 1, 5 (both parts), 10; REL-08, QUA-02, QUA-05 | Dispatch evals; session evals for rank 5 part 2 and QUA-02 |
| **3. Cost** | Spend less per dispatch without bringing back false passes. | Ranks 4, 9, 12; COST-05 | Dispatch evals; session evals for COST-05 |
| **4. Orchestrator behaviour** | The main loop plans, waits, asks and uses context well. | Ranks 3, 11, 13; REL-06, QUA-03, QUA-07, QUA-09, QUA-10, SPD-02, SPD-03 | Session evals; by hand until they exist |
| **5. Observability and evals** | Every run is recorded truthfully and can be measured cheaply. | Ranks 6, 8, 15, 16, 17, 19, 20, 21, 22; QUA-08, REL-07 | n/a (this is the measuring) |

**Notes per group.**
- **Execution and lifecycle.** Each finding has a plugin part and a platform part (rank 14); do both together. Rank 18 is this group's decision point. Because LangGraph runs inside the Workflow script to keep the UI, it does not remove REL-01, REL-05 or rank 14; it changes the dispatch code, not the harness. Do rank 2 now (small, P0, current sessions hit it); hold the larger harness asks until rank 18 is decided.
- **Verification integrity.** Rank 1 and QUA-05 change the same line (`iterative-fan-out.ts:139`); do them together. REL-08 sets pass=false on a denied tool, and QUA-02 labels such work UNVERIFIED; land them as a pair.
- **Cost.** Dispatch-evals ticket 09 → rank 4 → rank 9. Rank 12 runs in parallel, but needs rank 8's per-call usage to confirm the cause.
- **Orchestrator behaviour.** Mostly SKILL.md rules, and mostly blocked on session evals for measurement, not for implementation. QUA-03 and QUA-04 (rank 3) are one rule at `SKILL.md:122`. QUA-10 relies on QUA-07. REL-06's pre-launch check is interim; revisit it with rank 11. Rank 13 also needs dispatch-evals ticket 12.
- **Observability and evals.** Rank 6 is the hub of the roadmap: it gates group 4 and rank 17. Rank 15 has no design yet, so its place is provisional. Rank 20 is a process chore that fits no group well.

**Links across groups.**
- QUA-08 (group 5) depends on rank 9's scribe decision (group 3): without a scribe in `single`, the worker stamps the time.
- Rank 1 (group 2) gates rank 18 (group 1).
- Rank 6 (group 5) gates most of group 4.
- SPD-03 (group 4) ties to rank 12 (group 3): long waits outlast the cache lifetime.

**Effect of replacing the engine (rank 18).** The orchestrator stays a Claude Code skill, so group 4 is unaffected. Changes to the current dispatch code (QUA-08, REL-07, REL-06's refusal in `run.ts`, rank 9's scribe, rank 10) become interim: do them only if rank 18 is far off, else build them into the new engine. Rank 1's fix and the role prompts (REL-08, QUA-05, SPD-03) carry over. Rank 4 and rank 12 change shape if nodes call the API directly: model choice and cache control become the plugin's own. Rank 6's spike should launch the LangGraph program from headless Claude Code, not the Workflow tool, once rank 18 lands.

**Corrections to rank 7.** Besides QUA-08 and REL-07, REL-05, REL-08, QUA-03, QUA-05 and SPD-03 also change dispatch code (`run.ts`, `roles.ts`, `render.ts`). The `roles.ts` changes alter agent prompts, so measure them with the dispatch evals against the baseline. QUA-05's `iterative-fan-out.ts:139` change is rank 1; rescope QUA-05 when rank 1 lands.
