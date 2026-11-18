# graph-orchestrator: findings from 20 real sessions, for quality / speed / cost iteration

Inputs: `SCRATCH/sessions/summary.md` (the 20-session table, totals and patterns X1-X23), `SCRATCH/sessions/<id>.md` (20 notes), `SCRATCH/cost-speed.md`, `SCRATCH/quality-audit.md`, `SCRATCH/plugin-map.md`, `SCRATCH/prior-findings.md`, `SCRATCH/sessions-inventory*.md`, and this session's own run (`SCRATCH/state.md`).
`SCRATCH` = this directory (`docs/v1/graph-orchestrator/session-analysis-2026-11-18/`); the run used the session scratchpad. Raw event pages and parsing scripts were not kept.

Every plugin `file:line` below was re-checked against the repo source at `/home/user/context-engineering/graph-orchestrator/`. Its src and workflows are identical to the installed copy; only plugin.json, README.md and SKILL.md differ (plugin-map.md §1). Event ids are the 8-character prefixes the notes give.

Labels:
- **[exact]**: read from billing fields.
- **[model]**: from the per-agent cost model in cost-speed.md (±25%).
- **[est]**: a judgement estimate.

**Owner** says who can fix it:
- **plugin**: a change in this repo (SKILL.md, catalog.md, src/).
- **harness**: Claude Code, the Workflow tool or claude.ai behaviour (notifications, Write refusals, cache TTL, permission classifier, plugin sync).
- **platform**: the cloud container and its limits (restarts, the concurrency cap of 2, usage limits).
- **environment**: the user's repo setup (stop hooks).

---

## Executive summary

### Headline numbers

| measure | value | source |
|---|---|---|
| sessions analysed | 20 (of 26 confirmed in the inventory) | summary.md |
| waves / dispatches / agents | 228 / 418 / 1,152 (agents n = 19) | summary.md totals |
| cost | **$5,357.56** total, median $119.12 per session | summary.md totals |
| wall clock | 366.9 h total, median 7.9 h | summary.md totals |
| outcomes | accepted 7, accepted (weak) 2, accepted* 1, corrected 2, redone 1, abandoned 1, **unknown 6** | summary.md |
| sessions with at least one failure | **19 of 20** (only hAaY had none) | summary.md |
| failures | 20 refused scriptPath launches in 15 sessions; 9 failed, 7 blocked, 10 exhausted, 1 over_budget, **36 stopped** | summary.md totals |
| confirmed evaluator/panel false passes | **6 sessions** (+1 plausible) | quality-audit.md §2 |
| largest $ line item | cache **writes**: 55.9% of session $ | cost-speed.md §2 [exact] |
| generators | 61.9% of agent $ and 60.6% of agent-hours; chained ticket g-e is 63.6% of agent $ | cost-speed.md §4-5 [model] |
| orchestrator main loop | 1-11% of session $, median 6% | cost-speed.md §3 [exact] |
| idle wall clock | 38% of session span is idle. The wave barrier idles 42% of slot time in multi-dispatch waves, and queueing is 35% of fan-out agent time | cost-speed.md §6 |
| work killed by restarts | 9.0% of agent $ (~$100 [model]). About $45 of it was in finished agents and could have been replayed | cost-speed.md §7 |
| g-e first-round pass | 113 of 156 loops (72%); rounds ≥2 are 11% of g-e $ | cost-speed.md §5 |

### Top 5 changes

1. **Fix the launch path (REL-01, P0, S).**
   - The documented `scriptPath` wrapper at `SKILL.md:88` was refused in 15 of 20 sessions, and in this one. The other sessions already used a hand-made copy.
   - Fix: make "copy `workflows/` into SCRATCH at kickoff" the documented path, and say "Wave dispatched" only after the launch returns a task.
2. **Make pass_criteria countable and add a spec-level acceptance gate (QUA-01, P0, M).**
   - 6 false passes are confirmed, all on criteria like "relevant", "targeted", "touched-area" or "all checks".
   - Fix: a countability rule in `catalog.md:48`; `failed` instead of a silent default at `generator-evaluator.ts:10`; an acceptance dispatch at finish in SKILL.md.
3. **Per-role model in `callRole` (COST-01, P0, M).**
   - `shared.ts:182` passes no model, so scribes and partitions run on Opus, or on Fable at 2× the price.
   - Haiku for scribe and partition saves ~6% of agent $ [model] (about $300), with no quality risk, once a spike confirms `agent()` accepts a model. This is also COST-02(a): the scribe moves to Haiku here.
   - Up to about 13.9% of agent $ (about 12.8% of session $, ~$685 of the $5.3k observed) only if Sonnet evaluators, reducers and judges pass the QUA-01 false-pass check; that part is opt-in.
4. **A hook message is never a human answer (QUA-04, P0, S).**
   - In 10 sessions, stop hooks drove commits and pushes, or were logged as the human "Yes" to an irreversible-action gate.
   - Fix: one rule at `SKILL.md:80`.
5. **Rolling launches instead of the wave barrier (SPD-01, P1, M).**
   - 42% of slot time idles in multi-dispatch waves (cost-speed.md §6).
   - [est] 10-25% less active wall clock in sessions with ≥2 dispatches per wave; $ ≈ 0.

### Count by priority

- **By priority:** P0 4, P1 12, P2 11 (27 findings). COST-01 counts as P0; its Sonnet-evaluator part is P1.
- **By owner:**
  - Rule: a finding counts as harness/platform when its root cause names a harness or platform part, fully or partly; every other finding counts as plugin-fixable. 17 + 10 = 27.
  - Plugin-fixable: 17.
  - Owned by the harness or platform, fully or partly, with a plugin mitigation: 10 (REL-03, REL-05, REL-07, REL-08, QUA-05, QUA-10, SPD-03, SPD-04, COST-02, COST-03).
  - QUA-04 starts in the environment (repo stop hooks), but the plugin can mitigate it fully.

---

## Reliability

### REL-01 · The documented scriptPath launch is refused in cloud sessions

**Pattern.** X1: 15 sessions, plus 3 already on a workaround, plus this session.

**Evidence.**
- The first launch was refused with "scriptPath must be a script path this tool returned, or a file you can already read" in:
  - d9gr `2e7fde8c`, dJmJ `c6047292`, dQHS (both dispatches), efwY `4c0e146c`, eiLu `c4513c70`;
  - eptK `22db2bd2`, fS88 `d2efa2f7` and `6647ab76`, fm1f `5faeb723`, fnVU `19dd43e4`;
  - g2Kg `cb85ced5`, `8d89fdc8` and `7699499a`, g7is `7742d05b`, gRP1 `e0a663b9`;
  - gdsq `1ba1b6e4`, hD76 `e88e9fb2` and `0827fe48`, hQTT `d44e3e76`.
- That is 20 refused launches in total (summary.md `sp total 20`).
- d6Vc, dKG5 and eznd ran a SCRATCH copy throughout (d6Vc `2a7c0637`, dKG5 `cabfbca7`, eznd `398f7bf4`).
- This session hit it too (state.md DECISIONS: "scriptPath refusal worked around via cp workflows/ into SCRATCH").
- Orchestrators invented four different workarounds:
  - copy to SCRATCH: d9gr, efwY, eiLu, gdsq, g7is, gRP1, fnVU, hD76, fS88, dQHS;
  - the repo's own copy: g2Kg;
  - the registered workflow name `graph-orchestrator:wave`: fm1f, dJmJ, eptK, hQTT (older wave.js build);
  - a custom wrapper: d6Vc `ship.js`.

**Root cause.** Plugin.
- `SKILL.md:88` and `README.md:43` tell the orchestrator to pass `${CLAUDE_PLUGIN_ROOT}/workflows/dispatch.js` as `scriptPath`.
- The harness accepts only paths the session can Read, and the synced plugin directory is not one. That harness rule is not expected to change.
- ADR-0003 `0003-one-workflow-per-dispatch.md:32` lists exactly this case as "to verify in a live session", and it was never closed (prior A5).

**Proposed change.**
1. SKILL.md kickoff, after `:38`: "Copy the plugin's workflows once: `mkdir -p SCRATCH/plugin && cp -r ${CLAUDE_PLUGIN_ROOT}/workflows SCRATCH/plugin/`." Add it as exception 4 to the rule at `SKILL.md:15-19`.
2. `SKILL.md:88`: use `workflow({ scriptPath: 'SCRATCH/plugin/workflows/dispatch.js' }, args)` with SCRATCH substituted. Make the same change in `README.md:43` and ADR-0003 `:12`.
3. Spike, but do not ship, the registered-name route `Workflow({ name: "graph-orchestrator:dispatch", args })`.
   - It worked for the older `wave` build in 4 sessions.
   - It would lose the per-dispatch `meta.name` (ADR-0004), so the copy stays the default.

**Expected impact.**
- Per session it removes 1 failed launch, 1-2 min of re-planning and one main-loop turn (cost-speed.md §7 [est]: $0.05-0.3 per turn). That is under 0.1% of $.
- The value is reliability, not cost: 15 of 20 sessions start with a failure, and gRP1 never recovered (its retry was stopped 56 s in).

**Effort** S · **New/known** known (R1, A5) · **Priority** P0.

### REL-02 · "Wave N dispatched" is told to the user before the launch fails

**Pattern.** X2: 7 sessions.

**Evidence.**
- dQHS `08081332`, eiLu `274b92ce`, fS88 `55b2bcfe`, g2Kg `9e6ac6ea`, gdsq `69beacad`, fnVU `afe1392c`, gRP1 `fcd497e7` (quality-audit.md M3; gRP1.md obs 1).
- In each, the turn ended with "Wave 1 dispatched" (or "running") in the same second as the failure.

**Root cause.** Plugin. `SKILL.md:100` says "Then say one line, `Wave <n> dispatched…`, and wait". Nothing checks that each `Workflow` call returned a task rather than an error.

**Proposed change.** At `SKILL.md:100`: "When every Workflow call has returned a task id, say one line… If any call returned an error, fix the launch (see the kickoff copy) and relaunch before saying anything." This pairs with REL-01.

**Expected impact.** No false progress reports (7 of 20 sessions). The user is not left waiting on a wave that never started; gRP1 ended that way.

**Effort** S · **New/known** known (R1, as its visible symptom) · **Priority** P1.

### REL-03 · Container and worker restarts kill dispatches, and resume is ad hoc

**Pattern.** X10: 5 sessions.

**Evidence.**
- **d6Vc:** 4 restarts killed at least 18 dispatches, including all six wave-36 workflows (`585fa838`, `a7bcc9bb`, `e7622f14`, `715b98ff`, `9ed1524b`, `76fb0815`; d6Vc.md obs 11 and 16).
- **g7is:** 3 restarts killed 5 runs (`38dea46a`, `fccaefb3`). They were relaunched with `resumeFromRunId`.
- **d9gr:** w2-d3 was stopped after 1h51m (`6966a6fe`) and resumed (`57d35751`). 111 min of critical path were lost.
- **fMmB:** 3 restarts. The w4 traces were lost and the work was redone as w5 (`cbe1c287`); w22-d1 was stopped (`d30ef666`).
- **dKG5:** w12-d1..d4 were killed and re-dispatched as w13 (dKG5.md obs 6).
- **Totals:** summary.md counts 36 `stopped` dispatches. cost-speed.md §7 finds 14 tasks and 24 agents in the windows read: **$100 [model], 9.0% of agent $**, of which $45 was in agents that had already finished.

**Root cause.** Platform: container restarts are owned by the cloud runtime. Plugin part:
- The status table at `SKILL.md:108-114` has no row for a run the harness reports as `stopped` or killed.
- Nothing mentions `resumeFromRunId`, so recovery depended on each orchestrator finding it.
- g7is and d9gr found it. d6Vc relaunched fresh, saying it was "the fourth time" (`1947645e`).

**Proposed change.**
- Add a row to `SKILL.md:108-114`: "`stopped` (worker restart, no result): relaunch the same wrapper with `resumeFromRunId: <the run id>`, so finished agents replay from cache. Record run ids per dispatch in state.md FRONTIER so they survive compaction. Never re-dispatch fresh unless resume fails."
- Ask the platform for a restart notice or a drain.

**Expected impact.**
- Up to 4% of agent $ (the $45 in finished agents) and 6.9 agent-hours [model]. The $55 that was in flight is lost either way.
- Each restart costs tens of minutes to about 2 h of critical path (d9gr 111 min, g7is 108 min).

**Effort** S for the plugin text; L for the platform · **New/known** new (environment fragility was known as R21; resume discipline was not) · **Priority** P1.

### REL-04 · A chain loses its later stages, or a mid-chain verdict

**Pattern.** X15: 3 sessions.

**Evidence.**
- **fnVU w14-d1** (g-e ×2 → panel → CI single) returned only its last stage.
  - state.md: "panel verdict not surfaced by chain" (`f866350d`). The user was told: "The final review's verdict didn't come back to me" (`6917980b`).
  - w15-d1 (155k tokens) tried to recover the verdict from the trace (`b34e86c8`).
  - w16-d1 redid the review at 576k tokens and failed 0/3 (`ff4a877d`).
- **hQTT w4-d1:** stage 1 was exhausted and stages 2-4 never ran. They were re-dispatched as w5 (`cf4391ef`), so a 72-min wave delivered only the IAM stage.
- **dJmJ w8-d1:** stage 1 used all 3 rounds on one wording nit and the chain stopped (`3b4fd952`). w9 re-ran the chain with the nit fix as a single first stage (`e315a947`).

**Root cause.** Plugin.
- `src/topologies/chain.ts:28-38`: at the first stage that is not `done`, the chain builds its result from that stage alone (result at `:32`, `return out` at `:38`). It says nothing about the stages it did not run.
- `chain.ts:42`: when all stages are `done`, the chain returns only the last stage's result.
- A panel returns `status: "done"` even on FAIL (`panel.ts:116`, `:144`), so a gating panel mid-chain never stops the chain.
- `forwardLines` (`shared.ts:65-67`) passes only the panel's first line to the next stage, and the orchestrator never sees it.
- `catalog.md:216` ("make a gating panel the chain's last stage") is advice only. Nothing rejects a mid-chain panel.

**Proposed change.**
1. At `chain.ts:42` and `:32`: prefix the result with one line per stage, `<stage id> <status>: <first line>`, followed by the last stage's lines, cut to `maxLines`. The statuses are already collected at `:26`.
2. When a stage is not `done`, append `not run: <stage ids and titles>`, so the orchestrator re-dispatches only those. hQTT did this by hand.
3. In `runChain`, treat a non-last `panel` stage whose result line 1 starts with `FAIL` as a stop (status `exhausted`, result names the panel), unless the stage sets `params.gate: false`. Update `catalog.md:216` to match.

**Expected impact.**
- fnVU: 2 extra dispatches and about 731k tokens (155k + 576k) avoided [est from the notes].
- hQTT and dJmJ: the follow-on chain is planned from the result instead of from the trace.
- Affects 3 of 20 sessions.

**Effort** M · **New/known** new (quality-audit M1, S3) · **Priority** P1.

### REL-05 · The notification says "completed" for blocked, exhausted, failed and usage-limit runs

**Pattern.** X6: 7 sessions. X22 (usage-limit failures, 2 sessions: hQTT and eptK) is the worst case.

**Evidence.**
- **Blocked:** efwY w12-d1 `14f76398`, fnVU w13-d1 `70fd6990`, d9gr w6-d1 `e59f0d6c`.
- **Exhausted:** fS88 w2-d1 `6cabf2bc`, eznd w8-d3 `ed31f175`.
- **Refused for a same-wave dependency:** eznd `59e57b50`/`2458d8b2`, g7is `4d989a23` (quality-audit M2).
- **Usage limit (hQTT wave 2):** all 4 agents died on "You've reached your Fable limit". The notification still said "completed" (`dc4c4765`), and 27 min of idle time followed.
- The orchestrators read the result body correctly each time. Any count of notifications is wrong, though, including the counts in these audits.

**Root cause.**
- Harness (owner: the Workflow tool): the task_notification status reflects that the script returned, not the `status` in `DispatchReturn`.
- Plugin part: `SKILL.md:102` and `:106` key everything on the returned `status`, and never say that the notification's status is something else.

**Proposed change.**
- Plugin: in `run.ts`, before the `return` at `:97`, add `rt.log(\`${id}: STATUS ${result.status}\`)`, so the last line of the workflow log carries the real status.
- Plugin: one sentence at `SKILL.md:102`: "The notification says `completed` whenever the script returned; the dispatch's `status` is only in the returned data."
- Harness: carry the script's returned `status` field into the notification.

**Expected impact.** Counts in monitoring and retros become right. The usage-limit case would surface at once, instead of after a 27-min idle (hQTT).

**Effort** S for the plugin; M for the harness · **New/known** new · **Priority** P1.

### REL-06 · Same-wave `dependsOn` is refused, costs a relaunch, and teaches orchestrators to drop dependsOn

**Pattern.** X16: 3 sessions.

**Evidence.**
- **eznd:** w7-d2 and w7-d3 named the w7-d1 merge. They started (`53e50f1b`/`d6fb6cbe`) and were rejected in 5 s (`59e57b50`/`2458d8b2`). The orchestrator said: "I'd filed them in the same wave as the merge they depend on" (`75ea88c2`).
- **g7is:** w7-d2 declared `dependsOn ["w6-d2","w7-d1"]` (`c547b2e4`). It was refused, but the notification said completed, after 5,017 ms and 71,044 tokens (`4d989a23`).
- **d6Vc:**
  - w11-d2 "failed because its dependsOn named a dispatch in the same wave" and was re-dispatched as wave 12 (d6Vc.md:194).
  - From then on every dispatch passed `dependsOn: []`, and the orchestrator did the sequencing through the frontier (d6Vc.md:277).
  - As a result, about 40 later waves have no dependency edges in the trace.

**Root cause.** Plugin, by design.
- `src/run.ts:49-50` refuses a same-wave id without running the dispatch.
- `SKILL.md:78` states the rule, and `SKILL.md:114` already calls it "a planning fault: dispatch it next wave, or make the two one `chain`".
- But the rule is stated at integration, after the fact, not as a check before launch. Nothing says dependsOn must be kept for the trace.
- REL-05 hides the refusal.

**Proposed change.**
- Keep the refusal. Auto-promoting a dispatch to the next wave would need a rolling frontier (SPD-01), and would make one wave's launch block on another workflow.
- Add a pre-launch check at the end of "Plan a wave" (`SKILL.md:78`): "Before launching, check each `dependsOn` id: its wave number must be lower than this wave's. If not, move the dispatch to the next wave or make the pair one `chain`. Never clear `dependsOn` to get round the check: the diagram draws its edges from it."

**Expected impact.**
- Small: about 70k tokens and one relaunch per occurrence (g7is 71,044 tokens), in 3 of 20 sessions.
- The larger gain is keeping the trace's dependency edges (d6Vc).

**Effort** S · **New/known** the behaviour is known and decided-against by design (A4, U11); the missing pre-launch check and the dependsOn-clearing workaround are new · **Priority** P2.

### REL-07 · Sessions run a stale synced plugin build

**Pattern.** X23: 4 sessions.

**Evidence.**
- **dJmJ:** wave 2 committed readable labels (c02bbe1). Every later wave still showed the old labels, because waves ran the synced copy. The orchestrator then described the new label text to the user as if it were live (`6470364d`).
- **fm1f, eptK and hQTT** ran the older one-Workflow-per-wave `wave.js` build (`graph-orchestrator:wave`; fm1f obs 2, eptK obs 2, hQTT obs 1). That build has a per-wave scribe and allows in-wave dependsOn, so its semantics differ from the current source.
- **plugin-map.md §1:** today's installed copy still differs from the repo in SKILL.md, by an extra `lead-orchestrator` line that commit 3096bd5 removed.

**Root cause.**
- Harness (owner: claude.ai plugin sync, which lags the repo).
- Repo process: there is no version stamp, versions are bumped by hand (prior R16), and there is no navigation note (R20).
- Nothing in the plugin reports which build is running.

**Proposed change.**
- build.mjs injects `PLUGIN_VERSION` (package.json version plus the git short hash) into dispatch.js.
- `run.ts:97` adds it to `DispatchReturn` and to the scribe line.
- The SKILL.md MODE line records it, and render-trace prints it in the diagram header.

**Expected impact.** Analyses and users can tell which build produced a run. It also prevents claims about features that are not live (dJmJ).

**Effort** S · **New/known** known in part (R16, R20); the runtime version stamp is new · **Priority** P2.

### REL-08 · Subagent permission and classifier denials are absorbed silently or become unreviewed passes

**Pattern.** X19: 5 sessions.

**Evidence.**
- **eznd:**
  - 4 "Classifier unavailable" denials (`9086e929`, `91a71c6a`, `1700271a`, `7edf8ed7`) and one `rm` denial (`a4379c06`).
  - The w6-d1 evaluator was blocked ("Bash is blocked in this evaluator session"), and the ticket was accepted on the generator's evidence (quality-audit §3).
- **fS88:** `[Modify Shared Resources]` `c24c8953`, `[Credential Materialization]` `43f26fe0`.
- **fnVU:** `f55587ed`, `cf47d2b8`, `1cb09608`.
- **gdsq:** `097afc11`, `ff3a7d61`, `5a7a01d3`.
- **d6Vc:** listed under X19 in summary.md.

**Root cause.**
- Harness (owner: the auto-mode classifier's availability and policy).
- Plugin part: the evaluator stance (`src/roles.ts:86-88`) says "Read and run whatever you need to verify it", but not what to do when a needed tool is denied. So the outcome varies; in eznd, blocked became accepted unverified.

**Proposed change.** Add to the evaluator stance at `roles.ts:87`: "If a tool you need for a criterion is denied, set pass=false and say which check could not run; never pass a criterion you could not check." This links to QUA-02's UNVERIFIED label.

**Expected impact.** Closes one route to unreviewed passes (eznd w6-d1). No $ effect.

**Effort** S · **New/known** new · **Priority** P2.

---

## Quality

### QUA-01 · Evaluator and panel false passes on ticket-scoped, uncountable pass_criteria

**Pattern.** X7: 6 sessions, plus d6Vc as plausible.

**Evidence** (quality-audit.md §2).

| case | what passed | what later showed it wrong |
|---|---|---|
| efwY FP1 | "relevant tests and lint pass" (`56d62dca`) | CI caught a 14-07 regression (`2c77203f`); the walkthrough found story 34 failing (`7e39fb02`) |
| eznd FP2 | all suites green (`62651e1c`) | the user saw a comfort temperature above 1000 °C (`3daa0c7a`) |
| hD76 FP3 | 15/15 strong per-ticket passes | the walkthrough failed R043 and R130 (`d7940046`) |
| fnVU FP4 | "all checks pass" (`4ca57286`) | panels found 6 and 4 BLOCKING items (`30162c11`, `f6953018`); w16-d1 failed 0/3 (`ff4a877d`) |
| d9gr FP5 | "targeted tests" (`57d35751`) | integration found 6 failing tests (`9973c8cf`) |
| g7is FP6 | "touched-area tests … (env-limit failures excepted)" (`3fd81e29`) | the final gate failed 2/3 (`5f56d66d`) |
| d6Vc FP7 (plausible) | merges while "CI has never run on any of this" (`3088fd9b`) | fS88 then found 4 High and 18 Medium findings (`ea069040`) |

**Root cause.** Plugin.
- `src/roles.ts:86`: the evaluator judges "strictly against the PASS CRITERIA and nothing else".
- `catalog.md:48`: `pass_criteria` is "string, required in practice". It is free text with no countability rule and no regression floor. The good example at `catalog.md:62` is not required.
- `src/topologies/generator-evaluator.ts:10`: a missing `pass_criteria` silently becomes "the task is complete and correct".
- `SKILL.md:132` finishes when FRONTIER is empty. There is no spec-level acceptance step (FP3, efwY story 34).

**Proposed change.**
1. At `catalog.md:48`: "`pass_criteria` (string, required): a numbered list; each item names a command or an observable and its expected count or output. Include the full regression suite, or name the later gate that runs it. Words like *relevant*, *targeted*, *touched-area*, *all checks* or an *except* clause are not criteria."
2. At `generator-evaluator.ts:10`: return `failed` ("pass_criteria missing") instead of the default. This also closes U16.
3. In SKILL.md Finish (`:132`): "If the task is a spec or ticket set, the last wave before render is an acceptance dispatch (panel or single) that checks the spec's own acceptance strings end to end, not per ticket."

**Expected impact.**
- In 6 of 20 sessions a defect shipped after the evaluator had passed it. Each was caught later, by CI, a walkthrough, a panel or the user.
- Rework seen:
  - efwY w7-w8: +$29.56 (walkthrough $16.27, plus fix, PR and merge $13.29);
  - fnVU w10-w16;
  - d9gr's integration rounds (67 min and 2h32m).
- [est] Countable criteria plus one acceptance gate would have caught 4 of the 6 at the gate: FP1, FP5 and FP6 (uncountable criteria, quality-audit.md S1) and FP3 (no spec-level gate, S8).
  - FP4 also had uncountable criteria (S1) but is left out: its evaluator judged the generator's own claim as SUBMISSION (`generator-evaluator.ts:49`), which countable criteria alone do not fix. FP2 was a runtime value only the user saw.
- The cost is one extra dispatch per session, about $4-8 at the g-e and chain medians.

**Effort** M · **New/known** known (E1, R10, U16); the spec-level acceptance gate is new (FP3, S8) · **Priority** P0.

### QUA-02 · Blocked or exhausted loops closed without independent verification

**Pattern.** X8: 5 sessions, plus fnVU (unresolved) and dKG5 (budget overrun).

**Evidence.**
- **dQHS w2-d1** was blocked because a Write was refused. The orchestrator dropped the file requirement itself, and no evaluator ran (`028beaf0`).
- **d9gr w6-d1-s2** was blocked. The orchestrator read 38 KB and wrote `evidence/SUMMARY2.md` itself (`40aa7241`, `12da1717`, `48e2d7d8`).
- **fS88 w2-d1** ended exhausted on "missing files". An extraction stage was added, and the coverage evaluator never saw the reports (`c15df96f`, `72922dc9`).
- **eznd w8-d3:** "I've accepted the merge's own results" (`0fc50e88`).
- **hQTT** accepted three exhausted g-e loops as autonomous decisions (`c1712fa3`, `cf4391ef`).
- **fnVU** ended at the wave budget without opening `review-w16.md` (`eced78b8`).
- **dKG5** used all 16 waves, then did the rest in the main loop (174 Bash calls, 27 edits).

**Root cause.** Plugin.
- `SKILL.md:111`: blocked asks "in both modes". dQHS skipped this.
- `SKILL.md:112`: for exhausted in autonomous mode, "record a best guess and move on". There is no rule that work accepted without a passing evaluator is labelled unverified or re-reviewed.
- `SKILL.md:13` forbids reading even the one file that explains a final FAIL (fnVU).
- `SKILL.md:118`: a budget stop has no "report what failed" step.

**Proposed change.**
- At `SKILL.md:112`, add: "Work accepted without a passing evaluator is UNVERIFIED: write that word in its DECISIONS line, and plan an evaluator-only dispatch over its artifacts next wave unless the budget is spent. The final reply lists UNVERIFIED items first."
- At `SKILL.md:118`: "On a budget stop with a failing review, one last `single` reads the review artifact and returns its blocking items (maxLines ≤ 6)."
- At `SKILL.md:111`: "A blocked result is never resolved silently, in either mode."

**Expected impact.**
- 5 of 20 sessions (plus fnVU unresolved and dKG5 after the budget) ended with at least one deliverable that no evaluator had passed, and the user could not tell which one.
- The cost is one evaluator dispatch per occurrence, about $0.73 per evaluator agent at the median [model].

**Effort** S · **New/known** new (the dKG5 part is known as R2 and R3) · **Priority** P1.

### QUA-03 · Self-decisions and non-gate questions are drawn as human nodes

**Pattern.** X5: 9 sessions.

**Evidence.**
- **eznd:** `human_3` "accepted generator green results", although no human message falls between 10:16 and 12:07 (`62651e1c`).
- **dQHS:** `human_2 · blocked` for a decision the orchestrator made itself (`3fa8d614`).
- **g2Kg:** `human · ambiguity`, answered by the orchestrator (`624b7fb5`).
- **efwY:** the mode choice, and the user's question "Are we parallelising test runs?", are drawn as "human · irreversible" (`401dedb7`, `952e75f0`).
- **d9gr:** the stop hook is drawn twice as "human · irreversible" (`462bc8cf`).
- **eptK:** an autonomous ambiguity answer is drawn as a human node (`6a5dba7e`, render `1f0cf378`).
- **dJmJ:** the mode question is drawn as `human_1`, before any work started (`cfb0ac48`/`a6ec5d90`).
- **fm1f:** a hook answer is recorded as `trigger: irreversible` → "Yes" (`51395304`).
- **hQTT:** three autonomous accept gates (`cf4391ef`).

**Root cause.** Plugin.
- `src/trace/render.ts:185` builds the node title as `` `human · ${h.trigger}` `` and never reads `h.mode`, so an autonomous best guess looks exactly like a human answer.
- `SKILL.md:122` makes every autonomous best guess for triggers 1, 3 and 5 an intervention of `type: "human"`. Nothing excludes the mode question, the user's status questions or hook prompts.

**Proposed change.**
1. At `render.ts:185`: build the title prefix as `` `${h.mode === "autonomous" ? "self" : "human"} · ${h.trigger}` ``. At `render.ts:186`, give autonomous nodes their own `:::self` class (dashed outline).
2. At `SKILL.md:122`: "Not interventions: the mode question, a user's status question, hook messages. An autonomous best guess is recorded with `mode: "autonomous"` and is drawn as `self`."

**Expected impact.**
- The trace stops claiming the user was consulted when they were not (9 of 20 sessions).
- In the final reply, the "decisions that need your eyes" become distinguishable from decisions the user already made.

**Effort** S · **New/known** new (quality-audit M4) · **Priority** P1.

### QUA-04 · Stop hooks drive commits and pushes, or are logged as the human answer

**Pattern.** X4: 10 sessions.

**Evidence.**
- **fm1f:** a hook message became the human "Yes" to the irreversible push gate. That went against the state.md decision "no push / no PR without asking" (`af88da72` → `51395304`).
- **hQTT:** a `git add -A` checkpoint commit 8 s after wave 4 started, while its agents were writing (`0bded638`).
- **hAaY:** a hook-driven branch, commit and push that nobody asked for. The commit included a decoy file (`667eedf8`, `55ccf6a6`).
- **eptK:** a hook-driven commit and push (`c2df455c`).
- **d9gr:** 12 hook prompts and 14 git Bash calls in the main loop (`3a522421`, `4cdc225a`…), drawn as human nodes (`462bc8cf`).
- **g7is:** 9 prompts, each an extra turn at $1-2 (`a6ed37bb`, `8bb817d4`…).
- **fS88:** 4 prompts to commit a `.env` file (`efbcc79b`…), refused each time.
- **eznd:** 4 nags (`0fdbcd03`…).
- **efwY:** a `git status` run to answer a hook (`77727c12`).
- **hD76:** listed under X4 in summary.md.

**Root cause.**
- At the source, the environment (owner: each repo's stop-hook-git-check).
- For the response, the plugin: `SKILL.md:80` (trigger 4, irreversible actions) says nothing about hooks; `grep hook SKILL.md` finds nothing. So the hook text competes with the user's authorisation.

**Proposed change.**
- At `SKILL.md:80`, add: "A hook message is never a human answer and never authorises trigger 4. While a dispatch of this session is running, answer a commit/push hook with one line naming the dispatch that owns the tree, and do nothing else. Never `git add -A` in the main loop. Do not record a hook as an intervention."
- Suggest to hook authors: skip the hook when `SCRATCH/state.md` shows a running wave.

**Expected impact.**
- No unauthorised pushes (fm1f, hAaY, eptK), and no mid-wave commits of half-written trees (hQTT).
- Saves about one main-loop turn per hook: 9-12 per long session, at $1-2 each in g7is [est].

**Effort** S · **New/known** known (R7) · **Priority** P0.

### QUA-05 · The harness refuses subagent `.md` report writes, and the plugin asks for them

**Pattern.** X9: 3 sessions, plus this session.

**Evidence.**
- **dQHS w2-d1:** the generator could not write `FINDINGS.md` (`028beaf0`).
- **d9gr w6-d1-s2:** the summary-file write was refused (`74b51ff0`: "blocked only because the subagent wasn't allowed to write").
- **fS88 w2-d1** asked for "path of findings-all.md" (`d83c6ecf`).
  - 8 area reports existed only in the workflow journal (`c15df96f`).
  - That is why the iterative-fan-out ended exhausted.
- **This session:** the Writes by the w2-d1 reducer, the w4-d1-s1 aggregator (`summary.md`) and this generator (`findings.md`) were all refused ("Subagents should return findings as text").

**Root cause.**
- Harness (owner: Claude Code's subagent Write policy for report-like `.md` files).
- Plugin part: long output is routed to files with no fallback:
  - `SKILL.md:77`: "Anything longer is an artifact path".
  - `src/roles.ts:81`: the generator produces the deliverable "as files on disk where it is code or long text".
  - `roles.ts:98`: the reducer may "write a merged artifact".
- `src/topologies/iterative-fan-out.ts:139` shows the evaluator only `findingsText(findings, false)`, which is the first line plus artifacts. An inline-only report therefore looks like a gap.

**Proposed change.**
1. Every working stance in `roles.ts` (generator, worker, reducer): "If a Write is refused, put the full content in `result` and make line 1 `ARTIFACT REFUSED: <path>`."
2. At `SKILL.md:77` and in the catalog examples: name report artifacts `.txt`, `.json` or `.html` rather than `.md`. fS88's HTML report was accepted.
3. At `iterative-fan-out.ts:139`: pass `full = true` for branches with no artifacts.

**Expected impact.**
- In 4 sessions the refusal cost a review step or forced the orchestrator to do the work itself (d9gr read 38 KB into the main loop).
- Saves that redo, plus an exhausted round (fS88).

**Effort** S · **New/known** new (quality-audit S2, M5; plugin-map L21) · **Priority** P1.

### QUA-06 · Parallel builders on one working tree

**Pattern.** X13: 4 sessions.

**Evidence.**
- **d9gr:** 6-7 clusters on one tree.
  - Integration found 6 failing tests and a coverage gap (`9973c8cf`).
  - Round-2 integration took 2h32m and 3 rounds (`462bc8cf`).
- **efwY:** "They all go on the one dev branch, so I'm running them in order" (`67bdfa02`). With one dispatch per wave, 11 tickets took 18h51m.
- **hD76:** waves collapsed into one sequential chain "because they touch shared files" (`7c1dd7bc`).
- **g7is:** three migrations were numbered `0050` and had to be renumbered at integration (`cb65100b`, `5616d905`).
- **eznd and g7is** invented the fix themselves: ticket branches plus an integrate dispatch (eznd obs 2).

**Root cause.** Plugin. `SKILL.md:84` launches every dispatch of a wave at once. Neither SKILL.md:71 nor the catalog says how parallel code changes share a repository.

**Proposed change.**
- catalog.md, a new short section "Parallel code changes":
  - Each generator works in its own `git worktree`, on `ticket/<id>`.
  - A following `generator-evaluator` integrate stage merges them and runs the full suite (the QUA-01 floor).
- One line at `SKILL.md:71`: "Code dispatches in one wave each get a worktree; integration is its own dispatch."

**Expected impact.**
- [est] Sessions that ran serially like efwY could build 2 tickets at a time (the concurrency cap): roughly 30-45% less build wall clock in those sessions.
- Fewer integration failures (d9gr) and less renumbering (g7is).

**Effort** M · **New/known** new (quality-audit S4) · **Priority** P1.

### QUA-07 · The orchestrator does evidence work in its main loop

**Pattern.** X11: 10 sessions.

**Evidence.**
- **dKG5:** 174 Bash calls, 46 test runs and 27 repo edits after the wave budget (dKG5.md obs 1).
- **d6Vc:** long Bash cleanup and merge blocks after each notification (`4567cb0c`, `9dde5635`, `07827f24`).
- **fMmB:** post-restart assessment and completion in Bash (`e5aa1612`, `4e533344`, `33d63c28`).
- **d9gr:** ran pytest itself (`c2dd50c3`); read 18 KB and 20 KB (`40aa7241`, `12da1717`).
- **gdsq:** tailed a worker's journal and ran `ps` (`fc9576fe`, `69b4c7ab`).
- **g7is:** post-restart state checks (`2bc30834`, `eadab32b`).
- **eznd:** commits, a force-push retry loop, and PR create and merge (`bde34af8`, `ac5e6d35`, `60b0e5d7`).
- **hD76:** greps and a 10,960-char listing (`d689e39a`, `834637a7`).
- **fS88:** post-run greps and reads (`5dd43b89`, `bb574861`).
- **dJmJ:** 5 Bash reads of a truncated wave output (`90398958`).

**Root cause.** Plugin.
- `SKILL.md:15-19` allows only three exceptions. It gives no sanctioned path for post-restart assessment, housekeeping (git, PR, cleanup) or answering the user about results.
- The user's questions arrive after "finish", when no dispatch is running (prior R2, U26).

**Proposed change.**
- At `SKILL.md:21`, add: "After a restart, a user question about results, or for housekeeping (cleanup, commit, PR), dispatch a `single` with `maxLines` ≤ 6; that is cheaper than the context it saves."
- Add a Rationalizations row: "It's only a git push" → "A push is a single dispatch, and trigger 4 if irreversible."

**Expected impact.**
- Main-loop $ is only 1-11% (median 6%) [exact], so the $ impact is small.
- The gain is review coverage (dKG5's 27 unreviewed edits were merged) and context (feeds QUA-10).

**Effort** S · **New/known** known (R2, U26) · **Priority** P1.

### QUA-08 · `now` timestamps are invented, so the trace timeline is fiction

**Pattern.** X3: 5 sessions.

**Evidence.**
- **hQTT** passed `now` values from 00:00Z to 09:00Z for waves that ran 10:46-18:02 (`3cb4d1f4` … `af45202f`).
- **eptK** passed `00:00Z` and `01:00Z` for waves that ran at 19:47 and 20:21 (`6a5dba7e`, `2ee1f0e2`).
- **dJmJ** passed hourly values 00:00Z…07:00Z (`e315a947`, render `9ecaf57a`).
- **d9gr:** "Wave 4 · 2026-11-13T04:00:00Z" for a dispatch at 23:29 (`462bc8cf`).
- **d6Vc:** a bare date, `"2026-11-09"` (`2a7c0637`).

**Root cause.** Plugin. `SKILL.md:90` says "you have no clock". `src/run.ts:56` takes `args.now` or "unknown", and stamps every event with it (`:65`, `:77`).

**Proposed change.**
- Let the scribe stamp real time. `scribePrompt` (`run.ts:27-37`) tells the scribe to replace a `"__NOW__"` placeholder with the output of `date -u +%FT%TZ` before appending.
- `run.ts:77` emits `at: "__NOW__"` when `args.now` is absent.
- Drop the instruction at `SKILL.md:90`.
- If COST-02 removes the scribe from `single`, the worker does the same substitution.

**Expected impact.** A trustworthy timeline for every future analysis; this one had to rebuild timings from events. No $ effect.

**Effort** S · **New/known** known (R11) · **Priority** P2.

### QUA-09 · Standing rules and large context are re-pasted into every spec, once with credentials

**Pattern.** X17: 6 sessions.

**Evidence.**
- **dKG5:** a 7.4 KB spec (`cabfbca7`).
- **efwY:** 6.0 KB, with carry-forward notes (`56d62dca`).
- **gdsq:** 5.9 KB of repeated branch rules, attribution lines and a pgrep warning (`1da377d6`).
- **d6Vc:** 955-3,013 chars of RESUME, disk and test rules in each dispatch (`2a7c0637`).
- **g2Kg:** the CLI contract pasted into two specs (`b2648244`, `7ff8f975`).
- **fS88:** three demo account email/password pairs in context (`d83c6ecf`).

**Root cause.** Plugin. `SKILL.md:74` ("If `context` is longer than `task`…") is the only guard. Standing rules have no home except each spec, and there is no rule about secrets.

**Proposed change.** At `SKILL.md:74`, add: "Standing rules (branch policy, test rules, authorisations, attribution lines) go once into `SCRATCH/brief.md` at kickoff; each spec's `context` carries `brief: SCRATCH/brief.md`. Never put a credential in `context`; name the file or variable that holds it."

**Expected impact.**
- Under 2% of agent $ [est]: prompts are 0.6-6k tokens against a fixed floor of about 69k tokens per agent (cost-speed.md §8).
- The value is one source of truth for the rules, and no secrets in workflow inputs or transcripts.

**Effort** S · **New/known** new (quality-audit S6) · **Priority** P2.

### QUA-10 · Main-loop context grows past 230k and compacts

**Pattern.** X21: 6 of the 14 measured sessions, plus fnVU and gdsq.

**Evidence.**
- Peaks from cost-speed.md §3:
  - dKG5 410k, with 2 compactions (`20aa6660`);
  - eznd 316k;
  - eiLu 288k;
  - d6Vc 252k, with 2 compactions (`267cd378`, `7474285c`);
  - g7is 249k (`8b272758`);
  - d9gr 231k.
- fnVU reached about 266k (`9f8d8f98`). gdsq auto-compacted before the final reply (`5b83be4e`).
- What drove it, per the notes:
  - about 7-8k tokens per completed dispatch (g7is obs 6);
  - ReadNotifications boilerplate, 3.2 kB × 22 (eiLu);
  - large raw tool results (dKG5, 339k chars);
  - the diagram pasted verbatim into the final reply (dQHS, 8,449 chars, `3fa8d614`).

**Root cause.**
- Mostly plugin:
  - `SKILL.md:138` requires "the diagram, verbatim".
  - `SKILL.md:77` allows up to 20 lines per result.
  - The QUA-07 work adds raw output.
- Partly harness (the size of the notification text).

**Proposed change.**
- At `SKILL.md:138`: "the diagram's path (send the file), not its text".
- At `SKILL.md:77`: "default `maxLines` 4; above 8 needs a reason".
- Rely on QUA-07 for the raw-output share.

**Expected impact.**
- Under 1% of $ (cost-speed.md §8 L19/L20).
- Fewer compactions, and less drift after compaction (R2's "$75 session").

**Effort** S · **New/known** new (behaviour after compaction is known as R2) · **Priority** P2.

---

## Speed

### SPD-01 · The wave barrier idles ready work

**Pattern.** X14: 6 sessions.

**Evidence.**
- **fnVU:**
  - w5-d1 and w5-d2 depended only on w4-d1, which was done at 15:06:04 (`d08c0459`). They launched at 15:25:02 (`df90bc2d`): 19 min idle.
  - w8-d3 waited 43 min (`58c21668` → `f8af4e1c`).
- **eznd** launched w8-d3 and w8-d4 as w6 dispatches finished, rolling the waves by hand (`1f343783`, `dadc6071`).
- **gdsq** ran up to four "waves" at once from w7 (`a65b9df5`, `e1590cd9`, `b929c550`).
- **dKG5, fMmB and d6Vc** ran overlapping or one-ticket waves to get the same effect.
- **cost-speed.md §6:** in the 16 multi-dispatch waves, there were **20.5 h of idle slot time against 28.8 h busy (42%)**.

**Root cause.** Plugin.
- `SKILL.md:100`: "integrate once every workflow of the wave has reported".
- `run.ts:49-50` forbids same-wave waits.
- A rolling frontier was deferred to v2 (`docs/v2.md`, prior V2) and re-raised as R3.

**Proposed change.**
- At `SKILL.md:100`: "When a dispatch returns and a FRONTIER item depends only on finished dispatches, you may launch it at once as the next wave number; a wave is a launch batch, not a barrier. Rewrite state.md before each launch."
- Budgets (`SKILL.md:118`) count launches.
- No src change is needed: each dispatch is already its own workflow (ADR-0003).

**Expected impact.**
- [est] 10-25% less active wall clock in sessions with ≥2 dispatches per wave (d9gr, eznd, gdsq, d6Vc, g7is).
- About 0 in sessions with one dispatch per wave.
- $ ≈ 0 (cost-speed.md §8 L17).

**Effort** M · **New/known** known (R3; V2 was decided-against for v1, and this evidence is a reason to reopen it) · **Priority** P1.

### SPD-02 · Long human waits with nothing else dispatched

**Pattern.** X20: 4 sessions.

**Evidence.**
- **d9gr:** 4 design questions in one AskUserQuestion (`8dd37f71`), then 8h49m idle until the answer (`79bf0402`). The next fan-out launched 34 s after it.
- **fm1f:** a branch-name question (`4174250d`) was answered 5h51m later (`185a0627`).
- **gdsq:** 17 min idle on an AskUserQuestion (10:55:26 → 11:12:45).
- **hQTT:** 27 min idle after the usage limit, until the user typed "Continue". The platform caused this one.

**Root cause.** Plugin. `SKILL.md:111` ("ask"), and the asks for triggers 3 and 5, have no rule to keep the rest of the frontier moving. There is also no default answer for an attended run that goes quiet.

**Proposed change.** At `SKILL.md:111`, add: "Before asking, launch every FRONTIER dispatch that does not depend on the answer. Offer options with a recommended default." For design questions like d9gr's, dispatch first the parts the answer does not change.

**Expected impact.**
- [est] Wall clock only, and only where independent work exists. fm1f's wait blocked a push, not work.
- The 38% idle share of session span (cost-speed.md §6) is mostly human and overnight time, so expect a single-digit % of span.

**Effort** S · **New/known** new · **Priority** P2.

### SPD-03 · Subagents wait with `until`/`sleep`/`pgrep` loops

**Pattern.** X12: 5 sessions, plus dKG5's orchestrator.

**Evidence.**
- **d6Vc:** 74 background wait loops (`until grep -q ALLDONE …`). About 20 were orphaned by a restart (d6Vc.md obs 11, 13).
- **hD76:** 129 of 338 background tasks are wait loops, and 4 ended `failed` (`137cbc99`…).
- **eznd:** 37.
- **fMmB:** 15 (`fcbb3590`, `01af1c23`).
- **gdsq:** a worker looped on `pgrep -f "run-checks.sh"`, which matched its own command line. About 10 min were wasted (`23f95e43`).
- **dKG5:** the orchestrator itself ran 11 `until … sleep` loops (`9b2995e7`).

**Root cause.**
- Plugin: the working stances (`src/roles.ts:80-84`, and the worker stance) say nothing about waiting on long commands.
- Harness: background tasks outlive their agents.

**Proposed change.** Add to the generator and worker stances: "To wait on a long command, run it in the foreground with a timeout, or start it in the background and wait once on its exit status; never loop on `pgrep -f`, which matches itself." This ties to COST-03 (long waits that outlast the cache TTL).

**Expected impact.**
- A small direct gain (gdsq, 10 min).
- Fewer loops orphaned by restarts, which looked like stalled workflows (R9).

**Effort** S · **New/known** known (R9) · **Priority** P2.

### SPD-04 · Fan-out branches queue behind a concurrency cap of 2

**Pattern.** Not an X pattern. It is measured in cost-speed.md §6 over 9 non-chain fan-outs from dJmJ, eptK, dQHS and this session. gRP1 also shows it: only 2 of 9 branches started within 55 s (`fd8180b2`, `cf743c8e`).

**Evidence.**
- Fan-out queue time is 3.9 h against 7.2 h of run time, **35% of fan-out agent time** (1.3% of all agent time).
- Actual vs no-cap wall clock:

  | dispatch | actual | no cap |
  |---|---|---|
  | dJmJ 27-agent | 11.5 min | 8.1 min |
  | dJmJ 27-agent | 7.3 min | 4.8 min |
  | eptK 10-agent | 33.8 min | 18.0 min |
  | dQHS | 8.5 min | 5.8 min |
  | dQHS | 8.5 min | 6.0 min |
  | all 9 | 95 min | 65 min (−32%) |
  | this session's w2-d1 | 65 min | ~38.5 min (−41%) [est] |

**Root cause.**
- Platform: the cap is min(16, nproc−2), which is 2 on a 4-CPU container (ADR-0002 `0002-topologies-as-workflow-scripts.md:19`; spike item 3). It cannot be raised in the cloud (prior A3, decided-against as "slow, not broken").
- Plugin: a fan-out runs all its branches in one run (`MAX_WIDTH` 9 at `shared.ts:14`), while each run has its own cap (ADR-0003 `:23`).

**Proposed change.**
- catalog.md fan-out "Use when" note: "Width above 2 queues in the cloud. When branches need no shared partition, launch them as ⌈w/2⌉ sibling fan-outs of width ≤ 2 in one wave and reduce next wave."
- Keep the single run when a reducer or partition must see all branches together.

**Expected impact.**
- 32-41% less fan-out dispatch wall clock (measured on 10 dispatches).
- Under 2% of total wall clock in coding sessions.
- Each extra dispatch adds one scribe (see COST-02).

**Effort** S · **New/known** the cap is known (A3, decided-against); the split lever is new · **Priority** P2.

---

## Cost

### COST-01 · Every role runs on the session model

**Pattern.** All 20 sessions. There is no X number; this is a cause at the code level.

**Evidence.**
- 810 agents with per-agent data, across 15 sessions (cost-speed.md §4 [model]):
  - mechanical roles: scribe 5.8% and partition 0.2% of agent $;
  - evaluator 14.9%, reducer 0.8%, judge 0.05%.
- hD76 ran every role, the scribe included, on Fable at 2× the Opus price (cost-speed.md coverage note).
- hQTT's wave-2 scribe died on the Fable usage limit along with the workers (`dc4c4765`).
- This session: scribes $1.34, evaluators $1.62 [exact].

**Root cause.** Plugin.
- `src/topologies/shared.ts:182` calls `ctx.rt.agent(prompt, { label, schema })` with no model and no effort. The scribe call at `src/run.ts:85` is the same.
- `AgentOptions` (`src/types.ts:129-134`) has `effort?` but no `model?`.
- `RoleEntry` (`types.ts:11`) has no model field.

**Proposed change.**
1. Spike first: confirm that the Workflow `agent()` option accepts `model`. The harness owns this API.
2. Add `model?: string` to `AgentOptions` and to `RoleEntry`. Add a `ROLE_MODELS` default in `roles.ts`: scribe and partition on Haiku 5.5.
3. `callRole` (`shared.ts:182`) passes `roleEntry(spec, role).model ?? ROLE_MODELS[role]`. `run.ts:85` passes the scribe's default.
4. Evaluator, reducer and judge on Sonnet 5.5 as an opt-in per spec. Make it the default only after a false-pass check against QUA-01's countable criteria.

**Expected impact** (cost-speed.md §8 L8 [model]).
- 6% less agent $ from scribe and partition alone (high confidence, once the spike passes), about $300.
- About 13.9% less agent $ adding evaluator, reducer and judge (6.0 + 0.45 + 7.4 = 13.85; cost-speed.md §8 prints 13.5, an arithmetic slip), which is about 12.8% of session $, or **about $685 of the $5.3k** observed. This part waits on the QUA-01 false-pass check.

**Effort** M (it needs the runtime check) · **New/known** new (plugin-map L8/L9; not in prior-findings) · **Priority** P0 for the spike plus scribe/partition on Haiku; P1 for Sonnet evaluators, which wait on QUA-01.

### COST-02 · Fixed per-dispatch overhead: a full scribe agent, and ~150k tokens on trivial dispatches

**Pattern.** X18 (3 sessions: efwY, eiLu, d9gr), plus the scribe line item in every session.

**Evidence.**
- **X18, efwY:**
  - w9, w11, w12 and w13 each used 2 agents (worker and Grapher) and 148-154k tokens, for 8-13 tool uses and 30-135 s of work.
  - Example: `14f76398`, w12, 29.6 s and 150,538 tokens.
  - Opening a PR or calling the merge API cost about as much as a ticket-extraction single (efwY.md obs 3).
- **X18, eiLu:**
  - 22 single dispatches, at about 150k tokens and 10-14 tool calls each, just to read status (`52b2cea7`: 160,884 tokens).
  - That is 44 agents for 5 ticket transitions (eiLu.md obs 2).
- **X18, d9gr:** "A plain single dispatch still costs 169-245k tokens (w5-d7, w4-d1, w1-d1), and 2 agents each (worker + Grapher)" (d9gr.md:90).
- **The scribe line item** (cost-speed.md §4-5 [model]):
  - 166 scribe runs, each carrying a median context of 69,373 tokens for a task of about 1.1k characters.
  - 5.8% of agent $, 20% of agents spawned, **35.6% of single-dispatch $**, and 0.1% of wall clock.
  - It never failed in 166 runs.
  - In fm1f, the runtime flagged a scribe for "instruction poisoning" (`ff1a4916`).

**Root cause.**
- Plugin: `src/run.ts:84-95` always spawns one scribe agent per dispatch, with the prompt at `run.ts:27-37`. It does so because a Workflow script has no filesystem (ADR-0002).
- Harness: the fixed context floor of about 69k tokens per agent.

**Proposed change.**
- **(a) Now:** run the scribe on Haiku through COST-01 (`run.ts:85`).
- **(b) Next:** for `single`, add the trace lines to the worker's prompt as a final step ("append these lines to <trace file>"). Skip the scribe when the worker reports `appended`, and keep the scribe as a fallback when it reports 0.
- **(c)** Route trivial git and PR operations through the COST-05 and QUA-07 guidance, rather than through full-context workers.

**Expected impact.**
- (a): about 5.6% less agent $ [model] (the scribe's 5.8% at about 1/40 of the price).
- (b): one agent and one sequential step fewer per single dispatch (40 dispatches, 35.6% of their $). Extended to all topologies, 20% fewer agent spawns.

**Effort** S for (a), M for (b) · **New/known** new (plugin-map L5/L9) · **Priority** P1.

### COST-03 · Cache writes are the largest line item (55.9% of $)

**Pattern.** All 14 sessions that have `modelUsage`.

**Evidence** (cost-speed.md §2 [exact]).
- Where the dollars go:
  - 452M cache-write tokens are 55.9% of $ (5-min writes), plus 2.6% for the main loop's 1-hour writes;
  - cache reads 28.3%;
  - output 13.1%.
- The ratio of writes to reads differs by workload:
  - about 1:10 in coding sessions (d6Vc 273M:2,886M; eznd 43M:496M);
  - about 1:90 for this session's research workers (w2-d1 2.2M:194M).
- The per-agent model under-predicts coding sessions by 23-42% (ratio 0.58-0.77, cost-speed.md §1.3), which is consistent with extra writes.

**Root cause.**
- Harness (owner: the prompt-cache TTL for subagents): 5 minutes for workflow subagents, 1 hour for the main loop.
- The likely trigger is tool calls that outlast the TTL (60-90 min suites, R8), plus large tool outputs.
- **[est]** This is inferred from the ratios, not observed per call.

**Proposed change.**
- Harness: a 1-hour cache TTL for workflow subagents.
- Plugin: measure first, by fetching per-call usage for a few remote coding agents with `get_event`. If the mechanism is confirmed, the SPD-03 stance and COST-04 (fewer long suite runs per ticket) cut TTL expiries.

**Expected impact.** [est] 20-25% less coding-session $ if half the excess re-writes were avoided (cost-speed.md §8). That is larger than any plugin lever, but unconfirmed.

**Effort** L for the harness; S for the measurement · **New/known** new · **Priority** P1.

### COST-04 · Expensive checks run several times per ticket

**Pattern.** d6Vc, dKG5 and fMmB (3 sessions; matches the retro's R8).

**Evidence.**
- **d6Vc:**
  - w39-d1 was exhausted while backend tests ran (`4301bb0c`). Its follow-on, w39-d1r, merged as #65 (`f69e6696`): 1.09M tokens over two runs.
  - 4 more out-of-budget follow-ons came before w37 (`3088fd9b`).
  - w47-d2 went over_budget in its final check (`0cc85c17`).
- **dKG5:** g-e dispatches ran 1.2-6.1 h each, dominated by one generator (w13-d3, 18.8M ms).
- **fMmB:** w22 ran sharded pytest and Playwright in the container, then killed and re-ran the shards (`bf3764d6`).

**Root cause.** Plugin.
- `catalog.md:48` has no guidance on which role runs the full suite.
- `roles.ts:87` tells the evaluator to "run the tests", and generators run them too.
- So a 60-90 min suite runs 2-3 times per round.

**Proposed change.** A generator-evaluator note in catalog.md: "Generators run targeted tests. The evaluator runs the full suite once per round and writes its log to `SCRATCH/<id>-tests.log`; a later stage at the same commit cites that log instead of re-running." This keeps QUA-01's regression floor.

**Expected impact.**
- [est] One fewer full-suite run per round on long-suite tickets.
- [est] Generators are 62% of agent $ across sessions (cost-speed.md §4); in long-suite sessions like d6Vc that might save 10-20% of ticket $ (unmeasured). Small elsewhere.

**Effort** M · **New/known** known (R8, R8a) · **Priority** P2.

### COST-05 · Polling or waiting through full workflows

**Pattern.** eiLu (22 dispatches), the extreme case of X18. efwY shows the correct alternative.

**Evidence.**
- **eiLu:**
  - 22 single dispatches, one per 20-minute status check: about 3.37M tokens and 44 agents for 5 ticket transitions.
  - It also added 46 orchestrator turns (about $28 of main loop per eiLu.md obs 2; cost-speed.md §7 puts the agents at about $17 and the main loop at $7.4 of the $32 session).
  - The user stopped it (`a42e7ac1`) and re-ran the brief as gdsq (`e1cc76f4`).
- **efwY** waited for CI with `subscribe_pr_activity` (`55309386`) and one `send_later` (`a1ced111`), and no dispatches.
- **gdsq** dropped the poll correctly (`308bee9e`).

**Root cause.** Plugin. `SKILL.md:21` says "Everything else is a dispatch", and "When not to use" (`SKILL.md:159-163`) does not cover monitoring or wait-until briefs.

**Proposed change.**
- At `SKILL.md:159-163`, add: "Waiting on external state (a PR, CI, another session): use `subscribe_pr_activity` or `send_later` in the main loop; dispatch only when the check needs reading code."
- Mirror it as an exception note at `SKILL.md:21`.

**Expected impact.** eiLu: $17 less in agents, 52% of that session [model]. 0 elsewhere.

**Effort** S · **New/known** new (quality-audit S7) · **Priority** P2.

---

## Pattern coverage (every summary.md pattern)

| pattern | sessions | finding |
|---|---|---|
| X1 scriptPath refused | 15 (+3) | REL-01 |
| X2 "dispatched" before the failure | 7 | REL-02 |
| X3 invented `now` | 5 | QUA-08 |
| X4 stop hook | 10 | QUA-04 |
| X5 self-decisions drawn as human nodes | 9 | QUA-03 |
| X6 "completed" notification | 7 | REL-05 |
| X7 false passes | 6 (+1) | QUA-01 |
| X8 closed without review | 5 (+2) | QUA-02 |
| X9 .md writes refused | 3 (+1) | QUA-05 |
| X10 restarts | 5 | REL-03 |
| X11 evidence work in the main loop | 10 | QUA-07 |
| X12 subagent polling loops | 5 (+1) | SPD-03 |
| X13 shared working tree | 4 | QUA-06 |
| X14 wave barrier | 6 | SPD-01 |
| X15 chain lost stages or a verdict | 3 | REL-04 |
| X16 same-wave dependsOn | 3 | REL-06 |
| X17 re-pasted context | 6 | QUA-09 |
| X18 per-dispatch overhead | 3 | COST-02 (and COST-05) |
| X19 permission denials | 5 | REL-08 |
| X20 long human waits | 4 | SPD-02 |
| X21 main context >230k | 6 (+2) | QUA-10 |
| X22 usage-limit failure | 2 (below the threshold) | REL-05 evidence |
| X23 stale plugin build | 4 | REL-07 |

---

## Iteration roadmap (ranked)

Ranked by sessions affected × severity, per unit of effort. Asks of the harness and platform are listed separately.

**Iteration 1: docs-only and one-line code changes, all S, shipped together as 0.3.2**
1. **REL-01 + REL-02:** the kickoff copy of `workflows/`, the wrapper path, and an honest "dispatched" line (SKILL.md:15-19, :88, :100; README:43; ADR-0003).
2. **QUA-04:** the hook rule at SKILL.md:80.
3. **QUA-01, part 1:** the countable `pass_criteria` rule (catalog.md:48) and `failed` on missing criteria (generator-evaluator.ts:10).
4. **QUA-02:** the UNVERIFIED rule (SKILL.md:111-112, :118).
5. **QUA-03:** `self` vs `human` nodes (render.ts:185-186, SKILL.md:122).
6. **REL-03:** the `stopped` row and `resumeFromRunId` (SKILL.md:108-114).
7. **COST-03 measurement:** per-call usage for 3 coding agents via `get_event`, to confirm the cache-write mechanism before any harness ask.
8. **One-paragraph text changes** in SKILL.md, catalog.md and the roles.ts stances: the plugin part of REL-05, REL-06, REL-08, QUA-05, QUA-07, QUA-09, QUA-10, SPD-02, SPD-03, COST-05.
9. **QUA-08:** real timestamps through the scribe (run.ts:27-37, :77).
10. **REL-07:** the version stamp (build.mjs, run.ts:97, render-trace).

**Iteration 2: M changes (code with tests, and the rolling-launch rule)**
11. **COST-01:** spike `model` on `agent()`, then add per-role defaults (types.ts, roles.ts, shared.ts:182, run.ts:85). Scribe and partition move to Haiku first.
12. **COST-02:** (a) together with COST-01; then (b), the worker-appended trace for `single`.
13. **REL-04:** chain stage summary lines, the "not run" list, and the mid-chain panel gate (chain.ts:28-42, catalog.md:216).
14. **QUA-01, part 2:** the spec-level acceptance dispatch at finish (SKILL.md:132).
15. **SPD-01:** rolling launches (SKILL.md:100, :118), and reopen V2.

**Iteration 3: the planning model (M for QUA-06 and COST-04, S for SPD-04)**
16. **QUA-06:** the worktree-per-generator plus integrate pattern (catalog.md, SKILL.md:71).
17. **SPD-04:** split wide fan-outs (catalog.md).
18. **COST-04:** one full-suite run per round (catalog.md).

**Asks of the harness and platform (owners outside the plugin)**
- Accept a Workflow `scriptPath` from a plugin root, or document a plugin-workflow entry point that keeps `meta.name` (REL-01).
- Make the notification status the script's returned `status` (REL-05).
- A 1-hour cache TTL for workflow subagents (COST-03).
- A subagent `.md` Write policy that allows writes under the session scratchpad (QUA-05).
- A restart notice or drain, and classifier availability (REL-03, REL-08).
- Faster plugin sync, or a visible synced version (REL-07).

---

## Instrumentation gaps (what the plugin should log so the next analysis is cheaper)

This analysis had to rebuild most of its numbers from raw event pages, task_progress snapshots and a fitted cost model (±25%). Each item names what was missing and where to emit it.

1. **Real status in the log and the trace.**
   - Log `STATUS <status>` as the last line of the workflow log (REL-05).
   - Today, counting notifications gives the wrong answer in 7 sessions.
2. **Per-agent usage in the trace line.**
   - For each agent: role, model, input, output, cache-read and cache-write tokens, tool calls, start and end time, and queue time.
   - The dispatch trace line (`dispatchEvent`, `shared.ts:191-206`) carries only `iterations` and `status`.
   - cost-speed.md had to fit a model because per-call usage was not available for remote agents. COST-03's mechanism is unconfirmed for the same reason.
3. **Real timestamps.** `started_at` and `ended_at` from the clock, per dispatch and per stage (QUA-08), so wall-clock and barrier-idle numbers come straight from the trace.
4. **Run ids.** The workflow run id per dispatch, in the trace and in state.md, so restarts can be resumed (REL-03) and journals found without guessing.
5. **Plugin version** in every dispatch line (REL-07).
6. **Verdict detail per round.**
   - Record the `pass_criteria` text, each evaluator round's pass or fail and first feedback line, and the commands the evaluator ran.
   - Put them in the dispatch line or in a sidecar `<id>.rounds.jsonl`.
   - The false passes in QUA-01 had to be reconstructed from Workflow inputs and later events.
7. **Chain stage results** in the trace: the first line per stage, not only statuses (REL-04).
8. **Intervention source.** `source: user | self | hook` on every human event (QUA-03, QUA-04).
9. **Harness refusals and denials seen by agents.**
   - A `refusals` count per agent (Write refused, permission or classifier denied), returned with the result (QUA-05, REL-08).
   - Today they are visible only by scanning subagent transcripts.
10. **Truncation markers.**
    - When `cutLines` (`shared.ts:55-59`) or `readWorkOutput` (`shared.ts:135-139`) drops lines, log how many.
    - Silent cuts could only be ruled out by sampling.
11. **Demand vs actual agents, and queue time,** per dispatch, so the concurrency cost (SPD-04) is measured rather than inferred from snapshots.
12. **Wait reasons.**
    - In state.md, a one-line `WAITING: <human question | CI | restart>` with the time it started.
    - Then idle time (38% of span) can be split by cause without reading the transcript.
----- END findings.md -----