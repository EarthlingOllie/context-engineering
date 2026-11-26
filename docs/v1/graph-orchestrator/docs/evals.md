# Spec: dispatch evals and a baseline, run with Inspect AI

Status: ready for implementation. Decisions were settled in a design interview on 2026-11-26; the reasons for the two least obvious ones are in ADR-0005. Vocabulary follows `CONTEXT.md` (Dispatch Eval, Session Eval, Baseline).

## Problem Statement

The session analysis of 2026-11-18 produced 27 findings about the plugin's reliability, quality, speed and cost. I want to start fixing them, but I have no way to tell whether a fix worked. The only evidence today is whole real sessions, which cost a median of $119 and 7.9 hours each, differ in task every time, and cannot be repeated. A fix that cuts cost might also let more bad work pass review, and I would not see it.

## Solution

A suite of dispatch evals that I can run on demand. Each one hands a fixed dispatch spec to the shipped plugin, lets real agents do the work in a sandbox, and scores what came back against checks the agents never saw. One run produces a scorecard: was the outcome correct, was the reported status truthful, what did it cost, how long did it take, how many agents ran.

I run the suite once against the untouched plugin and freeze the result as the baseline. After each fix I run it again and a compare command shows me, sample by sample, what moved and whether the move is larger than noise.

## User Stories

1. As the plugin maintainer, I want a baseline scorecard for the plugin as shipped, so that every fix has something to be measured against.
2. As the plugin maintainer, I want to run the whole dispatch suite with one command, so that measuring a fix is cheap enough to do every time.
3. As the plugin maintainer, I want a compare command that prints fix versus baseline per sample and per metric, so that I can see what a change moved.
4. As the plugin maintainer, I want changes smaller than the measured run-to-run spread flagged as noise, so that I do not act on chance.
5. As the plugin maintainer, I want each sample's outcome judged by a hidden check, so that the plugin's own evaluator cannot mark its own work.
6. As the plugin maintainer, I want a sample with a planted bug and vague pass criteria, so that I can measure the false-pass rate (QUA-01).
7. As the plugin maintainer, I want each sample's reported status compared with what actually happened, so that I can measure status truthfulness (REL-05).
8. As the plugin maintainer, I want samples that must end blocked, exhausted and over budget, so that every status is exercised, not only done.
9. As the plugin maintainer, I want a chain whose second stage fails, so that I can check the chain stops and reports that stage (REL-04).
10. As the plugin maintainer, I want every topology in the catalog covered by at least one sample, so that a fix to one topology cannot silently break another.
11. As the plugin maintainer, I want the chained generator-evaluator pattern covered, so that the pattern that took 64% of agent spend is measured.
12. As the plugin maintainer, I want dollars per sample with cache-read and cache-write tokens kept apart, so that I can see the largest cost line move.
13. As the plugin maintainer, I want cost broken down by role, so that I can measure the saving from per-role models (COST-01) and the scribe's overhead (COST-02).
14. As the plugin maintainer, I want the agent count per dispatch recorded, so that I can compare it with the catalog's demand formula.
15. As the plugin maintainer, I want wall-clock time per sample recorded, so that speed fixes can be measured.
16. As the plugin maintainer, I want a role that asks for a different model to really get it, so that a per-role model fix does not silently run on the main model.
17. As the plugin maintainer, I want all roles on one pinned model in the baseline, so that the baseline matches how real sessions ran.
18. As the plugin maintainer, I want the baseline frozen at 5 epochs and routine runs at 3, so that the baseline's spread is known and routine runs stay affordable.
19. As the plugin maintainer, I want a configurable dollar budget and time limit per run, so that a runaway sample cannot spend without bound.
20. As the plugin maintainer, I want the concurrency cap to default to 2, so that the baseline's speed matches what cloud sessions experienced.
21. As the plugin maintainer, I want concurrency, CPU count and memory as run parameters, so that I can find the best concurrency for a real, limited machine.
22. As the plugin maintainer, I want an on-demand concurrency sweep over the fan-out samples, so that I can measure queueing without paying for the whole suite.
23. As the plugin maintainer, I want the roles to run on the real Claude Code engine, so that cost numbers include the fixed context every real agent carries.
24. As the plugin maintainer, I want samples to name skills from this repo for their roles, so that the evals reflect how real dispatches are written.
25. As the plugin maintainer, I want skills installed from this repo at the commit under test, so that nothing outside the repo changes a result.
26. As the plugin maintainer, I want the engine version, Inspect version and model id pinned and written into every scorecard, so that two scorecards are comparable or visibly not.
27. As the plugin maintainer, I want baseline scorecards committed and keyed by plugin commit, so that the history of the plugin's performance lives with its source.
28. As the plugin maintainer, I want raw run logs kept out of the repo, so that the repo stays small and holds no full transcripts.
29. As the plugin maintainer, I want the findings the suite cannot measure listed in its README, so that I never read an unmeasured finding as fixed.
30. As the plugin maintainer, I want a spike to prove the approach before the suite is built, so that a blocker costs a day and not the whole build.
31. As the plugin maintainer, I want the spike to prove the API key and workspace key authenticate through Inspect, so that the one known possible blocker is tested first.
32. As a contributor, I want the scorers tested against saved outputs, so that I can change a scorer without paying for a run.
33. As a contributor, I want the fixtures small and purpose-built, so that a sample finishes in minutes and holds no private code.
34. As a contributor, I want research samples scored by planted facts, so that scoring is deterministic and needs no model grader.
35. As a contributor, I want a Python fixture and a TypeScript fixture, so that results do not depend on one language's tooling.
36. As a contributor, I want a `code-review` skill in this repo, so that evaluator roles have a skill to name without depending on another plugin.
37. As a later spec's author, I want the harness and scorecard format to be reusable, so that session evals and skill evals can build on them.

## Implementation Decisions

**Scope and order**

- The work starts with a spike that runs one sample (sample 1 below) end to end. The suite is built only if all six conditions hold:
  1. Docker containers run in the environment where evals will run.
  2. The Claude Agent SDK works inside the sandbox with its model calls going through Inspect's sandbox agent bridge.
  3. A role that requests a different model, declared to the bridge as an alias, is served by that model.
  4. Cache-read and cache-write tokens appear per call in the Inspect log.
  5. A skill from this repo loads for a role inside the sandbox.
  6. Inspect's Anthropic provider and the Agent SDK both authenticate with `ANTHROPIC_API_KEY` plus `ANTHROPIC_WORKSPACE_KEY`. Test this first: how the workspace key is sent is not yet known, and if Inspect cannot send it the approach is blocked.
- If Docker will not run in a cloud session, the suite runs on the maintainer's machine or in GitHub Actions. Inspect's unsandboxed local mode is not a fallback: agents would edit the checkout.
- Evals run in a session or machine that has both keys in its environment. The session this spec was written in did not.

**Modules**

- **Eval harness** (Node). Loads the built dispatch bundle the way the Workflow harness does (meta literal split off, body run with the harness globals) and supplies a real `Runtime`:
  - `agent` runs one Claude Code engine per call, with the role's prompt, the schema as structured output, and the model the plugin requested or, if none, the run's main model;
  - `parallel` enforces the configured concurrency cap and records queue time;
  - `log` is captured.
  It takes a dispatch spec and run parameters, and writes one result file: the dispatch's return value, per-agent timings and labels, and queue time. No change to the plugin is needed.
- **Inspect tasks** (Python). One task for the dispatch suite and one for the concurrency sweep. Each sample is one dispatch eval: a dispatch spec, a fixture, the expected status and the hidden check. The solver copies the fixture into the sandbox, starts the bridge and runs the harness.
- **Scorers** (Python). Pure functions from a recorded sample (harness result file, trace files, sandbox file state, Inspect usage) to scorecard metrics. Hidden checks are copied into the sandbox only at scoring time.
- **Fixtures**. Four, each small and purpose-built:
  - a TypeScript library with a planted bug that "run the relevant tests" misses;
  - a document set with planted facts for research dispatches;
  - a task that can only end blocked;
  - a Python package with pytest and a "build this feature" task whose hidden tests are stricter than the visible ones.
- **Scorecard and compare**. A run writes one scorecard file. The compare command takes two scorecards and prints the difference per sample and metric, marking differences inside the noise band.
- **`code-review` skill**. Copied from mattpocock-skills v1.2.3 into this repo's skills plugin, with its MIT notice.

**Samples (first set)**

| # | Topology | Fixture | Expected | Targets |
|---|---|---|---|---|
| 1 | single | docs | done | cost floor per dispatch (COST-02) |
| 2 | single | blocked task | blocked | status truthfulness (REL-05) |
| 3 | generator-evaluator | Python feature | done, hidden tests pass | core loop |
| 4 | generator-evaluator | TS planted bug, vague criteria | catches the bug | false passes (QUA-01) |
| 5 | generator-evaluator | unmeetable criteria, 2 rounds | exhausted | status truthfulness |
| 6 | fan-out | docs, explicit list and reducer | done | reducer output (QUA-05) |
| 7 | fan-out | docs, partition into 6 | done | queueing under the cap (SPD-04) |
| 8 | chain | Python: single then generator-evaluator | done | the 64% spend pattern |
| 9 | chain | stage 2 fails | stops, reports stage 2 | lost stages (REL-04) |
| 10 | iterative-fan-out | docs with a gap visible only in round 2 | done in 2 rounds | coverage loop |
| 11 | panel | TS diff with a planted defect | FAIL verdict | verdict truncation |
| 12 | best-of-n | Python bug, 3 variants | picks a working fix | judge |
| 13 | debate | design question in docs | verdict | cost with no early stop |
| 14 | relay | Python feature list, 3 sessions | done | hand-over file |
| 15 | fan-out | split of 10 | over_budget, no agents | cap enforcement |

- Generator roles name `test-driven-development`; evaluator roles name `code-review`. Both are installed in the sandbox from this repo at the commit under test.

**Scorecard**

- Per sample, per epoch: outcome correct (hidden check), status truthful (reported status equals expected), dollars, input / output / cache-read / cache-write tokens, cache-write share, cost by role, agent count, wall clock, queue time.
- No composite score. A fix wins when its target metric improves and outcome correctness does not fall beyond noise.
- Scoring is deterministic. No model grader in this version; research samples are scored by whether the result states each planted fact and cites its file.
- Header: plugin commit, engine version, Inspect version, model id, concurrency cap, CPU count, memory, epochs.
- Prices are supplied to Inspect per model; Inspect ships none.

**Baseline and runs**

- Baseline: the plugin untouched, every role on `claude-opus-5-5`, 5 epochs, frozen and committed. This one-off run may exceed the routine budget.
- Routine runs: 3 epochs.
- Noise: until the baseline shows the real spread, treat cost or time changes under 10% as noise. After that, use the baseline's measured spread per sample.
- Budget: $30 and 30 minutes per routine run, both configurable, enforced with Inspect's per-sample cost and time limits. If the first run exceeds the budget, cut debate, best-of-n and relay to 1 epoch before dropping any sample.
- Default sandbox: 4 CPUs, concurrency cap 2, matching cloud sessions. Both are run parameters, as is memory.
- Concurrency sweep: a separate on-demand task that runs samples 6 and 7 at caps 2, 4 and 8. It is outside the routine run and its budget.

**Model routing**

- The bridge serves only model names declared to it; an undeclared name silently falls back to the main model. The suite declares every model id a role may request (Opus, Sonnet, Haiku) so a per-role assignment is honoured.
- The scorer fails a sample if the model that served a call differs from the model the plugin requested.

**Outputs and location**

- Everything lives under the plugin's `evals/` directory: tasks, harness, fixtures, scorers, baselines, README.
- Committed: scorecards for baselines, keyed by plugin commit. Not committed: raw Inspect logs.
- The README lists the findings the suite cannot measure and how each is verified by hand.

## Testing Decisions

A good test here checks behaviour at a seam with recorded or stubbed inputs, never the internals of a scorer or the harness, and never needs a paid model call.

- **The plugin under eval** is exercised at its existing seam: the shipped bundle called with harness globals. `test/bundle.test.ts` is the prior art; the eval harness does the same with a real runtime in place of the fake one. No new seam is added to the plugin.
- **The real runtime** is tested with a stub engine in place of the Agent SDK: the concurrency cap is honoured, the schema and requested model are passed through, timings and queue time are recorded, an engine failure surfaces as the plugin expects (nothing returned or a thrown error).
- **The scorers** are tested as pure functions over saved samples: a recorded result file, trace and file tree in; scorecard metrics out. Prior art is the trace fixtures under `test/fixtures/` used by the renderer tests. Include at least one saved sample per status and one false pass.
- **The compare command** is tested with two small hand-written scorecards, including a difference inside the noise band.
- **Not unit-tested**: Inspect tasks, fixtures and sandbox configuration. The spike and the baseline run exercise them.
- The existing deterministic tests under `test/` are unchanged and stay the first check on any plugin change.

## Out of Scope

- **Session evals**: evaluating a whole orchestrated session, including the orchestrator's planning, rule compliance and handling of human gates. A later spec; its agreed budget is $75 per run, run for a named fix or a release.
- **Skill evals**: evaluating the skills in this repo themselves.
- **A run-verification skill**, to be created in a later spec.
- **A comparison arm** against plain Claude Code or `lead-orchestrator`.
- **Plugin instrumentation**: structured per-dispatch logging inside the plugin.
- **The fixes themselves**: nothing in the findings report is fixed by this spec.
- **Findings owned by the harness or platform**, which a sandbox does not reproduce: the scriptPath refusal (REL-01), restart-killed dispatches (REL-03), the "completed" notification text (REL-05's notification half), stale synced builds (REL-07), permission and classifier denials (REL-08), the subagent report-write refusal (QUA-05's harness half). These are verified by hand in a cloud session.
- **A model grader** for prose results.
- **Publishing this spec to an issue tracker**; none is configured for this repo.

## Further Notes

- Facts about Inspect were checked against inspect_ai 0.3.292 and inspect_swe 0.3.2 by reading their source and docs sources, not by running them. Two remain unverified until the spike: that the Anthropic bridge fills the cache token fields, and that Docker Compose `cpus` limits the sandbox as expected.
- `inspect_swe` has a `claude_code()` agent that runs Claude Code through the same bridge. It is the likely base for session evals. It has no plugin option, so the plugin would be installed into the sandbox by the task.
- Inspect tracks working time poorly for bridged agents, because time spent in the engine's own tools is not seen. Wall clock comes from the harness, and every sample sets a wall-clock limit.
- The 15 samples cost an unknown amount until the first run; the $30 budget is a ceiling, not an estimate.
- Evidence for the findings referenced here is in `session-analysis-2026-11-18/`.
