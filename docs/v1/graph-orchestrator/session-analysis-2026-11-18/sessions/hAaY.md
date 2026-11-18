# hAaY: File unpacking -> ADR-0002 wave-spike (pre-release prototype)

Session `session_016jSC3hAaYgCMNNLAWKhLi9`, CLI session `1ad4089e-aff7-5641-a080-0183eac7b7a8`, repo postpics (branch `claude/adr-0002-spike`), spike dir `/workspace/tmp/spike`. **This is not the shipped graph-orchestrator.** It ran `spike/.claude/workflows/wave.js` from an uploaded tarball through the `/anthropic-skills:wave-spike` skill.

## Metrics

```
task:            "Please unpack this file" (user 3f7c9761, 06:53:48), then "/anthropic-skills:wave-spike" (user 8ed28ea7, 06:56:19)
mode:            skill-driven test script, no state.md, no orchestrator skill
waves:           4 /wave runs (Run A: w1, Run B: w2, item 5: w3, item 7: w4); Run C skipped
dispatches:      5 (w1-d1 single, w1-d2 generator-evaluator, w2-d1 probe x20, w3-d1 chain single -> g-e, w4-d1 single)
topology mix:    single 2 · generator-evaluator 1 · probe 1 · chain 1 (chain added mid-session by patching wave.js, 82727e0f)
status:          4/4 workflows completed · 0 failed · spike items: 5 pass, 1 "queue", 1 no
agents:          31 (Run A 4, Run B 21, item 5 4, item 7 2; each run has 1 scribe)
subagent_tokens: 1,662,995 (221,118 + 1,110,811 + 220,178 + 110,888; notifs 47c9bb17, 533c5e11, a74c386b, 7132df8c)
tool_uses:       20 in workflows; main thread Bash 11, Skill 1, Workflow 4
workflow ms:     132,930 summed; runs 06:56:44 -> 06:59:57
wall clock:      06:53:48 -> 07:00:23 final table (748351ec, 6m35s); resume hooks only at 07:32 and 07:50
cost:            $9.48 cumulative at 748351ec (unpack turn $0.71 at 71b14bd4)
human input:     2 messages; 0 corrections
compaction:      none seen
outcome:         item table 748351ec; spike committed and pushed to claude/adr-0002-spike (2e1b2ad2, 4e8dcc21)
```

| Run | Dispatches | Status | duration_ms | total_tokens | tool_uses | Agents (task_progress labels) | Notification |
|---|---|---|---|---|---|---|---|
| A (items 1,2,4,6) | w1-d1 single, w1-d2 g-e | completed | 30,633 | 221,118 | 8 | w1-d1 worker, w1-d2 generator r1, evaluator r1, scribe | 47c9bb17 |
| B (item 3) | w2-d1 probe x20 | completed, 20/20 ok | 41,968 | 1,110,811 | 1 | w2-d1 probe 1..20, scribe | 533c5e11 |
| item 5 | w3-d1 chain (w3-s1 single -> w3-s2 g-e) | completed | 31,946 | 220,178 | 7 | w3-s1 worker, w3-s2 generator r1, evaluator r1, scribe | a74c386b |
| item 7 | w4-d1 single + decoy .claude/agents/evaluator.md | completed | 28,383 | 110,888 | 4 | w4-d1 worker, scribe | 7132df8c |

## Observations

1. **The spike confirmed the design that ships: one Workflow per wave, args arrive nested, results come back as data.** Items 1, 2, 4 and 6 passed. The workflow log shows `args keys = now,traceFile,maxAgents,dispatches` (baeb8e8d). The scribe wrote trace.jsonl with wave_start/wave_end lines.
2. **Concurrency cap finding (item 3).** The final table says the effective cap was 2, not 16 (cap = min(16, nproc-2), nproc=4). Queue waits ran up to 30.9 s, with agents starting in pairs about every 3.5 s (896e0b61). The same tool output also prints "peak concurrent: 21", which reads queued agents as running. The table's conclusion of 2 matches the waits. Run C (raising `CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS`) was not done because a cloud session cannot set it.
3. **Chain composition was added in-session (item 5).** The orchestrator patched wave.js itself (82727e0f). Both stages ran inside one `/wave` and the trace has `stages:["w3-s1:done","w3-s2:done"]`.
4. **Agent definitions in .claude/agents are not loaded for workflow agents (item 7: no).** The decoy phrase never appeared. The worker read evaluator.md through a tool call but did not follow it (67487048).
5. **The stop hook pushed git commits.** The repo's stop-hook-git-check twice demanded commit and push (667eedf8, 55ccf6a6). The agent created branch `claude/adr-0002-spike` from a detached HEAD and pushed. It also committed the decoy `.claude/agents/evaluator.md` (d6f01e5d). The user did not ask for any of this.
6. scriptPath worked here because wave.js was in the working repo (`/home/user/postpics/spike/...`). This is the same condition that let g2Kg's workaround work.

## Evidence and coverage

- Complete: system, user, assistant and result kinds from c8cc111d (06:53:45) to 90bc31fd (07:50:25). 3 pages, saved as raw/hAaY/p0.txt, p1.txt and p2.txt (197 events).
- Not seen: wave.js source and subagent transcripts. The commit author identity is in the Bash commands but left out here.
