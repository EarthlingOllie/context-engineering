# g2Kg: Multi dispatch wave workflows (textkit test)

Session `session_016jSC3g2Kg1prQWSJsPhCbK`, CLI session `dd6da4ab-4ad3-5bb2-9975-b191a06c8281`, repo context-management, SCRATCH `.../scratchpad/mdw`.

## Metrics

```
task:            "Please generate a prompt that will test multi dispatch wave workflows and run it through /graph-orchestrator" (user b155a4a5)
mode:            autonomous (state.md MODE line, Write a72a054b/4bccdd67); waves 3/16 used, dispatches/wave cap 9
waves:           3 (+1 failed relaunch of wave 1)
dispatches:      6 logical; 9 Workflow launches (3 failed at launch, 6 completed)
topology mix:    generator-evaluator 3 · chain 2 (w2-d1: g-e -> single; w3-d1: single -> panel) · best-of-n 1
status:          done 6 · failed 3 (first wave-1 launch, scriptPath refused, 0 agents) · blocked 0 · exhausted 0 · over_budget 0
agents:          24 distinct agent labels (18 workers/evaluators/judges/reducers + 6 Grapher scribes)
subagent_tokens: 1,440,084 (sum of 6 completed workflow notifications)
tool_uses:       85
workflow ms:     321,465 summed; waves ran 07:57:18 -> 08:01:29 (4m11s)
wall clock:      07:55:51 prompt -> 08:01:59 final result (6m08s); follow-up Q&A 09:43:16-09:43:34
cost:            $5.85 at the final result 81a777e0; $6.60 cumulative after the follow-up (9b5af475)
human input:     2 messages (task prompt; "what did we build" ec40a193); 0 corrections
compaction:      none seen
outcome:         textkit built, 33/33 tests, panel PASS 3/3; user asked what was built and did not correct anything
```

Per-dispatch (task_notification usage):

| Dispatch | Topology | Status | duration_ms | total_tokens | tool_uses | Agents (task_progress labels) | Notification |
|---|---|---|---|---|---|---|---|
| w1-d1 (1st) | generator-evaluator | failed: scriptPath refused | 45 | 0 | 0 | 0 | 36786995 |
| w1-d2 (1st) | generator-evaluator | failed: scriptPath refused | 25 | 0 | 0 | 0 | a53b15a5 |
| w1-d3 (1st) | generator-evaluator | failed: scriptPath refused | 37 | 0 | 0 | 0 | e7710463 |
| w1-d1 wc | generator-evaluator | done, round 1, 7/7 | 36,269 | 174,557 | 9 | Generator, Evaluator, Grapher | 002e6bb6 |
| w1-d2 slug | generator-evaluator | done, round 1, 7/7 | 42,762 | 175,220 | 11 | Generator, Evaluator, Grapher | 8cbf1c05 |
| w1-d3 dedent | generator-evaluator | done, round 1, 7/7 | 48,924 | 177,718 | 13 | Generator, Evaluator, Grapher | 53096475 |
| w2-d1 CLI | chain (g-e -> single) | done, suite 33/33 | 52,398 | 235,787 | 11 | Generator, Evaluator, Worker, Grapher | 83dcdbf7 |
| w2-d2 README | best-of-n (3 + judge) | done, candidate 1 | 81,734 | 314,284 | 23 | Worker x3, Judge, Grapher | ddb0be10 |
| w3-d1 review | chain (single -> panel 3 + reducer) | done, PASS 3/3 | 59,378 | 362,518 | 18 | Worker, Evaluator x3, Reducer, Grapher | 7348b611 |

## Observations

1. **The SKILL.md scriptPath wrapper failed on the first wave.** All three wave-1 workflows failed 25-45 ms after launch with `workflow({scriptPath: '/root/.claude/plugins/synced/.../graph-orchestrator/workflows/dispatch.js'}): scriptPath must be a scr…` (task_updated cb85ced5, 8d89fdc8, 7699499a; notifications 36786995, a53b15a5, e7710463). The orchestrator first reported "Wave 1 dispatched" (result 9e6ac6ea, 07:56:51), before the failures came back in the same second.
2. **Workaround: the repo's copy of dispatch.js, not a scratch copy.** The orchestrator compared the plugin copy with the repo copy (Bash result `IDENTICAL`, user 1e655f76). It then relaunched with `scriptPath: '/home/user/context-management/graph-orchestrator/workflows/dispatch.js'` (assistant b6abf8e2, 82152148, 8a7aca52). It recorded this under RULED OUT and DECISIONS in state.md and reported it as "one real bug" in its final message (assistant 99d7bcfe). This only worked because the session was inside the plugin's own source repo.
3. **Waves and dependencies were set up correctly.** No dependsOn pointed at a dispatch in the same wave: w2-d1 and w2-d2 depend on w1-d1..d3 (e9e99341, b2648244), and w3-d1 depends on w2-d1 and w2-d2 (7ff8f975). The orchestrator waited for task notifications and did not poll. Between notifications it wrote one-line progress messages (851f38a9, 9bb32ce2, e8ab3aad).
4. **The orchestrator restated the same context in more than one spec.** It pasted the CLI contract (commands, exit codes, stdout/stderr rules) into both w2-d2 (b2648244) and w3-d1 (7ff8f975), and named it as a DECISION in state.md. Context arrays stayed small (417-743 chars for waves 1 and 2). It did not paste file contents.
5. **The orchestrator did a little work itself before the skill loaded.** To write the test prompt, it listed the repo, ran git log and read `docs/v1/e2e/use-cases.md` (user results 097cc86d, 22dbd9b8). The user had asked it to generate a prompt, so this is in scope. After kickoff it only wrote state.md and ran the render step (4bccdd67, 16ddd43b).
6. **The run logged a "human" gate even though it was autonomous.** The trace shows a `human · ambiguity on w1-d1` node: "Who writes package.json … → Only w1-d1 (wc) writes" (render output 624b7fb5). The orchestrator answered this itself. No human was asked.
7. **Results stayed small.** Each dispatch returned 2-8 lines, as its `returns.maxLines` asked (for example w2-d2 maxLines 2, w3-d1 maxLines 8). The orchestrator's integration messages were 1-3 sentences.
8. **Scribe:** a "Grapher: logging current dispatch" agent ran in every completed dispatch (task_progress), and render-trace drew all 6 nodes plus the chain stages (624b7fb5). No scribe returned null.
9. **Outcome:** the panel passed 3/3 and no fix wave was needed (result 81a777e0). At 09:43 the user asked "what did we build". The orchestrator demonstrated the CLI live (e5c2219d / 4f5c1755) and answered (7b2b5da0). The user made no correction. textkit stayed in the scratchpad and was not committed.

## Evidence and coverage

- The system and result kinds are complete for the session: 4 pages from 04ef53ac to eaafa22a (07:55:09-12:07:40), saved as raw/g2Kg/sr_p0..sr_p3.txt.
- User and assistant events: raw/g2Kg/u_p3.txt (user, 07:55-07:56), ua_p2.txt (07:57-07:58) and all_p2.txt (07:57-07:58, all kinds). The pages after 07:58:43 (b2648244 to 7b2b5da0) were read inline and not saved, so the event ids above are cited from that read.
- Not seen: the generated PROMPT.md body, and the subagent transcripts. The turns at 11:03 and 12:03 have turn_handoff events (f41c1b2f, 6d14cace) but no user message and no result.
