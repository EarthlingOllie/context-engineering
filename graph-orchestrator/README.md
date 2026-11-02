# graph-orchestrator

A Claude Code plugin in which the orchestrator is a skill that plans **waves** of **dispatches**, and each dispatch is a **topology** (single, generator-evaluator, fan-out, chain, relay, best-of-n, iterative-fan-out, panel, debate) run by deterministic code inside one Workflow script. Loops and parallelism happen inside the topology; only the outcome comes back to the orchestrator, which folds it into a one-screen state file and plans the next wave. When the frontier is empty, a renderer turns the trace into a Mermaid diagram of the session.

Spec: `docs/v1/spec.md`. Glossary: `docs/v1/graph-orchestrator/CONTEXT.md`. Decisions: ADR-0001, ADR-0002.

## Layout

```
.claude-plugin/plugin.json          the manifest
skills/graph-orchestrator/SKILL.md  the orchestrator skill, invoked as /graph-orchestrator <task> [flags]
skills/graph-orchestrator/catalog.md the catalog the skill loads once per session
workflows/wave.js                   the Workflow script, one wave per run (built; do not edit)
scripts/render-trace.js             trace.jsonl → Mermaid (built; do not edit)
src/                                TypeScript source: types, roles, topologies/ (one file each), runWave, renderer
test/                               wave-boundary tests (wave.test.ts, plus one file per topology added in v0.2), renderer fixtures, bundle test
build.mjs                           esbuild: src → workflows/wave.js and scripts/render-trace.js
```

The built files are committed, so the plugin installs with no build step.

## Install

```
claude plugin marketplace add earthlingollie/context-management
claude plugin install graph-orchestrator@earthlingollie
```

Then, in any project:

```
/graph-orchestrator Add a retry policy to the HTTP client and its tests --mode attended
```

Flags: `--mode attended|autonomous` (default autonomous when nobody says otherwise), `--waves N` (16), `--dispatches N` (9), `--scratch <dir>`.

## How a wave runs

The skill writes up to nine dispatch specs and calls the `Workflow` tool once with `{ now, traceFile, artifactDir, maxAgents, humans, dispatches }` as `args`. `wave.js` runs the dispatches in parallel, each through its topology, collects the trace events in memory, and finishes by dispatching a scribe agent that appends them to `trace.jsonl` in one write. The script cannot read the clock, the filesystem or the shell, so the orchestrator supplies `now` and the scribe does the writing. Agent demand is logged against the effective concurrency cap (`min(16, CPUs − 2)`, so 2 in a 4-CPU cloud session) and never refused: over-cap agents queue.

Signature (see `src/types.ts`):

```ts
DispatchSpec   = { id, topology, task, context[], roles{ name: { skill?, instructions } }, params{}, returns{ shape, maxLines ≤ 20 }, dependsOn[] }
DispatchResult = { id, status: done | blocked | exhausted | over_budget | failed, result, artifacts[], question?, iterations, stages? }
```

`failed` is the one status beyond the spec's four: it is what the wave returns instead of throwing when a spec cannot run (unknown topology, bad params, an agent that returned nothing).

## Develop

```
npm install
npm run check     # tsc --noEmit, then build and test
npm run build     # regenerates workflows/wave.js and scripts/render-trace.js
npm test
```

Tests run on Node 22 with native type stripping; no test runner beyond `node --test`. They exercise only the wave boundary (`runWave` with a fake `agent()`), the renderer with fixture traces, and the built bundle executed under a harness-shaped scope.

## Topologies

Nine, documented for the orchestrator in `skills/graph-orchestrator/catalog.md` (the source of truth for roles, params, demand and returns) and implemented one file each in `src/topologies/`. v0.2 added `relay`, `best-of-n`, `iterative-fan-out` and `panel`, and built `debate`, which spec story 42 had reserved as the dogfood task and v0.1 shipped as a stub returning `failed`.
