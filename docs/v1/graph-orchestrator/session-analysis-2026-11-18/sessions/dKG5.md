# dKG5: RAG Studio orchestrator, specs 12 and 13

Session `session_016jSC3dKG5EP2cXVxtBboWV` (repo rag-agent-studio, CLI session bcad6aa7).

**Coverage is partial.** I read 36 `list_events` pages, saved as `raw/dKG5-p001..p036.txt` (3,383 events). They run from 2026-11-10 19:09:57 (page `3627c5da..ba0c1492`, has_more=true) to the newest event, 2026-11-12 00:04:38. The newest 36 pages covered only 29 h of a 41 h session, because 3-4 concurrent workflows each emit a task_progress event every few seconds. Paging stopped there.

Waves 1-12 (2026-11-10 00:02 → about 16:30) were **not** read event by event. For that period the only source is the session's own compaction summary at 22:25:13 (user event `c6278c79-f3e7-4eb6-a835-aae6a455858b`, saved as `dKG5-compact-summary.txt`). Counts marked "covered window" apply to 11-10 19:09 → end only.

## Metrics

| metric | value | evidence |
|---|---|---|
| task | "work from the base branch candidate-reskin. Assess the frontier of tickets in spec 12, dispatching up to 4 at once depending on their blocking relationships. /graph-orchestrator", then "Tickets for spec 13 are now in scope". It ended with merging specs 12/13 to candidate-reskin → candidate → main | compaction summary `c6278c79` §1 and §6; human `d8441c83-682c-4843-a9b0-00e4e5978b72` |
| mode | attended in practice: 17 user messages before compaction, 17 after, many of them questions ("How far are we", "Are they still running?") | `c6278c79` §6; HUMAN list in `dKG5-digest.txt` |
| waves | 16, which hits the default `--waves` budget: w16-d1 is the last dispatch ever launched | START `a907e07a-3c81-4123-aed1-7a31698d3761` |
| dispatches | all generator-evaluator, one per ticket. Covered window: w13-d3, w13-d4, w14-d1, w14-d2, w15-d1, w16-d1 (6). w13-d1..d4 were resume jobs that re-dispatched w12-d1..d4 after a container restart killed them | NOTIFs `38569438`, `1a89efc4`, `940e4175`, `624b2d32`, `1174a8ca`, `8ff4b1ae`; `c6278c79` §4 |
| topology mix | generator-evaluator only (every Workflow meta in the covered window and the compaction summary say "(generator-evaluator)") | `0ee6c67c`, `cabfbca7`; `c6278c79` §2 |
| per-dispatch status | covered: all 6 workflows "completed". The orchestrator reported the tickets as passing: 13-06 `54845cee`, 13-05 `3a4617c2`, 13-07 `7de254b8`, 13-09 `0b985c1e`, 13-10 `ecdcb163`. Inside them, several evaluators were still `progress`/`start` when the workflow completed (w13-d3, w14-d1, w14-d2, w16-d1 Evaluator 2), so the loop status reached the orchestrator unclear. Before the window: w12-d1..d4 were **failed** (killed by a container restart) | agent rows from task_progress (see `bin/digest.py`); `c6278c79` §4 |
| agents | covered: 20 (3 each for w13-d3, w13-d4, w14-d1, w14-d2, w15-d1 = Generator, Evaluator, Grapher; 5 for w16-d1). Notifications carried no workflow_progress (`agents 0`), so these counts come from task_progress. The orchestrator also spawned 7 plain `Agent` subagents outside the plugin | Agent calls `453dd27a`, `d816b46b`, `9ef8d460`, `42043b87`, `942c87ff`, `55125865`, `e95c615e` |
| subagent_tokens | covered: 2,754,635 (454,842 + 344,241 + 326,275 + 445,569 + 535,479 + 648,229) | NOTIF `usage.total_tokens` |
| workflow duration_ms | covered: 70.5 M ms = 19.6 h summed. w13-d3 21,837,164 (6.1 h), w13-d4 17,736,184 (4.9 h), w14-d1 12,502,260, w14-d2 7,364,511, w15-d1 6,651,359, w16-d1 4,388,117. A single generator agent ran 18,770,165 ms (5.2 h) in w13-d3 | NOTIFs above |
| wall clock | 2026-11-10 00:02 → 2026-11-11 17:25:18, about 41.4 h (start from the inventory, end at the final result) | `e2d57bb3-9b9f-4418-9a5e-710941c9020a` |
| cost | $342.28 total. $239.3 had been spent by 11-10 20:13, so 70% went in the unread waves 1-12. 546M cache-read tokens, 1.83M output tokens | results `bc0b4969` ($239.3), `e2d57bb3` |
| human interventions | covered: 17 messages. Among them: the streaming requirement that became ticket 13-10 (`c2c070d8`, answered via AskUserQuestion `9ea74774`); environment corrections "should be spun up with make dev" (`23990dab`) and "rust would have been provisioned with docker compose up" (`f4b04b1f`), with a tool use interrupted (`31b7cc4d`); "yes run make services instead" (`aab18ac0`); "ok turn down the logging" (`89a4e171`); and a merge-order correction, where the user rejected a PR create and said "95 in first" (`50bac64f`, `0ea0fe57`). Before compaction: AskUserQuestion answers on pgvector, 2 Stop-hook "untracked files" nudges, "split spec 13 into a separate PR" | HUMAN events; `c6278c79` §6 |
| compaction | at least 2. One is visible: 22:25:13, pre_tokens 202,698 → post 13,045, `cumulative_dropped_tokens` 407,957 (so an earlier compaction dropped about 205k) | `20aa6660-a974-42e8-b981-15ed3dde9e5e` |
| scribe | the Grapher finished `done` (4.7-5.4 s) in all 6 covered workflows. No null or failed scribe was seen. The trace rendered to a 146-line session.mmd | task_progress agent rows; Bash `60352138`, result `380c8ea4` |
| final outcome | specs 12 (#96) and 13 (#95, including 13-10 streaming) merged to candidate-reskin, then #97 to candidate. #98 to main was blocked by a branch rule (405), and the user merged it by hand. Open: no real-model test; the CI e2e job never ran because of a runner DNS outage; a mistakenly published artifact | `e2d57bb3`; merge error `ffe416bf` |
| user acceptance | accepted ("grea, continue" `212ae6d1`; "I've merged candidate into main" `7d8f0c69`), after correcting the merge order (`0ea0fe57`) | |

## Observations

1. **Wave budget reached, then the orchestrator did the work itself.** w16-d1 (`a907e07a`, 13:45 on 11-11) was the 16th and last wave. In the covered window the main loop made 174 Bash calls (`bin/viol.py dKG5`):
   - 155 read or grep files (`cat`, `sed -n`, `grep`; e.g. `02a09c1f`, `c51f7287`);
   - 46 run tests or builds (pytest, pnpm, make; e.g. `9b2995e7`, `3d4c40c8`);
   - 28 git merge/commit/push/worktree (e.g. `73dd988d`, `86583eaa`);
   - 27 edit repo files by heredoc or python replace (e.g. `c5c7b4a3`; a GLOSSARY.md edit at 22:32:14);
   - 14 cat raw `tasks/*.output` files (`02a09c1f`, `84bb8261`).

   It also debugged a disk-full e2e failure across about 40 minutes of its own Bash calls before handing the problem to an Agent (`5a5a1a5e`, `a2e1f26a`). All of this breaks "spend context on judgment, never on evidence".
2. **Polling.** 11 orchestrator Bash calls used `until grep ...; sleep` or `sleep N` loops, e.g. `9b2995e7`, `18ef7635`, `012a35bb`, `2ddfbc75`. A 590 s `until grep -q '^exit='` loop waited on backend logs (START `6868d9bc`). It also scheduled `send_later` safety-net check-ins (`726e65a7`).
3. **Large raw tool output in the orchestrator's context.** 246 tool results totalled 339k chars in the covered window. The largest were ReadNotifications 23.9k (`289b5b84`), get_job_logs 20.1k (`6caddc6a`) and three pull_request_read results at 11.8k each (`e1714366`, `a6eab618`, `4ecad677`). Together with the work in obs 1, this drove the compaction (202.7k → 13k tokens, `20aa6660`).
4. **The scriptPath workaround was in use.** Every dispatch ran from `SCRATCH/plugin/workflows/dispatch.js`, a copy in the scratchpad, not the installed plugin path (`c6278c79` §2; Workflow `cabfbca7`). When the copy was made is before the covered window.
5. **Long, mostly single-agent workflows.** Generator-evaluator dispatches ran 1.2-6.1 h each. Agent time was dominated by one generator: w13-d3 generator 18.8 M ms, w13-d4 generator 17.0 M ms. Several workflows completed while an evaluator still showed `progress`. Wave overlap: w14-d1/d2 started while w13-d3/d4 were still running, since w13-d3 finished at 22:32 after w14-d2 at 21:11. The orchestrator ran ticket waves as a rolling frontier, not as a barrier per wave.
6. **Environment failures cost dispatches.** A container restart killed w12-d1..d4, which were re-dispatched as resume jobs w13-d1..d4 (`c6278c79` §4). Running 5 test suites at once caused an OOM kill (exit 137), fixed by a cap of 4. The e2e "accessibility" failure turned out to be the disk filling up with Chrome shared-memory files (`a2e1f26a`). The user had to correct how to start the environment twice (`23990dab`, `f4b04b1f`).
7. **Spec size.** Workflow inputs were 4,189 bytes (w15-d1, `0ee6c67c`) and 7,441 bytes (w16-d1, `cabfbca7`). 7.4 kB is large for a dispatch spec, which suggests ticket context was pasted inline.
8. **Side effects the user had to resolve.** State.md was published as an Artifact by mistake, and the session ended asking whether to delete it (`c6278c79` §7, `e2d57bb3`). w10-d1 committed SCRATCH/ into the repo, and the orchestrator moved it with git mv (`c6278c79` §4). A force-push attempt was denied by the auto-mode classifier.

## Per-dispatch status: gap fill (round 2)

**The session.mmd render cannot supply per-dispatch statuses.** `get_event 380c8ea4-e0c9-4c4c-b30f-3985d260282e` returns only the render's stdout, `wrote .../scratchpad/session.mmd\n146`. The Bash call `60352138-3d80-443b-9f58-c5e9037833c7` ran `render-trace.js $S/trace --out $S/session.mmd | tail -1; wc -l`, so the diagram itself was written to the other session's disk and never entered the transcript. An earlier render (`172821ba-71b9-4575-b278-90642e445372`, 11-11 01:01, 142 lines) also printed only file names and one edge (`w14_d1 --> w15_d1`).

**Paging back cannot fill the gap at reasonable cost either.** Before the covered window, 4 concurrent workflows write about 100 events a minute (page `14cc1df8..` spans 19:07:47-19:08:42, raw/dKG5b/b001.txt). Waves 1-12 cover about 19 h, so reaching them would take roughly 1,000 more pages. Three user-only pages before 19:05:38 (`3005be46`, `5f9b6e5a`, `d2ded963`) held no user events at all. I stopped paging there.

| dispatch | ticket | status | evidence |
|---|---|---|---|
| w1-d1 … w11-dN | 12-01…12-11, 13-01, 13-02 (which wave ran which ticket is not recoverable) | **unknown per dispatch.** Ticket level: all 11 spec-12 tickets plus 13-01 and 13-02 ended `Status: done` with every criterion ticked (e.g. 12-01 11/11, 13-02 13/13) | ticket-file scan Bash `bf211a63-5bad-4595-8a54-d1f01c257897`, result `d4deb3c6-1712-4d27-97e4-39e7205041af` (11-11 10:01); PR #95 table 13-01/13-02 "merged" `60d11315-c88b-4095-9a08-86826d033249` |
| w10-d1 | unknown | **done with a side effect**: it committed SCRATCH/ into the repo, and the orchestrator moved it with git mv | compaction summary `c6278c79-f3e7-4eb6-a835-aae6a455858b` §4 |
| w12-d1…d4 | 13-03, 13-04, 13-05, 13-06 | **failed** (killed by a container restart) and re-dispatched as w13-d1..d4 | `c6278c79` §4; state.md "running (resume jobs): w13-d1 13-03, w13-d2 13-04, w13-d3 13-05, w13-d4 13-06" in Bash `9d7f10f1-efad-40c9-9495-cacc3f1b8b11` |
| w13-d1 | 13-03 (resume) | **done**: "13-03 DONE t/13-03 @9acd08ee", merged locally into integ aab4336c | state.md edit `e0a7fe94` (11-10 19:08:37, raw/dKG5b/b001.txt) |
| w13-d2 | 13-04 (resume) | **done**: "13-04 passed: 2565 tests, 100% coverage", merged and pushed as ec59f1f5 | assistant `fc64e5c3-9a41-470d-adb7-5e7ff1c998a3` (19:05:39); merge `1fcaf4b4-69ee-40f1-b2b8-431164e455f5` / result `e6ea8ff6-a768-4693-ba2d-58ec721dac82`; state.md "13-04 DONE" `9d7f10f1` |
| w13-d3…w16-d1 | 13-05…13-10 | done (completed), as listed in Metrics | NOTIFs in Metrics |

**Round 3 (w1 to w13-d2 gap).** I re-read the compaction summary (`raw/dKG5-summary.txt`, extracted from user event `c6278c79`). It adds ticket-level outcomes but still does not map waves to tickets for w1-w11:

| scope | status | evidence |
|---|---|---|
| spec 12 (12-01…12-11, run in w1…w10/w11) | **done** as a whole. Branch claude/gallant-euler-zxqfxb-spec12 @e94acf54 went into candidate-reskin as PR #96, with E2E 118/118 after 4 app bug fixes found at integration (InstructionsVersions.tsx, CodeBlock.tsx, DocumentViewer.tsx, Dialog.tsx). | `c6278c79` §5 |
| 13-01 | **done** @17626f0c, in PR #95 (pushed at ce0c610d) | `c6278c79` §5 |
| 13-02 | **done, with a flagged gap** @0ce739f9: "agentic answers arrive whole at the end, not streamed", flagged to the user for review | `c6278c79` §5 |
| 13-03 (w12-d1 failed → w13-d1) | w12-d1 **failed** (restart); w13-d1 **done** @9acd08ee. The 13-03 vs 13-04 conflict in playground/service.py was resolved by the orchestrator | `c6278c79` §3–§5; `e0a7fe94` |
| 13-04 (w12-d2 failed → w13-d2) | w12-d2 **failed** (restart); w13-d2 **done** @50a4dac9, 2565 tests, 100% coverage | `c6278c79` §5; `fc64e5c3`, `9d7f10f1` |
| 13-06 (w12-d4 → w13-d4) | done @76d5b4e7, merged locally into integ 154dab48 (union-resolved test conflict) | `c6278c79` §3, §8 |
| w10-d1 | done, with the side effect that it committed SCRATCH/ into the repo (moved with git mv) | `c6278c79` §4 |

The OOM kill (exit 137, 5 suites at once) hit the orchestrator's own integration check, not a dispatch.

**Still not recoverable:** which wave ran which spec-12 ticket, and the per-dispatch event ids and usage for w1-w11. Paging back to them is estimated at about 1,000 pages (§ above), so this round did not attempt it.

subagent_tokens for w1-w11, w12-d1..d4, w13-d1 and w13-d2 are **not recoverable**. Their task-notifications fall before the covered window, and a timestamp search did not reach w13-d2's notification (before 19:05:38).

Dispatch count, inferred: 13 tickets in waves 1-11 at one dispatch per ticket, plus w10-d1 if it was an extra dispatch, plus 4 failed w12 dispatches and 10 in w13-w16. That gives about 27-28 dispatches. 24 of them are evidenced as done or failed, but only 11 have an event id at dispatch level.
