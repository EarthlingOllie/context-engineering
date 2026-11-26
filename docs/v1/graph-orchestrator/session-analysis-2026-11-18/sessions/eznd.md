# eznd: Richer-house spec implementation (joule-agent)

Session `session_016jSC3ezndKqpWLvw6rubcK`, CLI session `48da2a87-d965-5d91-ae06-81a3a41453d8`, repo EarthlingOllie/joule-agent, work branch `claude/focused-fermi-yc4alm`.

**Coverage is partial.** I read 22 `list_events` pages, saved as `raw/eznd/p001..p022.txt` (kinds user, assistant, result, system, other). They run from 2026-11-16 09:02:33 (page `afc7d801..`, has_more=true) to the newest event at 22:40:11. The pages are dense, often 2-5 minutes each while 4 workflows ran, so paging stopped there. The covered window holds w7 to w13 events and every human message after 09:02.

Waves 1-6 and the start (2026-11-15 22:07 → 11-16 09:02) were **not** read event by event. The source for that period is the session.mmd trace embedded in the orchestrator's final report (`62651e1c`, saved as `eznd-final-62651e1c.txt`). The initial prompt, its `--mode/--waves/--dispatches` flags, and per-dispatch usage for w1-w6 were not read. Parsed with `tools/digest3.py` (`eznd-digest.txt`), `tools/disptable.py` and `tools/ev.py`.

## Metrics

```
task:            implement every ticket (01-31) of docs/specs/richer-house; later: record core user stories, fix comfort bug, prepare and merge PR #3, reconcile ticket statuses, merge PR #4
                 (final report 62651e1c; PR bodies 60b0e5d7, e4f0441c). Initial prompt not read.
mode:            not read (prompt outside window). Behaviour was mixed. It stopped for the human on w1-d1 and w6-d1 (trace human_1, human_2) and used AskUserQuestion (0a7afa68).
                 It resolved the w8-d3 exhaustion itself, with no human message (0fc50e88).
waves:           13 (w1-w13). w1-w9 build all 31 tickets. w10 recordings, w11 comfort fix, w12 merge prep + agent-readiness question, w13 ticket status update.
dispatches:      45 = w1 1, w2 9, w3 1, w4 9, w5 6, w6 6, w7 3, w8 4, w9 1, w10 1, w11 1, w12 2, w13 1 (trace in 62651e1c for w1-w9; START events for w10-w13)
topology mix:    generator-evaluator 43, single 2 (w1-d1 read spec; w12-d2 "ready to build agents?"). No chains: each ticket is its own g-e dispatch, plus "Integrate ..." g-e merge dispatches (w3-d1, w5-d1, w6-d6, w7-d1, w8-d3, w9-d1)
per-dispatch:    done 40; blocked 2: w1-d1 (dev branch shares no history with origin/main) and w6-d1 (ticket 13, "Bash is blocked in this evaluator session");
                 failed 2: w7-d2, w7-d3 (same-wave dependsOn, ×0 rounds); exhausted 1: w8-d3 (integrate 22/23, evaluator ran out before verifying tests) (trace 62651e1c)
                 g-e rounds >1 on 15 tickets (×2 or ×3 in the trace)
workflow usage:  covered window only (12 notifications): total_tokens 3,771,435; duration_ms 25,130,100; tool_uses 691.
                 Largest: w8-d2 (ticket 27) 689,437 tok / 6.37 M ms; w6-d3 631,793 tok / 9.74 M ms and w6-d2 592,515 tok / 9.84 M ms (completed in window, 9e968a69, 323a7007)
agents:          no agent_count in notifications; 38 distinct progress labels over the 12 dispatches in the window
cost:            $363.84 cumulative total_cost_usd at the last result (19e135e3); $298.56 had been spent by 09:11 (1c7218b3)
wall clock:      2026-11-15 22:07 (inventory) -> 2026-11-16 20:08:26 (19e135e3), about 22 h; ticket build finished 11:34:55 (a8fd8de5)
human input:     window: 8 messages (3c7482dc recordings, 30c8db9f commit mp4, 3daa0c7a comfort >1000 C bug, e42918ae ready to merge?, 8f35c652 videos on a PR + fix wording + run suite, 9c16eee0 ready for agents?, dc11940a update ticket statuses, 8dab60b3 "Merge plz");
                 before window: 2 human trace nodes (human_1 branch off main; human_2 accept ticket 13 on generator evidence)
compaction:      none in the window read
scribe:          "Grapher: logging current dispatch" ran in every dispatch in the window; no null or failure seen
outcome:         31/31 tickets merged on the branch at 2e72045 (991 backend, 205/205 browser tests, a8fd8de5); PR #3 merged to main as 32fab34 (7a6ca796); PR #4 marks 29 tickets done, merged as ce4c112 (51b45d45).
                 Accepted with corrections: the user found a comfort-temperature bug in the demo videos (3daa0c7a), fixed in w11 (ea19386).
```

## Per-dispatch usage (covered window, from workflow task_notifications)

| Dispatch | Status (notification / trace) | Start-end | duration_ms | total_tokens | tool_uses | notification |
|---|---|---|---|---|---|---|
| w6-d3 g-e (ticket 22) | completed / done | -09:14:07 | 9,743,722 | 631,793 | 146 | 9e968a69 |
| w6-d2 g-e (ticket 18) | completed / done | -09:15:47 | 9,843,741 | 592,515 | 163 | 323a7007 |
| w7-d1 g-e (integrate 13 25 28) | completed / done | -09:11:20 | 1,341,377 | 432,713 | 55 | a54d80df |
| w7-d2 g-e (ticket 26) | completed / **failed** ×0 | 09:11:42-09:11:47 | 5,000 | 69,213 | 2 | 59e57b50 |
| w7-d3 g-e (ticket 27) | completed / **failed** ×0 | 09:11:42-09:11:47 | 4,870 | 69,217 | 2 | 2458d8b2 |
| w8-d1 g-e (ticket 26) | completed / done | 09:12:02-10:26:33 | 4,471,131 | 359,655 | 91 | ac389e40 |
| w8-d2 g-e (ticket 27) | completed / done ×2 | 09:12:02-10:58:10 | 6,367,423 | 689,437 | 163 | b5425fd8 |
| w8-d3 g-e (integrate 22 23) | completed / **exhausted** ×3 | 09:14:18-10:16:07 | 3,708,309 | 563,345 | 76 | ed31f175 |
| w8-d4 g-e (ticket 19) | completed / done ×2 | 09:15:58-10:27:25 | 4,286,832 | 486,683 | 86 | 51482eab |
| w9-d1 g-e (integrate 18 19 26 27) | completed / done | 10:58:25-11:34:10 | 2,145,265 | 320,120 | 78 | 3750a3af |
| w10-d1 g-e (recordings) | completed | 12:07:28-12:30:11 | 1,362,789 | 342,116 | 64 | 119005c5 |
| w11-d1 g-e (comfort fix) | completed | 13:02:05-13:13:11 | 665,810 | 272,242 | 53 | f9b2a13c |
| w12-d1 g-e (merge prep) | completed | 16:16:25-16:49:12 | 1,966,414 | 199,321 | 45 | 7b61b8c2 |
| w12-d2 single (agents ready?) | completed | 16:16:25-16:17:38 | 72,312 | 165,711 | 14 | 8a34feee |
| w13-d1 g-e (ticket statuses) | completed | 19:47:41-19:48:56 | 73,945 | 234,375 | 17 | ba4b3f2f |

The w6/w7-d1 starts fall before the window. Their tokens are not in the window totals above, except where noted.

## Observations

1. **Same-wave dependsOn violation, then a relaunch.** w7-d2 and w7-d3 (tickets 26, 27) were filed in the same wave as w7-d1, the merge they depend on. The workflow rejected them within 5 s (START `53e50f1b`/`d6fb6cbe` at 09:11:42, notifications `59e57b50`/`2458d8b2` at 09:11:47). The orchestrator said so: "I'd filed them in the same wave as the merge they depend on, which the workflow rejects" (`75ea88c2`). It relaunched them as w8-d1/d2 (`5dc76ca5`, `0662338c`). The cost was small (69k tokens each, the dispatch's fixed overhead). But the notifications report the rejected runs as "completed", while the trace marks them failed ×0. A notification-only reader would miscount them.
2. **Waves rolled instead of finishing.** w8-d3 and w8-d4 launched at 09:14 and 09:15, as w6-d3 and w6-d2 completed (`1f343783`, `dadc6071`), while w8-d1/d2 were still running. Wave numbers are launch batches, not barriers. w2 and w4 ran 9 dispatches each. Each ticket was its own g-e dispatch on its own `ticket/NN` branch, followed by a separate "Integrate ..." g-e dispatch. This is the worktree-then-integrate pattern, the opposite of hD76's one-chain-per-wave.
3. **Exhausted and blocked dispatches were accepted on generator evidence.** w8-d3 (integrate 22/23) exhausted after 3 rounds: "The merge's review ran out of time before it could verify the test runs itself. I've accepted the merge's own results" (`0fc50e88`). No human message falls between 10:16 and 12:07, yet the trace draws this as `human_3` "accepted generator green results" (`62651e1c`). A self-decision is recorded as a human node. w6-d1 (ticket 13) was blocked because the evaluator's Bash was refused. human_2 accepted it on generator evidence. The final report flags both as "Two reviews skipped" (`62651e1c`).
4. **Permission-classifier outages hit subagents.** 4 `permission_denied` events with "Classifier unavailable" (`9086e929`, `91a71c6a`, `1700271a`, `7edf8ed7`, 10:26) and 1 safety-check denial of `rm` on `rec-run/peek/*` (`a4379c06`). This is the same class of failure as the w6-d1 block ("Bash is blocked in this evaluator session").
5. **scriptPath workaround in use.** Every Workflow call is an inline `script` that calls `workflow({ scriptPath: S + '/plugin/dispatch.js' })` from the session scratchpad (`398f7bf4`). This is the copy-to-scratch workaround. The original failure is before the window.
6. **After the build, the orchestrator did git and PR work in its own main loop.** It committed and pushed the 8 MP4s itself, with `cp` and `sed` fixes to the README (`bde34af8`, `7b3e3712`, `5fe844fd`). It ran a `for i in 1 2 3 4; do git push --force-with-lease ...` retry loop (`ac5e6d35`), created and merged PR #3 (`60b0e5d7`, `2abf0c72`), and created and merged PR #4 (`e4f0441c`, `cd93d080`). It also Read two screenshots (`0dac4f76`, `3b36eb01`). The user asked for each of these ("commit the mp4", "Merge plz"), so they are not unauthorised. But they are main-loop work rather than dispatches. The w12-d1 dispatch rewrote branch history (`git rebase --onto` to drop video commits, `398f7bf4`) and force-pushed, as the user requested (`8f35c652`).
7. **Polling stayed in subagents.** All 196 background Bash tasks that subagents started are `owned_by_subagent: true`. 37 of them are until/sleep/wait loops. The orchestrator was woken only by notifications and human messages. Stop-hook nags about unpushed or uncommitted changes came 4 times (`0fdbcd03`, `4d20b9ee`, `307bdd68`, `bd7a4cae`). Each time the orchestrator correctly left the changes to the running dispatch (`d0c8c662`, `e8087eb8`, `1901eda1`, `ed1584e7`).
8. **Outcome and user reaction.** The build finished at 11:34 with all suites green (`62651e1c`). The user praised it, asked for recordings (w10), committed them, then found a real UI bug: comfort showed over 1000 °C (`3daa0c7a`). The cause was a running shortfall displayed as a temperature, fixed in w11 (`63348d1d`). Then came merge prep, PR #3 and PR #4. The orchestrator's final report also flags a destructive step the user should check: rebuilding the branch from origin/main overwrote 2 WIP commits on the remote, which are kept only as a local tag `backup/focused-fermi-wip` (`62651e1c`).

## Evidence and coverage

- Raw: `raw/eznd/p001.txt` (first_id `fab92236`, 16:49:58-22:40:11) back to `p022.txt` (`afc7d801`, 09:02:33-09:10:49). The next page back starts before `afc7d801-f38f-4a84-a3b0-df38cd25ba1e`.
- Final report with trace (waves 1-9): `eznd-final-62651e1c.txt`.
- Not read: the initial prompt and flags; w1-w6 events; usage for the dispatches that finished before 09:02; whether compaction happened before 09:02.
