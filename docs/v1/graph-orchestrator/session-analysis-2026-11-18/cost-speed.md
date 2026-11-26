# Cost and speed decomposition of graph-orchestrator sessions

Scope: the 19 confirmed sessions that have usable data. Dollars come from the sessions' own `total_cost_usd`/`modelUsage` (exact). Per-agent detail exists for 15 of them (810 agents, from `workflow_progress`). This session's 10 local workflows (26 agents) are included too, with exact per-call usage.
Scripts and intermediate data are in `SCRATCH/cs/`: `extract.py` → `remote.json`, `an.py`/`final.py` → `agents_remote.json`, `agents.py` → `agents.json` (local), and `main.json` (orchestrator main loop).

Labels used below: **[exact]** = read directly from billing fields. **[model]** = computed with the per-agent cost model in §1.3. **[est]** = a judgement estimate with its basis stated.

## 1. Method

1. **Sources.**
   - Remote raw pages: `sessions/raw/*`.
   - The last `workflow_progress` row per agent gives `tokens`, `toolCalls`, `durationMs`, `queuedAt`, `startedAt`, `state`, `model` and `label`.
   - `task_notification` gives status and usage.
   - `result` events give the cumulative `total_cost_usd`, `modelUsage`, and the main-loop usage per turn.
   - Local: `subagents/workflows/*/agent-*.jsonl` gives per-call `usage`; `journal.jsonl` gives role labels.
2. **What "tokens" means.**
   - Two figures behave the same way: the `total_tokens` in the notification (the "subagent_tokens" in every session note, 88.7M in total) and the agent row's `tokens`.
   - Each is approximately the sum, over agents, of each agent's final context size. Locally, w2-d1 reported 2.79M, and the sum of per-agent peak context was 2,786,156.
   - **It is not billed volume.** The same w2-d1 actually processed 197M tokens, 194M of them cache reads.
   - Dollars per reported token range from $4/M (dQHS, g2Kg) to $26/M (efwY, g7is). The ratio grows with the number of turns per agent, so do not compare session cost by "subagent_tokens".
3. **Per-agent cost model [model].**
   - Fitted on the 26 local agents against exact billing: `$ ≈ 0.139·(tokens_M × (toolCalls+1)) + 5.27·tokens_M`, R² 0.995.
   - This is the cache-read term (context × turns) plus one cache write of the context.
   - Opus 5.5 rates were taken from the claude-api skill: $4 in, $20 out, $0.20 cache read; cache writes assumed at 1.25× for 5 min and 2× for 1 h. These rates reproduce every session's reported `costUSD` to within 3%.
   - On fully covered sessions, (model agent $ + exact main-loop $) over reported $ is:

     | sessions | ratio | likely cause |
     |---|---|---|
     | research/fan-out: dJmJ, dQHS, eiLu, eptK, fm1f | 0.90-1.2 | — |
     | coding: d9gr, gdsq, g7is | 0.69-0.77 | the extra cache writes in §2 |
     | efwY | 0.58 | the extra cache writes in §2 |

   - **Role and topology shares are therefore reliable to about ±25%.** They understate long-running coding roles, which are mostly generators, so the generator share is a floor.
4. **Main loop vs subagents [exact].**
   - Main-loop dollars come from the `usage` on each `result` event, priced the same way (the main loop uses 1 h cache writes).
   - Subagent dollars are the session total minus the main loop.
5. **Wall clock.**
   - Workflow-active time is the union of [task_started, task_notification] intervals.
   - Idle time is the session span minus the active time.
   - Queue time per agent is `startedAt − queuedAt`.
   - The no-cap counterfactual groups agents that were queued within 10 s of each other and takes the slowest of each group.

Coverage caveats:
- d6Vc, dKG5, eznd, hD76 and hQTT have agent rows only for the windows that were read, so their agent $ is partial. Their totals and token-type splits are still exact.
- fMmB, fnVU, fS88 and g2Kg have no agent rows; only their totals are used.
- hD76 ran on Fable 5.2 (2× Opus price). The model prices it at Opus rates.

## 2. Where the dollars went: by token type [exact]

The 14 sessions with `modelUsage` came to $4,053 reported ($4,052 recomputed). Over the whole inventory the reported total is about $5,330: these plus fMmB $1,096, fnVU $122, fS88 $57 and g2Kg $7.

| billed as | tokens | share of $ |
|---|---|---|
| cache **writes**, 5 min | 452M (all writes) | **55.9%** |
| cache writes, 1 h (main loop) | | 2.6% |
| cache reads | 5.74B | 28.3% |
| output, thinking included | 25.0M | 13.1% |
| uncached input | ~0 | 0.0% |

- Cache writes, not reads, are the largest sink. The ratio of writes to reads differs by workload:
  - coding sessions: about 1:10 (d6Vc 273M:2,886M; eznd 43M:496M);
  - this session's research workers: about 1:90 (w2-d1 2.2M:194M).
- Coding agents therefore re-write their context about 9× as often. The likely causes:
  - long tool calls (test suites, builds) that outlast the 5-minute cache TTL;
  - large tool outputs.
- **[est]** This mechanism is inferred, not observed per call: per-call usage of remote agents was not fetched.

## 3. Main loop vs subagents [exact]

| session | main-loop $ | total $ | main share | peak main context |
|---|---|---|---|---|
| d6Vc | 25.1 | 2,177 | 1.2% | 252k |
| eznd | 9.9 | 364 | 2.7% | 316k |
| gdsq | 3.9 | 151 | 2.6% | 203k |
| hD76 | 6.1 | 201 | 3.0% | 214k |
| efwY | 11.2 | 207 | 5.4% | 207k |
| g7is | 10.9 | 192 | 5.7% | 249k |
| dQHS | 1.6 | 26 | 6.3% | 149k |
| d9gr | 8.3 | 116 | 7.2% | 231k |
| dKG5 | 25.4 | 342 | 7.4% | 410k (2 compactions) |
| dJmJ | 5.3 | 50 | 10.7% | 204k |
| fm1f | 2.9 | 18 | 16.6% | 134k |
| eiLu | 7.4 | 32 | 22.9% | 288k (polling) |
| this session (so far) | 1.09 | ~78 | 1.4% | 137k |

- **Median main share is 6%. The orchestrator is a minor cost (1-11%) everywhere except polling sessions.**
- Its cost is context growth, which hits quality and compaction rather than the bill:
  - 6 of 14 sessions peaked above 230k;
  - dKG5 reached 410k and compacted twice.
- gdsq's own `/usage` reply agrees: subagents were 98% of requests.

## 4. By role [model] (810 agents, model total $1,108; shares are what matter)

| role | n | share of agent $ | median $/agent | share of agent run-hours | median run | queue h |
|---|---|---|---|---|---|---|
| generator | 215 | **61.9%** | 2.01 | **60.6%** | 23.3 min | 0.4 |
| worker (single, branch, relay, chain link) | 179 | 16.0% | 0.61 | 23.3% | 2.0 min | 2.4 |
| evaluator (g-e, relay check, panel lens) | 218 | 14.9% | 0.73 | 15.9% | 4.0 min | 0.8 |
| **scribe (Grapher)** | 166 | **5.8%** | 0.39 | 0.1% (21 min total) | 7 s | 0 |
| reducer | 17 | 0.8% | 0.41 | 0.1% | 0.6 min | 0.15 |
| debater | 6 | 0.3% | 0.50 | ~0 | 0.4 min | 0 |
| partition | 8 | 0.2% | 0.34 | ~0 | 0.3 min | 0.28 |
| judge | 1 | 0.05% | 0.49 | ~0 | 0.7 min | 0 |

- **Scribe.** Every scribe carries about 69k tokens of context: a median of 69,373, with a p10-p90 range of 67k-71k. That is the harness's fixed system-prompt-plus-tools floor. The scribe's own task is only about 1.1k characters.
  - That floor is a fixed cost every agent pays, about $0.10 warm and $0.38 cold (locally: Grapher $0.105 with a warm cache, $0.375 cold).
  - Scribes are 20% of all agents spawned. They are 36% of the $ of a single-topology dispatch (§5).
- **Evaluators** are cheap relative to generators: their run time per g-e loop is a median 0.24× the generator's.
- **Generators dominate both $ and time.** The median generator runs 23 minutes with 47 tool calls, and the tail reaches 7.5 h (d6Vc).
- **This session (exact, local).**
  - Workers $70.5 (91%), evaluators $1.62, partition $0.46, reducer $0.59, scribes $1.34 (1.7%).
  - The research workers ran long (up to 217 turns), which shrinks the scribe's share.

## 5. By topology [model] (per dispatch)

| topology | dispatches | share of agent $ | median $/dispatch | median agents | median agent-minutes | scribe share of its $ |
|---|---|---|---|---|---|---|
| chain (ticket pipelines; g-e links) | 73 | **63.6%** | 8.08 | 4 | 143 | 3.4% |
| generator-evaluator | 47 | 19.8% | 3.98 | 3 | 39 | 8.2% |
| fan-out / iterative-fan-out | 21 | 12.4% | 4.32 | 6 | 12 | 4.9% |
| single | 40 | 3.9% | 0.94 | 2 | 0.6 | **35.6%** |
| debate | 1 | 0.3% | 3.85 | 8 | 3.5 | 10.2% |

- Panel, relay and best-of-n appear only as chain links, inside "chain".
- Generator-evaluator loops (156 loops, counting chain links):

  | final round | loops |
  |---|---|
  | 1 | 113 (72% passed on the first round) |
  | 2 | 31 |
  | 3 | 12 |

- Rounds 2 and later account for 11% of g-e $ and 18% of g-e hours. This is legitimate rework, not waste.
- The local iterative-fan-out (w2-d1) cost $59.7, 14 agents and 65 min. It ended `exhausted`, and the reducer's Write was refused, so the reducer's step ($0.59) produced nothing usable.

## 6. Where the wall clock went

1. **Session span vs active time.**
   - The 14 sessions with task data spanned 201 h of wall clock; workflows were active for 124 h (62%).
   - The other 38% was idle: human waits (d9gr 8h49m on one AskUserQuestion, plus about 21 h between rounds), overnight gaps, and `send_later` polling. eiLu, for example, was 3% active over 8.4 h.
   - Partial windows (d6Vc, dKG5) are counted as covered.
2. **Inside active time, the critical path is agent run time.** Of 312 agent-hours:
   - generators 61%, workers 23%, evaluators 16%;
   - scribes 0.1%: 7 s median, 21 min over 166 dispatches.
3. **Queueing under the cap of 2.**
   - Overall: 4.0 h of queue against 312 h of run, **1.3% of agent time**. g-e and chains are sequential and never exceed the cap.
   - **Fan-out is different: 3.9 h of queue against 7.2 h of run, 35% of fan-out agent time.**
   - Measured fan-out dispatches, actual wall vs no-cap wall:

     | dispatch | actual | no cap |
     |---|---|---|
     | dJmJ 27-agent | 11.5 min | 8.1 min |
     | dJmJ 27-agent | 7.3 min | 4.8 min |
     | eptK 10-agent | 33.8 min | 18.0 min |
     | dQHS | 8.5 min | 5.8 min |
     | dQHS | 8.5 min | 6.0 min |

   - Across all 9 non-chain fan-outs: 95 min → 65 min, **−32%** of their wall clock.
   - Local w2-d1:
     - the 7 round-1 workers started at +0, +0, +6.3, +10.5, +16.9, +19.9 and +29.7 min;
     - round 1 ended at +40.7 min, where it would end at +14 min with no cap;
     - the dispatch would take about 38.5 min instead of 65 min, **−41%** [est].
4. **The wave barrier.**
   - Only 16 waves held more than one dispatch: 10 of 2, 2 of 3, 2 of 4, one of 6 and one of 7. 68 waves held one.
   - In those 16 waves, finished dispatches idled until the wave's slowest one returned: 20.5 h of idle slot time against 28.8 h busy, **42% of slot time**.
5. **Orchestrator turnaround between waves.** The median gap is 50 s, a total of 0.8 h outside eiLu's deliberate 20-minute polls. This is negligible.

## 7. Failed and wasted work

| kind | count | $ | wall clock | source |
|---|---|---|---|---|
| scriptPath launch failures | 9 in the agent data; 13/14 sessions per the notes; this session 2 | ~0 for agents. One orchestrator turn each, about $0.05-0.3 [est] | under 1 s, plus 1-2 min of orchestrator re-planning [est] | task status `failed`, 0-60 ms |
| runs stopped by a container or worker restart | 14 tasks / 24 agents in the windows read (d6Vc 6, g7is 5, d9gr 1, ...) | **$100 [model], 9.0% of agent $**. $45 was in agents that had finished (recoverable through resumeFromRunId replay); $55 was in flight and lost | 6.9 agent-h. Critical path lost: d9gr 111 min; g7is 108 + 34-49 min ×4; d6Vc 66 min | task status `stopped` |
| evaluators left `progress` when the workflow completed | 8 (d6Vc 5, g7is 4 incl. stopped, d9gr 1) | about $30 [model] | none (not waited on) | agent state ≠ done |
| exhausted / over_budget needing a follow-on dispatch | d6Vc w39-d1 (608k reported, 4.7 h) and w47-d2 (813k, 9.1 h); this session w2-d1 | about $13-18 each [est from §5 medians ×2] | 4.7-9.1 h each before the follow-on | d6Vc table |
| polling dispatches that never led to work (eiLu) | 22 single dispatches | about $17 of agents + $7.4 main loop, the whole $32 session; abandoned and re-run as gdsq | 8.4 h span | eiLu.md |
| reducer output refused by the harness Write ban | this session w2-d1; dQHS w2-d1 generator; d9gr w6-d1 s2 | under $1 each, but the orchestrator then redoes the work itself (d9gr: 18 KB + 20 KB of reads in the main loop) | minutes | notes |

## 8. Savings per plugin lever (from SCRATCH/plugin-map.md)

Percentages are of **subagent $** unless stated otherwise. Subagent $ is about 94% of session $ (median).

| lever | mechanism | what it touches | plausible saving | confidence |
|---|---|---|---|---|
| **L8 per-role model/effort** (`callRole` passes no `model` or `effort`) | Run scribe and partition on Haiku 5.5 ($0.10/$0.50, about 40× cheaper). Run reducer, judge and evaluator on Sonnet 5.5 (half price, cache reads $0.10). Keep generators and workers on Opus. | scribe+partition 6.1% + reducer/judge 0.9% + evaluator 14.9% = **21.9% of agent $** | **−6%** from the mechanical roles only. **−13.5%** adding evaluators: 6.0 + 0.45 + 7.4. About 12.5% of session $ | high for the scribe; medium for evaluators (needs a check of false-pass rate, see the quality audit) |
| **L5/L9 remove the scribe agent** (return trace lines in the dispatch result; the orchestrator or renderer writes them) | No 69k-floor agent per dispatch | 5.8% of agent $; 20% of agents spawned; 35.6% of single-dispatch $; 0.1% of wall clock (7 s per dispatch) | **−5.8% of agent $** (−36% on single dispatches); −20% of agent spawns. Wall-clock gain negligible | high (no quality risk; the scribe never failed in 166 runs) |
| L15/L16 concurrency (cap 2 per run) | The plugin cannot raise the runtime cap, but it can split a fan-out wider than 2 into ⌈w/2⌉ sibling dispatches (each run has its own cap) | 35% of fan-out agent time is queue; fan-out is 2.3% of agent-hours | **−32% to −41% of fan-out dispatch wall clock**; under 2% of total session wall clock in coding sessions; $ ≈ 0 | measured on 10 dispatches |
| L17 wave barrier → rolling frontier | Start the next dependent dispatch when its own dependency returns (gdsq already did this by hand from w7) | 42% idle slot time in the 16 multi-dispatch waves (20.5 h) | [est] −10 to −25% of active wall clock in sessions that run ≥2 dispatches per wave (d9gr, eznd, gdsq, d6Vc, g7is); about 0 in one-dispatch-per-wave sessions (efwY, hD76). $ ≈ 0 | low-medium (depends on dependency structure) |
| L18 scriptPath fallback (copy or inline the script up front) | Removes the first-launch failure | 13/14 sessions; under 0.1% of $ | about 1-2 min and one main-loop turn per session; mostly reliability | high |
| SKILL resume discipline (always `resumeFromRunId` after a restart; not a numbered lever, the closest is L18 reliability) | Replay finished agents from cache instead of re-running them | stopped runs: 9% of agent $ | **up to −4% of agent $** (the $45 in finished agents) and 6.9 agent-h; in-flight work ($55) is lost regardless | medium |
| L6 early stop / L3 DEFAULT_ITERATIONS 3→2 | Cap g-e at 2 rounds | 12 of 156 loops reached round 3; rounds ≥2 = 11% of g-e $ | ≤ −3% of agent $ (round 3 only) [est]; **not recommended**: those rounds fixed real failures | low value |
| L1/L2 topology heuristics ("don't dispatch a poll") | Poll with Bash, `send_later` or Monitor in the main loop, not a 2-agent single dispatch | eiLu: 22 polls at about $0.77 each | that session −$17 (−52%); 0% elsewhere | high, narrow |
| L10-L13 prompt size (`context`, SKILL line, growing inputs) | Shorter dispatch prompts | dispatch prompts are 2-23k characters (0.6-6k tokens) against a fixed harness floor of about 69k tokens per agent; local first prompts 1.1-23k characters | **under 2%** of agent $ [est]; the reducer's 23k-character prompt is the largest | — |
| L19/L20 inline result ceiling | Smaller results in the orchestrator's window | main loop is 1-11% of $ | under 1% of $; the value is in main-context growth (compactions), not $ | — |

**Not in the plugin map but larger than any lever above.** Cache writes are 56% of session $, written about 9× as often per read in coding agents.
- Either of these would cut the dominant line item:
  - a 1-hour cache TTL for workflow subagents, which is a harness or runtime setting;
  - having generators and evaluators run long test suites in the background and poll, instead of sitting in a tool call past 5 minutes.
- **[est]** If half of the excess re-writes were avoided, the saving would be about −20 to −25% of coding-session $. This needs per-call usage from remote agents (via `get_event`) to confirm.

## 9. Summary of sinks

1. **Generators:** 62% of agent $ and 61% of agent-hours [model]. **Chains of ticket g-e:** 64% of agent $.
2. **Cache writes:** 56% of all session dollars [exact]. This line item rises with long tool calls.
3. **Idle wall clock:** 38% of the session span (human waits, overnight, polls). Within active time: restarts cost 9% of agent $, the barrier leaves 42% of slot time idle in multi-dispatch waves, and queueing takes 35% of fan-out agent time (1.3% overall).

**Highest-value plugin lever:** L8, per-role model/effort in `callRole`.
- It is −6% of subagent $ risk-free (scribe and partition on Haiku).
- It is about −13.5% (about 12.5% of session $, about $660 of the $5.3k observed) if evaluators move to Sonnet 5.5 and keep their pass accuracy.
- L5 (drop the scribe) gives the same 5.8% with no quality risk, and also removes 20% of agent spawns.
