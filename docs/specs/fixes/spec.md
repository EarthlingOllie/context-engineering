# Spec: fixes — verification integrity, cost and orchestrator behaviour

Status: ready for tickets. Decisions were settled in a design interview on 2026-11-26/27. This spec covers roadmap Groups 2, 3 and 4 (`docs/roadmap.md`): ranks 1, 2, 3, 4, 8, 9, 10, 11 (measurement only) and 12, and findings REL-06, REL-08, QUA-02, QUA-03, QUA-05, QUA-07, QUA-09, QUA-10, SPD-02, SPD-03 and COST-05. Finding ids refer to `docs/v1/graph-orchestrator/session-analysis-2026-11-18/findings.md`, which holds the evidence. Vocabulary follows `docs/v1/graph-orchestrator/CONTEXT.md`; **Unverified** and **Intervention** were added and **Wave** was redefined for this spec (ADR-0006, accepted with ticket 10). Its companion spec, `docs/specs/observability-evals/`, builds the session evals that later measure the orchestrator rules here.

Ships as one release, 0.4.0.

## Problem Statement

When the orchestrator tells me a piece of work passed, I cannot trust it. In six analysed sessions an evaluator passed work that CI, a walkthrough or I later showed was wrong, because the pass criteria said things like "relevant tests pass" that no one can count. In five more, work was accepted after its dispatch ended blocked or exhausted, and nothing told me which deliverables no evaluator had passed. A chain can hide a failing review in its middle or silently skip its later stages. An iterative fan-out that needs more than a one-line finding per branch fails every time, because its evaluator only ever sees the first line.

It also costs more than it should. Every role, down to the agent that only appends trace lines, runs on the session model, and every dispatch spends a full extra agent on its trace. Some orchestrators polled external state by launching whole workflows every twenty minutes.

And the orchestrator itself misbehaves in ways I have to catch. Stop hooks drove commits and pushes I never asked for, once logged as my "yes" to a push. The diagram shows the orchestrator's own guesses as if I had made them. Ready work idles at the wave barrier, parallel builders collide on one working tree, the main loop fills with test runs and file reads until it compacts, and while I am slow to answer a question nothing else moves.

## Solution

No pass without a check that ran. Pass criteria are numbered and countable; a generator-evaluator dispatch without them fails instead of inventing "the task is complete". An evaluator that cannot run a check it needs blocks rather than passing or failing the work. Whatever the orchestrator accepts without a passing evaluator is labelled **Unverified**, listed first in its final reply, and re-reviewed next wave. A chain reports every stage, names the stages it did not run, and stops at a failing panel. The iterative fan-out evaluator sees each branch's whole result. A spec- or ticket-set task ends with one acceptance dispatch across the whole spec.

Spend less without bringing back false passes. If the Workflow tool lets a script choose an agent's model, the scribe and partition roles run on Haiku by default and a dispatch spec may name a model per role. A `single` dispatch's worker appends its own trace lines, so the scribe runs only as a fallback. Waiting on a PR, CI or another session uses a subscription or a scheduled message, not dispatches.

The orchestrator follows clear rules. A hook message is never a human answer. Its own best guesses are drawn as `self`, not `human`. A wave is a launch batch, not a barrier. Evidence work is always dispatched; housekeeping may run in the main loop only when nothing is running and it is authorised. Standing rules live in one brief file. Questions to me come after every independent dispatch has launched, with a recommended default.

Every fix is measured: against the frozen dispatch-eval baseline where the dispatch evals can see it, and by hand otherwise until session evals exist.

## User Stories

### Verification integrity

1. As the session's user, I want an iterative fan-out to finish when its branches have covered the criteria, so that research dispatches stop ending `exhausted` after covering everything.
2. As the iterative fan-out's evaluator, I want to see each branch's whole result, cut only to the return contract, so that I can judge coverage from what the branches found.
3. As the orchestrator, I want the catalog to say pass criteria are a numbered list of commands or observables with expected counts or outputs, so that I write criteria an evaluator can check.
4. As the orchestrator, I want the catalog to show which words do not make criteria ("relevant", "targeted", "touched-area", "all checks", an "except" clause), so that I recognise an uncountable criterion before launching.
5. As the orchestrator, I want criteria to include the full regression suite or name the later gate that runs it, so that a narrow pass cannot hide a regression.
6. As the orchestrator, I want a generator-evaluator dispatch without pass criteria to return `failed`, so that a missing criterion is a visible planning fault, not a silent "the task is complete".
7. As an evaluator, I want my stance to say that a denied tool I need for a criterion means I block and name the check that could not run, so that I never pass or fail work I could not check.
8. As the orchestrator, I want an evaluator that cannot run a check to end the dispatch `blocked` at once, so that the generator does not burn every round on a check that can never run.
9. As the session's user, I want a blocked result never resolved silently, in either mode, so that I am asked whenever a check could not run.
10. As the orchestrator, I want work I accept without a passing evaluator labelled Unverified in its DECISIONS line, so that the label survives into the final reply.
11. As the orchestrator, I want to plan an evaluator-only dispatch over Unverified work next wave unless the budget is spent, so that accepted work gets its review.
12. As the session's user, I want the final reply to list Unverified items first, so that I know which deliverables nobody checked.
13. As the session's user, I want a budget stop with a failing review to end with one last dispatch that reads the review and returns its blocking items, so that I learn what failed without opening files.
14. As the session's user, I want a spec or ticket-set task to end with one acceptance dispatch that checks the spec's own acceptance criteria end to end, so that per-ticket passes cannot add up to a failing spec.
15. As the orchestrator, I want a chain's result to start with one line per stage, its id, status and first line, so that a mid-chain verdict reaches me.
16. As the orchestrator, I want a chain that stops early to list the stages it did not run, so that I re-dispatch only those.
17. As the orchestrator, I want a panel stage whose verdict is FAIL to stop the chain unless the stage opts out, so that work does not continue past a failing review.
18. As the orchestrator, I want the catalog's chain section to describe the panel gate and its opt-out, so that the advice and the behaviour agree.
19. As a generator, worker or reducer, I want my stance to say that a refused write means the full content goes in my result with a first line naming the refused path, so that refused reports are not lost.
20. As the orchestrator, I want report artifacts named `.txt`, `.json` or `.html`, not `.md`, so that the harness's report-write refusal is not triggered in the first place.

### Cost

21. As the plugin maintainer, I want a spike to establish whether a Workflow script can choose an agent's model, so that model routing is built only on behaviour the runtime has.
22. As the plugin maintainer, I want the scribe and partition roles to default to Haiku if the spike passes, so that mechanical work stops costing the session model's price.
23. As the orchestrator, I want to name a model for a role in a dispatch spec, so that I can opt a dispatch's evaluator, reducer or judge into a cheaper model.
24. As the plugin maintainer, I want evaluator, reducer and judge to stay on the session model by default, so that cheaper evaluators cannot bring back false passes before sample 4 shows they do not.
25. As the plugin maintainer, I want model routing dropped entirely if the spike fails, so that no unused configuration ships.
26. As a `single` dispatch's worker, I want to append the dispatch's trace lines myself as my last step, so that the dispatch needs no second agent.
27. As the plugin maintainer, I want the scribe to run only when the worker reports it appended nothing, so that the trace is still written when the worker cannot.
28. As the orchestrator, I want SKILL.md to say that waiting on a PR, CI or another session uses a subscription or a scheduled message in the main loop, so that I never poll with dispatches.
29. As the plugin maintainer, I want per-call usage for a few remote coding agents fetched and recorded, so that the cache-write cause is confirmed before any platform ask.

### Orchestrator behaviour

30. As the session's user, I want a hook message never treated as my answer and never as authorisation for an irreversible action, so that no hook pushes on my behalf.
31. As the orchestrator, I want to answer a commit or push hook while a dispatch is running with one line naming the dispatch that owns the tree, so that I neither ignore nor obey it.
32. As the session's user, I want the main loop never to run `git add -A`, so that half-written trees are never committed.
33. As the plugin maintainer, I want hook messages recorded in the trace as their own event kind, never as interventions, so that later analyses can count hook noise without reading transcripts.
34. As the session's user, I want the diagram to draw the orchestrator's autonomous best guesses as `self` with a dashed outline, so that it never claims I was consulted when I was not.
35. As the orchestrator, I want SKILL.md to say the mode question, a user's status question and hook messages are not interventions, so that I do not record them as decisions.
36. As the session's user, I want a dispatch whose dependencies have all finished launched at once as the next wave, so that ready work does not idle at the wave barrier.
37. As the orchestrator, I want to rewrite the state file before each launch, so that rolling launches never lose track of what is running.
38. As the orchestrator, I want wave budgets to count launches, so that rolling launches do not slip past the budget.
39. As the orchestrator, I want to check before launching that every `dependsOn` id is in a lower-numbered wave, so that a same-wave dependency costs no refused launch.
40. As the plugin maintainer, I want SKILL.md to say `dependsOn` is never cleared to get round the check, so that the diagram keeps its dependency edges.
41. As the orchestrator, I want evidence work (tests, reading results, assessing after a restart, answering the user about results) always dispatched as a small `single`, so that my context stays small and the work is reviewed.
42. As the orchestrator, I want housekeeping (commit, push, PR, cleanup) allowed in the main loop only when no dispatch is running and an authorisation is recorded in the state file, so that a push does not cost a whole dispatch and never runs unauthorised.
43. As the session's user, I want the final reply to send the diagram as a file with a short summary, so that the main loop does not spend its context pasting it.
44. As the orchestrator, I want the default result limit to be 4 lines, with more than 8 needing a reason, so that results do not fill my context.
45. As the orchestrator, I want standing rules (branch policy, test rules, authorisations, attribution lines) written once to a brief file at kickoff and referenced from each spec, so that I stop re-pasting them.
46. As the session's user, I want credentials never put in a dispatch's context, only the name of the file or variable that holds them, so that secrets stay out of workflow inputs and transcripts.
47. As the session's user, I want every dispatch that does not depend on my answer launched before I am asked, so that my slow reply does not idle the session.
48. As the session's user, I want questions to come with options and a recommended default, so that I can answer quickly.
49. As a generator or worker, I want my stance to say how to wait on a long command (foreground with a timeout, or one wait on its exit status, never a `pgrep -f` loop), so that I do not spin or match myself.
50. As the orchestrator, I want the catalog to say parallel code dispatches each work in their own git worktree on a ticket branch, followed by an integrate dispatch that merges and runs the full suite, so that parallel builders never share a tree.
51. As the orchestrator, I want the catalog to say generators run targeted tests and the evaluator runs the full suite once per round, writing a log a later stage at the same commit may cite, so that a long suite does not run several times per round.
52. As the orchestrator, I want the catalog to say a wide fan-out with no shared partition can be split into sibling fan-outs of width at most 2, if the concurrency sweep confirms it helps, so that branches do not queue behind the cap.

### Measurement and release

53. As the plugin maintainer, I want each change to a role prompt measured on its own dispatch-eval run before it merges, so that a prompt change's effect on every sample is attributable.
54. As the plugin maintainer, I want a fix merged only if its targeted sample rises above the baseline spread and every other sample stays within its spread, so that fixes are shown to help and not to harm.
55. As the plugin maintainer, I want a cost fix also to drop dollars per sample below the baseline spread with no new false passes, so that savings are real.
56. As the plugin maintainer, I want orchestrator rules checked by hand in a cloud session until session evals exist, with the manual steps in each ticket, so that they ship now and are measured later.
57. As the plugin maintainer, I want all of this shipped as one version, so that the release maps to this spec.

## Implementation Decisions

**Spike first (ships nothing).** In a real cloud session, establish whether the Workflow tool's `agent()` accepts a model choice and whether the agent then runs on it. The result decides the cost section: if it passes, model routing ships; if not, model routing and the scribe-on-Haiku change are dropped from this spec, and only the worker-appended trace ships. The spike also fetches per-call usage for three remote coding agents and records whether cache writes follow tool calls that outlast the cache lifetime (COST-03's measurement; no platform ask is filed here).

**Iterative fan-out evaluator.** FINDINGS SO FAR shows each done branch's whole result, already cut to the return contract's line limit, and its artifacts. No second cap. This also covers branches with no artifacts (QUA-05 part 3).

**Countable criteria.** Written guidance only, no code check of the text: the catalog's `pass_criteria` entry becomes required and defines a criterion as a numbered item naming a command or observable and its expected count or output, including the full regression suite or the later gate that runs it, with the non-criteria words listed. Generator-evaluator returns `failed` ("pass_criteria missing") instead of its default; panel and iterative fan-out already fail on missing criteria.

**Blocked evaluator.** The evaluator's output already carries a blocked flag that stops the loop. The evaluator stance gains: if a tool needed for a criterion is denied, set blocked, ask a question naming the check that could not run, and never pass a criterion that could not be checked. The dispatch ends `blocked`. No new signature status.

**Unverified.** An orchestrator label, not a status (see CONTEXT.md). SKILL.md: work accepted without a passing evaluator, after `blocked` or `exhausted`, carries the word UNVERIFIED in its DECISIONS line; the next wave plans an evaluator-only dispatch over its artifacts unless the budget is spent; the final reply lists Unverified items first. A blocked result is never resolved silently, in either mode. A budget stop with a failing review ends with one `single` that reads the review artifact and returns its blocking items in at most 6 lines.

**Acceptance dispatch.** SKILL.md Finish: if the task is a spec or ticket set, the last wave before rendering is one acceptance dispatch (panel or single) checking the spec's own acceptance criteria end to end.

**Chain reporting.** A chain's result starts with one line per stage, `<stage id> <status>: <first line>`, then the last run stage's lines, cut to the line limit. A chain that stops early appends `not run: <stage ids and titles>`. A panel stage that is not the last stage and whose result's first line starts `FAIL` stops the chain with status `exhausted` and a result naming the panel, unless the stage's params set `gate: false`. The panel's verdict line is built by code, so reading line 1 is safe; the signature does not change. The catalog's chain section matches.

**Refused writes.** Generator, worker and reducer stances: if a write is refused, put the full content in the result and make line 1 `ARTIFACT REFUSED: <path>`. SKILL.md and the catalog examples name report artifacts `.txt`, `.json` or `.html`.

**Model routing (only if the spike passes).** Agent options gain an optional model. A role entry in a dispatch spec gains an optional model. A per-role default table puts scribe and partition on Haiku and leaves every other role unset (the session model). Every role call passes the spec's model for that role, else the default. Evaluator, reducer and judge on Sonnet stay opt-in per spec.

**Worker-appended trace for `single`.** The worker's prompt gains a final step to append the dispatch's trace lines to its trace file and report how many it appended. The scribe runs only when the worker reports none. Other topologies keep the scribe.

**Waiting on external state.** SKILL.md's "when not to use" and its "everything else is a dispatch" rule gain: waiting on a PR, CI or another session uses a subscription or a scheduled message in the main loop; dispatch only when the check needs reading code.

**Hooks.** SKILL.md's irreversible-action trigger gains: a hook message is never a human answer and never authorises an irreversible action; while a dispatch is running, answer a commit or push hook with one line naming the dispatch that owns the tree and do nothing else; never `git add -A` in the main loop; record a hook as a `hook` trace event, not an intervention. The trace gains a `hook` event kind carrying the hook's first line, which the renderer does not draw.

**Interventions.** The renderer titles an intervention by its source, `self` when its mode is autonomous and `human` otherwise, and gives `self` nodes their own dashed class. SKILL.md: the mode question, a user's status question and hook messages are not interventions.

**Rolling launches (ADR-0006).** SKILL.md: when a dispatch returns and a FRONTIER item depends only on finished dispatches, it may launch at once as the next wave number; rewrite the state file before each launch; wave budgets count launches. Before launching, each `dependsOn` id must be in a lower-numbered wave, else the dispatch moves to the next wave or the pair becomes one chain; never clear `dependsOn`. The same-wave refusal in code stays. ADR-0006 becomes accepted when this ships; CONTEXT.md already defines Wave this way.

**Main-loop work.** SKILL.md's exceptions to the rule: evidence work (after a restart, a user question about results) is a `single` with at most 6 lines. Housekeeping (cleanup, commit, push, PR) may run in the main loop only when no dispatch is running and an authorisation is recorded in the state file; an irreversible step still asks. A rationalisations row: "it's only a git push".

**Context hygiene.** Final reply: the diagram's file, sent, plus a summary of at most 3 lines, not its text. Default `maxLines` 4; above 8 needs a reason. Standing rules go once into a brief file in the scratch directory at kickoff; each spec's context names it. Never put a credential in context; name where it is held.

**Human waits.** SKILL.md's ask step: before asking, launch every FRONTIER dispatch that does not depend on the answer; offer options with a recommended default.

**Waiting in subagents.** Generator and worker stances: to wait on a long command, run it in the foreground with a timeout, or start it in the background and wait once on its exit status; never loop on `pgrep -f`.

**Planning-model catalog sections.** Parallel code changes: each generator in its own git worktree on `ticket/<id>`, followed by an integrate generator-evaluator that merges and runs the full suite; SKILL.md's wave planning gets one line pointing to it. Tests per round: generators run targeted tests, the evaluator runs the full suite once per round and logs it to the scratch directory, and a later stage at the same commit cites the log. Split fan-outs: only after one concurrency sweep run confirms that sibling fan-outs of width at most 2 finish faster than one wide fan-out; if it does not, the section is not added.

**Release.** All of it ships as 0.4.0; the version moves in the plugin manifest and the package manifest together. The roadmap drops the covered items.

## Testing Decisions

A good test drives a seam from outside and asserts only on what comes out: the returned status and result, the prompts the scripted agents received, the rendered diagram, or the documented text. It never reaches into topology internals.

- **The dispatch seam (automated).** Run a dispatch spec through the workflow entry point against the fake runtime with scripted agents (prior art: the run, iterative fan-out and panel tests). New tests:
  - iterative fan-out: the round-2 evaluator's prompt contains each round-1 branch's whole result;
  - generator-evaluator without pass criteria returns `failed` and spends no agents;
  - an evaluator scripted to block ends the dispatch `blocked` with its question;
  - chain: the result has one line per stage; a stage that is not done yields a `not run:` list; a mid-chain panel FAIL stops the chain as `exhausted`, and `gate: false` lets it continue;
  - model routing (if shipped): scribe and partition calls carry the Haiku default, a spec's role model overrides it, other roles carry none;
  - `single`: the scribe is skipped when the worker reports appended lines and runs when it reports none;
  - stance text: the evaluator, generator, worker and reducer prompts carry the new sentences.
- **The render seam (automated).** Trace files in, diagram out (prior art: the render tests): an autonomous intervention renders as `self` with the dashed class; a `hook` event renders nothing.
- **The docs seam (automated).** Assertions on SKILL.md and catalog text (prior art: the launch and resume docs tests): each orchestrator rule and catalog section above is present, and no document still says the wave is waited on in full or tells the orchestrator to paste the diagram.
- **Dispatch evals (merge gate).** Prompt changes (blocked evaluator, refused-write fallback, waiting in subagents, worker-appended trace) each get their own run against the frozen baseline before merging; code fixes are measured by their own sample (rank 1 by sample 10, countable criteria by sample 16 with sample 4 as the vague-criteria guard, chain by sample 9, cost by every sample's dollars). A fix merges only if its target rises above the baseline spread and every other sample stays within its spread; cost fixes must also drop dollars below the spread with no new false passes.
- **By hand, in a cloud session.** The hook rule, rolling launches, Unverified, the acceptance dispatch, main-loop work, human waits and context hygiene are SKILL.md behaviour with no automated seam until session evals exist. Each ticket states its manual steps as acceptance criteria.

## Out of Scope

- Session evals, plugin instrumentation, real timestamps, the version stamp and running evals from GitHub Actions: the companion spec `docs/specs/observability-evals/`.
- Evaluator, reducer and judge on Sonnet by default: a later change, once sample 4's false-pass rate holds at the baseline with them opted in.
- Filing a platform ask for a longer cache lifetime: this spec only measures the cause.
- A code check on the wording of pass criteria.
- A worker-appended trace for topologies other than `single`.
- Auto-promoting a same-wave dependency to the next wave; the refusal stays.
- The harness-side fixes for refused report writes and classifier availability, already written up in the execution-lifecycle asks.

## Further Notes

- The roadmap's notes say rank 1 and QUA-05 change the same line; rank 1's change also completes QUA-05's third part, so QUA-05 here is only the fallback and the naming.
- REL-08 and QUA-02 are one term, Unverified, defined from both sides: the evaluator blocks, the orchestrator labels what it accepts anyway.
- Orchestrator rules shipped here are measured again once the companion spec's session evals exist; its first scenarios target the hook rule, blocked to Unverified, and rolling launches.
- ADR-0006 was proposed when this spec was written; ticket 10 accepted it, and it ships with this release.
