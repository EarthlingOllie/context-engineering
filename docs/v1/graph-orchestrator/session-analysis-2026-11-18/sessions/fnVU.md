# fnVU: Sandbox Orchestrator (agentic-environment-provisioning)

Session `session_016jSC3fnVUdcu2dLVp7eqXn`, CLI session `6e52c967-cd3d-507d-8bc7-516670c6c4fc`, repo agentic-environment-provisioning, work branch `claude/upbeat-goodall-dnxn3z`, SCRATCH `/tmp/claude-0/-home-user-agentic-environment-provisioning/6e52c967-.../scratchpad`.

## Metrics

```
task:            "Please read the spec and assess the frontier of tickets. Working through tickets for [four] at a time,
                 reassessing the frontier as you go /graph-orchestrator" (human 3c75db90, 14:43:29); tickets 01-19 of
                 .scratch/sandbox-mvp
mode:            autonomous (AskUserQuestion 45332874, answer c10208ec: "Autonomous (Recommended)"; git: "commit, push and
                 merge once all green"); dispatches/wave cap 4; waves 16/16 (budget reached) (state.md 4c69786e)
waves:           16
dispatches:      36 logical; 37 Workflow launches (1 failed at launch)
topology mix:    generator-evaluator 24 · single 5 (w1-d1, w2-d2, w8-d4, w10-d2, w15-d1) · panel 3 (w6-d4, w10-d1,
                 w12-d1) · chain 4 (w11-d1 g-e->single; w13-d1 g-e; w14-d1 g-e->panel->single; w16-d1 panel->single)
status:          done 35 · blocked 1 (w13-d1, git-escape fix choice) · failed 1 (first w1-d1 launch, scriptPath refused)
                 · exhausted 0 · over_budget 0. Session stopped at the 16-wave budget, not merged.
agents:          121 distinct agent labels across the 36 completed workflows (2-9 each; Grapher scribe in every one)
subagent_tokens: 12,044,437 (sum of 36 completed task_notification usages); w14-d1 alone 1,170,593
tool_uses:       1,956 (subagents)
workflow ms:     38,886,643 summed (10.8 h of workflow time inside 7.1 h of wall clock)
wall clock:      14:42:37 first event / 14:43:29 prompt -> 21:52:21 final result 5432e981 = 7h09m (2026-11-11); idle after
cost:            $121.94 cumulative at the final result (5432e981)
main context:    largest main-loop prompt 265,964 tokens (assistant 9f8d8f98, 19:42); 207,622 tokens re-cached after a cache
                 miss at 21:36 (751c19a6)
human input:     2 AskUserQuestion answers (c10208ec mode/git at 14:44; 91455281 "A: agent's own clone" at 19:41, 10 min
                 after the question 6029cabf); 0 typed corrections; the user did not reply after the final report
compaction:      none seen
outcome:         19/19 tickets pushed (tip 82f2973), CI green up to 4919967/1777bb9; NOT merged to main: the final re-review
                 (w16-d1) failed 0/3 lenses and CI for the tip stayed queued. The user neither accepted nor corrected
                 (only turn_handoff events at 11-12 00:04 and 07:32, no user message).
```

Per-dispatch (task_notification usage; the start time is when the task_started event arrived, which was batched for some waves):

| Dispatch | Topology | Status | duration_ms | total_tokens | tool_uses | Agents | Notification |
|---|---|---|---|---|---|---|---|
| w1-d1 (1st) | single | failed: scriptPath refused | 23 | 0 | 0 | 0 | c4575a0f (task_updated 19dd43e4) |
| w1-d1 Map spec and ticket frontier | single | done | 65,139 | 158,689 | 11 | 2 | fb31e181 |
| w2-d1 Adopt ticket 01 skeleton | g-e | done | 70,311 | 234,083 | 16 | 3 | 7df6c7e5 |
| w2-d2 Plan post-01 ticket waves | single | done | 150,138 | 164,948 | 7 | 2 | a0f2b1bf |
| w3-d1 ticket 03 | g-e | done | 346,841 | 281,420 | 32 | 3 | a51af907 |
| w4-d1 ticket 04 | g-e | done | 600,373 | 307,730 | 41 | 3 | d08c0459 |
| w4-d2 ticket 07 | g-e | done | 1,443,279 | 327,153 | 73 | 3 | 53d3e91b |
| w4-d3 ticket 09 | g-e | done | 1,716,394 | 346,777 | 93 | 3 | 20090326 |
| w4-d4 ticket 02 | g-e | done | 257,129 | 276,147 | 35 | 3 | 1dd5c057 |
| w5-d1 ticket 05 | g-e | done | 1,160,388 | 310,394 | 66 | 3 | b327c0ea |
| w5-d2 ticket 11 | g-e | done, 2 rounds | 1,347,034 | 490,481 | 70 | 5 | 20bbd265 |
| w5-d3 ticket 10 | g-e | done | 311,221 | 256,615 | 28 | 3 | 92686cf9 |
| w5-d4 Isolate integration test projects | g-e | done | 790,644 | 261,304 | 40 | 3 | 2232a0ba |
| w6-d1 ticket 06 | g-e | done | 939,023 | 304,516 | 57 | 3 | 58c21668 |
| w6-d2 ticket 14 | g-e | done | 786,982 | 300,196 | 45 | 3 | a4ad5fcb |
| w6-d3 ticket 08 | g-e | done | 1,287,908 | 315,195 | 66 | 3 | 96cfb9ce |
| w6-d4 Review done tickets | panel (3 lenses) | done, 6 BLOCKING found | 131,432 | 414,426 | 30 | 5 | 6efc1539 |
| w7-d1 ticket 12 | g-e | done | 2,116,798 | 380,880 | 84 | 3 | 2c99fe4a |
| w7-d2 ticket 16 | g-e | done | 776,836 | 284,479 | 44 | 3 | 872dfa1c |
| w7-d3 Fix review blocking defects | g-e | done | 1,368,693 | 307,606 | 60 | 3 | fe7036ed |
| w7-d4 Isolate integration test IPs | g-e | done | 2,122,941 | 263,800 | 46 | 3 | 3532e7f6 |
| w8-d1 ticket 13 | g-e | done | 854,437 | 282,835 | 38 | 3 | 105a7c39 |
| w8-d2 ticket 17 | g-e | done | 1,264,897 | 298,856 | 47 | 3 | 3c75f465 |
| w8-d3 ticket 18 | g-e | done | 1,865,517 | 382,798 | 83 | 3 | 47d0b9fa |
| w8-d4 Check GitHub CI | single | done (CI red, network flake) | 39,329 | 168,514 | 11 | 2 | 2b425c74 |
| w9-d1 ticket 15 | g-e | done | 1,139,384 | 283,092 | 43 | 3 | 07eda5ac |
| w9-d2 ticket 19 | g-e | done | 2,373,213 | 344,863 | 86 | 3 | f3c50c4a |
| w9-d3 Get GitHub CI green | g-e | done | 181,730 | 248,135 | 19 | 3 | 6c425a7f |
| w10-d1 Final review of the branch | panel (4 lenses) | done, 4 BLOCKING found | 241,870 | 621,308 | 78 | 6 | 9aec38f3 |
| w10-d2 Check CI at tip | single | done | 27,012 | 155,892 | 10 | 2 | 4f88eba7 |
| w10-d3 Diagnose rollback test | g-e | done (not a failure) | 205,785 | 229,393 | 23 | 3 | a58db2b0 |
| w11-d1 Fix final review defects | chain (g-e -> single) | done | 1,537,263 | 419,454 | 89 | 4 | 7acec196 |
| w12-d1 Confirm final fixes | panel (2 lenses) | done, 1 of 4 fixes fails | 1,187,434 | 250,337 | 23 | 3 | 30fa84e6 |
| w13-d1 Close the git config escape | chain (g-e x2) | blocked: which fix (A/B) | 2,478,722 | 470,986 | 95 | 4 | 70fd6990 |
| w14-d1 Move agent to its own clone | chain (g-e x2 -> panel -> single) | done, panel verdict lost | 6,859,746 | 1,170,593 | 287 | 9 | 88e28edc |
| w15-d1 Verify gates and merge | single | done: NOT MERGED (gate 1 verdict missing) | 34,110 | 154,976 | 8 | 2 | 20718d84 |
| w16-d1 Review then merge | chain (panel -> single) | done: review FAIL 0/3, NOT MERGED | 806,690 | 575,566 | 72 | 6 | ff4a877d |

Statuses and round counts come from the session.mmd render (f9dddf06, also embedded in final text eced78b8). Every task_notification says "completed", including w13-d1's, which the trace marks blocked.

## Observations

1. **The scriptPath wrapper failed on the first dispatch, and the turn ended reporting success.** w1-d1 with `scriptPath` set to the synced plugin's `workflows/dispatch.js` failed in 23 ms (WF 6d273485, task_updated 19dd43e4, notification c4575a0f). The turn still ended with "Wave 1 dispatched" (afe1392c, result 9cc13544). The next turn copied the whole `workflows/` dir to `SCRATCH/go-workflows/` (Bash aea2489a) and relaunched 15 s later (b44ec35f, text 32e92dfe). Every later Workflow call used `SCRATCH/go-workflows/dispatch.js`, and state.md recorded "workflow scripts load from SCRATCH/go-workflows/dispatch.js" (f866350d).
2. **The chain topology lost a mid-chain panel verdict, which cost two extra dispatches.** w14-d1 (g-e -> panel -> CI single) returned only its last stage's result. state.md says "panel verdict not surfaced by chain ... (verdict in SCRATCH/trace, not in result)" (f866350d), and the user was told "The final review's verdict didn't come back to me" (6917980b). The orchestrator ran w15-d1 to read the verdict from the trace files (d61298f2). It stopped at gate 1 (b34e86c8: "the final review's verdict was never saved"), at a cost of 154,976 tokens. It then ran w16-d1 to redo the review (6e847702, 575,566 tokens), which failed 0/3. This is a plugin defect: chain should surface every gating stage's verdict.
3. **Blocked status was invisible in the notification, and the human gate worked.** w13-d1's notification says "completed" (70fd6990), but the trace marks it blocked with the question "Which fix should I build? (A) ... (B) ..." (f9dddf06). The orchestrator raised it via AskUserQuestion (6029cabf, 19:31:31). The user answered 10 min later, "A: agent's own clone" (91455281), and w14-d1 launched at 19:42 (79f3f861). This was the run's only real human intervention.
4. **Wave barriers left ready work idle.** Each wave was launched only after its slowest dispatch finished, even when the next dispatches depended on earlier, faster ones. w5-d1/w5-d2 depended only on w4-d1 (done 15:06:04, d08c0459) but launched at 15:25:02 (df90bc2d), after w4-d3 finished at 15:24:40: 19 min idle. w8-d3 depended only on w6-d1 (done 16:04:29, 58c21668) but launched at 16:47:16 (f8af4e1c): 43 min. w10-d3 depended on w9-d1 (done 17:38:13) but launched at 17:59:25 (865f7385): 21 min. With 10.8 h of workflow time in a 7.1 h run, the 4-per-wave cap and barriers set the wall clock.
5. **The orchestrator followed the rules but did not open review-w16.md.** Main-loop tools for the whole run were Skill 1, Read 1 (catalog.md), AskUserQuestion 2, Write 13 (state.md), Workflow 35+1 failed, and Bash 1 (the cp workaround) plus the render step. It did not grep, edit or read code itself, and did not poll CI itself: CI checks went to dispatches (w8-d4, w10-d2, and the CI wait inside w15-d1/w16-d1 workers, "wait up to ~40 min"). The flip side: the final report says the blocking items are in review-w16.md, "which I haven't opened, so I can't yet say what they are or how big" (eced78b8). The user was left without the substance of why the merge failed.
6. **Context pasted into specs stayed modest.** Context arrays were 2-1,152 chars. The largest was w13-d1 at 1,152 chars, carrying the git-hole analysis (d3958a29). The merge workers got long instructions with exact git commands, the authorised and unauthorised actions, and commit trailers (d61298f2, 6e847702). No file contents were pasted. dependsOn always pointed at earlier waves: no dispatch depended on another in its own wave.
7. **Many review and fix loops.** There were 3 panels and 2 more panels inside chains: w6-d4 found 6 BLOCKING items (30162c11), w10-d1 found 4 (f6953018), w12-d1 found one of the 4 fixes ineffective (c7d8f8f8), and w16-d1 failed 0/3. Two fix dispatches, an escape hardening that a later review ruled out, and a model change followed. About 3.6M of the 12.0M subagent tokens went to waves 13-16 on the git-escape problem alone (470,986 + 1,170,593 + 154,976 + 575,566 + w11/w12).
8. **Flakes were routed into dispatches rather than diagnosed in the main loop.** These were w5-d4 and w7-d4 (integration test isolation), w8-d4 (CI red, network) (6fecf7c9), w9-d3 (CI green) (c2ddfd34), and w10-d3 (rollback "never actually failing") (6506afba). state.md recorded them under RULED OUT (f866350d).
9. **Main-loop context grew large without compaction.** The main prompt reached about 266k tokens by 19:42 (9f8d8f98). At 21:36 there was a cache miss and 207,622 tokens were re-cached in one call (751c19a6). Each integration turn was 1-6 turns long and $1-5, apart from turns that carried big workflow completions (cumulative cost jumped $94.44 -> $116.69 across the w14-d1 completion turn, 4d1c12ea). No compaction event was seen.
10. **Subagent permission denials:** `[Code from External]` (f55587ed, 15:01), a dangerous `rm` on `/home/user/agentic-environment-provisioning/*` blocked by the safety check (cf47d2b8, 16:14), and `[Credential Materialization]` (1cb09608, 16:20). No visible effect on dispatch status.
11. **Scribe:** a Grapher agent ran in all 36 completed workflows (task_progress labels). render-trace drew all 36 dispatches, the chain stages and three human nodes (mode, w13 block, budget) (f9dddf06). The budget node was added by hand with `--human` (0b7179da). No scribe null was seen.
12. **Outcome:** the session stopped at the 16-wave budget, not merged ("stop at 16-wave budget (autonomous, trigger 5) without merging — main untouched", state.md 4c69786e). It left manual checks for tickets 10, 18 and 19 and offered "Say the word and I'll pick it up" (eced78b8). The user did not reply. The goal "merged to main" was not met.

## Evidence and coverage

- All kinds (system, result, user, assistant) are complete from 2c8656ec (14:42:37) to 58d87505 (11-12 07:32:33). Saved as raw/fnVU/sr_p00..sr_p03.txt (system+result, 20:46-11-12 07:32) and all_p04..all_p50.txt (all four kinds, 14:42-20:46).
- The user/assistant events for 20:46-21:52 came back inline from three pages. They are summarised in raw/fnVU/ua_p00_inline_note.txt (final state.md, render, final text), ua_p01_inline_note.txt (w16-d1 launch) and ua_p02_inline_note.txt (w15-d1 launch, the 207k re-cache). The page for 20:46-20:58 had no user/assistant events.
- Parsed with tools/digest3.py -> fnVU-digest.txt and tools/disptable.py.
- Not seen: subagent transcripts, review-w*.md contents, why CI run 43097139349 stayed queued, and per-dispatch dollar cost.
