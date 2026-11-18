# eptK: Agent topology research

Session `session_016jSC3eptKYoM8EWaULAMvD`, CLI session `d986a0f2-1669-5743-833d-5e3a809cdbf5`, repo context-management (EarthlingOllie/context-management), SCRATCH `/tmp/claude-0/-home-user-context-management/d986a0f2-.../scratchpad` (later moved into the repo as `scratch/topology-research/`).

## Metrics

```
task:            "look at the definition of topology as it exists in this repo ... review the catalog ... research resources from all the known leading ai labs ... Producing a list report of potential topologies worth considering /graph-orchestrator" (user 85470d03)
mode:            autonomous (state.md MODE line, Write 6123235a / 8d0b6444 / 59f3b2d0); waves 2/16 used, dispatches/wave cap 9; maxAgents 2 passed in args
waves:           2 (+1 Workflow launch refused at the tool: scriptPath, 0 agents)
dispatches:      3 logical (w1-d1, w1-d2, w2-d1); 2 completed Workflow runs
topology mix:    single 1 (w1-d1) · fan-out 1 (w1-d2: 7 branches + reducer) · generator-evaluator 1 (w2-d1, passed round 2)
status:          done 3 · failed 0 (the refused launch never became a task) · blocked 0 · exhausted 0 · over_budget 0
agents:          15 distinct agent ids (13 workers/reducer/generators/evaluators + 2 wave scribes)
subagent_tokens: 2,010,649 (wave 1 1,515,551 c6055282 + wave 2 495,098 54f3e944)
tool_uses:       382 (328 + 54)
workflow ms:     2,709,900 summed; waves ran 19:47:06 -> 20:32:43 (45m37s)
wall clock:      19:45:48 prompt -> 20:33:13 final result (47m25s); follow-up 22:44:28-22:49:22 (move files into repo, commit, push)
cost:            $22.08 at the final result 8b1e6a46 ($0.51 before wave 1, 8a06242a; $18.14 after wave 1, 1018cb09); $22.83 after the follow-up (b3edfad1); $22.86 at /usage e18dc6a5 (Opus $22.01, Haiku $0.84 with 68 web searches)
human input:     6 messages: task prompt; "Try again" after the Fable limit (0fe3e333); "move all temporary files into the repo as scratch files" (b8264179); interrupt (b8e80e74); "Continue" (12c81415); /usage (a50ff16b). 0 corrections to the report
compaction:      none seen
outcome:         SCRATCH/topology-candidates.md, passed evaluator r2: Tier 1 relay, best-of-n; Tier 2 iterative-fan-out, panel; 45 lab patterns, 26 rejected. Committed later to branch `topology-research` (6ad3887b), no PR
```

Per-dispatch (task_progress agent snapshots, task_notification usage per wave):

| Dispatch | Topology | Status | Agents (labels, duration) | Wave notification |
|---|---|---|---|---|
| (refused) w1-d1 + w1-d2 | - | Workflow refused: scriptPath `.../graph-orchestrator/workflows/wave.js` (22db2bd2) | 0 | - |
| w1-d1 repo survey | single | done -> SCRATCH/repo-topologies.md | worker (89s) | c6055282 (wave 1: 2,032,210 ms, 1,515,551 tok, 328 tool uses) |
| w1-d2 lab research | fan-out (7 branches + reducer) | done -> SCRATCH/lab-topologies.md, 45 patterns | branch 1/7..7/7 (296-627s), reducer (443s) | c6055282 |
| w2-d1 report | generator-evaluator (max 3) | done, PASS round 2 | generator r1 (499s), evaluator r1 (96s), generator r2 (20s), evaluator r2 (42s) | 54f3e944 (wave 2: 677,690 ms, 495,098 tok, 54 tool uses) |
| scribes | - | done | wave 1 scribe (9s), wave 2 scribe (7s) | - |

## Observations

1. **The session started on the Fable limit.** The first turn ran on `claude-fable-5-1` and returned "You've reached your Fable limit" with $0 cost (52a10a27, result 29166604). The user said "Try again" and switched the model to `claude-opus-5-5` (0fe3e333, ad461bdf). Everything after that ran on Opus.
2. **scriptPath failure, fixed with the registered workflow name.** The first Workflow call passed `scriptPath: /root/.claude/plugins/synced/.../graph-orchestrator/workflows/wave.js` and was refused at the tool: "scriptPath must be a script path this tool returned, or a file you can already read" (tool_use 36229336, error 22db2bd2). Four seconds later the orchestrator said "I'll try the registered workflow name instead" (adaef13d). It relaunched with `name: "graph-orchestrator:wave"` and the same args, and no scriptPath (6a5dba7e). That worked at once (task_started b2ec220b). Unlike g2Kg it did not need the repo's own copy of the script, and unlike hQTT it did not go through the Skill tool first.
3. **The plan matched the task shape.** Wave 1 ran the repo survey (single) in parallel with a 7-branch lab fan-out with a reducer (one branch each for Anthropic, OpenAI, Google/DeepMind, Microsoft, LangChain/CrewAI, Meta/Together/others, academic). Wave 2 ran one generator-evaluator that depended on both (`dependsOn: ["w1-d1","w1-d2"]`, 2ee1f0e2). The pass criteria could be checked: "every one of the 45 lab patterns ... appears exactly once", "no source URL or claim absent from the input files" (2ee1f0e2).
4. **The "human" gate was answered by the orchestrator.** Wave 1 args carry `humans: [{trigger: ambiguity, question: "Which labs count as 'all the known leading AI labs'?", answer: "Anthropic, OpenAI, Google/DeepMind, Microsoft, Meta, plus framework and academic sources", mode: autonomous}]` (6a5dba7e). The trace drew it as a human node (render 1f0cf378). The final message listed it under "Decisions that need your eyes" (8b1e6a46). The user was not asked during the run.
5. **The `now` timestamps were invented.** Wave 1 passed `now: 2026-10-31T00:00:00Z` and wave 2 `01:00:00Z` (6a5dba7e, 2ee1f0e2), but the waves actually ran at 19:47 and 20:21. The rendered trace shows the invented times in the wave headers (1f0cf378). hQTT has the same pattern.
6. **Background shell tasks from workflow agents surfaced in the parent session.** Eleven `b...` tasks (for example "Download relevant cookbook notebooks and articles" 65a30ca8, "Shallow-clone Microsoft doc repos" f4037b56, "Clone Cohere docs" 357925b6) appear as top-level task_started/task_notification events during wave 1, with no usage. The lab domains were blocked, so the research branches cloned GitHub mirrors instead. This left 2.1 GB of clones with about 20 nested git repos in SCRATCH (ad6326a6). The final report says the lab sources are "only partly verified" (8b1e6a46; state.md KNOWN 8d0b6444).
7. **The wave results text is not in the transcript.** Each task_notification carries only "Dynamic workflow ... completed", usage and an `output_file` (`.../tasks/wr4o261ma.output`, `.../tasks/wzrtllktb.output`). The orchestrator's next message summarised the result ("45 candidate patterns from seven source groups", 41c7b477), so it read the output, but neither the read nor its content is logged at top level.
8. **The orchestrator stayed lean.** Between waves it only wrote state.md (3 Writes, 1.2-1.5 KB each) and ran render-trace once (6b7cce4d). It read the catalog once before planning (fd7acb1b, 9.1 KB). Wave context arrays were 1-4 short lines. No file contents were pasted.
9. **Follow-up housekeeping.** The user asked to move the temporary files into the repo. The orchestrator moved the whole scratchpad into `scratch/topology-research/` with a single `mv` and gitignored the `dl/` and `src/` clones (7a7dead8). The user interrupted while it ran; on "Continue" the orchestrator confirmed the move had finished (a00f5708). The stop hook then asked for a commit and push (c2df455c). The orchestrator branched off main to `topology-research`, committed 16 files and pushed, without opening a PR (d2fe3f96, 6ad3887b). It also noted that paths inside the moved files were now stale (ad6326a6).
10. **/usage attribution:** "graph-orchestrator:graph-orchestrator 78%, workflow-subagent 17%" (e18dc6a5). That is the inverse of hQTT's split, where workflow-subagent was 77%.

## Evidence and coverage

- All events from the first one to the last: 8 unfiltered pages, 28f274bf (19:45:32, env_manager start) to b3edfad1 / 31aa8bdd (22:51:59), saved as raw/eptK/p001..p008. The first 7 env_manager events (page 28f274bf..1bb28008) and the tail page a2e4a43b..920710be (22:52 -> 11-01 18:31: turn handoffs, init, /usage a50ff16b / 8e690e7c / e18dc6a5) were read inline and not saved.
- Parsed with bin/main.py, bin/digest2.py (eptK-main.txt, eptK-digest.txt), bin/wfagg2.py and tools/agents.py.
- Not seen: the wave output files (`tasks/*.output`), the report body, and the subagent transcripts.
