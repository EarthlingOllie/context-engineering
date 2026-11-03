# Catalog — graph-orchestrator v0.3

The topologies this plugin version runs. Fixed per version: a topology that is not here is not available mid-session; it becomes a proper addition. Load once at kickoff; choose from this page, never from the implementation.

Every dispatch, whatever its topology, has the same signature:

```
in:  { id, title, topology, task, context[], roles{}, params{}, returns{shape,maxLines≤20}, dependsOn[] }
out: { id, status: done|blocked|exhausted|over_budget|failed, result (inline, ≤ maxLines), artifacts[], question?, iterations }
```

`failed` means the spec could not run at all (unknown topology, bad params, an agent that returned nothing or threw — the thrown error goes to the log); the `result` says why. `over_budget` means a cap was exceeded and no agent was spent. Roles take `{ skill?, instructions }`: the skill supplies the domain, the instructions the task-specific detail. Every role is told to return `blocked=true` with one `question` when only a human can answer; a blocked role stops its topology, except where an entry says a blocked branch or attempt only drops out.

Each dispatch runs as its own workflow, named by its `title` (a few plain words saying what it is for), in parallel with the rest of its wave. Agent demand is logged and never refused; the runtime queues. The 1,000-agents-per-run limit applies per dispatch and is the only hard check: a dispatch whose demand plus its scribe would cross it returns `over_budget` unrun. `dependsOn` may name only earlier waves: dispatches in one wave cannot wait on each other, and one that names a same-wave id returns `failed` unrun. Ordered steps inside a wave are a `chain`.

---

## single

**Use when** one worker can do it in one pass: a lookup, a focused edit, a survey of one area, writing one file.

**Roles** `worker` (optional entry; skill + instructions).

**Params** none.

**Demand** 1 agent.

**Returns** `done` with the worker's result, or `blocked` with its question.

```json
{ "id": "w1-d1", "title": "Write the leap-year helper", "topology": "single",
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
{ "id": "w2-d1", "title": "Build the trace renderer", "topology": "generator-evaluator",
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

**Use when** independent sub-tasks can run at once and be merged inside the dispatch: research across N areas, the same check on N packages. To pick one of N candidate approaches, use `best-of-n`.

**Roles** `worker` (every branch), `reducer` (optional; merges the finished branches and notes gaps).

**Params** `split`: either an explicit list of sub-tasks (width = its length) or a partition instruction string, in which case a partition agent splits the task into at most `width` sub-tasks first. `width` ≤ 9 (default 3 with an instruction; ignored with a list). `reducer`: `true` or a role entry, or just supply `roles.reducer`.

**Demand** width (+1 for a partition instruction) (+1 for a reducer).

**Returns** `done` when at least one branch finished. Without a reducer the result is `[i] <branch result>` per branch, each branch given an equal share of `maxLines`. With a reducer the result is the reducer's, in the full contract; a reducer that returns nothing is logged and the result falls back to the concatenated form. A blocked branch blocks only itself: the dispatch is still `done`, the reducer is told the gap, and `question` lists the blocked branches' questions so you can ask. A blocked reducer → `blocked`, with its question first and the blocked branches' questions after it. All branches blocked → `blocked`. A `split` list longer than 9 → `over_budget`, nothing run.

```json
{ "id": "w1-d2", "title": "Research store write concurrency", "topology": "fan-out",
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
{ "id": "w3-d1", "title": "Write the store architecture note", "topology": "chain",
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

## relay

**Use when** one deliverable is too big for one context and must be built in order in one place: one tree, one long document, a feature list worked through until all pass. Each session starts fresh; the progress file is the hand-over.

**Roles** `worker` (every session; makes the next increment and rewrites the progress file), `evaluator` (the done-check against `done_criteria`; changes nothing). Both entries optional.

**Params** `done_criteria` (string, required: the check is the only stop). `progress` (string, required): the progress-artifact path, which you name, usually under `SCRATCH`. `max_sessions` (default 3, ≤ 10). `check_every` (default 1): run the check every k sessions; the last session is always checked. Need a scaffold first? Use `chain [single, relay]`.

**Demand** max_sessions + ceil(max_sessions / check_every) (upper bound; stops on the first pass). 6 with the defaults.

**Loop** each session gets `SESSION s of N`, `PROGRESS`, `DONE CRITERIA`, the union of artifact paths so far and the last check's feedback, never a prior inline result. On a check session the evaluator sees the done criteria, that session's result, the artifacts and the progress path; a pass ends the dispatch, a fail's feedback goes to the next session.

**Returns** `done` on the first passing check, with that session's result and every session's artifacts (`iterations` = sessions used). `exhausted` after the last session: its result (giving up its last line if needed) plus `-- exhausted after N session(s); last check: <first feedback line>`. `blocked` if the worker or the evaluator blocks. `failed` if `done_criteria` or `progress` is missing, `max_sessions` or `check_every` is below 1, or a role returns nothing (artifacts so far kept). `max_sessions` above 10 → `over_budget`.

```json
{ "id": "w2-d1", "title": "Implement the feature list", "topology": "relay",
  "task": "Implement every feature in /scratch/features.json until all pass",
  "context": ["feature list written by w1-d1"],
  "roles": { "worker": { "skill": "tdd", "instructions": "one failing feature per session; update the progress file" },
             "evaluator": { "instructions": "run npm test; pass only if every listed feature passes" } },
  "params": { "done_criteria": "all features pass and the progress file says DONE", "progress": "/scratch/progress.md", "max_sessions": 6, "check_every": 2 },
  "returns": { "shape": "features passing / total, then the last progress line", "maxLines": 3 },
  "dependsOn": ["w1-d1"] }
```

---

## best-of-n

**Use when** several approaches are viable and a wrong pick is costly: n independent attempts, one chosen. Also the equal-compute baseline to compare a `debate` against.

**Roles** `worker` (every attempt), `judge` (picks one candidate by its `[i]` index; changes nothing). Both entries optional.

**Params** `n` (default 3; 2 to 9). `variants`: optional list of approach hints, one per attempt; its length sets n, and an explicit `n` that disagrees → `failed`. `criteria` (string, required). `mode`: `"select"` (default; the judge always picks) or `"vote"` (a strict majority, more than n/2, of identical first result lines wins with no judge; otherwise the judge picks). First lines are compared trimmed, lowercased, whitespace collapsed; an empty first line is no vote.

**Demand** n + 1 (in vote mode an upper bound: the judge runs only without a majority).

**Flow** attempts run in parallel; each is told to write its candidate under `<artifactDir>/<id>-c<i>/` and leave the working tree alone, so applying the winner is a later dispatch. A blocked or empty attempt drops out. The judge sees `CRITERIA`, every candidate as `[i] <result>` with its artifacts, and the dropped attempts.

**Returns** `done` with the judge's verdict (or, in vote mode, the winning result); `artifacts` are the winner's first, then every other candidate's, then the judge's; `iterations` = 1. `question` lists the blocked attempts as `attempt i: <question>`. Every attempt dropped → `blocked` if any blocked, else `failed`. A blocked judge → `blocked`, its question first. A judge that returns nothing or an empty verdict → `failed`, candidates' artifacts kept. Missing `criteria`, n below 2 or a bad `mode` → `failed`. n above 9 → `over_budget`.

```json
{ "id": "w3-d2", "title": "Fix the flaky renderer test", "topology": "best-of-n",
  "task": "Propose a fix for the flaky trace-renderer test",
  "context": ["failing test and log at /scratch/flake.md"],
  "roles": { "worker": { "skill": "diagnosing-bugs", "instructions": "write the patch to a new file; do not apply it" },
             "judge": { "instructions": "pick the patch most likely to remove the root cause with the smallest diff" } },
  "params": { "variants": ["minimal change", "fix the timing assumption", "restructure the test"], "criteria": "root cause addressed; no new flakiness; smallest diff", "mode": "select" },
  "returns": { "shape": "path of the chosen patch, then one line why", "maxLines": 2 },
  "dependsOn": [] }
```

---

## iterative-fan-out

**Use when** research across many files or sources where some gaps show only after a first pass: a fan-out whose evaluator turns each coverage gap into the next round's sub-tasks.

**Roles** `worker` (every branch, and the partition step), `evaluator` (checks coverage after every round; each feedback line becomes one follow-up sub-task), `reducer` (always runs, over every branch of every round). All entries optional.

**Params** `split`: an explicit list of sub-tasks or a partition instruction, as in fan-out (the partition runs in round 1 only). `width` ≤ 9 per round (default 3 with an instruction; with a list, the list length, blank entries not counted). `coverage_criteria` (string, required). `max_rounds` (default 2, ≤ 3).

**Demand** max_rounds × width + max_rounds + 1 (+1 for a partition instruction). Width 6 over 2 rounds: 15, or 16 with a partition instruction.

**Loop** round 1 is fan-out's branch step; every branch gets the dispatch's full contract. After each round the evaluator sees `COVERAGE CRITERIA` and every branch so far (first line and artifacts; blocked branches as gaps). Pass → reduce. Fail → the next round's split is the feedback lines, numbering stripped, minus sub-tasks already run, cut to `width`. No new sub-task (a stall) or `max_rounds` used → reduce as exhausted. The reducer gets every branch's full result, plus `OPEN GAPS` when exhausted.

**Returns** `done` on an evaluator pass, with the reducer's result; `iterations` = rounds. `exhausted` on a stall or at the cap: the reducer's result plus `-- exhausted after R round(s); open gaps: <count>; first: <gap>`. A blocked branch blocks only itself; `question` lists them as `round r branch i (<sub-task>): <question>`. No branch finished in round 1 → `blocked` if any blocked, else `failed`, as fan-out. A blocked evaluator or reducer → `blocked`, its question first. An evaluator or reducer that returns nothing → `failed`, artifacts kept. `width` or a `split` list above 9, or `max_rounds` above 3 → `over_budget`.

```json
{ "id": "w1-d3", "title": "Map trace file access", "topology": "iterative-fan-out",
  "task": "Map every place the codebase reads or writes the trace file",
  "context": [],
  "roles": { "worker": { "instructions": "cite file:line" },
             "evaluator": { "instructions": "list each module or call path not yet covered, one follow-up sub-task per line" },
             "reducer": { "instructions": "one line per call site, grouped by module" } },
  "params": { "split": "one branch per top-level directory under src/", "width": 6, "coverage_criteria": "every import of the trace module is accounted for", "max_rounds": 2 },
  "returns": { "shape": "path of the findings note, then the count of call sites", "maxLines": 2 },
  "dependsOn": [] }
```

---

## panel

**Use when** a finished artifact must clear several independent reviews and the answer should be one pass/fail: correctness, caps, docs, security, each judged alone. Typically the gate at the end of a chain.

**Roles** `evaluator` (one per lens, all from the single `roles.evaluator` entry; judges only its lens; changes nothing), `reducer` (optional; merges and dedupes the feedback into an artifact).

**Params** `lenses`: `[{ name, focus, skill? }]`, 1 to 6, unique names; a lens's `skill` overrides `roles.evaluator.skill`. `pass_criteria` (string, required). `pool`: `"all"` (default; every lens passes) or `"majority"` (more than k/2 lenses pass). `reducer`: `true` or a role entry, or just supply `roles.reducer`. The evaluators review the artifacts named in `context`, so put the paths there.

**Demand** k lenses (+1 with a reducer).

**Returns** `done` with the pooled verdict on line 1, `PASS` or `FAIL (p/k)`, even on FAIL; `iterations` = 1. Without a reducer, `[name] FAIL: <first feedback line>` follows for each failing lens, cut to `maxLines`. With a reducer, its result follows the verdict line and its artifacts carry the merged feedback. A chain does not stop on a FAIL verdict, so make a gating panel the chain's last stage. Any blocked lens → `blocked`, no reducer run, `question` lists them as `lens <name>: <question>`. A lens that returns nothing, or a reducer that returns nothing → `failed`. A blocked reducer → `blocked` with the verdict as result. Malformed lenses, duplicate names, missing `pass_criteria` or a bad `pool` → `failed`. More than 6 lenses → `over_budget`.

```json
{ "id": "w4-d1", "title": "Review the dispatch bundle", "topology": "panel",
  "task": "Review the dispatch.js bundle change before release",
  "context": ["diff at /scratch/release.diff"],
  "roles": { "evaluator": { "instructions": "judge only your lens; cite file:line" } },
  "params": { "lenses": [ { "name": "correctness", "focus": "behaviour vs spec" },
                          { "name": "caps", "focus": "every cap still enforced" },
                          { "name": "docs", "focus": "catalog matches code", "skill": "writing-for-agents" } ],
              "pass_criteria": "no lens finds a blocking defect", "pool": "all" },
  "returns": { "shape": "PASS or FAIL, then one line per failing lens", "maxLines": 4 },
  "dependsOn": [] }
```

---

## debate

**Use when** a contested decision should come back as a verdict, not a transcript: choose between designs, settle a disputed root cause.

**Roles** `debater` (one per participant, all from the single `roles.debater` entry; each holds the fixed stance its participant gives), `judge` (required; returns the verdict; changes nothing).

**Params** `participants`: `[{ name, stance }]`, 2 to 6, unique names, non-empty stances. `rounds` (default 2; 1 to 4); every round always runs. `judge`: a role entry, or supply `roles.judge` (which wins when both are given); with neither → `failed`, no agent spent.

**Demand** participants × rounds + 1.

**Loop** inside a round all debaters run in parallel, each given `STANCE` and `YOU ARE`; from round 2 each also sees every participant's previous position as `[name] <position>`. Positions are cut to 8 lines and the transcript stays inline. The judge sees the participants with their stances and the whole transcript, and answers in your return contract.

**Returns** `done` with the judge's verdict, plus `-- decisive: <first line of its reasoning>` when `maxLines` leaves room; the judge's artifacts; `iterations` = rounds. Any blocked debater → `blocked` in that round, `question` lists them as `debater <name>: <question>`. A blocked judge → `blocked`. A debater that returns nothing, or a judge that returns nothing or an empty verdict → `failed`. Fewer than 2 participants, a missing name or stance, or a duplicate name → `failed`. More than 6 participants or more than 4 rounds → `over_budget`.

```json
{ "id": "w5-d1", "title": "Decide the relay done signal", "topology": "debate",
  "task": "Decide whether relay's done signal should be an evaluator check or a worker completion flag",
  "context": ["roles are six fixed stances (K3)", "relay spec at /scratch/design-specs.md"],
  "roles": { "debater": { "instructions": "cite file:line for any claim about the code" },
             "judge": { "instructions": "weigh contract stability above agent cost" } },
  "params": { "participants": [ { "name": "check", "stance": "an evaluator done-check is better" },
                                { "name": "flag", "stance": "a worker completion flag is better" } ],
              "rounds": 2 },
  "returns": { "shape": "the chosen option, then the decisive reason in one line", "maxLines": 2 },
  "dependsOn": [] }
```
