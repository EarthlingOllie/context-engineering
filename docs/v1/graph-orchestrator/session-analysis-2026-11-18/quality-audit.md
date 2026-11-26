# Quality audit: what the 14 analysed graph-orchestrator sessions delivered

Scope: the 14 sessions that have a note in `SCRATCH/sessions/<id>.md`. These are d6Vc, d9gr, dKG5, dQHS, efwY, eiLu, eznd, fMmB, fS88, fnVU, g2Kg, g7is, gdsq and hD76. The 6 new sessions in the inventory addendum (hQTT, eptK, fm1f, dJmJ, gRP1, hAaY) have not been analysed yet and are not covered here.

Method:
- The notes, the raw pages, and the pass_criteria strings were grepped from the raw Workflow inputs.
- The user's reaction was re-checked with `list_events` wherever a note said there was "no reply":
  - fMmB, newest 100 events: user kinds only.
  - dQHS, fnVU, g7is and d6Vc, newest 5 events: user and result kinds. None of them holds a human message after the final report.
  - d9gr: the newest user or result event is the final result `74b51ff0` (11-14 11:38), and nothing follows it.
- Plugin citations point to the repo source, `/home/user/context-engineering/graph-orchestrator/...`.
- Each issue is marked as one of:
  - **known (<prior-findings id>)**;
  - **new**: not in `SCRATCH/prior-findings.md`. Some of these issues also appear as patterns in `state.md` from this session's wave 2, but they have no prior id.

## 1. Outcome per session

Categories:
- **accepted**: the user used the result or moved on without correcting it.
- **corrected**: the user found or forced a fix to the outcome.
- **redone**: the user abandoned the run and re-ran it.
- **unknown**: there was no reaction.

| session | deliverable | verdict | evidence (event ids) | notes |
|---|---|---|---|---|
| d6Vc | 78 tickets merged to `candidate`, with no CI | **unknown** (directly). Corrected downstream, plausibly | The only later input is `/usage` `c2dee9ff`. Re-check: the newest user and result page is empty | fS88 then tested the app and found 4 High, 18 Medium and 26 Low findings (`ea069040`). d9gr fixed 36 of them over two rounds (`9973c8cf`, `74b51ff0`). The app also contains gdsq and dKG5 work, so attributing these findings to d6Vc is plausible, not proven |
| d9gr | round 1: 22 High/Medium fixes. Round 2: 14 fixes | **accepted** | The user moved on to round 2 (`156a83cc`). The fS88 user said on 11-13 that "high and medium are already resolved" (`330e0240`). Nothing follows `74b51ff0` | The final message lists evidence gaps (AUTH-I1: the fix was disabled, not reverted. AUTH-F3: the red run was recorded before a path was added) (`74b51ff0`) |
| dKG5 | specs 12+13 merged to candidate-reskin → candidate → main | **corrected** | merge order "95 in first" (`50bac64f`, `0ea0fe57`). Environment corrections (`23990dab`, `f4b04b1f`). Then "grea, continue" (`212ae6d1`) and "I've merged candidate into main" (`7d8f0c69`) | The user had to merge #98 by hand (branch rule) |
| dQHS | design note `design/langgraph-design.md` (panel PASS) | **unknown** | No reply. Only a `turn_handoff_available` event (`3dfd851a`). The newest user and result page is empty | |
| efwY | spec 14 (11 tickets), story-34 fix and CI fixes merged via PR #103 | **accepted** | The next day the user asked only "Is the spec 14 implementation merged?" (`50d983fc`) | Defects were found after the evaluator passes (section 2) |
| eiLu | poll specs 1-10, then build spec 11 | **redone** | The user said "Stop" (`a42e7ac1`). The same brief was re-run 2h40m later as gdsq (`e1cc76f4`) | It polled d6Vc through a full workflow every 20 min (section 5) |
| eznd | 31 tickets, PR #3 and PR #4 merged | **corrected** | The user found the comfort temperature above 1000 °C in the demo videos (`3daa0c7a`). It was fixed in w11 (`63348d1d`) | |
| fMmB | 61/61 tickets pushed at 00f9618. 12 checks unticked | **unknown** | No human message in the newest 100 events after `cbe1c287`. The session went idle at `024847f3` | |
| fS88 | 60-finding app test report (HTML) | **accepted** | The report was used: d9gr's task uploads the findings report (`abb9ed17`). In Q&A the user referred to it (`330e0240`). One Q&A answer was redone (`698383c7` → `3cce06ee`) | |
| fnVU | 19 tickets pushed, **not merged**. The final review failed 0/3 | **unknown** | No reply after `eced78b8`/`5432e981`. The newest user and result page is empty | The goal ("merge once all green") was not met |
| g2Kg | textkit, 33/33 tests, panel 3/3 | **accepted** (weak) | The user asked only "what did we build" (`ec40a193`) | This was a plugin test run |
| g7is | 14 tickets pushed at 3b0bfb71 | **unknown** | The user's last message was "What verification has been completed" (`a58fb0f5`), answered by `2b016596`. No reply after it, and the newest user and result page is empty | |
| gdsq | 13/13 spec-11 tickets merged | **accepted** | "Great, how do I get this running on my Mac?" (`363ce9e8`) | |
| hD76 | 15/15 tickets, plus a walkthrough with 151/153 passing | **accepted** | The user asked only branch questions (`7db30ec5`, `3d4e4601`) | R043 and R130 still fail (section 2) |

**Counts: accepted 6 (d9gr, efwY, fS88, g2Kg, gdsq, hD76) / corrected 2 (dKG5, eznd) / redone 1 (eiLu) / unknown 5 (d6Vc, dQHS, fMmB, fnVU, g7is).** In 5 of the 14 sessions, then, the user never confirmed the deliverable. In 3 of those 5 (d6Vc, fMmB, g7is) the final report itself lists checks that never ran: CI, real AWS, e2e, and the coverage gate.

## 2. False passes: evaluator or panel passes later shown wrong

| # | session | what passed | what later showed it wrong | plugin text that allowed it | status |
|---|---|---|---|---|---|
| FP1 | efwY | The 14-07 generator-evaluator stage passed inside the w5-d1 chain. Its pass_criteria were "every acceptance criterion of 14-07 met; **relevant tests** and lint pass" (Workflow input `56d62dca`) | CI caught a 14-07 regression (a delete dialog stayed open) and a stale org-cost test (`2c77203f`). The user-requested walkthrough w7-d1 found story 34 failing (72/73, `7e39fb02`), which needed w8-d1 to fix | The evaluator stance is "Judge the SUBMISSION strictly against the PASS CRITERIA and nothing else" (`src/roles.ts:86`). `pass_criteria` is free text with no regression or full-suite floor (`skills/graph-orchestrator/catalog.md:48`) | known (R10 recurrence; E1) |
| FP2 | eznd | The ticket's generator-evaluator passed, and all suites were green at 11:34 (`62651e1c`) | The user saw a comfort temperature above 1000 °C in the demo videos (`3daa0c7a`). It was a running shortfall rendered as a temperature (`63348d1d`) | Same as FP1. Nothing in the catalog prompts a user-visible or behavioural check (`catalog.md:44-48`) | known (R10) |
| FP3 | hD76 | All 15 per-ticket evaluators passed. Their criteria were strong ("full pytest and Playwright suites pass with no skips") | The walkthrough of the spec's own strings failed R043 (no UI jump control) and R130 (no appliance list endpoints) (`d7940046`) | Criteria are scoped per ticket. Nothing in SKILL.md asks for a spec-level acceptance gate before "done" (`SKILL.md:71`, `:132`). The panel "typically the gate at the end of a chain" (`catalog.md:208`) is optional | new |
| FP4 | fnVU | The generator-evaluator passed tickets in waves 2-5 with "all checks pass, every acceptance criterion met" (`4ca57286`). The w11-d1 fix chain passed | Panel w6-d4 found 6 BLOCKING items (`30162c11`) and w10-d1 found 4 (`f6953018`). w12-d1 found 1 of the 4 w11 fixes ineffective (`c7d8f8f8`). w16-d1 failed 0/3 after w14-d1's generator-evaluator ×2 had passed (`ff4a877d`) | `roles.ts:86-88` (criteria only). The evaluator receives the generator's own claim as SUBMISSION (`src/topologies/generator-evaluator.ts:49`). "All checks" is uncountable (`catalog.md:48`) | known (R10, E1) |
| FP5 | d9gr | Every cluster's generator-evaluator passed on "**targeted tests**, ruff, mypy pass" (for example `57d35751`) | Round-1 integration w3-d1 found 6 failing tests and a coverage gap (`9973c8cf`). Round-2 integration w6-d1 needed 3 rounds (`462bc8cf`). The final evidence still had gaps the evaluator accepted: AUTH-I1 was "disabled for the test run rather than actually reverted" (`74b51ff0`) | `catalog.md:48` (criteria free text). No guidance on parallel generators sharing one working tree (`SKILL.md:84` launches the whole wave at once) | known (R10, E1). Shared tree: new |
| FP6 | g7is | Ticket generator-evaluators passed on "touched-area tests and lint pass (**env-limit failures excepted**)" (`3fd81e29`) | The final 3-reviewer gate in w10-d1 failed 2/3 on a demo-data bug (`5f56d66d`). It was fixed in w11-d1. "The spec reviewers weren't re-run after the fix" (`2b016596`) | The criteria text is author-defined, so an escape clause passes unchallenged (`catalog.md:48`; `generator-evaluator.ts:10` defaults when missing) | known (E1, U16) |
| FP7 | d6Vc (+gdsq, dKG5) | Every ticket in waves 37-52 was "done" through its review chain. Merges ran on local tests while "CI has never run on any of this" (`3088fd9b`) | fS88 found 4 High and 18 Medium findings in the same app (`ea069040`). d9gr fixed them, along with 14 more (`9973c8cf`, `74b51ff0`) | Same as FP1, plus R8 (expensive checks pushed toward narrower gates) | plausible. known (R10) |

Also suspect, but not shown wrong:
- **dKG5.** w13-d3, w14-d1, w14-d2 and w16-d1 completed while an evaluator label was still `progress`/`start` (`38569438`, `940e4175`, `624b2d32`, `8ff4b1ae`). The orchestrator reported each ticket as passing (`54845cee`, `7de254b8`, `0b985c1e`, `ecdcb163`). From events alone, the pass is unverifiable.
- **gdsq.** Agent labels show only "(1 of 3)", but the 11-03 summary says "It took 2 review rounds" (`c454d672`). The round count reported to the orchestrator is inconsistent.

**False passes confirmed: 6 sessions** (efwY, eznd, hD76, fnVU, d9gr, g7is), **plus 1 plausible** (d6Vc). In every confirmed case the pass_criteria were scoped to one ticket or cluster: "relevant", "targeted", "touched-area" or "all checks". The defect then surfaced only at a later integration, CI, walkthrough or human check.

## 3. Blocked, exhausted and over-budget loops, and how each was resolved

| session | dispatch | status, cause | resolution | quality of resolution | plugin text | status |
|---|---|---|---|---|---|---|
| dQHS | w2-d1 g-e | blocked after generator round 1: the harness refused the Write of `FINDINGS.md` | Autonomous mode. The orchestrator dropped the file requirement itself and **did not ask** (`028beaf0`). The trace still draws `human_2 · blocked` | No evaluator ever ran, so the findings went in unreviewed | `SKILL.md:111` says to ask on blocked "in both modes", so this violates it. `roles.ts:98` and `SKILL.md:77` push results into artifact files that the harness refuses (.md) | new |
| d9gr | w6-d1-s2 single | blocked: the harness refused the summary-file write | The orchestrator read 38 KB of output and wrote `evidence/SUMMARY2.md` itself (`40aa7241`, `12da1717`, `48e2d7d8`). Its final message says it was "blocked only because the subagent wasn't allowed to write" (`74b51ff0`) | The deliverable was written by the orchestrator, outside any review | `SKILL.md:13` (the rule) has no sanctioned fallback for a harness refusal. `SKILL.md:111` | new (harness .md refusal). Orchestrator doing the work: known (R2) |
| fS88 | w2-d1 iterative-fan-out | exhausted with 4 open gaps, "mainly missing files": subagents could not write `.md` reports (state.md `c15df96f`) | The orchestrator did not re-test. It added an extraction stage to w3-d1 that pulled the reports back out of the workflow journal (`72922dc9`) | 104 of 105 stories were tested, and the gaps were disclosed. Acceptable, but the coverage evaluator never saw the reports | `iterative-fan-out.ts:139`: the evaluator sees only the first line plus artifacts, so with no artifact the coverage looks like a gap. The spec asked for an .md path (`d83c6ecf`) | new |
| eznd | w8-d3 g-e integrate | exhausted after 3 rounds: the evaluator "ran out of time before it could verify the test runs" | "I've accepted the merge's own results" (`0fc50e88`). This was the orchestrator's own decision, but the trace draws it as `human_3` | The integration was accepted on the generator's say-so. Flagged in the final report as "Two reviews skipped" (`62651e1c`) | `SKILL.md:112`: in autonomous mode "record a best guess and move on". There is no rule that unverified work stays unverified | new |
| eznd | w6-d1 g-e (ticket 13) | blocked: "Bash is blocked in this evaluator session" | Accepted on the generator's evidence (`human_2`, before the window read) | The ticket was never independently reviewed | `SKILL.md:111` | new |
| d6Vc | w39-d1 g-e chain | exhausted: out of review rounds while backend tests ran (`4301bb0c`) | A changed follow-on, w39-d1r, merged as #65 (`f69e6696`) | Correct per `SKILL.md:112`, but the ticket cost 1.09M tokens across two runs. Before w37 there were 4 more out-of-budget follow-ons (`3088fd9b`) | `max_iterations` 3 × a 60-90 min suite (`catalog.md:48`; R8) | known (R8, R8a) |
| d6Vc | w47-d2 | over_budget in its final check (`0cc85c17`) | Follow-on w47-d2r merged as #81 (`3088fd9b`) | Correct | `SKILL.md:113` | (no issue) |
| fnVU | w13-d1 chain | blocked: which fix, A or B | Asked through AskUserQuestion (`6029cabf`). Answered in 10 min (`91455281`) | Correct | `SKILL.md:111` | (works) |
| fnVU | w14-d1 → w15-d1 → w16-d1 | The mid-chain panel verdict was lost (section 4). The re-review then FAILED 0/3 | Stopped at the 16-wave budget, **not merged**. It never opened `review-w16.md`: "I haven't opened, so I can't yet say what they are" (`eced78b8`) | The user was left with an unmerged branch and no list of the blockers | `SKILL.md:118`: an autonomous budget stop. `SKILL.md:13` forbids reading even the one file that explains the failure | new |
| efwY | w12-d1 single | blocked: the ruleset needs 1 approval | Asked (`30811eba`). The user chose a bypass (`2da547d8`). Recorded as a decision (`211aa54b`) | Correct | `SKILL.md:80,111` | (works) |
| gdsq | w2-d1 chain | CI red (Actions billing), so PR #82 could not merge | AskUserQuestion (`9e6267a0`) → "Use local checks" (`42235ed7`) | Correct, but local checks became the only gate for 13 tickets | `SKILL.md:80` | (works) |
| dKG5 | wave budget | 16/16 waves used (w16-d1, `a907e07a`) | Instead of the trigger-5 ask or stop, the orchestrator did the remaining work itself: 174 Bash calls, 46 test runs, 27 repo edits (dKG5.md obs 1) | Unreviewed main-loop edits merged | `SKILL.md:118` (trigger 5: attended → ask) was ignored. There is no hard stop | known (R2, R3) |
| eiLu | 22 polls | an unbounded poll loop; the brief gated spec 11 on 78/78 | The user stopped it (`a42e7ac1`) and re-ran the brief as gdsq | Redone | section 5 | new |

Summary:
- Sessions where a blocked or exhausted dispatch was closed **without independent verification**: **4** (dQHS, d9gr, fS88, eznd).
- Sessions that ended with the loop unresolved: **1** (fnVU).
- Sessions where the budget was exceeded by doing the work in the main loop: **1** (dKG5).
- Sessions where loops were resolved correctly: d6Vc, fnVU-w13, efwY, gdsq.

## 4. Results truncated or misread by the orchestrator

| # | session(s) | what happened | plugin text | status |
|---|---|---|---|---|
| M1 | fnVU | The w14-d1 chain (g-e ×2 → **panel** → CI single) returned only its last stage, so the panel verdict was lost: "panel verdict not surfaced by chain" (`f866350d`, `6917980b`). w15-d1 (155k tokens) tried to read it from the trace and stopped at gate 1 (`b34e86c8`). w16-d1 redid the review at 576k tokens and FAILED 0/3 | `chain.ts:118` returns `prev.result` only. `shared.ts:66-67` forwards just the first line. `catalog.md:216`: "A chain does not stop on a FAIL verdict, so make a gating panel the chain's last stage". That is advice only: nothing rejects a mid-chain panel | new |
| M2 | efwY, fnVU, eznd, g7is, d9gr, fS88 | Every Workflow task_notification says `completed`, including blocked (efwY w12-d1 `14f76398`, fnVU w13-d1 `70fd6990`, d9gr w6-d1 `e59f0d6c`), exhausted (fS88 w2-d1 `6cabf2bc`, eznd w8-d3 `ed31f175`) and same-wave-refused failed runs (eznd w7-d2/d3 `59e57b50`/`2458d8b2`, g7is w7-d2 `4d989a23`). The orchestrators read the result body correctly each time, but anything that counts notifications (including these audits) miscounts | `SKILL.md:102,106-114` key everything on the returned `status`. The harness-level status is not mentioned, so the mismatch is undocumented | new |
| M3 | dQHS, eiLu, fS88, g2Kg, gdsq, fnVU | "Wave 1 dispatched" was told to the user before the scriptPath failures arrived (`08081332`, `274b92ce`, `55b2bcfe`, `9e6ac6ea`, `69beacad`, `afe1392c`) | `SKILL.md:88` scriptPath. `SKILL.md:100` says to "say one line … and wait" with no check that the launch succeeded | known (R1) |
| M4 | eznd, dQHS, g2Kg, efwY, d9gr | Self-decisions are drawn as human nodes, so the user cannot tell whether they were consulted: eznd `human_3` "accepted generator green results" (`62651e1c`), dQHS `human_2` blocked (`3fa8d614`), g2Kg `human · ambiguity` (`624b7fb5`), efwY mode node (`401dedb7`). Stop-hook prompts and status questions are drawn as "human · irreversible" (d9gr human_2/human_7 `462bc8cf`; efwY w5-d1/w8-d1 `401dedb7`, `952e75f0`) | `SKILL.md:122` makes every autonomous best guess an intervention. `src/trace/render.ts:185` builds the node title without `mode`, so "autonomous" never shows | new |
| M5 | fS88 | The iterative-fan-out coverage evaluator judged 8 areas from first lines and artifact lists. The reports existed only inline, so it flagged 4 gaps, mainly "missing files" (`c15df96f`) | `iterative-fan-out.ts:139` `findingsText(findings, false)` (first line only) | new (map L21, not in prior) |
| M6 | fS88 | Mid-run, the orchestrator told the user there were 7 Highs (`96dddd3c`). After consolidation there were 4 (`6c588e52`). The per-area severities were relayed before the reducer had normalised them | `SKILL.md:110` "fold result into KNOWN" has no rule that interim tallies are provisional | new (minor) |
| M7 | dKG5 | Tickets were reported as passing while evaluator labels were unfinished (section 2) | The notification carries no workflow_progress, so agent states are invisible. The `iterations` field was not surfaced in prose | new (plausible) |
| M8 | d9gr | The final message replaced the rendered session.mmd with a hand-drawn 6-node summary diagram (`74b51ff0`) | `SKILL.md:138` "the diagram, verbatim" | new (minor) |

Silent truncation of results by `cutLines` (`shared.ts:55-59`, `MAX_LINES` 20) was **not observed** to drop a decision-relevant line in any session. M1 and M5 are truncation by design (chain last stage, first line only), not cuts to the contract.

## 5. Spec-writing faults

| # | fault | sessions | evidence | plugin text that allowed it | status |
|---|---|---|---|---|---|
| S1 | **Vague or ticket-scoped pass_criteria**: "relevant tests", "targeted tests", "touched-area tests (env-limit failures excepted)", "all checks pass" | efwY, d9gr, g7is, fnVU (and eznd and d6Vc by outcome) | `56d62dca`, `57d35751`, `3fd81e29`, `4ca57286`. These caused FP1, FP4, FP5 and FP6 | `catalog.md:48` "(string, required in practice)" has no countability or regression floor. `generator-evaluator.ts:10` silently defaults. The catalog example at `catalog.md:62` is good, but nothing requires it | known (E1, U16, R10) |
| S2 | **Artifact contract the harness refuses**: returns or instructions asked subagents to write `.md` reports | fS88, dQHS, d9gr | fS88 `d83c6ecf` ("path of findings-all.md"); dQHS `028beaf0`; d9gr `462bc8cf` | `SKILL.md:77` "Anything longer is an artifact path". `roles.ts:98` "write a merged artifact". Neither mentions the Write refusal for .md files in cloud subagents ("subagents should return findings as text", state.md) | new |
| S3 | **Mid-chain gating panel** (wrong topology composition) | fnVU | w14-d1, g-e ×2 → panel → single (`88e28edc`), leading to M1 | `catalog.md:216` warns, but `chain.ts:89-118` accepts it without checking | new |
| S4 | **Parallel generators on one working tree with integration deferred** | d9gr (6-7 clusters, one tree), efwY (serialised as a result) | d9gr: integration found 6 failures (`9973c8cf`), and stop-hook churn hit 12 times (`3a522421`…). efwY: "They all go on the one dev branch, so I'm running them in order" (`67bdfa02`) | `SKILL.md:84` "Launch every dispatch of the wave in one message". There is no worktree-or-integrate guidance. eznd and g7is invented the worktree-then-integrate pattern themselves | new |
| S5 | **Same-wave dependsOn** | eznd (w7-d2/d3), g7is (w7-d2) | `75ea88c2`, `b5aa0593`. Low cost (about 70k tokens each), but hidden by M2 | `SKILL.md:78` states the rule. `run.ts:49-50` refuses unrun | known (A4, decided-against by design). Hidden by M2: new |
| S6 | **Oversized or repeated context**: standing rules re-pasted into every spec | dKG5 (7.4 KB `cabfbca7`), efwY (6.0 KB `56d62dca`), gdsq (5.9 KB `1da377d6`), d6Vc (up to 3 KB of RESUME, disk and test rules per dispatch, `2a7c0637`), fS88 (pasted demo credentials, `d83c6ecf`) | Repeated constraints rather than pasted files. One session pasted secrets into prompts | `SKILL.md:74` ("If context is longer than task…") is the only guard. There is no shared-brief artifact pattern, so standing rules ride in every spec | new |
| S7 | **Wrong topology for the job: polling through a full workflow** | eiLu | 22 single dispatches at about 150k tokens each for a status read (`52b2cea7`). It also polled another session's progress instead of the user's intent ("If nothing is delivering them, the polling will go on indefinitely", `37e0a8b5`). Redone as gdsq | `SKILL.md:13,21` "Everything else is a dispatch". `SKILL.md:159-163` "When not to use" does not cover monitoring or wait-until briefs | new |
| S8 | **Ticket-level criteria with no spec-level gate** | hD76, efwY | FP3 (R043/R130). efwY's story 34 was found only by the user-requested walkthrough | `SKILL.md:132` renders and finishes when FRONTIER is empty. There is no "spec acceptance before done" step | new |

## 6. Top quality failure modes (by sessions affected)

1. **Evaluator or panel false passes from ticket-scoped, uncountable pass_criteria.** 6 sessions confirmed (efwY, eznd, hD76, fnVU, d9gr, g7is), plus d6Vc plausible, so 7. The cause is `roles.ts:86` (criteria only) combined with `catalog.md:48` (free-text criteria, no regression or spec floor). Known: E1, R10.
2. **Wrong or missing status signals and results:**
   - Notifications say `completed` for blocked, exhausted and failed runs: 6 sessions (efwY, fnVU, eznd, g7is, d9gr, fS88).
   - A chain dropped a gating verdict: fnVU.
   - Self-decisions were drawn as human consultations: 5 sessions (eznd, dQHS, g2Kg, efwY, d9gr).

   Cited lines: `SKILL.md:102`, `chain.ts:118`, `render.ts:185`. New.
3. **Blocked or exhausted loops closed without independent verification.** The generator's evidence was accepted, or the orchestrator wrote the deliverable itself: 4 sessions (dQHS, d9gr, fS88, eznd). fnVU ended unresolved with its review file unread, and dKG5 overran its budget by doing the work itself, which brings the total to 6. Three of these trace back to the harness refusing subagent `.md` writes (S2). Cited lines: `SKILL.md:111-112`, `SKILL.md:13`, `SKILL.md:77`. New, apart from R2 and R3.
