# Spec: execution and lifecycle — dispatches launch, survive interruption and report their real status

Status: ready for tickets. Decisions were settled in a design interview on 2026-11-26. This spec covers roadmap Group 1 (`docs/roadmap.md`): rank 2 (REL-01, REL-02), REL-03, REL-05 and rank 14. Finding ids refer to `docs/v1/graph-orchestrator/session-analysis-2026-11-18/findings.md`, which holds the evidence. Vocabulary follows `docs/v1/graph-orchestrator/CONTEXT.md`; **Run** and **Stopped** were added to it for this spec, and `failed` was added to the **Signature**.

Ships as one release, 0.3.2.

## Problem Statement

When I start the orchestrator in a cloud session, the first thing that usually happens is a failure. The launch SKILL.md documents is refused in 15 of 20 analysed sessions, and each orchestrator improvises its own workaround. Worse, it often tells me "Wave 1 dispatched" in the same second the launch failed, so I wait for work that never started.

Once dispatches are running, they do not survive interruption. A container or worker restart kills them, and whether the work is recovered depends on whether that orchestrator happens to know about `resumeFromRunId`. Most relaunch from scratch, which threw away about $45 of finished agent work and up to two hours of critical path per restart. A usage limit is worse still: every agent dies, the dispatch comes back `failed` with "worker returned nothing", and nothing tells the orchestrator (or me) that the cause was a limit rather than a bad spec. In one session that meant 27 minutes of idle time until I stepped in.

Finally, the harness's completion notification says "completed" for every run that returned, whether it was done, blocked, exhausted or failed. The orchestrators read the returned data correctly, but anyone counting notifications, me included, gets the wrong answer.

## Solution

The orchestrator launches each dispatch through a route the harness accepts, and only says a wave is dispatched once every launch returned a run. It records each dispatch's run id in the state file as soon as it has one.

At the start of every turn, the orchestrator resumes interrupted work: any dispatch on the frontier that has a run id but no integrated result is relaunched with `resumeFromRunId`, and so is any dispatch whose `failed` result reports a usage limit. Finished agents replay from cache, so nothing done is redone. This one rule covers container restarts, usage limits and anything else that ends a run without a result I integrated, and it needs no knowledge of which runs died or why. It runs in both modes without asking, because it is reversible.

Every run's last log line states the dispatch's real status, and a `failed` result carries the error an agent threw, so a usage limit is visible as one.

The changes that only the harness or the platform can make are written up, with evidence, in one note I can file.

## User Stories

1. As the session's user, I want the first dispatch of a session to launch without a refusal, so that a session does not start with a failure.
2. As the session's user, I want every session to use the same launch route, so that behaviour does not depend on which workaround an orchestrator invents.
3. As the session's user, I want each workflow still named for its dispatch's purpose, so that watching a wave shows its goals (ADR-0003, ADR-0004).
4. As the session's user, I want "Wave n dispatched" said only after every launch returned a run, so that I am never told work started when it did not.
5. As the orchestrator, I want a launch error to be fixed and relaunched before I report anything, so that a refused launch costs one retry, not a stalled session.
6. As the orchestrator, I want a documented fallback launch for when the preferred route is unavailable, so that I never have to improvise one.
7. As the orchestrator, I want each dispatch's run id written to the state file right after launch, so that it survives compaction and a restart.
8. As the orchestrator, I want to check at the start of every turn for dispatches with a run id but no integrated result, so that interrupted work is found whatever interrupted it.
9. As the orchestrator, I want to relaunch interrupted dispatches with `resumeFromRunId`, so that finished agents replay from cache instead of running again.
10. As the session's user, I want resume to happen without being asked, in attended and autonomous mode alike, so that recovery does not wait on me for a reversible step.
11. As the orchestrator, I want to relaunch a dispatch fresh once if its resume fails, and treat a second failure as `failed`, so that recovery cannot loop.
12. As the orchestrator, I want a run the harness reports as stopped handled by the same resume rule, so that I do not need a separate path for restarts.
13. As the session's user, I want work killed by a container restart recovered automatically, so that a restart costs minutes, not hours.
14. As the orchestrator, I want a `failed` result to say what an agent threw, so that I can tell a usage limit from a bad spec.
15. As the orchestrator, I want a `failed` result caused by a usage limit resumed once I next get a turn, so that the work continues after the limit resets without anyone re-planning it.
16. As the orchestrator, I want not to "fix the spec" after a usage-limit failure, so that I do not change a correct spec because of an outage.
17. As the session's user, I want a session interrupted by a usage limit to pick up where it stopped, whether the harness resumes it or I type "continue", so that the limit costs only the wait.
18. As the orchestrator, I want SKILL.md to say the notification's "completed" is not the dispatch's status, so that I act only on the returned `status`.
19. As someone watching a workflow, I want its last log line to be `STATUS <status>`, so that the real outcome is visible without reading the returned data.
20. As the plugin maintainer, I want counts of dispatch outcomes taken from the log line, not the notification, so that later analyses and audits are right.
21. As the plugin maintainer, I want each run id in the trace where the runtime makes it available, so that a later analysis can find a dispatch's journal without guessing.
22. As the plugin maintainer, I want the harness and platform asks written up with their evidence in one note, so that I can file them where the owners will see them.
23. As the plugin maintainer, I want the spike's findings recorded before the launch and resume changes are built, so that those changes rest on observed behaviour, not on documentation.
24. As the plugin maintainer, I want the README and ADR-0003 to show the same launch SKILL.md documents, so that no document teaches the refused route.
25. As the plugin maintainer, I want the bundle-level behaviour (error text in `failed`, the STATUS line) covered by automated tests, so that a later change cannot silently undo it.
26. As the plugin maintainer, I want all of this shipped as one version, so that the release maps to one roadmap group.

## Implementation Decisions

**Spike first (ships nothing).** Run in a real cloud session before the other work, and record findings in the spike's ticket:
- Whether a wrapper that launches the dispatch script by its registered workflow name (`graph-orchestrator:dispatch`) still shows the wrapper's `meta.name` as the workflow's name.
- What the full error text of a usage-limit agent failure says, and whether it carries a reset time (best-effort: from past session transcripts, or a limit met in passing).
- Whether the harness resumes a session automatically when a usage limit resets, or waits for the human.
- Whether the orchestrator can still take a turn once its agents are limited.
- That relaunching an already finished run with `resumeFromRunId` returns quickly, with every agent replayed from cache. The resume rule rests on this; if it causes long delays, the rule is rethought before it ships.
- Whether a running script can learn its own run id (it decides whether the trace records it).

**Launch.** The documented launch becomes the wrapper calling the dispatch workflow by its registered name, if the spike shows `meta.name` survives. Otherwise, the documented launch is a copy of the plugin's workflows into the session scratch directory once at kickoff, added as a fourth exception to "the rule" in SKILL.md, with the wrapper pointing at that copy. The wrapper stays two lines and `meta` stays a literal. README and ADR-0003 change to match.

**Honest dispatch line.** SKILL.md says "Wave n dispatched" only once every Workflow call of the wave returned a run. Any launch error is fixed and relaunched first.

**Run ids.** The orchestrator records each dispatch's run id on that dispatch's FRONTIER line in the state file, right after launch. The trace's dispatch line gains the run id if the spike shows the script can learn it; if not, the state file alone holds it.

**Resume interrupted runs.** One SKILL.md rule, applied at the start of every turn and in both modes without asking:
- A dispatch on FRONTIER with a run id and no integrated result is relaunched with `resumeFromRunId` set to that run id.
- A dispatch whose result is `failed` with a usage-limit error is relaunched the same way.
- If a resume fails, relaunch fresh once; a second failure is treated as `failed`.

**Stopped** is a run outcome, not a signature status: the topology code never returns it, so it is handled by the resume rule, not added to the status table's statuses. The integrate table gains a line pointing to the rule.

**Real status.**
- SKILL.md: the notification says "completed" whenever the script returned; the dispatch's status is only in the returned data.
- The dispatch entry point logs `STATUS <status>` as its last log line, after the scribe, for every status, including `failed` and `over_budget` returned before any agent ran.
- An agent call that throws keeps its error message, and a `failed` result caused by it includes that message (for example, that the worker threw a usage-limit error), in place of a bare "returned nothing". The result still fits the return contract's line limit.
- The `failed` status's code comment is corrected: it is part of the orchestrator-facing signature.

**Harness and platform asks.** A note, `asks.md`, in this spec's folder. One section per ask, each naming the finding, the evidence and the plugin-side mitigation this spec ships: accept a plugin-root `scriptPath`; carry the script's returned status into the notification; allow subagent writes under the session scratchpad; a restart notice or drain; classifier availability; faster or visible plugin sync.

**Release.** All of it ships as 0.3.2; the version moves in the plugin manifest and the package manifest together.

## Testing Decisions

A good test drives the built dispatch script from outside, with a fake engine, and asserts only on what comes back and what is logged: the returned status and result, the log lines. It never reaches into topology internals.

- **Automated, at the bundle seam.** The eval harness already runs the built `dispatch.js` against an injected engine (prior art: the stub-engine and harness tests). New tests there:
  - an engine whose agent calls throw a usage-limit error: the dispatch returns `failed`, and its result contains the error text;
  - for a done, an exhausted, a failed and an over-budget dispatch: the last log line is `STATUS <status>` matching the returned status.
- **By hand, in a cloud session.** Launch, the dispatch line, run ids, the resume rule and the notification sentence are SKILL.md behaviour, with no automated seam until session evals exist (roadmap rank 5). Each ticket states its manual steps as acceptance criteria. The manual checks for REL-01, REL-03 and REL-05 in the evals README are a starting point.
- Dispatch evals against the baseline are not required: no role prompt changes. Fuller dispatch-eval coverage of these behaviours is future work.

## Out of Scope

- Scheduling a wake for when a usage limit resets. The orchestrator is limited too, so it acts only once the limit has reset, on its next turn.
- Per-role models, which could keep agents off a limited model (rank 3, Group 3).
- Rolling launches (rank 10) and the same-wave `dependsOn` check (REL-06).
- Filing the harness and platform asks; this spec only writes them.
- Session evals (rank 5), which would automate the manual checks.
- An engine other than the Workflow tool; the LangGraph port was dropped from the roadmap.

## Further Notes

- The resume rule relaunches anything not integrated, including runs that may have finished while the orchestrator could not take a turn. This is deliberate: resuming a finished run should replay from cache, so the orchestrator never needs to know which runs died. The spike must confirm it is cheap and quick.
- In the one analysed usage-limit session (hQTT), the harness did not resume automatically; the human typed "continue". The rule works either way.
- If the registered-name launch is adopted, ADR-0003's wrapper and its "to verify in a live session" list should be updated, and the spike's result closes that list's open item on plugin script paths.
