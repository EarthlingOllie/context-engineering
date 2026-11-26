# 01: Spike: launch, resume and usage-limit behaviour

**What to build:** Recorded answers, from a real cloud session, to the questions the launch and resume work rests on. Ships nothing; the findings go in this ticket under a Findings heading.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Launching by the registered workflow name `graph-orchestrator:dispatch` from a two-line wrapper: does the workflow show the wrapper's `meta.name`, and does the dispatch's return come back as the wrapper's? Answer recorded, with the workflow name as displayed
- [ ] The full error text of a usage-limit agent failure, and whether it carries a reset time (best-effort: from past session transcripts, or a limit met in passing); recorded verbatim, or "not found" with where was looked
- [ ] Whether the harness resumes a session by itself when a usage limit resets, or waits for the human; recorded, or "not observed"
- [ ] Whether the orchestrator can still take a turn once its agents are limited; recorded, or "not observed"
- [ ] Relaunching an already finished run with `resumeFromRunId`: wall clock to return and whether every agent replayed from cache, measured on at least one generator-evaluator run. If it takes more than about a minute or reruns agents, flag that the resume rule (ticket 04) must be rethought
- [ ] Whether a running dispatch script can learn its own run id; recorded, with how
- [ ] A one-line recommendation for ticket 03 (registered name or scratch copy) and for ticket 04 (run id in the trace or not)

## Findings

Recorded 2026-11-26 from cloud session `765ad18d` by a worker subagent inside dispatch w2-d1. The worker had no Workflow tool, so it launched nothing itself. Evidence comes from this session's own transcript (`~/.claude/projects/-home-user-context-engineering/765ad18d-*.jsonl`, plus `subagents/workflows/*/journal.jsonl` and `workflows/wf_*.json`), the 2026-11-18 session analysis, and the Workflow authoring reference. Items 1 and 5 were later updated from live probes the orchestrator ran in the same session (runs `wf_c5438344-de0` and `wf_7f6afc9b-0c8`).

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Registered-name launch keeps the wrapper's `meta.name` and returns the dispatch's result | partial fail (live probe) | Live probe by the orchestrator: `Workflow({name: 'graph-orchestrator:dispatch', args})` launches and **returns the dispatch result**, but the workflow is **labelled with the plugin description, not the dispatch title** (run `wf_c5438344-de0`). So the registered name does not keep a per-dispatch name. Related routes that were observed: (a) the plugin-root `scriptPath` was **refused** (run `wf_089aa526-a91`, task `w30z5dzt4`, journal holds only `launched`); (b) a **scratch copy** (`<scratchpad>/plugin/workflows/dispatch.js`) worked. Run `wf_7f6afc9b-0c8` was displayed with `workflowName` "Single: Map spec tickets frontier", which is the wrapper's `meta.name`. The notification summary used `meta.description` ("w1-d1 · single"). The child's return came back as the wrapper's result, as the dispatch JSON in the `<result>` of the `completed` notification |
| 2 | Full usage-limit error text, and whether it carries a reset time | untestable (fragment only) | Only the fragment "You've reached your Fable limit" was found (hQTT findings, REL-05; also eptK turn 1). The full text and any reset time were **not found**. Searched: this session's transcript and subagent transcripts (no limit met), and `docs/v1/graph-orchestrator/session-analysis-2026-11-18/` (findings.md, sessions/hQTT.md, eptK.md, d6Vc.md). The raw hQTT and eptK transcripts are not on disk here |
| 3 | Does the harness resume a session by itself when a limit resets? | pass (observed once, from prior analysis) | It **waits for the human**. In hQTT the session sat idle for 27 min until the user typed "Continue" (findings.md line 627, hQTT.md item 2). In d6Vc the orchestrator worked around this with a keep-alive script until the reset. Nothing was observed live in this session |
| 4 | Can the orchestrator still take a turn once its agents are limited? | pass (observed once, from prior analysis) | **No, when it is on the same model.** In hQTT the orchestrator itself hit the Fable limit right after its wave-2 agents did (events 9e8b2dd9, a595e3ba). It acted again only after the human switched the model to Opus |
| 5 | Relaunching a finished run with `resumeFromRunId`: wall clock and cache replay on a generator-evaluator run | pass (live probe, on a single run) | Live probe by the orchestrator: `Workflow({scriptPath, resumeFromRunId, args identical})` on finished run `wf_7f6afc9b-0c8` replayed **2 of 2** agent results from cache, **0 subagent tokens, 202 ms**, reused the **same run id**, and did not append the scribe line again. Well under the one-minute flag, and no agent reran. With changed args the cache would miss from the first changed agent call onward. Caveat: the probed run was a single-topology dispatch, not a generator-evaluator one; the documented rule ("Same script + same args → 100% cache hit unless a call failed or never finished") predicts the same for gen-eval |
| 6 | Can a running dispatch script learn its own run id? | fail (from documentation, not probed live) | The documented script globals are `agent`, `pipeline`, `parallel`, `log`, `phase`, `args`, `budget` and `workflow`, and none of them is a run id. `args` is fixed before launch, while the run id first appears in the launch's tool result (`Run ID: wf_…`, `toolUseResult.runId`). The plugin's `dispatch.js` does not reference a run id. Only the orchestrator learns the id, from the launch result |

**Verbatim refusal for the plugin-root scriptPath (item 1, route a):**

> Dynamic workflow "w1-d1 · single" failed: Error: workflow({scriptPath: '/root/.claude/plugins/synced/…/graph-orchestrator/workflows/dispatch.js'}): scriptPath must be a script path this tool returned, or a file you can already read (the working directory or a directory you have added): …/dispatch.js
> A session that cannot call Read cannot load any scriptPath. Pass the whole script inline through Workflow's `script` input instead.

The launch call returned "Workflow launched in background" with a run id. The refusal arrived only as a `failed` task-notification about 0.1 s later. A run id in hand does not prove the launch succeeded, and this bears on ticket 03's honest dispatch line.

**Recommendation.**
- Ticket 03: adopt the **scratch copy** as the documented launch, since it is observed to keep `meta.name` and to return the dispatch result (`wf_7f6afc9b-0c8`). The registered name returns the result but labels every run with the plugin description (`wf_c5438344-de0`), and the plugin-root `scriptPath` is refused. The dispatch line should wait for the first notification, or check the journal for more than `launched`, not only for the run id.
- Ticket 04: keep the run id in the **state file only**, because the script cannot learn it. Cache replay on resume is measured fast (202 ms, 0 tokens, same run id, on a single run), so the resume rule can stand; resume must pass identical args, or agents rerun from the first changed call.
