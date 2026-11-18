# d9gr: Graph orchestrator findings review fixes (rag-agent-studio)

Session `session_016jSC3d9grbBEsD9Xf86T4C`, CLI session `a604c94c-5d25-5ec8-b612-fc9a542e58d3`, repo rag-agent-studio, branch `claude/fervent-einstein-oo67ih`, plugin graph-orchestrator v0.3 (catalog read f287ff21), model claude-opus-5-5, permission mode auto.
SCRATCH `/tmp/claude-0/-home-user-rag-agent-studio/a604c94c-5d25-5ec8-b612-fc9a542e58d3/scratchpad`.

Coverage: the whole transcript was read. That is 44 saved page files (4,298 unique events, 2026-11-12 21:39:45 to 2026-11-14 11:38:07) in `raw/d9gr/p001..p044.txt (files are deduplicated by event uuid when parsed)`, reading backwards until has_more was false. Parsing used `bin/main.py`, `bin/wfagg2.py`, `bin/viol2.py` and `bin/ctx.py`. Digests are in `d9gr-main.txt`, `d9gr-compact-b2afcecc.txt`, `d9gr-state-last.txt` and `d9gr-render-*.txt`.

## Metrics

```
task:            round 1: "Please can you read the findings and work through the high and then medium ones, test as you go and
                 evidence the fixes. /graph-orchestrator" (human abb9ed17, 11-12 21:42:16, with an uploaded findings-report.html)
                 round 2: "Now please resolve these findings: KB-F8, AGT-F6, CONV-F2, CONV-F3, KB-F7, KB-F10, AUTH-F3, AGT-F4,
                 WID-F4, ORG-F4, AGT-F3, AGT-F2 / AUTH-F4 (Low) and AUTH-I1 (Info)" (human 156a83cc, 11-13 23:28:47)
mode:            autonomous, chosen by the orchestrator itself: "I'm running in autonomous mode because your request was
                 explicit" (96d05cda). Cap: waves 6/16, dispatches/wave 9 (state.md d5acc211)
waves:           6 (round 1 = w1-w3, round 2 = w4-w6)
dispatches:      17 logical; 19 Workflow launches (1 failed at launch, 1 killed by a container restart and resumed)
topology mix:    generator-evaluator 11 (w2-d1,d2,d4,d5,d6; w5-d1..d6) · single 3 (w1-d1, w4-d1, w5-d7)
                 · chain 3 (w2-d3 g-e->g-e; w3-d1 g-e->single; w6-d1 g-e->single)
                 widest waves: w2 = 6 parallel dispatches, w5 = 7 parallel dispatches
status:          done 15 · blocked 1 (w6-d1: stage s2 "write the round two summary" was blocked because the harness kept the
                 subagent from writing the file; trace render 462bc8cf) · failed 1 launch (w1-d1, scriptPath refused, 2e7fde8c)
                 · stopped 1 launch (w2-d3, "Stopped by a worker restart", 6966a6fe; resumed 58ec8a59 and done)
                 · exhausted 0 · over_budget 0
agents:          67 agent labels across the 18 launches that ran (Grapher scribe included in each; w2-d3's stopped run had 3)
subagent_tokens: 6,750,041 (sum of the 17 completed task_notification usages; the stopped w2-d3 run reported no usage)
tool_uses:       1,298 (subagents)
workflow ms:     42,462,896 summed (11.8 h). Longest: w6-d1 9,121,152 (2.5 h), w2-d4 6,562,198 (1.8 h), w3-d1 4,020,767
wall clock:      11-12 21:42:16 -> 11-14 11:38:05 (74b51ff0) = 37h56m. Round 1 21:42 -> 02:13:04 (9973c8cf) = 4h31m.
                 Round 2 23:28:47 -> 11:38:05 = 12h09m, of which 8h49m was spent waiting on AskUserQuestion
                 (asked 8dd37f71 23:35:46, answered 79bf0402 08:24:51)
cost:            $80.05 at the end of round 1 (9973c8cf); $116.29 at the end (74b51ff0)
main context:    peak main-loop prompt 231,008 tokens (77dfd198, 11-14 09:05, at the w6-d1 dispatch)
compaction:      1, compact_boundary 6a265a2d at 11-14 11:37:11: pre 233,073 -> post 14,629 tokens. It came after the last
                 dispatch (w6-d1) returned; the summary is b2afcecc
human input:     3 messages (abb9ed17 task; 17f4d4c5 design decision on prompt injection, given while w1-d1 ran; 156a83cc
                 round 2) + 1 AskUserQuestion answering 4 design choices (79bf0402). 0 corrections
synthetic input: 12 stop-hook prompts to commit and push uncommitted changes (first 3a522421; then 41d72497, 672add9d,
                 6486906b, 48071ebb, 267f3309, d072c83f ...)
outcome:         round 1: 22 High/Medium findings fixed, red/green test for each, full suite green (2758 BE / 1117 FE at 100%,
                 9973c8cf). Round 2: 14 findings: 11 fixed, 3 proven already fixed (74b51ff0). Everything was pushed; no
                 PR was opened. The user did not reply after either final report: no correction, no explicit acceptance
```

Per-dispatch (task_notification usage; agents counted from the task_progress workflow_progress labels):

| Dispatch | Topology | Status | duration_ms | total_tokens | tool_uses | agents | started / notified |
|---|---|---|---|---|---|---|---|
| w1-d1 (1st launch) | single | failed: scriptPath refused | 30 | 0 | 0 | 0 | 1c5834bc / 2e7fde8c |
| w1-d1 Extract findings and test tooling | single | done | 2,901,073 | 244,663 | 75 | 2 | 55c730c3 / 0434870f |
| w2-d1 Fix auth throttling | g-e ×2 rounds | done | 2,239,811 | 553,977 | 89 | 5 | 76bb8a04 / 5bba7f44 |
| w2-d2 Fix tenancy invites | g-e ×1 | done | 1,105,049 | 322,098 | 52 | 3 | 70f6d662 / bd52d5f9 |
| w2-d3 (1st launch) | chain | stopped by worker restart | – | – | – | 3 | a0a1f8b4 / 6966a6fe |
| w2-d3 Fix injection and upload (resumed) | chain (g-e -> g-e) | done | 2,439,489 | 317,181 | 47 | 5 | 58ec8a59 / cf3abff3 |
| w2-d4 Fix widget spend | g-e ×3 rounds | done | 6,562,198 | 993,557 | 234 | 7 | b5e2722a / 8a806ded |
| w2-d5 Fix platform hardening | g-e ×1 | done | 2,334,868 | 372,575 | 92 | 3 | ba451628 / 18340f37 |
| w2-d6 Fix analytics privacy | g-e ×1 | done | 3,531,302 | 360,838 | 90 | 3 | ac0e8d4c / fd80d2e3 |
| w3-d1 Integrate and evidence all fixes | chain (g-e -> single) | done | 4,020,767 | 484,291 | 104 | 4 | 66dc4c93 / 3a241813 |
| w4-d1 Extract round two findings | single | done | 388,742 | 237,927 | 63 | 2 | 52c3728c / efaefed4 |
| w5-d1 Fix app shell | g-e ×1 | done | 1,192,826 | 309,948 | 52 | 3 | 7247f0f9 / 3c2461f0 |
| w5-d2 Fix embed widget | g-e ×1 | done | 1,690,861 | 340,829 | 89 | 3 | 25d5915c / 11e9bbc5 |
| w5-d3 Fix query bounds | g-e ×2 rounds | done | 2,335,437 | 458,494 | 58 | 5 | fab48591 / 0baea95d |
| w5-d4 Fix credentials audit | g-e ×1 | done | 764,616 | 250,753 | 27 | 3 | bf558aba / b2dc18cb |
| w5-d5 Fix ingestion bounds | g-e ×1 | done | 736,388 | 253,771 | 22 | 3 | e966f127 / c156e7c5 |
| w5-d6 Fix playground stream | g-e ×1 | done | 884,847 | 275,788 | 35 | 3 | 1b9bc557 / bf013e25 |
| w5-d7 Evidence already-resolved findings | single | done | 213,440 | 168,857 | 17 | 2 | 30cd151d / a7291415 |
| w6-d1 Integrate and evidence round two | chain (g-e ×3 -> single) | blocked (s2) | 9,121,152 | 804,494 | 152 | 8 | a1311754 / e59f0d6c |

All task_notification events report `completed`. The blocked status of w6-d1 and the round counts come from the orchestrator's trace render (462bc8cf). The task_notification events carry no workflow_progress, so the agent counts are taken from the task_progress events (`bin/wfagg2.py`). The Grapher scribe reached `done` in every launch that ran; no null or failed scribe was seen.

## Observations

1. **The scriptPath wrapper failed on the first dispatch, and the session worked around it by copying the script.** The first w1-d1 launch failed in 30 ms with `Error: workflow({scriptPath: '/root/.claude/plugins/synced/...` (2e7fde8c). The orchestrator said "The orchestrator's dispatch script can't be loaded from the plugin directory. I'll copy it into the scratchpad" (61977998), ran `cp .../graph-orchestrator/workflows/dispa…` (b9f195f5) and relaunched (aa630e71 -> 55c730c3). Every later dispatch used `scriptPath: SCRATCH/dispatch.js`, per the wrapper recorded in the compaction summary (b2afcecc §2) and state.md (d5acc211, "dispatch.js at SCRATCH/dispatch.js").

2. **A container restart killed an in-flight chain, and resumeFromRunId recovered it.** w2-d3 was reported "Stopped by a worker restart" (6966a6fe, 11-13 00:23:12) after running for 1h51m. The orchestrator read the workflow journal itself (`.../subagents/workflows/wf_e99e6568-b3f/journal.jsonl`, c6ee2bbe) and relaunched with resume (57d35751, started 58ec8a59). Per 092bcf4d the C3 stage replayed from cache, but the C4 attempt in progress and its test run were lost. The resumed run took a further 40 min (cf3abff3). The stopped run's token usage was never reported.

3. **The Stop hook pushed the orchestrator into doing git work itself on every turn.** There were 12 stop-hook prompts ("There are uncommitted changes in the repository. Please commit and push", first 3a522421). The orchestrator ran 28 Bash calls, 14 of them git add/commit/push (for example 4cdc225a, dca79f25, ec0b22eb, 347d3d97, 513a0573, fd5f6d4d). It also inspected diffs to work out which parallel cluster owned which file: d3de98b7 returned a 7,497-char `git diff`, and bf0d4da0 ran `git diff --stat` across clusters. This happened because 6-7 generator-evaluator dispatches edited one working tree in parallel (w2, w5), so the hook kept firing while other clusters were mid-edit. Each time, the orchestrator wrote a follow-up turn explaining why it was not committing (8fecc5e1, 6a46b4ed, 29be65e8 ...), and each such turn added a result event and cost.

4. **The orchestrator ran its own verification work.** At 02:12 it ran pytest itself to close a WID-F3 evidence gap the summary flagged (c2dd50c3, then 031a6a37 to append to evidence). After compaction, when w6-d1's summary stage was blocked, it read 18 KB of integration output (40aa7241 -> ec1b5bb6, 18,075 chars) and 20 KB of findings2.md headings (12da1717 -> 2c0db65c, 20,328 chars), then wrote `evidence/SUMMARY2.md` itself with a 5.5 KB heredoc (48e2d7d8). These are the largest main-loop tool results after the 21.7 KB catalog Read (24c5a12d). The orchestrator made no Read, Grep or Monitor calls on its own on repository code: main-loop tools were Bash 28, Workflow 19, Edit 12 (state.md), Write 7, AskUserQuestion 1, Read 1 (catalog), Skill 1.

5. **The parallel-cluster design paid an integration cost each round.** Clusters ran targeted tests only, with one integration wave at the end (b2afcecc §2). Round 1 integration (w3-d1, 67 min) found 6 failing tests and a coverage gap (9973c8cf). Round 2 integration (w6-d1) was the longest dispatch of the session: 2h32m, 804k tokens, 3 generator-evaluator rounds (462bc8cf).

6. **A human gate was a cheap question but an expensive wait.** w4-d1 extracted the round-2 findings in 6.5 min. The orchestrator then asked 4 design questions in one AskUserQuestion call (8dd37f71, 2,401-char input) and sat idle 8h49m until they were answered (79bf0402). The w5 fan-out of 7 dispatches launched 34 s after the answer (f183d3e1..f0ce2528). The user had also volunteered a binding design decision on prompt injection while w1-d1 was running (17f4d4c5). The orchestrator recorded it in state.md (14ef2a84) and passed it into the dispatch context.

7. **The trace render is unreliable as a timeline.** The wave timestamps in session.mmd are invented round numbers: "Wave 4 · 2026-11-13T04:00:00Z" for a wave dispatched at 23:29, and "Wave 5 · 2026-11-14T00:00:00Z" for one dispatched at 08:25 (462bc8cf). The Stop hook is drawn twice as a "human · irreversible" node on w3-d1 (human_2 and human_7). The renderer also printed a "Cannot update this protected ref" line, which is a bypass notice from git push. The compaction summary records that the push did succeed (b2afcecc §4).

8. **Dispatch specs carry moderate context.** Workflow inputs ran 1.8-5.1 KB. The largest were 2eba45b5 (w2-d3, 5,084), 57d35751 (w2-d3 resume, 5,033) and b9372ef2 (w3-d1, 4,600). Each passes a findings/cluster file path rather than pasting findings. No dispatch within a wave depended on another dispatch in the same wave.

9. **Cost profile.** Round 1 cost $80.05 for 22 findings (about $3.6 each). Round 2 cost $36.24 for 14 (about $2.6 each). The highest-token dispatches were the 3-round generator-evaluator w2-d4 (994k) and the two integration chains (484k, 804k). A plain single dispatch still costs 169-245k tokens (w5-d7, w4-d1, w1-d1), and 2 agents each (worker + Grapher).

## Evidence and coverage

- Raw pages: `raw/d9gr/p*.txt` (44 files, deduplicated by uuid; the oldest page reached has_more false). All event ids cited above are uuid prefixes from these pages.
- Not captured: the content of each dispatch's handback (the orchestrator turned it into prose, for example b2a83aad and d34d86d7), and per-agent token splits inside dispatches.
