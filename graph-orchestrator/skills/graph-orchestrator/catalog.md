# Catalog — graph-orchestrator v0.2

The topologies this plugin version runs. Fixed per version: a topology that is not here is not available mid-session; it becomes a proper addition. Load once at kickoff; choose from this page, never from the implementation.

Every dispatch, whatever its topology, has the same signature:

```
in:  { id, topology, task, context[], roles{}, params{}, returns{shape,maxLines≤20}, dependsOn[] }
out: { id, status: done|blocked|exhausted|over_budget|failed, result (inline, ≤ maxLines), artifacts[], question?, iterations }
```

`failed` means the spec could not run at all (unknown topology, bad params, an agent that returned nothing or threw — the thrown error goes to the log); the `result` says why. `over_budget` means a cap was exceeded and no agent was spent. Roles take `{ skill?, instructions }`: the skill supplies the domain, the instructions the task-specific detail. Every role is told to return `blocked=true` with one `question` when only a human can answer; a blocked role stops its topology.

Agent demand is logged against the concurrency cap and never refused; the runtime queues. The 1,000-agents-per-run limit is the only hard check: a dispatch that would cross it returns `over_budget` unrun and counts nothing, as does a spec a cap refuses, so the dispatches after it still run if they fit.

---

## single

**Use when** one worker can do it in one pass: a lookup, a focused edit, a survey of one area, writing one file.

**Roles** `worker` (optional entry; skill + instructions).

**Params** none.

**Demand** 1 agent.

**Returns** `done` with the worker's result, or `blocked` with its question.

```json
{ "id": "w1-d1", "topology": "single",
  "task": "Write the leap-year helper with tests in test/leap.test.ts",
  "context": ["project uses node:test, not vitest"],
  "roles": { "worker": { "skill": "tdd", "instructions": "red before green; keep the API to one exported function" } },
  "params": {},
  "returns": { "shape": "path of the file written, then one line on what it exports", "maxLines": 2 },
  "dependsOn": [] }
```

---

## generator-evaluator

**Use when** the deliverable should be reviewed until it passes and you do not want to see the rounds: code against tests, a plan against criteria, prose against a style guide.

**Roles** `generator` (produces), `evaluator` (judges strictly against `pass_criteria`; changes nothing). Give each its own skill when the domain differs (e.g. `tdd` for the generator, `code-review` for the evaluator).

**Params** `pass_criteria` (string, required in practice), `max_iterations` (default 3).

**Demand** 2 × max_iterations (upper bound; stops early on pass).

**Loop** generate → evaluate → if pass, done. Otherwise the next generator round sees the evaluator's numbered feedback and its own artifact paths, but not its previous inline output, so rounds converge instead of drifting.

**Returns** `done` on the first pass (`iterations` = rounds used); `exhausted` at the cap with the last result and the last feedback line; `blocked` if either role blocks.

```json
{ "id": "w2-d1", "topology": "generator-evaluator",
  "task": "Implement the trace renderer in src/trace/render.ts so all fixtures in test/fixtures render",
  "context": ["fixture files were written by w1-d2 at /scratch/fixtures/"],
  "roles": { "generator": { "instructions": "pure function, no I/O" },
             "evaluator": { "skill": "code-review", "instructions": "run npm test; fail on any failing fixture" } },
  "params": { "pass_criteria": "npm test passes and no fixture is skipped", "max_iterations": 3 },
  "returns": { "shape": "one line per file changed, then PASS or the last failing test name", "maxLines": 6 },
  "dependsOn": ["w1-d2"] }
```

---

## fan-out

**Use when** independent sub-tasks can run at once and be merged inside the dispatch: research across N areas, the same check on N packages, N candidate approaches.

**Roles** `worker` (every branch), `reducer` (optional; merges the finished branches and notes gaps).

**Params** `split`: either an explicit list of sub-tasks (width = its length) or a partition instruction string, in which case a partition agent splits the task into at most `width` sub-tasks first. `width` ≤ 9 (default 3 with an instruction; ignored with a list). `reducer`: `true` or a role entry, or just supply `roles.reducer`.

**Demand** width (+1 for a partition instruction) (+1 for a reducer).

**Returns** `done` when at least one branch finished. Without a reducer the result is `[i] <branch result>` per branch, each branch given an equal share of `maxLines`. With a reducer the result is the reducer's, in the full contract; a reducer that returns nothing is logged and the result falls back to the concatenated form. A blocked branch blocks only itself: the dispatch is still `done`, the reducer is told the gap, and `question` lists the blocked branches' questions so you can ask. A blocked reducer → `blocked`, with its question first and the blocked branches' questions after it. All branches blocked → `blocked`. A `split` list longer than 9 → `over_budget`, nothing run.

```json
{ "id": "w1-d2", "topology": "fan-out",
  "task": "Research how each store module handles concurrent writes",
  "context": [],
  "roles": { "worker": { "instructions": "cite file:line" },
             "reducer": { "instructions": "group by strategy; one line per module" } },
  "params": { "split": ["src/store/pg.ts", "src/store/sqlite.ts", "src/store/memory.ts"] },
  "returns": { "shape": "one line per module: strategy and the file:line that proves it", "maxLines": 4 },
  "dependsOn": [] }
```

With a partition instruction: `"params": { "split": "one branch per top-level package under packages/", "width": 6 }`.

---

## chain

**Use when** stages must happen in order and each stage is itself a dispatch: "fan out research, then review the synthesis, then write it up" as one dispatch. The only composition in v1; a stage may be any topology, including another chain.

**Roles** none of its own; each stage carries its own roles.

**Params** `stages`: a list of dispatch specs. A stage may omit `id` (becomes `<chain-id>-s<n>`), `context`, `returns` and `dependsOn`; it inherits the chain's context and return contract.

**Demand** the sum of the stages' demand.

**Flow** stages run in order. Each stage's context gains the prior stage's status, first result line and artifact paths. The first stage that is not `done` stops the chain, which returns that stage's status, result and question. Trace lines are written for every stage (tagged with the chain as parent) and for the chain itself with `stages: ["w3-s1:done", ...]`.

**Returns** the last stage's result, all stages' artifacts, `iterations` = stages run, plus `stages` statuses.

```json
{ "id": "w3-d1", "topology": "chain",
  "task": "Produce the architecture note for the store layer",
  "context": ["decision: keep sqlite for tests (w2-d1)"],
  "roles": {}, "params": { "stages": [
    { "topology": "fan-out", "task": "Research each store module", "params": { "split": ["pg", "sqlite", "memory"] }, "roles": { "reducer": { "instructions": "one paragraph per module" } }, "returns": { "shape": "path of the research note", "maxLines": 1 } },
    { "topology": "generator-evaluator", "task": "Write docs/store.md from the research note", "params": { "pass_criteria": "every claim cites a file; under 400 words" }, "roles": { "evaluator": { "skill": "writing-for-agents", "instructions": "" } }, "returns": { "shape": "path of the note, then its word count", "maxLines": 2 } }
  ] },
  "returns": { "shape": "path of the note, then its word count", "maxLines": 2 },
  "dependsOn": ["w2-d1"] }
```

---

## debate

**Use when** a contested decision should come back as a verdict, not a transcript: choose between designs, settle a disputed root cause, pick one of several candidate fixes.

**Roles** `debater` (one entry shared by every participant; each participant argues the fixed stance given in params), `judge` (required; reads the whole transcript and returns the verdict). Give the debater a research-shaped skill when the stances need evidence from the codebase.

**Params** `participants`: `[{ name, stance }]`, 1–6; `rounds` (default 2); `judge`: a role entry, or supply `roles.judge`.

**Demand** participants × rounds + 1.

**Flow** each round runs one debater per participant in parallel; a debater sees its STANCE, the OTHER PARTICIPANTS' stances and the PRIOR ROUNDS' transcript (never its own round's positions), and returns a position of at most 8 lines. After the last round the judge sees the participants and the full transcript and answers in the dispatch's return contract.

**Returns** `done` with the judge's verdict in the contract shape, its last line the judge's reasoning (`-- judge reasoning: …`, as the evaluator's feedback is surfaced), `iterations` = rounds. `blocked` with the question if any debater blocks (that round's remaining debaters finish, the judge never runs, `iterations` = the round reached) or the judge blocks. More than 6 participants → `over_budget`, nothing run. No participants, or no judge in either place → `failed`, nothing run.

```json
{ "id": "w2-d3", "topology": "debate",
  "task": "Pick the store for v1: Postgres or SQLite",
  "context": ["tests already run against sqlite (w1-d2)"],
  "roles": { "debater": { "skill": "research", "instructions": "cite file:line for every claim about the current code" },
             "judge": { "instructions": "decide on scale and operational cost; name what would overturn the verdict" } },
  "params": { "participants": [ { "name": "pg", "stance": "Postgres from day one" }, { "name": "sqlite", "stance": "SQLite until a measured need" } ], "rounds": 2 },
  "returns": { "shape": "one verdict line, then at most two lines of reasoning", "maxLines": 3 },
  "dependsOn": ["w1-d2"] }
```
