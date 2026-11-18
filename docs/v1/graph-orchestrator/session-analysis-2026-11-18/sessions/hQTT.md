# hQTT: Agent deployment infrastructure plan

Session `session_016jSC3hQTTqJWKhoUVpQiX9`, CLI session `8c3eb568-1d35-5af8-b1a8-fb79f8aa541d`, repo **rag-agent-studio** (cwd `/home/user/rag-agent-studio`, init 9786db47, not context-management), SCRATCH `/tmp/claude-0/-home-user-rag-agent-studio/8c3eb568-.../scratchpad`.

## Metrics

```
task:            "consider the challenges of deploying applications like this and build out and infra plan that scales and is secure, then implement it. use terraform ... AWS. Also observability and monitor ability of deployed agents is paramount ... plan and implement all the necessary tooling /graph-orchestrator" (user 160e7ebd)
mode:            autonomous (state.md MODE line, e4b352d2; wave-1 human gate "attended or autonomous?" -> "autonomous (nobody watching live)", 9948d9d9); waves 6/16 used, dispatches/wave cap 9; maxAgents 2 passed in every wave's args
waves:           6 completed Workflow runs (+1 launch refused at the tool: scriptPath, d44e3e76; +1 Skill detour to graph-orchestrator:wave, 7725d709)
dispatches:      11 logical (w1 2, w2 3, w3 3 [w2 rerun], w4 1, w5 1, w6 1)
topology mix:    chain 5 (w1-d1 fan-out -> g-e; w2-d1/w3-d1 single -> fan-out -> g-e; w4-d1 g-e x3 -> single; w5-d1 g-e x2 -> single) · generator-evaluator 5 (w2-d2, w2-d3, w3-d2, w3-d3, w6-d1) · single 1 (w1-d2)
status:          done 5 (w1-d1, w1-d2, w3-d2, w3-d3, w5-d1) · failed 3 (all of wave 2: Fable usage limit, 4/4 agents error) · exhausted 3 (w3-d1 terraform stage r4; w4-d1 stage 1 r3, chain stopped before stages 2-4; w6-d1 r3 with gates green, accepted) · blocked 0 · over_budget 0. All 6 wave notifications say status "completed", including wave 2
agents:          70 distinct agent ids (64 workers/branches/reducers/partition/generators/evaluators + 6 wave scribes; the wave 2 scribe errored)
subagent_tokens: 8,377,229 (sum of 6 wave notifications)
workflow ms:     28,852,055 summed; waves ran 10:46:33 -> 19:19:09 (8h33m), with a 27-min gap 11:39-12:06 on the Fable limit
wall clock:      10:44:11 prompt -> 19:20:08 final result a8227dda (8h36m)
cost:            $152.73 at the final result a8227dda; $152.78 at the last /usage b63191f8 (Fable $35.82, Opus $116.96, Haiku $0.0003). Per checkpoint: $2.18 after launching w1 (f070f822), $23.21 after w1 (d037edd8), $35.82 after w2 failed (ce104ad6), $90.24 after w3 (39913517), $103.72 after w4 (11fed0c9), $136.41 after w5 (203f8d45)
human input:     prompt; "Continue" + model switch to claude-opus-5-5 (bd4a56f0, e633f9a1); /usage x3 (0c66e148 17:43, e8c4c8ab 18:25, 6656e1f9 19:46). 0 corrections
compaction:      none seen
outcome:         plan, Terraform AWS stack (18 modules + bootstrap + dev/prod), in-app OTel agent telemetry, ADOT/X-Ray/AMP/Grafana tooling, CI/CD, runbook and security review, pushed to `infra/aws-terraform-observability` in 5 commits; check.sh exit 0, checkov 1329/0 failed, 468 tests passed; never planned or applied (no AWS credentials) (595ac01e)
```

Per-wave (task_notification usage; agents from task_progress snapshots):

| Wave / dispatch | Topology | Status | Agents | duration_ms | total_tokens | Notification |
|---|---|---|---|---|---|---|
| (refused) w1 | - | scriptPath `.../workflows/wave.js` refused (d44e3e76) | 0 | - | - | - |
| w1-d1 plan | chain: fan-out 4 + reducer -> g-e | done, PASS r2 (docs/infra/PLAN.md) | branch 1-4/4, reducer, gen r1-r2, eval r1-r2 | | | |
| w1-d2 tooling check | single | done (terraform 1.17.1 via provider mirror, tflint, trivy, checkov) | worker | | | |
| wave 1 total | | | 11 (incl. scribe) | 1,790,860 | 1,072,710 | fc07f2a6 |
| w2-d1 terraform | chain: single -> fan-out -> g-e | failed: Fable limit (worker error after 1258s) | 1 | | | |
| w2-d2 instrumentation | g-e (max 4) | failed: Fable limit (gen r1 error after 1218s) | 1 | | | |
| w2-d3 CI/CD | g-e (max 3) | failed: Fable limit (gen r1 error at 0s) | 1 | | | |
| wave 2 total | | notification says "completed" | 4 (incl. scribe, all error) | 1,258,422 | 371,806 | dc4c4765 |
| w3-d1 terraform (rerun) | chain: single -> partition + fan-out 5 + reducer -> g-e | exhausted at r4: check.sh exit 0 on 21 roots, one §3 IAM point still failed by the evaluator | worker, partition, branch 1-5/5, reducer, gen r1-r4, eval r1-r4 | | | |
| w3-d2 instrumentation (rerun) | g-e (max 4) | done r4 (445 tests) | gen r1-r4, eval r1-r4 | | | |
| w3-d3 CI/CD (rerun) | g-e (max 3) | done r3 (actionlint clean) | gen r1-r3, eval r1-r3 | | | |
| wave 3 total | | | 31 (incl. scribe) | 10,366,102 | 3,669,197 | 5f72b4f1 |
| w4-d1 finish | chain: g-e (IAM) -> g-e (consistency) -> g-e (runbook) -> single (security) | exhausted at stage 1 r3; stages 2-4 not run | gen r1-r3, eval r1-r3 + scribe = 7 | 4,339,540 | 748,828 | 8a6159ac |
| w5-d1 finish (retry) | chain: g-e (consistency) -> g-e (runbook) -> single (security review) | done: 2 high, 2 medium, 8 low findings | s1 gen/eval r1-r3, s2 gen/eval r1, s3 worker + scribe = 10 | 6,490,783 | 1,698,120 | 82ff59a1 |
| w6-d1 security fixes | g-e (max 3) | exhausted r3, gates green, accepted | gen/eval r1-r3 + scribe = 7 | 4,606,348 | 816,568 | 91a722c6 |

## Observations

1. **scriptPath failure; the workaround went through the Skill tool.** The first Workflow call (3cb4d1f4) was refused: "scriptPath must be a script path this tool returned, or a file you can already read" (d44e3e76). The orchestrator said "The skill notes that the `graph-orchestrator:wave` skill is equivalent" (117ff348). It invoked `Skill graph-orchestrator:wave` with the full args (7725d709), which only returned "Run the graph-orchestrator:wave workflow" (9b530a08). It then called Workflow with `name: "graph-orchestrator:wave"` (9948d9d9), which started. The detour cost about 50 s and one extra 6.4 KB args payload. All later waves went straight to Workflow by name.
2. **A usage limit was hidden as a "completed" wave.** The session started on `claude-fable-5-1`, and wave 1's agents ran on Fable too (task_progress model field). In wave 2, all four agents errored. Two failed after about 20 min of work (w2-d1-s1 worker 1258s, w2-d2 gen r1 1218s); w2-d3 and the scribe failed at 0s with "You've reached your Fable limit". The workflow notification still says `completed` (dc4c4765), and the orchestrator itself then hit the limit (9e8b2dd9, a595e3ba). The session sat idle for 27 min until the user typed "Continue" and switched to Opus. The orchestrator then diagnosed the failure correctly: "Wave 2 failed because the Fable usage limit was hit, not because of a problem with the specs" (eab97ba2). It re-ran the same three specs as wave 3, each with a note that partial files may exist (40907d4b, context grew 723 -> 979 chars for d1). It logged this as a `trigger: exhausted` human gate answered autonomously.
3. **Exhausted generator-evaluator loops were accepted by the orchestrator, as documented decisions.** Three times the evaluator still failed after the round limit while the mechanical gates were green: w3-d1 (one IAM point), w4-d1 (CI roles keep ReadOnlyAccess/PowerUserAccess behind permission-boundary denies), and w6-d1 (a residual note on H1). Each time the orchestrator recorded an autonomous human gate and moved on. In w3-d1 it ran a targeted fix wave (0a0e1391). In w4-d1 it accepted "boundary-fenced design as a documented decision for the user to review" (c1712fa3, gate in cf4391ef). In w6-d1 it accepted and flagged the residual for human review (e2295f82). These are surfaced under "Decisions that need your review" in the final message (595ac01e).
4. **A chain lost its later stages when stage 1 was exhausted.** w4-d1 chained IAM fix -> consistency -> runbook -> security review. When the IAM stage was exhausted, the whole chain stopped, so wave 5 re-dispatched the three skipped stages as a new chain (cf4391ef). That cost a 72-min wave (w4) that delivered only the IAM tightening.
5. **The user's /usage calls became a stop signal.** The user ran /usage three times late in the run (17:43, 18:25, 19:46). After wave 6 the orchestrator wrote "Given the usage checks, I'm stopping here" (ead094fd). It recorded "STOP after w6 (user checking usage)" in state.md (e2295f82). The user never said to stop. The orchestrator inferred it from the /usage calls.
6. **The stop hook drove mid-wave commits.** The git stop hook fired at the end of each background-launch turn (3e790dec, 6830e73b). The orchestrator first declined to commit a half-built tree (88689b3c). At 12:07 it committed only `docs/infra` on a new branch (a1ab45ba). At 15:00:33, 8 s after wave 4 started, it ran `git add -A` and committed the wave 3 work "as a checkpoint" (0bded638), while wave 4 agents were already writing to the repo. Later commits came after each wave's notification (6e166a0a/b2b558e1, 85e768e1, e2295f82): 5 pushes in all.
7. **maxAgents 2 did not cap parallelism.** Every wave passed `maxAgents: 2`. Yet in wave 3, w3-d1's 5 fan-out branches and the w3-d2 and w3-d3 generator/evaluator loops all show start/progress at the same time (task_progress snapshots, 12:07-12:40). Wave 3 alone ran 31 agents over 2h53m.
8. **The `now` timestamps were invented.** Waves 1-6 passed `now` from 2026-10-31T00:00:00Z to 09:00:00Z in hour-ish steps (3cb4d1f4 ... af45202f). The real start times were 10:46-18:02. eptK has the same pattern.
9. **dependsOn was never used.** Every dispatch has `dependsOn: []`. Ordering came only from wave boundaries, plus `context` lines that point at earlier artifacts (PLAN.md §5/§6/§7, security-review.md). Context arrays stayed 125-979 chars. Tasks named plan sections instead of pasting them.
10. **The orchestrator did no evidence work itself.** It read the catalog once with `cat` (eb019eb9) and wrote state.md via heredoc or sed (e4b352d2, 96cf405c, 6e166a0a). The only repo-touching commands were git commands and copying security-review.md into docs (e2295f82). It made 21 top-level tool calls in total.
11. **/usage attribution:** "Top skills: /code-review 12%; Top subagents: workflow-subagent 77%, graph-orchestrator:wave 9%" (b63191f8). The `/code-review` share means the workflow agents ran the code-review skill, likely in the security-review stage.
12. **Scribe:** one "wave N scribe" agent per wave, 7-18 s each. The wave 2 scribe died on the Fable limit (0 s). The trace was rendered once at the end with an extra `--human` node for the w6 acceptance (e2295f82). The render output was not inspected.

## Evidence and coverage

- All events from the first one (a2436087, 10:42:48) to the last (b6344e33, 11-01 14:24): 41 unfiltered pages of 100 events, saved as raw/hQTT/p001..p041. They are in no particular file order, since the parsers sort by created_at and dedupe by uuid. p001-p007 are newest-first from 19:11 back to 17:50, p008 is 17:36-17:50, and p009-p041 page back to 10:42.
- Parsed with bin/main.py (hQTT-main.txt), bin/wfagg2.py (patched to tolerate events without uuid), tools/wfin.py (Workflow args per wave), and tools/agents2.py (hQTT-agents.txt, agent label/status/model/duration per wave).
- Not seen: the wave output files (`tasks/*.output`), the PLAN.md and security-review bodies, the subagent transcripts, and the render-trace output (that Bash result was not inspected).
