# fMmB: AIOS Orchestrator (largest)

Session `session_016jSC3fMmBpPbFyqqfQ9sEs`, CLI session `739238b4-3951-583e-a01a-c47505501ee5`, repo aios, branch `claude/dispatch-tickets-phases-0-4-yk2t18`.

**Coverage warning.** 100 events covered only 10-35 minutes of this session, because subagent task_progress events were dense. The full 60-hour transcript would take roughly 200-300 pages, so it was not paged. What was read:
- system and result events from 2026-11-13 07:54 to 16:37 (6 pages, raw/fMmB/sr_p00..sr_p04 and sr_p01b);
- the newest user and assistant page, 11:22-11:23 (raw/fMmB/ua_p00);
- the final result event `cbe1c287` in full. It holds the session.mmd for waves 1-20, the cost and the model usage.

Waves, dispatches and topologies below come from that trace. Per-dispatch usage from workflow notifications was **not** read for waves 1-21.

## Metrics

```
task:            build all 61 tickets of phases 0-4 (docs/tickets/), at most 4 per round in worktrees, push to the branch (inventory; final result cbe1c287)
mode:            autonomous ("I ran without stopping to ask, because your request was a full task brief", cbe1c287; trace node human_1 "attended or autonomous? → autonomous")
waves:           22 run; 20 traced (w21 and w22 were cut off by container restarts before logging, cbe1c287)
dispatches:      25 traced dispatch nodes (w1 1, w2 4, w3 1 with a failed first attempt, w4 1, w5 3, w6-w20 1 each) + 3 untraced (w4-d1, w4-d3, w4-d4, lost to a restart) + w21 + w22 = at least 30
chain links:     55 stages across the 15 chains (w3, w6, w8-w20); the longest have 6 links (w16, w19, w20)
topology mix:    single 1 (w1-d1) · generator-evaluator 10 standalone (w2 x4, w4-d2, w5 x3, w7 x2) · chain 15 (internally fan-out -> g-e -> single, repeated)
status:          done: all traced except w3-d1-s1's first attempt (failed, then retried and done); w4-d1, d3 and d4 lost (redone as w5 "Finish … after restart"); w21 lost; w22-d1 "Stopped by a worker restart" (d30ef666)
agents:          unknown (not read; no workflow notification with usage fell in the window read)
subagent_tokens: unknown per dispatch; whole-session opus usage: output 7,050,808, thinking 1,649,599, cache read 2,522,596,293, cache write 88,989,785 (cbe1c287 modelUsage)
cost:            $1,096.24 total_cost_usd (cbe1c287), the largest in the inventory; API time 73,229,828 ms (about 20.3 h)
wall clock:      2026-11-10 23:15 -> 2026-11-13 11:23 (about 60 h; start date from the inventory, end from cbe1c287)
restarts:        at least 3 container or worker restarts (during w4, w21 and w22)
human input:     none in the window read; no correction after the final result (turn_handoff 024847f3 at 16:37 has no user message or result after it)
compaction:      no compaction event in the window read
outcome:         61/61 tickets marked done and pushed at 00f9618; 12 acceptance checks left unticked (8 need real CI, 2 need a deploy, 2 partly unmet on P1-15); no PR opened
```

## Observations

1. **Restarts were the main failure.** Three restarts cost dispatches. The w4-d1, w4-d3 and w4-d4 traces were lost, and the work was redone as w5-d1..d3 "Finish P0-05/07/09 after restart". The trace keeps comments such as `%% w5-d1 depends on unknown w4-d1` (cbe1c287). w21 and w22 were cut off before logging. w22-d1 shows as "Stopped by a worker restart" (task_notification d30ef666, 11:21:57). The orchestrator's closing turn was triggered by that notification (`origin: task-notification`, cbe1c287).
2. **After the last restart, the orchestrator did the closing step itself.** It ran Bash in the main loop: "Assess state after second restart" (e5aa1612), "Check leftover worktree and ticket statuses" (4e533344; task b8azyhspz started by MAIN, 5db0d2f9), "Clean up worktree and verify ticket completion" (38211151 / 88f37541), "List unticked acceptance boxes" (33d63c28) and "Finalise graph, state, completion notes, render trace" (4b606e42). The final message says the closing summary "I did … by hand". These were small checks, but they broke the rule that the orchestrator only integrates results. One read returned 5,473 chars (b38b69ba).
3. **Rounds grew into long multi-ticket chains instead of 4-ticket waves.** From w9 onward every wave is a single chain of 2-6 links of the pattern build in worktrees (fan-out) -> merge and verify (g-e) -> push. Some chains bundle two batches. w16 is "Land two batches of six tickets", which is over the 4-per-round brief. The final message gives the reason: "Rounds that followed on from each other could share one run". Because of this, waves 9-20 each contain exactly 1 dispatch.
4. **The trace has rendering defects.** In w3-d1, the failed first attempt and the retry share one label. The subgraph `w3_d1` is emitted twice and draws a self-edge `w3_d1_s1 --> w3_d1_s1`, which the orchestrator acknowledged in cbe1c287. Waves 21 and 22 are missing from the trace.
5. **Subagents polled; in the window read, the orchestrator did not.** 22 of 22 background tasks started in sr_p03/sr_p04 have `owned_by_subagent: true`. 15 of the background Bash tasks in the window are `until …; do sleep 10; done` waits, for example bugby31fi (fcbb3590), bqmx5ekxh (01af1c23) and blp9pw0bi. Several ended "failed" when their pgrep target was killed (b7pllcwym and blp9pw0bi at 09:19). Subagents also ran ambient `/code-review` tasks (dabcb1c0).
6. **The suite was too heavy for this environment.** w22's P4-11 end-to-end work ran sharded pytest and Playwright in the container. It used DB-per-test setups (`/var/tmp/p002env/env.sh`, bf3764d6) and killed and reran the shards (`pkill -f "p411run/run.sh"`, 09:19:09). As decisions, the final message lists accepting tests that also fail on the base branch, and counting flaky-under-load tests as passing when they passed on a rerun alone.
7. **scriptPath and dispatch.js: no evidence either way in the window read.** All workflows in the window are named `wN-dM · chain` (w22-d1, run 0mwe9jdo4). No scriptPath error appears in the events read. Whether this session copied dispatch.js to scratch can't be seen from the tail of the session.
8. **Outcome and acceptance:** the final result (cbe1c287, 11:23:49) reports 61/61 tickets done at 00f9618, with 12 checks unticked and the P1-15 network block on `api.typesafe.ai` flagged for a retry. No user reply follows in the pages read. The session went idle (turn_handoff 024847f3, 16:37:28).

## Evidence and coverage

- raw/fMmB/sr_p00 (bf3764d6..024847f3, 10:05-16:37), sr_p01b (c6eae6af.., 09:19-10:05), sr_p01 (4d992054.., 08:43-09:19), sr_p02 (1e8a9a1c.., 08:34-08:43), sr_p03 (3a10aa63.., 08:22-08:34), sr_p04 (b540be38.., 07:54-08:22). The next page back starts before `b540be38`.
- raw/fMmB/ua_p00: the main-loop user and assistant events of the closing turn, 11:22-11:23.
- Not read: the initial user prompt; waves 1-21 as events; workflow notifications with agent_count, subagent_tokens and duration_ms; whether any human messages came mid-session; whether there was compaction.
