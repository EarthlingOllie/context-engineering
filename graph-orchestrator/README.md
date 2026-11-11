# graph-orchestrator

A Claude Code plugin in which the orchestrator is a skill that plans **waves** of **dispatches**, and each dispatch is a **topology** (single, generator-evaluator, fan-out, chain, relay, best-of-n, iterative-fan-out, panel, debate) run by deterministic code as its own named Workflow; a wave is the set of those workflows, launched together and run in parallel. Loops and parallelism happen inside the topology; only the outcome comes back to the orchestrator, which folds it into a one-screen state file and plans the next wave. When the frontier is empty, a renderer turns the trace into a Mermaid diagram of the session.

Spec: `docs/v1/spec.md`. Glossary: `docs/v1/graph-orchestrator/CONTEXT.md`. Decisions: ADR-0001, ADR-0002, ADR-0003.

## Layout

```
.claude-plugin/plugin.json          the manifest
skills/graph-orchestrator/SKILL.md  the orchestrator skill, invoked as /graph-orchestrator <task> [flags]
skills/graph-orchestrator/catalog.md the catalog the skill loads once per session
workflows/dispatch.js               the Workflow script, one dispatch per run (built; do not edit)
scripts/render-trace.js             trace.jsonl → Mermaid (built; do not edit)
src/                                TypeScript source: types, roles, labels, topologies/ (one file each), runWorkflow, renderer
test/                               dispatch-boundary tests (run.test.ts, plus one file per topology added in v0.2), labels, renderer fixtures, bundle test
build.mjs                           esbuild: src → workflows/dispatch.js and scripts/render-trace.js
```

The built files are committed, so the plugin installs with no build step.

## Install

```
claude plugin marketplace add earthlingollie/context-engineering
claude plugin install graph-orchestrator@earthlingollie
```

Then, in any project:

```
/graph-orchestrator Add a retry policy to the HTTP client and its tests --mode attended
```

Flags: `--mode attended|autonomous` (default autonomous when nobody says otherwise), `--waves N` (16), `--dispatches N` (9), `--scratch <dir>`.

## How a wave runs

The skill writes up to nine dispatch specs and launches each as its own `Workflow` call, all in one message, so the wave's dispatches run in parallel and show up as separate workflows. Each call is a two-line inline wrapper:

```
export const meta = { name: 'Generator-evaluator: Add the HTTP retry policy', description: 'w1-d1 · generator-evaluator' }
return await workflow({ scriptPath: '<plugin root>/workflows/dispatch.js' }, args)
```

with `{ now, scratch, dispatch, humans }` as `args`. A workflow's displayed name is its `meta.name`, which must be a literal, so the wrapper is what lets every workflow be named for its topology and purpose (`<Topology>: <title>`); the topology code stays in one built file. `dispatch.js` runs the dispatch through its topology, then dispatches a scribe agent that appends the dispatch's trace lines to `<scratch>/trace/<id>.jsonl`, a file of its own, so parallel workflows never write the same file. The script cannot read the clock, the filesystem or the shell, so the orchestrator supplies `now` and the scribe does the writing. Agent demand is logged and never refused: over-cap agents queue. Because the dispatches of a wave are separate runs, `dependsOn` names earlier waves only; ordered steps within a wave are a `chain`.

Inside a workflow, whose name already gives the topology, every agent label reads `<role> (n of m): <task>` (ADR-0004). `(n of m)` places the agent among the instances of its role and is left out when only one is configured; a second axis is named; the task is the agent's own, cut to 40 characters: `Worker: Add the HTTP retry policy`, `Generator (1 of 3): Add the HTTP retry policy`, `Worker (2 of 4): parse headers`, `Judge: Pick the parser`, `Debater pro (round 1 of 2): Pick a queue`, `Worker (round 2 of 3, 1 of 2): scan src/b`, `Grapher: logging current dispatch` (the scribe, which writes the trace lines the session's Mermaid graph is later drawn from). A chain's stages each run their own topology, so a stage agent's label also names its link of the chain and that topology: `Link 2 · Generator-evaluator, Evaluator (1 of 2): write it up`.

Signature (see `src/types.ts`):

```ts
DispatchSpec   = { id, title?, topology, task, context[], roles{ name: { skill?, instructions } }, params{}, returns{ shape, maxLines ≤ 20 }, dependsOn[] }
DispatchResult = { id, status: done | blocked | exhausted | over_budget | failed, result, artifacts[], question?, iterations, stages? }
```

`failed` is the one status beyond the spec's four: it is what a dispatch returns instead of throwing when a spec cannot run (unknown topology, bad params, an agent that returned nothing).

## Develop

```
npm install
npm run check     # tsc --noEmit, then build and test
npm run build     # regenerates workflows/dispatch.js and scripts/render-trace.js
npm test
```

Tests run on Node 22 with native type stripping; no test runner beyond `node --test`. They exercise only the dispatch boundary (`runWorkflow` with a fake `agent()`, one run per dispatch as a wave launches them), the renderer with fixture traces, and the built bundle executed under a harness-shaped scope.

## Topologies

Nine, documented for the orchestrator in `skills/graph-orchestrator/catalog.md` (the source of truth for roles, params, demand and returns) and implemented one file each in `src/topologies/`. v0.2 added `relay`, `best-of-n`, `iterative-fan-out` and `panel`, and built `debate`, which spec story 42 had reserved as the dogfood task and v0.1 shipped as a stub returning `failed`.
