# eiLu: Specs 1-10 poll, then spec 11 (never reached)

Session `session_016jSC3eiLuWizBNLVpY3yn5` (repo rag-agent-studio, CLI session dd5c092c). Read-only: 12 `list_events` pages (kinds system/result/user/assistant/other, limit 100), paged backward from the newest event to the first (has_more=None on `raw/eiLu-p012.txt`). Saved as `raw/eiLu-p001..p012.txt`, 964 events from 2026-11-08 22:56:30 to 2026-11-09 12:31:13. Parsed with `bin/digest.py` (giving `eiLu-digest.txt` and the main-loop-only `eiLu-main.txt`), `bin/wfagg.py` (per-workflow usage and agents from task_progress/task_notification) and `bin/viol.py`.

**Correction to the inventory.** This session did not poll gdsq. Its poll workers read `session_016jSC3d6VcueRR7JYyZJPGP` ("Graph orchestrator ticket frontier", inventory #13) with `list_events`. The first worker call is task_progress `e1fe4ac8-4a5e-4bc8-93fd-03cdf1ceda81`, and state.md records "in-flight: session_016jSC3d6VcueRR7JYyZJPGP" (`beac8b9b-b94f-4b71-93de-ae000bd544b8`). The raw pages mention d6Vc 96 times and gdsq never. gdsq started 2h40m after this session stopped, with the same brief: it was a re-run.

## Metrics

| metric | value | evidence |
|---|---|---|
| task | "Check every 20 minutes until tickets for specs 1-10 are fully delivered, once complete then start building out tickets for spec 11 using candidate-reskin as the base branch. Merge candidate into our candidate-reskin branch before starting. Assess the frontier of tickets in spec 11, dispatching up to 4 at once ... /graph-orchestrator" | human `f3982a81-9ac6-41a0-8155-23e657586e4b` |
| mode | autonomous by default: no AskUserQuestion. The skill was loaded with the brief as args | Skill `3c39ab38-36fc-4905-814d-2f246aeb7519` |
| waves | 23. Wave 1 was orientation; waves 2-23 were one poll each, re-armed with `send_later` every 20 min | START `02bccf94` … `ddf8dfec` |
| dispatches | 24 launches: 23 completed, 1 failed (first w1-d1, scriptPath) | NOTIF `c4513c70-…` (failed), `aa0a4b75` … `b003d126` |
| topology mix | fan-out 1 (w1-d1: 4 workers, reducer, Grapher); single 22 (w2-d1 … w23-d1, "Poll specs 1-10 delivery") | wfagg rows; START `02bccf94`, `5256d00d`, `ddf8dfec` |
| per-dispatch status | 23 done. 1 failed in 63 ms with "A session that cannot call Read cannot load any scriptPath" (w1-d1 first try, task wxzvq4lje). No blocked, exhausted or over_budget | `c4513c70`; orchestrator summaries `37e0a8b5`, `27576a4c` … `26bedf70` |
| agents | 50 (w1-d1 6; each poll 2 = worker + Grapher) | task_progress workflow_progress agentIds |
| subagent_tokens | 3,913,378 (w1-d1 542,476; the 22 polls 143,787-176,426 each, about 3.37M in total) | NOTIF usage `aa0a4b75`, `52b2cea7`, `a5e3729a`, `b003d126` |
| workflow duration_ms | 1,042,237 in total (17.4 min). w1-d1 196,840; polls 29,041-65,431 | same NOTIFs |
| wall clock | 22:56:30 → 07:40:37 UTC (8h44m). Workflows ran for 3% of that; the rest was waiting on `send_later` | `f3982a81` → `eb6a3fad-d518-4bbb-9066-f1028ca36cfe` |
| cost | $32.43 cumulative | result `eb6a3fad` |
| human interventions | 1: "Stop" at 07:40:08 | `a42e7ac1` |
| compaction | none. Per-turn cache reads grew steadily, from 232,912 (`27576a4c`) to 567,150 (`26bedf70`) over the 3-iteration wake turns, about 190k context per call by the end | result usage |
| scribe | Grapher ran and finished `done` in all 23 completed dispatches. No null or failed scribe | wfagg (grapher ['done'] ×23) |
| final outcome | Abandoned at 77/78. 07-05 was still open, `candidate` was never merged into `candidate-reskin`, no spec 11 ticket was started, and there were no commits, pushes or PRs. The scheduled poll was deleted | `eb6a3fad`; delete_trigger `4243d74e` |
| user acceptance | corrected: the user stopped it (`a42e7ac1`) and 2h40m later re-ran the same brief in a new session (gdsq, `e1cc76f4-…` at 11-09 10:20:56) | gdsq.md |

## Observations

1. **scriptPath failure and the copy workaround.** The first w1-d1 launch used the plugin path (`b8504317`) and failed in 63 ms (`c4513c70`). Before that failure surfaced, the orchestrator had already reported "Wave 1 has started" and ended its turn (`274b92ce`, result `b9d733ac`). The next turn copied `dispatch.js` into the scratchpad (Bash `b9e9f917`) and relaunched (`4b991f61`, START `02bccf94`). All later dispatches used `scratchpad/dispatch.js`.
2. **A full workflow ran for every 20-minute status check.** 22 single dispatches each spun up an Opus worker and a Grapher to read PR state and another session's events. Each check cost about 150k subagent tokens and 10-14 tool calls (for example `52b2cea7`: 160,884 tokens, 10 tool uses). Total: about 3.37M tokens and 44 agents for 5 ticket transitions (72→77/78). The brief asked for polling, so polling itself is not a violation. Polling through a two-agent workflow plus a trace scribe, rather than one cheap check, is the cost driver. Each poll took two main-loop turns: launch, end the turn with "Wave N is running" (44-char result, e.g. `a7ae2378`), then wake on the notification and summarise. That added 46 orchestrator turns and about $28 of main-loop cost.
3. **It polled the wrong thing for the user's intent.** The orientation reply said "I didn't see any session working on these tickets. If nothing is delivering them, the polling will go on indefinitely. Tell me if you'd rather I deliver them here" (`37e0a8b5`). By the next poll it had found d6Vc delivering them (`afc217bb`). From then on it reported on d6Vc's progress ticket by ticket (`46177c65`, `15e97dff`, `adeb6a05`), which repeats d6Vc's work. It also prepared nothing for spec 11 beyond `orient-spec11.md`, because the brief gated spec 11 on 78/78.
4. **Orchestrator discipline was otherwise clean.** Main-loop tools: Skill 1, Read 1 (catalog.md, 21,765 chars, `9d95c43d`), Bash 1 (the cp), Write 6 and Edit 20 (all `state.md`), Workflow 24, send_later 23, ReadNotifications 22, ToolSearch 2, delete_trigger 1. There were no greps, no reads of worker output and no same-wave dependsOn (each wave had one dispatch). Spec (Workflow input) sizes were 1,348-2,741 chars, with no pasted context. Results stayed small: the largest is 1,684 chars (`37e0a8b5`), and the "running" interim results are 44-113 chars.
5. **No session.mmd was produced.** The session was stopped mid-poll, and the stop reply gave no trace render, only state.md and orient-spec11.md (`eb6a3fad`).
6. **Wake mechanism.** Each wake started with `ReadNotifications` (`2882c2fe`, about 3.2 kB of system boilerplate each, 22 times, about 70 kB in total). This is the largest recurring tool-result cost after the catalog read (`bin/viol.py`: 101 tool results, 129,676 chars).
