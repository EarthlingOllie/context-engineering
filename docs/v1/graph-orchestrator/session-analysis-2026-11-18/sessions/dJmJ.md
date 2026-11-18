# dJmJ: High value skills for topologies (skills catalog, readable labels, role-sectioned skill contract experiment)

Session `session_016jSC3dJmJsBQeLuAnbYwsj`, CLI session `4a071a11-5d1f-5814-a03b-9dee994b6b06`, repo context-management, SCRATCH `/tmp/claude-0/-home-user-context-management/4a071a11-…/scratchpad`.

## Metrics

```
task:            run A: "Skills are how we will inject domain into the topology runs. Please identify high value skills for these topologies that support all aspects of the sdlc. /graph-orchestrator" (user 7448c66b, 01:01:38)
                 + "Please also refine workflow labels to be more human readable" (user 7ba7d4f1, 01:02:45, after the user interrupted, 990b8387)
                 run B: after Q&A on scribes (6a27b84a), persona roles (e961eb92), the goal (971e78ea, interrupted) and "What would the best line of research and solution be here?" (03e20a38),
                 "yes, run it as an orchestrated session" (user 059d37ce, 08:04:22). Same state.md, trace and wave numbering as run A
mode:            autonomous (AskUserQuestion b04962c1 -> "Autonomous (Recommended)", d0ff10c1); waves 9/16 used, dispatches/wave cap 9, maxAgents 2 on every wave
waves:           9 (run A: w1-w2; run B: w3-w9) (+1 Workflow call refused at launch: scriptPath, 0 agents)
dispatches:      39 logical (w1 2, w2 2, w3 3, w4 9, w5 5, w6 9, w7 7, w8 1 chain, w9 1 chain); 10 Workflow calls (1 refused, 9 completed)
topology mix:    single 11 · generator-evaluator 17 · fan-out 9 (w1-d2 width 7; 8 grid cells in w4/w6/w7 with width 3) · chain 2 (w8-d1: g-e ×3; w9-d1: single -> g-e -> g-e)
status:          done 38 · exhausted 1 (w8-d1: chain stage 1 used 3 rounds on one wording nit) · blocked 0 · failed 0 · over_budget 0 · refused launch 1 (cfb0ac48)
agents:          129 distinct agent labels (120 workers/generators/evaluators/partitions/branches/reducers + 9 "wave N scribe")
subagent_tokens: 8,807,511 (sum of 9 completed workflow notifications)
tool_uses:       856
workflow ms:     4,565,238 summed; run A 01:03:25 -> 01:11:48; run B 08:05:09 -> 09:18:40 (waves back to back)
wall clock:      run A 01:01:38 -> 01:12:20 result be8a3fa6 (10m42s); run B 08:04:22 -> 09:19:28 result d7f2b520 (1h15m)
cost:            $6.13 after run A (be8a3fa6); $46.64 at the end of run B (d7f2b520); $49.53 cumulative after the PR turn (94507011)
human input:     11 messages (2 tasks, 1 add-on, 6 questions/steers, /usage 0a2930ba, "push claude/humanize-workflow-labels. and open a PR" 7559089e) + 1 AskUserQuestion answer; 2 user interrupts (990b8387, 1e23f804); 0 corrections of results
compaction:      none seen
outcome:         run A: SCRATCH/skills-catalog.md (7 SDLC phases × roles, ~38 fitting skills, 5 gaps) and readable labels committed as c02bbe1 on claude/humanize-workflow-labels (aa0e6dfa).
                 run B: hypothesis "partly supported". Scores tied at ceiling (n=1). Role friction went to 0 with the contract. Contract, converted skills, section loading, skill lint and fan-out per-branch dirs committed on claude/role-sectioned-skills, 77 tests (9aa40c4d).
                 11-02: labels branch pushed, PR #4 (ffd07661, 94507011); the role-sectioned branch stayed local
```

Per-wave (task_notification usage; one Workflow per wave):

| Wave | Task id | Dispatches (topology) | Status | duration_ms | total_tokens | tool_uses | Agents (task_progress labels) | Notification |
|---|---|---|---|---|---|---|---|---|
| 1 (1st) | none | w1-d1, w1-d2 | refused at launch: scriptPath not readable | 0 | 0 | 0 | 0 | tool_result c6047292 |
| 1 | wphi9sabn | w1-d1 repo map (single), w1-d2 SDLC skills survey (fan-out, 7 branches + reducer) | done 2 | 238,298 | 650,534 | 46 | 10 | c289569f |
| 2 | wu0tsqdzu | w2-d1 readable labels (g-e, tdd/code-review), w2-d2 skills catalog (g-e, writing-for-agents evaluator) | done 2 | 233,747 | 402,961 | 56 | 5 | 6ba28b1c |
| 3 | wbptcllbm | w3-d1 fixtures + keys (g-e), w3-d2 skill contract (g-e), w3-d3 prior art (single, research) | done 3 | 297,856 | 419,643 | 47 | 6 | 8fd6ccfd |
| 4 | wxh1wm632 | baseline grid: {code, spec, rca} × {single, g-e, fan-out w3}, original skills | done 9 | 438,775 | 1,653,344 | 135 | 27 (w4-d5 2 rounds) | 8871d46e |
| 5 | wbhpwda88 | w5-d1 score baseline (single); w5-d2..d4 convert tdd, diagnosing-bugs, domain-modeling (g-e); w5-d5 harder fixtures (g-e) | done 5 | 535,096 | 1,286,273 | 103 | 18 (d3, d4 3 rounds) | 2db569bf |
| 6 | whh6py1pk | hard grid, original skills (d1-d6) + spec with converted skill (d7-d9) | done 9 | 689,180 | 1,722,733 | 155 | 27 (w6-d9 "branch 1/1"; d8 3 rounds) | ef225cf1 |
| 7 | wiy3fa0ew | hard grid, converted skills (d1-d6) + w7-d7 comparison (g-e, dependsOn d1-d6 in the same wave) | done 7 | 903,781 | 1,465,552 | 176 | 21 | 2f8ebadf |
| 8 | wz8f4blty | w8-d1 chain: revise contract -> wire orchestrator -> fan-out fix + note | exhausted at stage 1 (3 rounds) | 599,313 | 590,100 | 60 | 7 (s1 gen/eval ×3) | 0655be25 |
| 9 | wrx0v72b0 | w9-d1 chain: fix nit (single) -> section loading + lint:skills (g-e) -> fan-out per-branch dirs + research note (g-e) | done 1 | 629,192 | 616,371 | 78 | 8 | c00f04f8 |

## Observations

1. **scriptPath refused, fixed by calling the workflow by name.** The first Workflow call (cfb0ac48, 01:03:13) passed the synced plugin's `wave.js` as scriptPath and was refused: "scriptPath must be a script path this tool returned, or a file you can already read" (c6047292). Eleven seconds later the orchestrator relaunched with `name: "graph-orchestrator:wave"` (a6ec5d90), and all later waves did the same. This is the same fix as fm1f, which ran 6 minutes earlier in a separate session, so it looks like a learned or system-suggested route rather than a coincidence. The refusal text points to the inline `script` route, not to the name.
2. **One session, two orchestrated runs.** Run A (waves 1-2) finished at 01:12. After almost 7 hours of Q&A, the user asked for an experiment and said "run it as an orchestrated session". The orchestrator went on from the same state.md and trace (wave 3, 50236ff9) and did not start a new run. The final trace has one human node and 9 waves (render 9ecaf57a).
3. **The orchestrator invented `now` values.** Run B waves passed `now` values such as "2026-11-01T07:00:00Z" for wave 9, which launched at 09:08 (e315a947). The rendered trace headers read 00:00Z, 00:10Z, 01:00Z … 07:00Z in hourly steps (9ecaf57a), so the trace's wave times are fabricated, not measured.
4. **A controlled experiment run as a wave grid.** Waves 4, 6 and 7 are 3×3 grids: tasks {code, spec, rca} × topologies {single, g-e, fan-out width 3}. Each cell writes to its own `SCRATCH/grid/<arm>/<id>/work`, and context arrays are 320-520 chars of file paths. Waves 5 and 7 add scoring and comparison dispatches. w7-d7 depends on w7-d1..d6 in the same wave, and the engine ran it after them (labels w7-d7 generator r1 come after the reducers).
5. **The orchestrator read evidence itself twice.** Large wave results came back truncated in the notification. After wave 6 the orchestrator ran 5 Bash calls on `tasks/whh6py1pk.output` (90398958 … fd47c77f; one failed, 1cdb5e57). It then said it would leave the scoring to the next wave "instead of digging" (7081a333). After wave 7 it read the subagent workflow transcripts with Python (a493736f, b797b1e8). state.md logged "wave notifications truncate large results" as a plugin bug (a119738a).
6. **An exhausted chain was turned into a targeted fix.** w8-d1's first stage (contract revision) used all 3 generator-evaluator rounds on one wording nit at contract.md:152. The chain stopped, and wiring and the fan-out fix never ran (3b4fd952). Wave 9 recorded a human entry `trigger: exhausted`, mode autonomous, "best guess: fix the nit as a targeted single stage, then continue the chain". It re-ran the chain with that nit as a `single` first stage (e315a947), which passed. DECISIONS logged "rather than re-run the revision loop".
7. **The labels change did not reach the running plugin.** Wave 2 committed readable labels (c02bbe1) in the repo source. Every later wave in this session still showed the old labels ("w4-d1 worker", "wave 6 scribe"), because waves ran the synced plugin under /root/.claude/plugins/synced. At 07:42 the orchestrator told the user scribes are "labelled `Wave N · Trace scribe` (it used to be `wave N scribe`)" (6470364d). That is true of the repo source, not of what the user saw in this session. It also guessed why the scribe is a separate agent and said it had not checked.
8. **The fan-out did not split under the contract.** w6-d9 (spec, converted skill, width 3) ran as "branch 1/1" (task_progress). The comparison reported that the contract fan-out "never split the work" (1eceb98f). This fed contract fix 3, a decidable Decompose/Merge rule.
9. **Workers got the attribution lines and an explicit not-authorised list.** w9-d1 context carried the commit trailer lines and "NOT authorised: push, open PRs, delete files outside SCRATCH, edit installed skills under /root/.claude" (e315a947). Both branches stayed local until the user asked; the push and PR #4 were done by the orchestrator itself, not by a wave (989bfccf, ffd07661). Before pushing, it checked the labels branch alone in a worktree, with 44 tests and the type check (44a9781c).
10. **Mode question recorded as a human node.** The attended/autonomous AskUserQuestion was logged as `trigger: ambiguity`, `mode: attended`, question "attended or autonomous?", answer "autonomous" (cfb0ac48/a6ec5d90). The trace draws it as human_1 on w1-d1, so the trace shows a human gate before any work started.

## Evidence and coverage

- Read to the first event (`ad61577c`, 00:58:44, a turn_handoff_available; the next page is empty with no `has_more`). Pages are saved as raw/dJmJ/p001-p020.txt, filtered to system, result, user and assistant. p004 was first read inline without system kinds, then re-read and saved (09:04:12-09:12:19). The empty last page is logged in raw/INLINE-notes.txt.
- One misfiled page (another worker's list_events result for CLI session 8c3eb568, picked up by a newest-file mover) was detected by session_id and moved back to tool-results as `…-RESTORED-8c3eb568-misgrabbed.txt`. It is not part of this note.
- Parsed with bin/main.py, bin/wfagg2.py and ad hoc scripts (Workflow args, task_progress labels, trace render 9ecaf57a).
- Not seen: subagent transcripts, SCRATCH/grid/comparison.md, skills-catalog.md, the contract text, and the PR #4 body beyond its first 1,395 chars of tool input.
