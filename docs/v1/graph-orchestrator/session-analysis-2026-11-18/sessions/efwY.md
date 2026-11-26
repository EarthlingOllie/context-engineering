# efwY: Spec 14 graph implementer (rag-agent-studio)

Session `session_016jSC3efwYsrqKGWpoahfXf`, CLI session `c805b6b0-8abe-56ab-822f-0032a04d7c80`, repo rag-agent-studio, branch `claude/vigilant-fermi-hyy6yt` -> PR #103 -> main, plugin graph-orchestrator v0.3 (catalog read c0933bc9), model claude-opus-5-5, permission mode default then auto (8c16a8e4).
SCRATCH `/tmp/claude-0/-home-user-rag-agent-studio/c805b6b0-8abe-56ab-822f-0032a04d7c80/scratchpad`.

Coverage: the whole transcript was read. That is 56 saved page files (5,287 unique events, 2026-11-14 09:00:59 to 2026-11-16 06:42:56) in `raw/efwY/p001..p056.txt (files are deduplicated by event uuid when parsed)`, read backwards until has_more was false. Parsing used `bin/main.py`, `bin/wfagg2.py`, `bin/viol2.py` and `bin/ctx.py`. Digests are in `efwY-main.txt`, `efwY-state-last.txt` and `efwY-render-*.txt`.

## Metrics

```
task:            "Spec 14 is about to merge into main, please await its merge, then assess the frontier of tickets, working your
                 way through the spec in waves. /graph-orchestrator" (human eea33ab8, 11-14 09:01:45). Follow-ups added a
                 Playwright walkthrough (52a17c2c), the story-34 fix (30fd08fa), PR + CI + merge (89eae1ce) and merge as user (2da547d8)
mode:            autonomous (state.md 211aa54b: "autonomous · waves 13/16 · dispatches/wave 9"). The trace logs a
                 "human · ambiguity: attended or autonomous? -> autonomous" node (render 401dedb7), but the session made no
                 AskUserQuestion call; the orchestrator chose
waves:           13
dispatches:      13 logical; 14 Workflow launches (1 failed at launch). Exactly 1 dispatch per wave throughout
topology mix:    single 5 (w1, w9, w11, w12, w13) · generator-evaluator 3 (w2-d1, w3-d1, w8-d1)
                 · chain 4 (w4-d1 3x g-e; w5-d1 4x g-e; w6-d1 2x g-e + single; w7-d1 single -> relay x4) · fan-out 1 (w10-d1)
status:          done 12 · blocked 1 (w12-d1: "main branch ruleset needs 1 approving review", render 5a4670d9)
                 · failed 1 launch (w1-d1, scriptPath refused, 4c0e146c) · exhausted 0 · over_budget 0
agents:          61 agent labels across the 13 launches that ran (Grapher scribe included in each)
subagent_tokens: 7,834,854 (sum of the 13 completed task_notification usages)
tool_uses:       2,067 (subagents)
workflow ms:     73,758,753 summed (20.5 h). Every wave held 1 dispatch, so this is nearly all of the active wall clock.
                 Longest: w5-d1 24,808,949 (6.9 h), w4-d1 19,750,637 (5.5 h), w6-d1 14,855,151 (4.1 h)
wall clock:      11-14 09:01:45 -> 11-15 16:43:49 (merge report 2c77203f) = 31h42m. Implementation alone (w1-w6):
                 09:01:45 -> 11-15 03:52:47 (8c5d5c46) = 18h51m. Follow-up Q&A 11-16 06:31:24 -> 06:31:39 (341f5d9f)
cost:            $175.78 when all 11 tickets were done (8c5d5c46); $205.33 at the merge (2c77203f); $206.55 final (341f5d9f)
main context:    peak main-loop prompt 207,014 tokens (30950612, 11-16 06:31); no compaction
human input:     9 messages: eea33ab8 task, 4d629a63 "Are we parellising test runs", 2f5f175c "Where are we with each ticket",
                 52a17c2c walkthrough, 30fd08fa "Yes please fix story 34", 8ac83b4a "What's the confidence on the feature ?",
                 89eae1ce "Open the pr, wait for CI and merge when green", 2da547d8 "Can you not merge is as me?",
                 50d983fc "Is the spec 14 implementation merged?". 0 corrections; 3 were status questions
synthetic input: 2 stop-hook prompts (6d7f6558 untracked files; bb88a90f 1 unpushed commit). The orchestrator declined both
                 because a running dispatch owned the changes (fbf1c7a7, 3e750b57)
outcome:         all 11 spec-14 tickets + the story-34 fix + 2 CI fixes merged to main as c26be6b3 via PR #103. 28 checks:
                 22 passed, 6 skipped (2c77203f). The merge bypassed the required review at the user's request. Walkthrough:
                 73/73 stories pass after the fix. The user accepted it: the next day they asked only whether it was merged (50d983fc)
```

Per-dispatch (task_notification usage; agents counted from the task_progress workflow_progress labels; stage statuses from the trace renders):

| Dispatch | Topology | Status | duration_ms | total_tokens | tool_uses | agents | started / notified |
|---|---|---|---|---|---|---|---|
| w1-d1 (1st launch) | single | failed: scriptPath refused | 17 | 0 | 0 | 0 | f3dbe270 / 4c0e146c |
| w1-d1 Locate spec 14 and tickets | single | done | 63,466 | 163,087 | 17 | 2 | f8fe2013 / ebff6945 |
| w2-d1 Implement ticket 14-01 | g-e ×2 rounds | done | 3,490,113 | 463,845 | 88 | 5 | fac0f06b / b2767245 |
| w3-d1 Implement ticket 14-02 | g-e ×1 | done | 4,663,371 | 621,443 | 205 | 3 | a92c07e2 / 088ebf8b |
| w4-d1 Implement tickets 14-03..14-05 | chain of 3 g-e (14-03 ×2 rounds) | done | 19,750,637 | 1,444,086 | 431 | 9 | 1a8bf87d / 98b928c6 |
| w5-d1 Implement tickets 14-06..14-09 | chain of 4 g-e (14-07 ×2 rounds) | done | 24,808,949 | 1,733,189 | 568 | 11 | 47a162ff / ab739813 |
| w6-d1 Implement 14-10, 14-11, confirm spec complete | chain (g-e ×2, g-e, single) | done | 14,855,151 | 1,110,531 | 341 | 8 | cd2b610e / a960faa0 |
| w7-d1 Record spec 14 user stories | chain (single -> relay ×4) | done (72/73 pass) | 4,623,383 | 1,031,009 | 267 | 8 | 483cf8ae / 7e39fb02 |
| w8-d1 Fix story 34 Evaluate button | g-e ×1 | done | 653,981 | 256,678 | 32 | 3 | 75d484e4 / fca8d491 |
| w9-d1 Open spec 14 PR | single | done | 76,883 | 154,340 | 13 | 2 | c1fafee1 / 2fe40b11 |
| w10-d1 Fix failing CI checks | fan-out | done | 573,028 | 406,988 | 75 | 4 | e3b929c6 / ebe92afd |
| w11-d1 Apply CI fixes and push | single | done | 134,844 | 150,651 | 12 | 2 | 45688d35 / a3caf333 |
| w12-d1 Verify green and merge PR 103 | single | blocked (ruleset needs 1 approval) | 29,555 | 150,538 | 10 | 2 | aadd5bff / 14f76398 |
| w13-d1 Merge PR 103 as user | single | done | 35,375 | 148,469 | 8 | 2 | 174ab6e2 / b579abbf |

All task_notification events report `completed`; the w12-d1 blocked status comes from the trace render (5a4670d9) and the reply 30811eba. The Grapher scribe reached `done` in every launch that ran; no null or failed scribe was seen.

## Observations

1. **The scriptPath wrapper failed, and the session copied the whole workflows/ directory to scratch.** The first w1-d1 failed in 17 ms with `Error: workflow({scriptPath: '/root/.claude/plugins/synced/...` (4c0e146c). The orchestrator ran `mkdir -p $S/plugin && cp -r $P/workflows $S/plugin/` (8e14753e) and relaunched (430b8d6f, "retry with the dispatch script copied into the scratchpad", effcd052). This is the same failure and the same workaround as d9gr, 1.5 days later on the same plugin version.

2. **Every wave ran exactly one dispatch, so 11 tickets took 18h51m of wall clock.** After 14-02, the orchestrator decided "They all go on the one dev branch, so I'm running them in order, one commit each" (67bdfa02). It bundled 14-03..14-05 and 14-06..14-09 into serial chains of 5.5 h (w4-d1) and 6.9 h (w5-d1). Ticket dependencies were not the only constraint: the shared working tree drove the decision. Mid-chain the user asked "Are we parellising test runs" (4d629a63). The answer was "Partly, and only inside a single run ... The full suite runs with pytest-xdist (-n auto) and still takes about 22 minutes" (59d46b63). With a 22-minute full suite inside each generator-evaluator stage, wall clock was dominated by test runs. The 13 dispatches summed to 20.5 h of workflow time.

3. **Fixed per-dispatch overhead is high for trivial dispatches.** w9, w11, w12 and w13 each used 2 agents (worker + Grapher) and 148-154k tokens for 8-13 tool uses and 30-135 s of work (14f76398 w12: 29.6 s, 150,538 tokens). Opening a PR, pushing a patch or calling the merge API each cost about the same as a full ticket-extraction single (w1-d1, 163k).

4. **The orchestrator kept a very clean main loop.** Main-loop tools were Workflow 14, Write 16 (state.md), Bash 5 (the cp, one `git status` 77727c12 to answer a stop hook, and three trace renders 17ea383f/b44735ad/158b0512), ReadNotifications 5, SendUserFile 2, Read 1 (the 21.7 KB catalog, 80fe488a), subscribe_pr_activity 1 (55309386) and send_later 1 (a1ced111). There was no repository reading, grepping, editing, testing or Monitor polling by the orchestrator. The largest main-loop tool result after the catalog was a 7 KB ReadNotifications (621aa75d). Even so, without any compaction the main context grew to 207k tokens by the end (30950612).

5. **Waiting for CI used push events plus one safety-net check-in, not polling loops.** After w9 opened PR #103, the orchestrator subscribed to it (55309386) and scheduled one send_later check-in for 50 minutes later (a1ced111, "backup check-in for 14:53 UTC", b3f90480). It did not wait for the queued run: it started a fan-out to diagnose the two checks that had failed on an earlier run of the same commit (d511cef6, w10-d1). It read ReadNotifications 5 times, each at a turn boundary. When it found the PR stuck on a required review, it stopped the scheduled check-ins and said so (fe483cf2).

6. **Local verification missed regressions that CI caught, and real-model testing never ran.** The implementation report says "the end-to-end tests for this work have not run anywhere yet" (e86c25b3); Docker could not build in the container because of a proxy certificate problem (b5763c10). CI then caught a 14-07 regression in which a delete dialog stayed open, and an outdated org-cost test expecting 3 cards (2c77203f). Those two fixes plus a gitleaks false positive took w10-w11. The final report also flags that the judge was only ever tested against the fake model and fake judge (2c77203f, state.md 211aa54b).

7. **A human gate surfaced correctly, and the user then chose to bypass it.** w12-d1 came back blocked: the ruleset needs 1 approving review (30811eba gave the options "approve it on GitHub" or "merge it yourself"). The user asked "Can you not merge is as me?" (2da547d8), and w13-d1 merged under the user's account with no approval (b579abbf). The orchestrator recorded this as a decision ("merged without an approving review at user's request (ruleset bypass)", 211aa54b) and put "It went in without a review" first under "Needs your attention" (2c77203f). It announced the merge (61e7051e, 16:43:14) 9 s before w13-d1's own notification arrived (b579abbf, 16:43:23); a PR event had already reported the merge, and the confirmed commit followed in 2c77203f.

8. **The trace mislabels human interactions.** The user's question "Are we parallelising test runs?" is drawn as a "human · irreversible" gate on w5-d1, and "Fix story 34 ... push to the branch?" as "human · irreversible" on w8-d1 (renders 401dedb7, 952e75f0). The mode choice is drawn as a human answer, although no question was asked (401dedb7).

9. **Dispatch specs sometimes carried substantial context.** Workflow inputs ran 1.7-6.0 KB. The largest were 56d62dca (w5-d1, 5,997), cf703389 (w7-d1, 4,756), fee498a4 (w6-d1, 4,685) and e4ade9df (w4-d1, 4,434). They carried carry-forward notes from earlier tickets, such as "14-05 notes: expected sources keep ..." and "14-02 notes: judge = Default Model via ...", rather than file paths to notes.

10. **Cost profile.** The 11 tickets cost $175.78 (about $16 each), compared with $2.6-3.6 per finding in d9gr. The walkthrough added $16.27 (177.01 -> 192.04 around w7-d1); the story-34 fix, PR, CI and merge added $13.29.

## Evidence and coverage

- Raw pages: `raw/efwY/p*.txt` (56 files, deduplicated by uuid; the oldest page reached has_more false). All event ids cited are uuid prefixes from these pages.
- Not captured: the dispatch handback texts verbatim (the orchestrator turned them into prose), and per-agent token splits.
