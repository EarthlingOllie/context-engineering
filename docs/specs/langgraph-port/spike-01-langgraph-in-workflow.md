# Spike 01: LangGraph TS runs inside a Claude Code Workflow script

**Question.** Can the topologies run on `@langchain/langgraph` (TypeScript) while every role agent still shows in Claude Code's Workflow UI (`/workflows`), with its label, phase and the workflow's name?

**Status:** designed. The local part (items 1–4) passes; the live part (items 5–12) has not been run. Go/no-go for roadmap rank 18 as this spike frames it.

## The architecture under test

Only `agent()` calls made from inside a Workflow script appear in the Workflow UI. A LangGraph program run outside the harness (a Node process from Bash) would spawn agents the UI cannot see. So the design is:

- The orchestrator stays a Claude Code plugin skill and launches a Workflow per dispatch, as today (ADR-0003, ADR-0004).
- The dispatch script is LangGraph plus the topology graphs, bundled by esbuild into one file, the way `build.mjs` bundles `dispatch.js` now.
- Each graph node calls the harness's injected `agent()` (and `log()`), so the harness does the spawning, queueing, labelling and resume.

```
skill ──Workflow(wrapper, meta.name = title)──▶ workflow({scriptPath: dispatch.js})
                                                  └─ LangGraph StateGraph.invoke()
                                                       ├─ node ─▶ agent(prompt, {label, phase, schema})
                                                       └─ Send fan-out ─▶ agent() × n   (queued by the harness cap)
```

The constraints come from the Workflow script runtime: one file, no `import` or `require`, no Node API, no filesystem, and `Date.now()`, `new Date()` and `Math.random()` throw (they would break resume).

## Two consequences for the roadmap, known before the live run

These follow from the architecture, not from the spike's results, and rank 18's rationale should be corrected for them:

1. **REL-01 is not sidestepped.** The engine is still a Workflow script launched by `scriptPath`, so the SCRATCH-copy launch from rank 2 is still needed.
2. **LangGraph's checkpointed resume (REL-03) is not available inside the harness.** Scripts have no filesystem, so a checkpointer can only be in memory for the life of the run. Durable resume is the harness's `resumeFromRunId`, which needs the graph to call `agent()` in the same order on replay (item 10).

What LangGraph does buy here: graphs, state, reducers and routing as a maintained library instead of hand-written loops, and a graph definition that can later run outside Claude Code by swapping the node's `agent()` for an Agent SDK call (ADR-0001's standalone program).

## Files

All under `spike-01/`, throwaway:

| File | What it is |
|---|---|
| `graph.ts` | The spike graph: a 3-way `Send` fan-out, then a generator → evaluator loop with a conditional edge, a reducer channel and a schema'd evaluator. Nodes call `rt.agent` with `label` and `phase`. |
| `clock-shim.js` | Replaces `Date` and `Math` inside the bundle (esbuild `inject`): the clock is seeded from `args.now` and ticks 1 ms per read; `Math.random` is a seeded LCG. Deterministic, so replays match. |
| `build.cjs` | Bundles to `spike-graph.js`: an IIFE (the bundle declares its own top-level `meta`, which collides with the script's `meta`), stubs for the `node:` builtins `langsmith` imports, the `meta` literal first and a top-level `return` last. |
| `emu.cjs` | Local stand-in for the sandbox: `vm` context with no Node APIs, where `Date.now`, `new Date()` and `Math.random` throw; a fake `agent()` records labels. |
| `globals-probe.cjs` | Removes one web global at a time to find which ones the bundle needs. |
| `package.json` | Pins `@langchain/langgraph` 1.7.5, `@langchain/core` 1.5.1, `esbuild` 0.28.2. |

```bash
cd docs/specs/langgraph-port/spike-01 && npm install && node build.cjs --minify && node emu.cjs && node globals-probe.cjs
```

## Items

L = local, no model calls. C = live, in a Claude Code cloud session.

| # | Item | Where | Pass when | Result |
|---|---|---|---|---|
| 1 | **Bundles to one Workflow script.** | L | One file, no `import`/`export` statements, `meta` literal first, top-level `return` last. | **pass.** 1.40 MB minified (2.96 MB not). Needed: the browser export conditions, stubs for 6 `node:` builtins (all from `langsmith`, via `@langchain/core`; tracing is never on), and an IIFE wrapper. Largest parts: zod, `@langchain/core`, `langsmith`, then LangGraph itself. |
| 2 | **Runs with the clock and randomness removed.** | L | The graph completes in a sandbox where `Date.now`, `new Date()` and `Math.random` throw. | **pass with the shim.** Without it, LangGraph throws at once: `uuid6` → `emptyCheckpoint` calls `Date.now()` even with no checkpointer. |
| 3 | **Graph semantics.** | L | `Send` fan-out, reducer and conditional loop behave as in Node. | **pass** (the recursion limit was set but not hit). 3 branches, then generator/evaluator for 2 rounds, ending on `pass`. Agents were called in a stable order: `Branch 1..3`, `Generator (round 1)`, `Evaluator (round 1)`, `Generator (round 2)`, `Evaluator (round 2)`. |
| 4 | **Web globals needed.** | L | A list exists to check live. | **done.** `TextEncoder`, `URL`, `AbortController`, `ReadableStream`, `crypto`. `setTimeout` and `queueMicrotask` were not needed when these were present. |
| 5 | **The live sandbox has those globals.** | C | A one-agent script logs `typeof` each global from item 4; then `spike-graph.js` runs and returns `{round, pass, branches}` as data. Any missing global is shimmed through `inject` (a deterministic `crypto.getRandomValues` from the seeded LCG; `AbortController` and `TextEncoder` polyfills) and the run repeated. | |
| 6 | **A 1.4 MB script is accepted.** | C | `Workflow({scriptPath: <SCRATCH copy>})` runs it directly, and through the ADR-0003 wrapper `workflow({scriptPath})`. Inline `script` is not an option: its limit is 524,288 characters. Record the time from launch to the first agent start, against the current 60 KB `dispatch.js`. | |
| 7 | **The UI shows the graph.** | C | In `/workflows`: the wrapper's `meta.name`; the nested group for the child script; agents under the labels the nodes gave; `Fan-out` and `Loop` as phase groups. Evidence: a screenshot or a written description per point. | |
| 8 | **Fan-out queues under the cap.** | C | A 6-way `Send` under the cloud cap of 2 completes with 6 results, no nulls and no errors (the ADR-0002 spike's item 3, repeated through LangGraph). | |
| 9 | **Failures surface as data.** | C | (a) Skip one branch agent in the UI so `agent()` returns null; (b) make one node throw. The graph returns a `failed` status with the cause, and the workflow returns data rather than crashing. | |
| 10 | **Harness resume replays from cache.** | C | Stop the run after `Evaluator (round 1)`, relaunch with `resumeFromRunId`: the 5 finished agents return from cache instantly, the rest run live, and the result equals an uninterrupted run. This depends on the shim's determinism and on the stable order seen in item 3. | |
| 11 | **Parity on a real topology.** | C | Port `generator-evaluator` onto LangGraph using the existing `buildPrompt` and `callRole`, returning the same `DispatchReturn`. Run one real spec through both engines; agents, iterations, status and trace line match, and tokens differ by no more than run-to-run noise. | |
| 12 | **Engine overhead.** | C | A graph with one `agent()` call against a plain script with the same call: record the wall-clock difference. Pass: under 2 s per dispatch. | |

## Go / no-go

- **Go** if items 5–10 pass. Item 11 then becomes the first ticket of the port spec, and item 12 is recorded, not gating.
- **No-go on 5 or 6** (the sandbox can't host the bundle): try a slimmer bundle first, using `@langchain/langgraph/web` only with zod 3 and dropping `langsmith` by alias. If that still fails, the fallback is LangGraph as a Node process launched from Bash, with nodes calling the Agent SDK. That loses the Workflow UI and harness resume, so it needs its own decision, not a quiet switch.
- **No-go on 10** (replay is not deterministic): the port would lose resume that today's engine has. Stop and report.

## Cost and prerequisites

- Items 5–10 use trivial prompts: about 30 agents in all. Each agent carries Claude Code's fixed context (about 69k tokens, cost-speed.md §8), so expect about 2M tokens, mostly cache reads.
- Item 11 is one real generator-evaluator dispatch per engine.
- Run it in a cloud session with the plugin installed. Running Workflow needs the user's explicit go-ahead in that session.
