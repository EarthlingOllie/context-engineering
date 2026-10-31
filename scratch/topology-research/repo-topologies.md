# Topologies in /home/user/context-management

All paths relative to /home/user/context-management. Repo HEAD: f5ef282 ("Add the graph-orchestrator plugin (v1 spec) (#1)").

## 1. Definition

### Glossary (canonical)
`docs/v1/graph-orchestrator/CONTEXT.md:11-13`
> **Topology**:
> A reusable, parameterised control-flow pattern with a fixed signature and no task-specific content. A template, not a run. Only a chain's stages may themselves be topologies.
> _Avoid_: Workflow, pattern, building block, tool

Related terms (same file):
- Dispatch (:15-16): "One topology instantiated with concrete parameters. The unit the orchestrator issues within a wave and the unit that returns a result."
- Dispatch Spec (:19-20): "The structured description of a dispatch the orchestrator writes: id, topology, task, context, roles, params, return contract, dependencies."
- Role (:23-24): "A named slot inside a topology, with a fixed stance and output shape, filled at dispatch time with a skill and task-specific instructions. The domain comes from the skill, never from the role."
- Stage (:27-28): "One step of a chain. A stage is a dispatch, so it may be any topology."
- Signature (:39-40): "The fixed contract every topology accepts from and returns to the orchestrator: a dispatch spec in; a status (done, blocked, exhausted, over budget), an inline result, artifact paths and an iteration count out."
- Catalog (:51-52): "The short description of every available topology — when to use it, its roles, its params — that the orchestrator loads once. Fixed per version."

### Spec framing
`docs/v1/spec.md:19`: "...each dispatch is a **topology** — a reusable control-flow pattern (single, generator-evaluator, fan-out, debate, chain) run by deterministic code inside one Workflow script. ... Loops and parallelism happen inside the topology; only the outcome comes back."
`docs/v1/spec.md:145`: "'workflow' refers only to the Claude Code runtime feature, never to a topology."

### Dispatch signature / contract
`graph-orchestrator/skills/graph-orchestrator/catalog.md:7-10`
```
in:  { id, topology, task, context[], roles{}, params{}, returns{shape,maxLines≤20}, dependsOn[] }
out: { id, status: done|blocked|exhausted|over_budget|failed, result (inline, ≤ maxLines), artifacts[], question?, iterations }
```
Typed source of truth: `graph-orchestrator/src/types.ts`
- `:7` `export const TOPOLOGIES = ["single", "generator-evaluator", "fan-out", "debate", "chain"] as const;`
- `:15` `DispatchSpec`; `:27-39` per-topology narrowed params; `:46` `DispatchStatus` (adds `failed` beyond the spec's four); `:48` `DispatchResult` (adds `stages?` for chain).
- Spec version (without `failed`): `docs/v1/spec.md:80-102`.

Implementation contract: `graph-orchestrator/src/topologies/shared.ts:29` `TopologyImpl = { demand(spec, params): number; run(ctx, spec): Promise<DispatchResult> }`. Registry keyed by the union: `graph-orchestrator/src/topologies/dispatch.ts:17` (`Record<Topology, TopologyImpl>`, "a topology without an entry is a type error", :1-7). `runDispatch` (:43) never throws: unknown topology / no id / no task / a thrown topology -> `failed`.

### Constraints
- Caps (`graph-orchestrator/src/topologies/shared.ts:9-14`; summarised `src/topologies.ts:9-11`): MAX_LINES=20, MAX_WIDTH=9 (fan-out), MAX_PARTICIPANTS=6 (debate); defaults: iterations 3, rounds 2, width 3. "A spec that exceeds a cap returns `over_budget` without spending an agent."
- Run limit: 1,000 agents per run is the only hard check; concurrency demand is logged, never refused (catalog.md:14; spec.md:104).
- Composition: only chain composes ("Only a chain's stages may themselves be topologies", CONTEXT.md:12; spec story 24, spec.md:46; ADR-0002 `docs/v1/graph-orchestrator/docs/adr/0002-topologies-as-workflow-scripts.md:15`: "A chain's stages are topologies because that is code composition, not agent nesting; no other topology composes in v1.").
- Topologies cannot ask the human; a blocked role short-circuits the topology and the orchestrator asks (ADR-0002:18; spec.md:108; spec story 26, spec.md:48).
- Form: all topologies are functions in one Workflow script `wave.js` (bundled from TypeScript by esbuild), invoked once per wave, because scripts cannot import each other and concurrent runs are undocumented (ADR-0002:4-8; spec.md:104). Caps are "enforced rather than requested" (ADR-0002:6). ADR-0001:10: "only the topologies are deterministic".
- Roles: six fixed stances — worker, generator, evaluator, judge, reducer, debater (`graph-orchestrator/src/roles.ts:9`; spec.md:106); domain comes from a skill named at dispatch time (spec story 25, spec.md:47).

### What makes something a topology vs. not
- A topology is a template (pattern) with no task content; a dispatch is a run of one (CONTEXT.md:12,16).
- It must have the fixed signature and be listed in the version's catalog / `TOPOLOGIES` union; anything else returns `failed` ("unknown topology", dispatch.ts:46).
- "Workflow" (the runtime), "pattern", "building block", "tool" are explicitly not synonyms (CONTEXT.md:13; spec.md:145).
- The `lead-orchestrator` skill is the non-topology alternative: "dispatches `Agent` calls one at a time with no topologies and no trace" (`graph-orchestrator/skills/graph-orchestrator/SKILL.md:162`).

## 2. Catalog of topologies

Choice heuristic: `SKILL.md:71` — "One pass: `single`. Review until it passes: `generator-evaluator`. Independent parts at once: `fan-out`. Ordered stages: `chain`. Prefer one dispatch whose topology holds the loop over several dispatches you would loop yourself."

| Name | Status | Use when | Roles | Params | Demand | Where |
|---|---|---|---|---|---|---|
| single | built | one worker can do it in one pass: lookup, focused edit, survey of one area, writing one file | `worker` (optional entry) | none (`SingleParams = Record<string, never>`) | 1 | catalog.md:18; src/topologies/single.ts:21; types.ts:27; spec story 17 (spec.md:39) |
| generator-evaluator | built | deliverable should be reviewed until it passes without seeing rounds: code vs tests, plan vs criteria, prose vs style guide | `generator`, `evaluator` (judges strictly vs pass_criteria; changes nothing) | `pass_criteria` (string, required in practice), `max_iterations` (default 3) | 2 x max_iterations | catalog.md:42; src/topologies/generator-evaluator.ts:73; types.ts:28; spec stories 18-19 (spec.md:40-41) |
| fan-out | built | independent sub-tasks run at once and merge inside the dispatch: research across N areas, same check on N packages, N candidate approaches | `worker` (every branch), `reducer` (optional) | `split` (list of sub-tasks, or partition-instruction string), `width` ≤ 9 (default 3 with instruction), `reducer` (true or role entry, or `roles.reducer`) | width (+1 partition agent) (+1 reducer) | catalog.md:69; src/topologies/fan-out.ts:133 (caps :22, :28); types.ts:29; spec stories 20-21, 27 (spec.md:42-43,49) |
| chain | built (added during the ADR-0002 spike) | ordered stages, each itself a dispatch ("fan out research, then review the synthesis, then write it up"); the only composition in v1; a stage may be any topology incl. another chain | none of its own; each stage carries its own roles | `stages`: list of dispatch specs (may omit id -> `<chain-id>-s<n>`, context, returns, dependsOn; inherits chain's) | sum of stages | catalog.md:96; src/topologies/chain.ts:45; types.ts:39; spec stories 23-24 (spec.md:45-46); spike-adr0002.md:9 |
| debate | planned (signature, caps, roles, catalog entry exist; run returns `failed`, spends no agents; >6 participants -> `over_budget`) | (once built) a contested decision should come back as a verdict, not a transcript: choose between designs, settle a disputed root cause. Stand-in: generator-evaluator or fan-out + reducer | `debater` (one per participant, stance in params), `judge` (required) | `participants: [{name, stance}]` ≤ 6, `rounds` (default 2), `judge` role entry (or `roles.judge`) | participants x rounds + 1 | catalog.md:124-136; src/topologies/debate.ts:11-18; types.ts:34; spec stories 22, 42 (spec.md:44,64); graph-orchestrator/README.md:63 |

No topology is recorded as rejected.

## 3. Adding topologies; future/rejected ideas

### Stated process / criteria for additions
- Catalog fixed per plugin version: "a topology that is not here is not available mid-session; it becomes a proper addition. Load once at kickoff; choose from this page, never from the implementation." (catalog.md:3)
- Spec story 30 (spec.md:52): "I want the catalog fixed per plugin version, so that ad-hoc topologies become proper additions rather than one-offs." Story 29 (spec.md:51): catalog is a fixed short description loaded once.
- Mechanically (implied by code): add the name to `TOPOLOGIES` (types.ts:7), a narrowed `*Params` type, a `TopologyImpl` file under `src/topologies/`, a REGISTRY entry (dispatch.ts:17 — omission is a type error), a catalog.md entry (use when / roles / params / demand / returns / example), tests through `runWave` (spec.md:8, :122), rebundle to `workflows/wave.js`.
- Composition rule constrains new topologies: only chain may compose in v1 (spec story 24: "so that the design does not become a general graph language before it has been used").
- Dogfood acceptance: building `debate` through the orchestrator is the v1 acceptance test (spec.md:144; expected: a fan-out for research, a generator-evaluator for the script, a chain for the catalog entry, one human intervention on the judge's verdict format).

### Future / deferred ideas
- `docs/v1/graph-orchestrator/docs/v2.md:6` — "Composition beyond chain: fan-out of topologies, nested debate."
- `docs/v2.md:8` — "Ad-hoc topologies defined mid-session." (also out of scope, spec.md:136)
- `docs/v2.md:10` — "Python port of the orchestrator loop and topologies." (ADR-0001:6 intends port to code-defined topologies, e.g. Python/LangGraph or Agent SDK)
- spec.md:134 Out of Scope — "Composition beyond chain."
- Rejected alternatives for *how topologies run* (not topologies themselves), ADR-0002:6: a runner subagent following prose instructions, or the orchestrator stepping through roles itself — rejected in favour of Workflow scripts.
- Live e2e coverage gap: debate "unbuilt by design", not exercised (docs/v1/e2e/findings.md:27).
