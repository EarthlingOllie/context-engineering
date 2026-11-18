# g7is: Specs 15/16 ticket frontier (rag-agent-studio)

Session `session_016jSC3g7isai42vZVQtACob`, CLI session `ffa4c35a-4eb4-5da3-9e49-03a4380ab757`, repo rag-agent-studio, branch `claude/tender-sagan-glfr3o`, plugin graph-orchestrator v0.3 (catalog read 762756ca), model claude-opus-5-5, permission mode auto.
SCRATCH `/tmp/claude-0/-home-user-rag-agent-studio/ffa4c35a-4eb4-5da3-9e49-03a4380ab757/scratchpad`.

Coverage: the whole transcript was read. That is 64 pages (6,253 events, 2026-11-16 20:43:08 to 2026-11-17 19:49:45) in `raw/g7is/p001..p064.txt`, read backwards with kinds user/assistant/system/result until has_more was no longer true. Parsing used `bin/main.py`, `bin/wfagg2.py`, `bin/viol2.py`, `bin/ctx.py` and two new helpers, `bin/show.py` (prints chosen events) and `bin/notif.py`. The digests are `g7is-main.txt` and `g7is-wf.txt`.

## Metrics

```
task:            "Specs 15 and 16 are currently being merged into main. Please assess the frontier of tickets for these
                 two specs, building them out in waves. Prefer parallel dispatching of tickets over sequential graphs
                 where possible." (human 9fbd0d30, 11-16 20:45:58)
mode:            autonomous, chosen by the user through AskUserQuestion (asked 19789668, answered cd872ea9): "Autonomous
                 (Recommended)" and "Commit and push (Recommended)" to claude/tender-sagan-glfr3o, with no PRs and no
                 push to main (16a0569b)
waves:           11 (w1-w11)
dispatches:      20 logical dispatch ids; 25 Workflow launches (1 failed at launch, 5 killed by container restarts,
                 of which 3 were resumed with resumeFromRunId and 1 was replaced; 1 refused for a same-wave dependsOn)
topology mix:    generator-evaluator 10 (w2-d1, w2-d2, w3-d3, w3-d4, w3-d5, w4-d1, w5-d1, w6-d2, w9-d2, w11-d1)
                 · single 6 (w3-d1, w6-d1, w7-d1, w7-d2, w8-d1, w9-d1) · chain 3 (w3-d2, w5-d2, w10-d1) · fan-out 1 (w1-d1)
                 widest wave: w3 = 5 parallel dispatches
status:          done 17 logical dispatches · stopped 1 never re-run (w3-d1 integration, killed by the 1st container
                 restart; its work was redone as w4-d1, 6b5b7b55) · refused 1 (w7-d2, same wave id as the dispatch it
                 depended on; re-sent as w8-d1, a4bcdf18) · failed 1 launch (w1-d1, scriptPath refused, 7742d05b)
                 · exhausted 0 · over_budget 0 · blocked 0
agents:          72 agent labels across the launches (Grapher scribe in every completed launch)
subagent_tokens: 7,390,321 (sum of the 20 task_notification usages that reported one; the 5 stopped runs reported none)
workflow ms:     59,422,112 summed (16.5 h). Longest: w10-d1 14,318,743 (4.0 h), w5-d2 resumed 6,098,121, w3-d5 6,191,721
wall clock:      11-16 20:45:58 -> 11-17 10:03:05 (684aa0c9) = 13h17m for the run. Follow-up Q&A 15:46:52 -> 15:47:14
cost:            $190.65 at the final report (684aa0c9); $192.17 after the follow-up answer (0ee0770c)
main context:    84,256 tokens at the first tool call (7c2f7b95), rising steadily to 245,746 at the final report (8b272758,
                 10:02) and 249,216 at the follow-up (789071f7). No compaction
compaction:      0
human input:     1 task (9fbd0d30) + 1 AskUserQuestion with 2 answers (cd872ea9) + 1 follow-up question, "What
                 verification has been completed for this work" (a58fb0f5, 15:46:52). 0 corrections
synthetic input: 9 stop-hook prompts to commit/push (a6ed37bb, 5d77e814, 8bb817d4, 8f13cefb, c1868684, ffbffd0b, d7c6ab7e,
                 251f474e, b216a164). The orchestrator declined each one because the work belonged to a running step
container:       3 restarts (about 23:58, 01:32 and 02:21 on 11-17), killing 5 Workflow runs
outcome:         all 14 tickets built, reviewed, merged and pushed to claude/tender-sagan-glfr3o at 3b0bfb71 (db2fb23d). The
                 full backend coverage gate, Playwright, RustFS, halfvec and live tests were never run here. The user
                 asked what had been verified and got a breakdown (2b016596). No correction, no explicit acceptance
```

Per-dispatch (task_notification usage; agents counted from the task_progress workflow_progress labels):

| Dispatch | Topology | Status | duration_ms | total_tokens | agents | started / notified |
|---|---|---|---|---|---|---|
| w1-d1 (1st launch) | fan-out | failed: scriptPath refused | 22 | 0 | 0 | bbb6c6ae / 7742d05b |
| w1-d1 | fan-out | done (ticket map: 14 tickets) | 118,182 | 361,391 | 4 | 29e5de8c / b054e14a |
| w2-d1 | generator-evaluator | done (15-01) | 4,726,573 | 519,277 | 3 | d240c5c0 / d4ff61fa |
| w2-d2 | generator-evaluator | done (16-01) | 694,822 | 259,342 | 3 | 8cfce786 / 1e7f225d |
| w3-d1 | single | stopped by restart 1, never resumed (integrate 15-01 + 16-01) | - | - | 1 | a4487ea8 / faef1177 |
| w3-d2 | chain | done (15-02 then 15-03) | 5,339,959 | 784,160 | 5 | acae7a8e / c65c8f94 |
| w3-d3 | generator-evaluator | done (15-04) | 3,336,628 | 389,535 | 3 | c297091a / 02129982 |
| w3-d4 | generator-evaluator | done (15-05) | 3,467,787 | 412,314 | 3 | 4dcf4526 / de09a451 |
| w3-d5 | generator-evaluator | done (16-02) | 6,191,721 | 545,821 | 3 | a93734d2 / cb6ff374 |
| w4-d1 | generator-evaluator | done (integrate the wave and push) | 3,528,309 | 305,012 | 3 | 31443d09 / dd152b1b |
| w5-d1 (1st) | generator-evaluator | stopped by restart 2 | - | - | 2 | 1cadb0c9 / 9e95e5d6 |
| w5-d2 (1st) | chain | stopped by restart 2 | - | - | 1 | 124ccee4 / 4c3f8656 |
| w5-d1 (resumed) | generator-evaluator | done (15-06) | 803,907 | 185,952 | 3 | 4cd553fe / 30f3bbcd |
| w5-d2 (2nd) | chain | stopped by restart 3 | - | - | 3 | bb7d56c1 / 6287fd9a |
| w6-d1 | single | done (integrate 15-06) | 590,878 | 155,166 | 2 | 0b5e2bd6 / 63aeba8d |
| w6-d2 (1st) | generator-evaluator | stopped by restart 3 | - | - | 2 | 0373142d / 3972558c |
| w5-d2 (resumed) | chain | done (16-03, 16-04, 16-06) | 6,098,121 | 825,080 | 7 | eb1a3059 / ed6b79e6 |
| w6-d2 (resumed) | generator-evaluator | done (15-07) | 685,273 | 188,536 | 3 | 17ba3954 / 741a827a |
| w7-d1 | single | done (integrate 16-03) | 799,815 | 158,690 | 2 | d86b97bd / 64af9b93 |
| w7-d2 | single | refused: depends on w7-d1 in the same wave; harness still says "completed" | 5,017 | 71,044 | 1 | b98ce6b7 / 4d989a23 |
| w8-d1 | single | done (integrate 15-07, re-sent w7-d2) | 606,858 | 149,370 | 2 | c7b7a1cc / 3a01190a |
| w9-d1 | single | done (integrate 16-04 + 16-06) | 1,031,586 | 161,238 | 2 | df68ff4e / c227014c |
| w9-d2 | generator-evaluator | done (16-05) | 3,352,332 | 488,611 | 3 | 51e048ce / 12e8a258 |
| w10-d1 | chain | done with findings: land 16-05 + 16-07, then the final 3-reviewer gate failed 2 of 3 on one flaky demo-data bug (5f56d66d) | 14,318,743 | 1,070,161 | 8 | fa7c0154 / 0fdda3f0 |
| w11-d1 | generator-evaluator | done (fix the seeded live-score test) | 3,725,579 | 359,621 | 3 | 02845ef7 / 63868e65 |

## Observations

1. **The plugin launch path failed on the first dispatch, and the fix was a copy of the workflows into SCRATCH.** The first w1-d1 wrapper sent `scriptPath: '/root/.claude/plugins/synced/.../graph-orchestrator/workflows/dispatch.js'` (91980702) and failed in 22 ms with "scriptPath must be a script path this tool returned, or a file you can already read" (7742d05b). The orchestrator ran `cp -r .../graph-orchestrator/workflows SCRATCH/go-workflows` (c26b4e24) and re-sent the same wrapper pointing at `SCRATCH/go-workflows/dispatch.js` (dec70764). It told the user (eb891211). Every later launch used the copy. This is the known SKILL.md scriptPath defect.

2. **Container restarts were the main source of lost work.** There were three: about 23:58, about 01:32 ("about an hour after the last one", 38dea46a) and about 02:21 ("restarted a third time", fccaefb3). They killed five Workflow runs (w3-d1, w5-d1, w5-d2 twice, w6-d2). Recovery was good. After restarts 2 and 3 the orchestrator re-launched w5-d1, w5-d2 and w6-d2 with `resumeFromRunId` and the per-run script path the harness had saved (d32221db, 3fd81e29, 7b0bb6cd), so finished steps came back from cache. After restart 1 it did not resume w3-d1. It checked what survived (2bc30834) and re-planned the integration as w4-d1 (ba5870c3, 6b5b7b55). The run also changed how it gated merges: "the full backend run with its 100% coverage gate never completed, since it takes over an hour and the container restarted about hourly" (db2fb23d).

3. **There was one same-wave dependsOn violation, and the harness reported it as completed.** w7-d2 (c547b2e4) declared `dependsOn ["w6-d2","w7-d1"]` while it was itself in wave 7. The dispatcher refused it. Even so, the task_notification reads `"w7-d2 · single" completed` after 5,017 ms and 71,044 tokens (4d989a23), so a status check alone would not catch the refusal. The orchestrator noticed: "Planning fault: wrong wave id. Re-dispatching as wave 8." (b5aa0593). It then re-sent the identical spec as w8-d1 (568f7bc6) and explained the fault to the user (a4bcdf18).

4. **The orchestrator inspected things itself while waiting, though not heavily.** It made 9 Bash calls in total. Most were state checks after a restart (2bc30834, eadab32b, 10f6c51d). Two checked on a running step:
   - one read a running task's output file, `tail -c 1500 .../tasks/wnmzctkjl.output` (90a97e15);
   - one inspected the workflow journal and `ps` for pytest (9391a728).

   It did one `git push` itself (b8127fc4), which came back "Everything up-to-date", and rendered the trace with `node .../render-trace.js` (71d620ec). It made no source edits. It touched only state.md, through Write and Edit, 17 times. It never polled with sleep or Monitor.

5. **Specs carried a moderate amount of inline context.** The Workflow inputs were 1.9k to 5.2k characters. The `dispatch.context` arrays were 191 to 1,182 characters (largest: w10-d1 6b4914a6 at 5,172 / 1,182). They held commit hashes, migration numbers and worktree commands rather than pasted file bodies. Tool results returned to the main loop were small: 69 KB in total over 58 results, the largest being the 21.7 KB catalog read (762756ca).

6. **The main context was large from the start and never compacted.** The first tool call already carried 84,256 prompt tokens (7c2f7b95). The run ended at 245,746 (8b272758), and the follow-up answer ran at 249,216 (789071f7) with no compaction. Each completed dispatch added about 7 to 8k tokens of notification and report text to the main loop.

7. **The stop hook kept asking to commit or push, 9 times.** The first prompt was a6ed37bb ("untracked files": a worker's `dump.rdb` Redis snapshot). Later ones said "13 unpushed commits" (8bb817d4, 8f13cefb, c1868684, ffbffd0b, d7c6ab7e). Each was declined, because the push belonged to a running integration step (75758591, 5a62b5b7). Every one cost an extra turn, and turns cost $1 to $2 each by this point.

8. **The scribe worked every time.** A Grapher label appears in each of the 20 launches that reported usage, all finished as `done`. The five runs killed by restarts had no Grapher result. The final trace rendered to `SCRATCH/session.mmd` (71d620ec, 235fc466).

9. **Parallel building forced migration renumbering at integration.** Parallel builds produced three migrations numbered `0050` (cb65100b). Integration steps renumbered them into one chain, `0049`..`0058` (5616d905, db2fb23d). The local `ticket/*` branches kept the old numbers, and the final report tells the user to treat the pushed branch as the source of truth.

10. **The final report and the follow-up were honest about gaps.** The final report lists what was never run (db2fb23d). The answer to "What verification has been completed" (a58fb0f5 → 2b016596) separates checks the agents reported from checks never run, and adds: "The spec reviewers weren't re-run after the fix; only that test was re-checked." The user gave no further reply. After that only `turn_handoff_available` system events follow, the last at 19:49:45 (9117d399).
