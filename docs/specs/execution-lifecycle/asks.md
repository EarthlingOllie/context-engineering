# Asks of the harness and the platform

Six changes that only the owners of the Workflow tool, Claude Code, claude.ai or the cloud platform can make. Each section names the finding, its owner, the sessions affected, a short summary of the evidence and the plugin-side mitigation. This note covers roadmap rank 14 for the execution and lifecycle spec (`spec.md` in this folder); it writes the asks, and filing them is out of scope.

The evidence for every ask is in the session analysis, [`findings.md`](../../v1/graph-orchestrator/session-analysis-2026-11-18/findings.md). Sessions are named by the short ids it uses. Owners follow its **Owner** labels:
- **harness**: Claude Code, the Workflow tool or claude.ai behaviour.
- **platform**: the cloud container and its limits.

## 1. Accept a plugin-root `scriptPath` (REL-01)

**Ask.** Accept a Workflow `scriptPath` under the plugin root (`${CLAUDE_PLUGIN_ROOT}/workflows/dispatch.js`), or document a plugin-workflow entry point that keeps the wrapper's `meta.name`.

**Owner.** Harness (the Workflow tool).

**Sessions affected.** 15 of 20 analysed sessions had their first launch refused: d9gr, dJmJ, dQHS, efwY, eiLu, eptK, fS88, fm1f, fnVU, g2Kg, g7is, gRP1, gdsq, hD76 and hQTT. Three more (d6Vc, dKG5, eznd) were already on a workaround, and the analysis session itself hit it.

**Evidence.** The launch the plugin documented was refused with "scriptPath must be a script path this tool returned, or a file you can already read": 20 refused launches in total. The synced plugin directory is not a path the session can Read. Orchestrators invented four different workarounds, and gRP1 never recovered. See [REL-01](../../v1/graph-orchestrator/session-analysis-2026-11-18/findings.md#rel-01--the-documented-scriptpath-launch-is-refused-in-cloud-sessions).

**Plugin-side mitigation.** Ticket 03 documents one launch route the harness accepts, chosen by the ticket 01 spike: a two-line wrapper with a literal `meta` that launches the registered workflow `graph-orchestrator:dispatch`, or, if that loses `meta.name`, a copy of the plugin's workflows into the session scratch directory at kickoff. SKILL.md also says "Wave n dispatched" only once every launch returned a run (REL-02). Either route is a workaround; a plugin-root `scriptPath` would let the plugin launch its own file directly.

## 2. Carry the script's returned status into the notification (REL-05)

**Ask.** Make the completion notification's status the `status` field the script returned, not just the fact that the script returned.

**Owner.** Harness (the Workflow tool).

**Sessions affected.** 7 sessions where "completed" was reported for a run that was not done: efwY, fnVU and d9gr (blocked); fS88 and eznd (exhausted); eznd and g7is (refused for a same-wave dependency); hQTT (usage limit). eptK also had a usage-limit failure.

**Evidence.** In hQTT wave 2 all four agents died on a usage-limit error, the notification still said "completed", and 27 minutes of idle time followed until the human typed "continue". The orchestrators read the returned data correctly each time, but any count of notifications is wrong, including the counts in the analysis itself. See [REL-05](../../v1/graph-orchestrator/session-analysis-2026-11-18/findings.md#rel-05--the-notification-says-completed-for-blocked-exhausted-failed-and-usage-limit-runs).

**Plugin-side mitigation.** Ticket 02: the dispatch's last log line is `STATUS <status>` for every status, including early returns before any agent ran, and a `failed` result carries the error an agent threw, so a usage limit shows as one. SKILL.md says the notification's "completed" is not the dispatch's status. Ticket 04 resumes a `failed` result caused by a usage limit with `resumeFromRunId`. The notification itself still says "completed".

## 3. Allow subagent writes under the session scratchpad (QUA-05)

**Ask.** Let workflow subagents write report-like `.md` files under the session scratchpad, so long output can go to a file the orchestrator reads.

**Owner.** Harness (Claude Code's subagent Write policy).

**Sessions affected.** dQHS, d9gr and fS88, plus the analysis session itself.

**Evidence.** A dQHS generator could not write its findings file; a d9gr summary write was refused; in fS88, eight area reports existed only in the workflow journal, and the iterative fan-out ended exhausted. In the analysis session the reducer's, the aggregator's and the generator's writes were all refused ("Subagents should return findings as text"). See [QUA-05](../../v1/graph-orchestrator/session-analysis-2026-11-18/findings.md#qua-05--the-harness-refuses-subagent-md-report-writes-and-the-plugin-asks-for-them).

**Plugin-side mitigation.** None in this spec. The plugin part of QUA-05 (an `ARTIFACT REFUSED: <path>` fallback in the role stances, non-`.md` report names, and the full result for branches with no artifacts) is planned under roadmap Group 2, verification integrity.

## 4. A restart notice or drain (REL-03)

**Ask.** Before a container or worker restart, give running sessions a notice, or drain running workflows first, so dispatches are not killed mid-run.

**Owner.** Platform (the cloud container runtime).

**Sessions affected.** 5 sessions: d6Vc, g7is, d9gr, fMmB and dKG5.

**Evidence.** d6Vc lost at least 18 dispatches to 4 restarts; g7is lost 5 runs to 3 restarts; d9gr lost 111 minutes of critical path on one stopped dispatch; fMmB and dKG5 redid killed work as new waves. The analysis counts 36 stopped dispatches, about $100 of agent spend [model], of which about $45 was in agents that had already finished. See [REL-03](../../v1/graph-orchestrator/session-analysis-2026-11-18/findings.md#rel-03--container-and-worker-restarts-kill-dispatches-and-resume-is-ad-hoc).

**Plugin-side mitigation.** Ticket 04: the orchestrator records each dispatch's run id on its FRONTIER line, and at the start of every turn relaunches any dispatch with a run id but no integrated result with `resumeFromRunId`, so finished agents replay from cache; a failed resume gets one fresh relaunch, then `failed`. This recovers finished work after a restart, but the work in flight is still lost.

## 5. Classifier availability (REL-08)

**Ask.** Keep the auto-mode permission classifier available to workflow subagents, and make a denial visible to the orchestrator rather than only to the subagent.

**Owner.** Harness (the auto-mode classifier's availability and policy).

**Sessions affected.** 5 sessions: eznd, fS88, fnVU, gdsq and d6Vc.

**Evidence.** eznd had four "Classifier unavailable" denials and one `rm` denial; its w6-d1 evaluator was blocked from running Bash, and the ticket was accepted on the generator's evidence. fS88, fnVU and gdsq had permission denials of their own. See [REL-08](../../v1/graph-orchestrator/session-analysis-2026-11-18/findings.md#rel-08--subagent-permission-and-classifier-denials-are-absorbed-silently-or-become-unreviewed-passes).

**Plugin-side mitigation.** None in this spec. The plugin part of REL-08 (an evaluator that sets pass=false and names the check it could not run when a tool is denied) is planned under roadmap Group 2, paired with QUA-02.

## 6. Faster or visible plugin sync (REL-07)

**Ask.** Sync the plugin from its repository faster, or show sessions which synced version they are running.

**Owner.** Harness (claude.ai plugin sync).

**Sessions affected.** 4 sessions: dJmJ, fm1f, eptK and hQTT.

**Evidence.** In dJmJ, a change committed in wave 2 never showed in later waves, because they ran the synced copy, and the orchestrator described the new behaviour to the user as if it were live. fm1f, eptK and hQTT ran an older one-workflow-per-wave build with different semantics. At the time of the analysis, the installed copy still differed from the repo. See [REL-07](../../v1/graph-orchestrator/session-analysis-2026-11-18/findings.md#rel-07--sessions-run-a-stale-synced-plugin-build).

**Plugin-side mitigation.** None in this spec. The plugin part of REL-07 (a version stamp injected at build time and reported in the dispatch result, the scribe line and the trace header) is planned under roadmap Group 5, observability and evals.
