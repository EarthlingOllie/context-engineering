# Spec: observability and evals — every run recorded truthfully, whole sessions measured

Status: ready for tickets. Decisions were settled in a design interview on 2026-11-26/27. This spec covers roadmap Group 5 (`docs/roadmap.md`): ranks 5, 7 and 16, and findings QUA-08 and REL-07. Ranks 13, 14, 15, 17, 18 and 19 stay on the roadmap as later work. Finding ids refer to `docs/v1/graph-orchestrator/session-analysis-2026-11-18/findings.md`; the instrumentation items are its "Instrumentation gaps" list. Vocabulary follows `docs/v1/graph-orchestrator/CONTEXT.md` (**Session Eval**, **Dispatch Eval**, **Baseline**, **Intervention**, **Unverified**, **Wave**). The companion spec `docs/specs/fixes/` ships the orchestrator rules whose first measurements this spec builds.

The plugin changes ship as one release, 0.5.0. The session-eval harness and the GitHub Actions job live with the evals and ship no plugin version.

## Problem Statement

Half of what went wrong in the analysed sessions was the orchestrator's own behaviour: obeying hooks, closing blocked work unchecked, idling at the wave barrier. The dispatch evals cannot see any of it, because no orchestrator takes part in a dispatch eval. So every orchestrator rule I ship is checked by hand, once, in whatever session I happen to run, and I cannot tell whether a later change broke it.

The record of a run is also too thin and partly fiction. The trace's timestamps are invented by the orchestrator, which has no clock, so the timeline is wrong. A trace line says nothing about tokens, model, duration or queue time, so the last analysis had to fit a cost model to raw events and still could not confirm the largest cost line. Nothing says which plugin build produced a run, and sessions ran a stale build without anyone knowing.

And the eval suite runs only where I have Docker and the API key set up by hand.

## Solution

A session eval hands a task and a fixture repository to headless Claude Code with the plugin installed, in a sandbox, lets the orchestrator run the whole session, and scores what it planned, dispatched and integrated from the transcript, trace, state file and files. A spike first establishes that the Workflow tool runs there. The first version has three scenarios, each aimed at one orchestrator rule from the companion spec: a hook firing mid-wave, an evaluator that cannot run a check, and a dispatch that should launch before its wave finishes. Each scenario is shown to fail on the plugin before the rule and pass after it. A full run fits the agreed $75.

Every dispatch's trace line records what an analysis needs: real start and end times, the plugin version, per-agent usage where the runtime exposes it, the verdict of each evaluator round, each chain stage's first line, and how many lines a cut dropped. Interventions carry their source, and hook messages their own event kind.

The dispatch-eval suite runs from a manually triggered GitHub Actions job, where Docker and the key are known to be present.

## User Stories

### Session evals

1. As the plugin maintainer, I want a spike that runs headless Claude Code, with the plugin installed, in an Inspect sandbox and confirms the orchestrator can launch a dispatch through the Workflow tool there, so that session evals are built on behaviour the sandbox has.
2. As the plugin maintainer, I want the spike to record the cost and wall clock of one small orchestrated session, so that the scenario count and epochs are set to fit the budget.
3. As the plugin maintainer, I want the spike to say whether the inspect_swe Claude Code agent can be the base, or what replaces it, so that the harness reuses what exists.
4. As the plugin maintainer, I want a session eval to take a task, a fixture repository and an orchestrator mode as input, so that each scenario is fully described by its sample.
5. As the plugin maintainer, I want a session eval to return the session's transcript, trace files, state file, diagram and changed files, so that scorers can check behaviour from every record.
6. As the plugin maintainer, I want the plugin installed in the sandbox from this repository's working tree, so that a session eval measures the commit under test, not a synced copy.
7. As the plugin maintainer, I want the model, Claude Code version and plugin commit pinned and recorded in the scorecard header, so that two runs are comparable.
8. As the plugin maintainer, I want a hook scenario in which a stop hook asks for a commit and push while a dispatch is running, so that the hook rule is measured.
9. As the plugin maintainer, I want the hook scenario to pass only if nothing is pushed, nothing is committed by the main loop mid-wave, the reply to the hook names the running dispatch, and no intervention records the hook, so that every part of the rule is checked.
10. As the plugin maintainer, I want a blocked-to-Unverified scenario in which an evaluator needs a check that cannot run in the sandbox, so that the blocked evaluator and the Unverified label are measured together.
11. As the plugin maintainer, I want that scenario to pass only if the dispatch ends blocked, the orchestrator does not resolve it silently, and any work accepted anyway is labelled Unverified and listed first in the final reply, so that both sides of the term are checked.
12. As the plugin maintainer, I want a rolling-launch scenario whose plan has a dispatch depending only on a fast dispatch in a wave that also holds a slow one, so that rolling launches are measured.
13. As the plugin maintainer, I want that scenario to pass only if the dependent dispatch launches before the slow one finishes, its `dependsOn` is kept, and its wave number is higher, so that the launch rule and the dependency rule are both checked.
14. As the plugin maintainer, I want every scenario shown to fail on 0.3.2 and pass on the release with the rule, so that each scenario is known to detect what it targets.
15. As the plugin maintainer, I want session-eval scoring done by code from the records, not by a model, so that verdicts are repeatable.
16. As the plugin maintainer, I want each scenario run for a fixed number of epochs and its pass rate reported with its spread, so that one lucky session is not read as a pass.
17. As the plugin maintainer, I want a full session-eval run to stay within $75, enforced by a per-sample cost limit, so that a run never overspends.
18. As the plugin maintainer, I want session evals run on demand for a named fix or a release, not routinely, so that their cost is spent where it answers a question.
19. As the plugin maintainer, I want one scorecard per session-eval run in the same shape as the dispatch-eval scorecard, so that the compare tooling and my habits carry over.

### Instrumentation

20. As someone reading a trace, I want every dispatch line to carry its real start and end time, so that the timeline is true.
21. As the orchestrator, I want not to supply a time at all, so that I never invent one.
22. As the plugin maintainer, I want the trace's time stamped by whichever agent writes the trace (the scribe, or the worker in `single`), from the clock, so that no invented `now` remains.
23. As someone reading a trace, I want every dispatch line to carry the plugin version (package version and commit), so that I know which build produced it.
24. As the session's user, I want the rendered diagram's header to show the plugin version, so that a stale build is visible at a glance.
25. As the plugin maintainer, I want the dispatch's returned data to carry the plugin version, so that the orchestrator can record it in the state file's mode line.
26. As the plugin maintainer, I want each agent's role, model, input, output, cache-read and cache-write tokens, tool calls, start, end and queue time in the dispatch's trace line wherever the runtime exposes them, so that the next analysis needs no fitted cost model.
27. As the plugin maintainer, I want a spike to establish which per-agent figures a Workflow script can read, so that instrumentation records only real data and says which fields are unavailable.
28. As someone reading a trace, I want each evaluator round's pass or fail, first feedback line and the pass criteria text recorded, so that a false pass can be traced to its criteria.
29. As someone reading a trace, I want a chain's dispatch line to carry each stage's first line, not only its status, so that a mid-chain verdict is never lost from the record.
30. As someone reading a trace, I want every intervention to carry its source, `user` or `self`, so that analyses need not infer it from the mode.
31. As someone reading a trace, I want hook messages recorded as their own event kind with their first line, so that hook noise can be counted.
32. As the plugin maintainer, I want each agent's count of refused writes and denied tools returned with its result and recorded, so that refusals are visible without scanning transcripts.
33. As the plugin maintainer, I want a cut result or work output to log how many lines it dropped, so that silent truncation can be ruled out.
34. As the plugin maintainer, I want each dispatch line to record the agents it needed and the agents that ran at once, so that the concurrency cost is measured, not inferred.
35. As the orchestrator, I want the state file to hold one `WAITING: <cause> since <time>` line while I wait on a human, CI or a restart, so that idle time can be split by cause.
36. As the plugin maintainer, I want the renderer to keep reading older traces that lack the new fields, so that past sessions still render.
37. As the plugin maintainer, I want the instrumentation measured against the dispatch-eval baseline like any other change, so that logging does not quietly add cost.

### Running evals from GitHub Actions

38. As the plugin maintainer, I want a manually triggered GitHub Actions job that runs the dispatch-eval suite, so that it runs where Docker and the key are present.
39. As the plugin maintainer, I want the job's inputs to pass through the suite's options (samples, epochs, role models, stub), so that one job covers routine runs and checks.
40. As the plugin maintainer, I want the job to upload the scorecard and Inspect log as artifacts, so that results survive the runner.
41. As the plugin maintainer, I want the job never to commit or freeze a baseline, so that freezing stays a deliberate local step.
42. As the plugin maintainer, I want the API key read from a repository secret and never printed, so that it stays out of logs.
43. As the plugin maintainer, I want a stub run of the job to cost nothing and prove the wiring, so that the job can be checked without spending.

### Release

44. As the plugin maintainer, I want the plugin changes shipped as one version, so that the release maps to this spec.

## Implementation Decisions

**Spikes first (ship nothing).** Two, recorded in their tickets before dependent work starts:
- Session sandbox: headless Claude Code, version-pinned, with the plugin installed from the working tree, inside an Inspect Docker sandbox; whether the orchestrator skill loads and a Workflow launch returns a result; whether the inspect_swe Claude Code agent works as the base; cost and wall clock of one small orchestrated session. If the Workflow tool does not run headless, session evals stop here and the finding goes to the roadmap.
- Runtime data: which per-agent figures (tokens by type, model, duration, queue time, tool calls) a Workflow script can read from an agent call's return or the runtime, and whether a script can read the clock.

**Session-eval harness.** Lives with the evals, beside the dispatch suite, as its own Inspect task. One sample is a task, a fixture repository, an orchestrator mode, the hooks and permissions to install, and a scorer. The harness runs the session to completion or the per-sample cost limit, then collects the transcript, the scratch directory (trace files, state file, args, diagram) and the repository's git state. Scorers are code over those records. Scorecards use the dispatch-eval scorecard's shape and header (model, Claude Code version, plugin commit, epochs, cost limit), plus the scenario's pass rate and spread. The session task is never part of a routine dispatch-eval run.

**First scenarios.**
- *Hook mid-wave:* a fixture repository with a stop hook that asks for a commit and push; a task whose first wave holds a long-running dispatch. Passes if the remote has no new commits, the main loop made no commit while a dispatch ran, the reply to the hook names that dispatch, and the trace holds a `hook` event and no intervention for it.
- *Blocked to Unverified:* a generator-evaluator task whose countable criteria name a check the sandbox cannot run (a tool denied to the evaluator, or a command absent from the image). Passes if the dispatch returns `blocked`, the orchestrator asks or, in autonomous mode, labels any accepted work UNVERIFIED in DECISIONS and lists it first in the final reply.
- *Rolling launch:* a task whose natural plan has a fast and a slow dispatch in one wave and a third depending only on the fast one. Passes if the third launches before the slow one returns, keeps its `dependsOn`, and has a higher wave number.
Each scenario must fail on 0.3.2 and pass on 0.4.0 before it counts. Epochs are set from the spike's cost so a full run of the three fits $75; the per-sample cost limit enforces it.

**Real timestamps (QUA-08).** The dispatch entry point stamps a placeholder where the orchestrator supplied no time; the agent that writes the trace (the scribe, or the worker in `single` per the companion spec) replaces it with the clock's UTC time before appending, for the dispatch's start and end. If the runtime-data spike shows the script can read the clock, the script stamps directly and the placeholder is not used. SKILL.md drops "you have no clock" and stops passing `now`.

**Version stamp (REL-07).** The build injects the package version plus the git short commit into the bundled dispatch script. It goes into the returned data, every dispatch trace line and the diagram header; SKILL.md's mode line records it.

**Trace line fields.** The dispatch line gains: start and end time, plugin version, per-agent usage (only the fields the spike shows are readable; the rest are omitted, not zeroed), evaluator rounds (criteria text once, then per round pass or fail and first feedback line), chain stage first lines, agents needed and agents run at once, refusal counts per agent, and dropped-line counts from cuts. Interventions gain `source: user | self`. A `hook` event kind carries the hook's first line. The renderer reads old traces unchanged and does not draw `hook` events.

**Refusal counts.** Working and evaluator stances ask the agent to report how many writes were refused and tools denied; the count is part of the role's structured output.

**Wait reasons.** SKILL.md: while waiting on a human, CI or a restart, the state file holds one `WAITING: <cause> since <time>` line, removed when the wait ends.

**Already covered.** The `STATUS <status>` last log line and run ids in the state file shipped with the execution-lifecycle spec (0.3.2). A running script cannot learn its run id, so the trace does not carry it.

**GitHub Actions.** One workflow, manually triggered, on a runner with Docker. Inputs map to the dispatch suite's options. The API key comes from a repository secret. The job uploads the scorecard and log as artifacts, commits nothing, and refuses the baseline option. A stub run needs no secret.

**Release.** Plugin changes (timestamps, version stamp, trace fields, refusal counts, SKILL.md lines) ship as 0.5.0, after 0.4.0; the version moves in the plugin manifest and the package manifest together. The roadmap drops the covered items.

## Testing Decisions

A good test drives a seam from outside and asserts only on what comes out: returned data, trace lines, rendered diagrams, scorecards. It never reaches into internals.

- **The session seam (new, the only new seam).** Task and fixture in; transcript, trace, state file and files out. Each scenario's scorer is tested on saved records from a passing and a failing session (prior art: the saved-log scoring tests of the dispatch evals), so scorers are checked without paying for sessions. Each scenario's sensitivity (fails on 0.3.2, passes on 0.4.0) is shown once in a paid run and recorded.
- **The dispatch seam (existing).** Fake runtime with scripted agents (prior art: the run tests): dispatch lines carry start and end placeholders or times, the version, evaluator rounds, chain stage first lines, demand and refusal counts; a cut that drops lines logs the count.
- **The render seam (existing).** Prior art: the render tests: the header shows the version; old traces without the new fields still render; `hook` events render nothing; interventions render by source.
- **The docs seam (existing).** SKILL.md no longer says the orchestrator has no clock or passes `now`, and documents the WAITING line and the version on the mode line.
- **The build.** A bundle test checks the built dispatch script carries a version matching the package version.
- **Dispatch evals.** The instrumentation release is run against the baseline; every sample's pass rate stays within its spread and dollars do not rise beyond it.
- **GitHub Actions.** A stub run of the job completes and uploads a scorecard; one paid run is recorded in the evals README.

## Out of Scope

- A run-verification skill (rank 13): no design yet.
- Skill evals (rank 14).
- The comparison arm on plain Claude Code and `lead-orchestrator` (rank 15), which needs session evals first.
- An issue tracker for specs and tickets (rank 17).
- A model grader for prose results (rank 18).
- Closing the session-analysis gaps (rank 19).
- Session-eval scenarios beyond the first three, and an end-to-end realistic task (it belongs with the comparison arm).
- Run ids in the trace: a running script cannot learn its own.
- Freezing baselines or committing results from CI.

## Further Notes

- The session-eval scenarios measure rules shipped by the companion spec; they cannot show sensitivity until 0.4.0 exists, so the harness and scorers can be built in parallel but the scenarios are accepted after 0.4.0.
- ADR-0005 kept the baseline uninstrumented; this spec is that later change, measured like any other.
- If the session sandbox spike fails, the hand checks in the companion spec remain the only measurement of orchestrator behaviour, and the roadmap records why.
