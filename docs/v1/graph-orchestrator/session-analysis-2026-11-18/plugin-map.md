# graph-orchestrator plugin map (baseline for cost / latency / quality)

`PR` = installed plugin root `/root/.claude/plugins/synced/0f384659-661a-452d-95da-c7e71702fd24_2e6a74af-e383-4cf8-a0b5-a0ddec22d8c0/graph-orchestrator` (v0.3.1, catalog v0.3).
`REPO` = `/home/user/context-engineering`. Line numbers refer to the TS source under `PR/src` unless the path says otherwise. `PR/workflows/dispatch.js` (1274 lines, 61,924 bytes) is the esbuild bundle of that source (`PR/build.mjs:21-35`).

## 1. Source and history in the repo

- `REPO/graph-orchestrator/` holds the full plugin source: src, tests, build.mjs, the built dispatch.js, and skills. `diff -rq` against PR shows only three differing files: `plugin.json` (repository URL: context-management in the installed copy, context-engineering in the repo), `README.md` (marketplace name), and `SKILL.md`. The installed SKILL.md has an extra line 164 that points at `lead-orchestrator`, which the repo removed in commit 3096bd5. All src, test and workflows files are identical, so the installed plugin is one or two commits behind the repo HEAD on its docs only.
- History: 32 of the 46 commits touch `graph-orchestrator/`, from 2a12011 (2026-10-30, the v1 add) to a5161eb (2026-11-11). The current branch is `claude/affectionate-edison-y1c8pt`, with a clean tree.
- Design record: `REPO/docs/v1/spec.md` (146 lines), `REPO/docs/v1/graph-orchestrator/CONTEXT.md` (glossary), ADRs 0001-0004 plus `spike-adr0002.md` under `REPO/docs/v1/graph-orchestrator/docs/adr/`, `docs/v2.md` (deferred items), and `REPO/docs/v1/e2e/{use-cases,findings}.md` (v0.1 live runs).
- Existing evidence of cost and latency (`REPO/docs/v1/e2e/findings.md:5-9`):
  - UC1: 7 agents, about 5 minutes.
  - UC2: 12 agents, about 21 minutes.
  - UC3: 10 agents, about 3 minutes.
  - A 9-agent fan-out took 15 minutes through a concurrency cap of 2 (`findings.md:14`).

## 2. Control flow (where an agent gets spawned)

1. **Orchestrator (main session)**, from `PR/skills/graph-orchestrator/SKILL.md`. It reads catalog.md once (`SKILL.md:17,38`) and writes state.md (`:44-59`). It plans up to `--dispatches` (default 9) dispatches per wave, over up to `--waves` (default 16) waves (`:27-31`). It launches **one Workflow per dispatch, all in one message** (`:84-96`), and every result comes back inline into its own window (`:102`).
2. **Wrapper**: a two-line inline script, `workflow({ scriptPath: '${CLAUDE_PLUGIN_ROOT}/workflows/dispatch.js' }, args)` (`SKILL.md:88`; ADR-0003 `0003-one-workflow-per-dispatch.md:10-13`). ADR-0003 `:27-33` lists this as "to verify in a live session". **Reliability lever:** in this session Workflow refused the documented scriptPath at the installed plugin dir ("not a readable path"). A byte-identical copy at `SCRATCH/plugin/workflows/dispatch.js` worked (verified identical with `diff`). So every dispatch depends on the orchestrator knowing that workaround, and nothing in SKILL.md mentions it.
3. **runWorkflow** (`run.ts:54-97`) does four things:
   - logs the demand (`:68-69`);
   - refuses the dispatch if demand+1 > 1000 or if a dependency is in the same wave (`:46-52`);
   - runs the topology (`:74`);
   - then **always spawns 1 scribe agent** (`:84-95`).
4. **callRole** (`topologies/shared.ts:171-189`): `ctx.rt.agent(prompt, { label, schema })` (`:182`; bundle `dispatch.js:284`). **No `model`, `effort` or `phase` is ever passed.** `AgentOptions` declares `effort?` and `phase?` (`types.ts:129-134`), but nothing sets them, so every role agent inherits the session default model and effort. `grep model|effort` over src, workflows and skills finds only `types.ts:133`.
5. Concurrency: the runtime queues past the cap. The effective cap is min(16, nproc-2), which is 2 on a 4-CPU cloud box (ADR-0002 `0002-topologies-as-workflow-scripts.md:19`; spike item 3). Each dispatch is its own run with its own cap (ADR-0003 `:23`). Demand is logged and never refused (`catalog.md:14`).

## 3. Per topology: agent count (excluding the +1 scribe) and what each prompt adds

The catalog states the demand per topology. The code's demand functions are what is logged and checked.

| topology | demand (code) | defaults → agents | sequential depth (latency) | file:line |
|---|---|---|---|---|
| single | 1 | 1 | 1 | `topologies/single.ts:21` |
| generator-evaluator | 2 × max_iterations (upper bound) | 3 → 6 | 2 per round, all sequential | `generator-evaluator.ts:73-76`, DEFAULT_ITERATIONS=3 `shared.ts:16` |
| fan-out | width (+1 partition) (+1 reducer) | instruction split → 3+1(+1) | partition → branches ∥ → reducer = up to 3 | `fan-out.ts:176-184`, DEFAULT_WIDTH=3 `shared.ts:18`, MAX_WIDTH=9 `:14` |
| chain | sum of stage demands | — | sum of stage depths | `chain.ts:45-51` |
| relay | max_sessions + ceil(max_sessions/check_every) | 3 → 6 | fully sequential | `relay.ts:29-33`, DEFAULT_SESSIONS=3, MAX=10 `shared.ts:20-21` |
| best-of-n | n + 1 | 3 → 4 | attempts ∥ → judge = 2 | `best-of-n.ts:61-65` |
| iterative-fan-out | rounds×width + rounds + 1 (+1 partition) | 2×3+2+1(+1) → 9-10 | per round: branches ∥ → evaluator; then reducer | `iterative-fan-out.ts:47-52`, DEFAULT_GAP_ROUNDS=2, MAX=3 `shared.ts:23-24` |
| panel | k lenses (+1 reducer) | k (≤6) | lenses ∥ → reducer | `panel.ts:42-49`, MAX_PARTICIPANTS=6 `shared.ts:15` |
| debate | participants × rounds + 1 | 2×2+1 → 5 (max 6×4+1 = 25) | rounds sequential, debaters ∥ within a round, then judge | `debate.ts:44-50`, DEFAULT_ROUNDS=2 `shared.ts:17`, MAX_DEBATE_ROUNDS=4 `:26` |
| (every dispatch) | +1 scribe | +1 | +1 sequential at the end | `run.ts:84-95` |

How many of those agents run in practice:
- **generator-evaluator** stops at the first pass (`generator-evaluator.ts:57`).
- **relay** stops at the first passing check (`relay.ts:97`).
- **best-of-n vote mode** skips the judge when a strict majority exists (`best-of-n.ts:142-155`).
- **iterative-fan-out** stops on a pass or on a stall, meaning the evaluator named no new sub-task (`:161-171`).
- **debate** always runs every round (`catalog.md:239`).

### Role prompt assembly: `buildPrompt` (`roles.ts:117-155`)

Every role agent gets the same skeleton, in this order:
- `ROLE:`
- the stance (3 lines, `roles.ts:74-104`)
- `TASK:`
- `CONTEXT:` (all of `spec.context`, plus any inherited or forwarded lines)
- `SKILL:` (a one-line "load the skill" instruction, which tells the agent to load it; `:127-132`)
- `INSTRUCTIONS:`
- the topology sections
- `ARTIFACTS:` (the dir is `scratch`)
- `RETURN:` (maxLines + shape)
- `BLOCKED:`

The fixed overhead is about 15 lines. The variable size comes from the context lines, the instructions, and the sections below. The output schemas are set in `ROLE_SCHEMAS` (`roles.ts:34-72`):
- evaluator feedback: 10 lines or fewer
- judge reasoning: 5 lines or fewer
- debater position: 8 lines or fewer

Topology sections (these decide prompt growth):
- **generator-evaluator**:
  - The generator gets PASS CRITERIA. From round 2 it also gets FEEDBACK and the paths to its own previous artifacts; its previous inline output is deliberately omitted (`generator-evaluator.ts:19-21`).
  - The evaluator gets PASS CRITERIA and SUBMISSION (the cut result plus artifact paths) (`:40-51`).
  - The evaluator's contract is hard-coded at 10 lines (`:45`).
- **fan-out**:
  - The partition agent is a worker with the PARTITION INSTRUCTION and a schema of at most `width` sub-tasks (`fan-out.ts:22-45`).
  - Each branch is a worker with its sub-task and the extra context line "branch i of n … parent task" (`:76`).
  - Branch contract: the full contract when there is a reducer, otherwise floor(maxLines/n) (`:136`).
  - The reducer gets BRANCH RESULTS: every branch's full cut result, its artifacts, and any GAPs (`:149-157`).
- **chain**: each stage's context is the parent's context, then the stage's own, then the forwarded lines (status, first line of the result, artifact paths; `shared.ts:66-68`, `chain.ts:7-11,22-23`). Context therefore grows by about 2 lines per stage.
- **relay**:
  - Workers get SESSION s of N, PROGRESS path, DONE CRITERIA, ARTIFACTS SO FAR (a union that grows with every session), and LAST CHECK FEEDBACK (`relay.ts:55-61`).
  - The evaluator gets DONE CRITERIA and SUBMISSION (`:87-90`).
- **best-of-n**:
  - Each attempt gets ATTEMPT i of n, APPROACH (when variants are given), CRITERIA, and CANDIDATE DIR (`best-of-n.ts:108-113`).
  - The judge gets CRITERIA, every candidate's full cut result and artifacts, BLOCKED ATTEMPTS, and CHOICE (`:158-165`), with schema `chosen` (`:71-78`).
- **iterative-fan-out**:
  - The evaluator sees FINDINGS SO FAR, but only the **first line** of each branch (`findingsText(…, false)`, `iterative-fan-out.ts:139`), which is a quality risk for judging coverage.
  - The reducer sees every branch of every round **in full**, plus OPEN GAPS (`:177-178`). This is the largest input prompt in the plugin: up to 3×9 branches × 20 lines.
  - Gap sub-tasks are cut to `width` per round (`:172-173`).
- **panel**:
  - Each lens gets LENS name/focus, PASS CRITERIA, and SUBMISSION. SUBMISSION is just "the artifact(s) named in CONTEXT", so the evaluators must re-read the artifacts themselves (`panel.ts:84-88`).
  - A lens skill overrides the evaluator skill (`:71-72`).
  - The reducer gets VERDICT, PASS CRITERIA and LENS FEEDBACK (`:132-136`).
- **debate**:
  - Debaters get STANCE, YOU ARE, and from round 2 the PRIOR ROUND positions of all participants (all-to-all; `debate.ts:77-81`).
  - The judge gets PARTICIPANTS and the full TRANSCRIPT of every round, kept inline (`:116-119`).
  - POSITION_LINES=8 (`debate.ts:7`).

## 4. Scribe and trace writing

- One scribe **agent** per dispatch, always, including dispatches that were refused or failed (`run.ts:74-95`). It is a full LLM agent whose only job is appending JSON lines to `<scratch>/trace/<id>.jsonl` (`run.ts:27-37` scribePrompt, `:23-25` traceFileOf; bundle `dispatch.js:1213,1259`).
- It runs **sequentially after** the topology, so it adds one agent spin-up of latency to every dispatch. The scribe also takes a slot in the concurrency queue.
- The reason a whole agent is used: a Workflow script has no filesystem access (ADR-0002 `:16`).
- If the scribe fails, the dispatch returns `scribe: null` and the result is kept (`run.ts:90-95`; `SKILL.md:102`).
- The scribe's line count is checked but never retried (`:89`).
- The trace content written per dispatch:
  - the `humans` interventions,
  - the chain stage events,
  - one dispatch event (`run.ts:77`; `dispatchEvent` `shared.ts:191-206`).
- The renderer runs once at the end of the session, from the orchestrator (`SKILL.md:135`; `PR/scripts/render-trace.js`; source `src/trace/`).

## 5. Result truncation (the inline ceiling)

- `MAX_LINES = 20` (`shared.ts:13`). `contractOf` clamps `returns.maxLines` to 1..20 and defaults to 20 (`shared.ts:71-76`).
- `cutLines` truncates by **line count only, not characters** (`shared.ts:55-59`). A single very long line passes through whole, so token size is not bounded.
- Every working output is cut in `readWorkOutput` (`shared.ts:135-139`). Cuts are silent: nothing marks that a result was truncated.
- Fan-out without a reducer gives each branch floor(maxLines/n) lines (`fan-out.ts:136`). Panel's reducer gets maxLines-1 (`panel.ts:120`).
- **exhausted** results give up their last line to a `-- exhausted …` tail line (`generator-evaluator.ts:62-70`, `relay.ts:102-104`, `iterative-fan-out.ts:191-192`).
- Debate appends `-- decisive:` only when a line is free (`debate.ts:129-132`).
- **Chain forwards only the first line** of each stage's result, plus its artifact paths (`shared.ts:66-68`). The final result is the last stage's (`chain.ts:42`).
- `docs/v2.md:3-4` defers contract validation and file-returned results to v2. Today a contract violation is just truncated.

## 6. Orchestrator-side cost (in SKILL.md)

- Every dispatch result lands in the orchestrator's window, at up to 20 lines each. With a 9-dispatch wave, that is up to about 180 lines per wave (`SKILL.md:77,102,149`).
- The orchestrator reads catalog.md once: 258 lines, about 18 KB (`SKILL.md:17`).
- Context hygiene rule (`SKILL.md:74`): "If `context` is longer than `task`, you are pasting your window into the prompt."
- Skills are named, not pasted (`SKILL.md:75`). Each role therefore pays for loading its skill itself, through the SKILL line in the prompt.
- Concurrency limit: dispatches inside a wave cannot depend on each other (`run.ts:49-50`), so the orchestrator must wait for the whole wave before planning the next (`SKILL.md:100`). A rolling frontier is deferred (`docs/v2.md:5`).

## 7. Levers (each place that controls agent count, prompt size, model choice, parallelism or quality)

Agent count
- L1: the `--waves` / `--dispatches` defaults, 16 / 9 (`SKILL.md:27-31`, `:118`).
- L2: the topology choice heuristics (`SKILL.md:71`) and the "Use when" lines in the catalog (`catalog.md:20,44,71,98,126,153,180,208,235`).
- L3: default caps and defaults in `shared.ts:13-26`: MAX_LINES 20, MAX_WIDTH 9, MAX_PARTICIPANTS 6, DEFAULT_ITERATIONS 3, DEFAULT_ROUNDS 2, DEFAULT_WIDTH 3, MAX/DEFAULT_SESSIONS 10/3, MAX/DEFAULT_GAP_ROUNDS 3/2, MAX_DEBATE_ROUNDS 4.
- L4: the per-topology demand functions (§3 table). Demand is logged only and never refused below 1000 (`run.ts:15,47`).
- L5: **one scribe agent per dispatch**, at +1 agent and +1 sequential step each (`run.ts:84-95`). This is replaceable only if the script gains a filesystem, or if the trace lines are returned to the orchestrator and written by the renderer.
- L6: early-stop conditions:
  - generator-evaluator pass (`generator-evaluator.ts:57`)
  - relay `check_every` (`relay.ts:75`)
  - best-of-n `mode: "vote"` (`best-of-n.ts:142`)
  - iterative-fan-out stall (`iterative-fan-out.ts:167`)
  - debate has none: every round always runs (`debate.ts:73`)
- L7: an optional reducer, partition step or judge (`fan-out.ts:111-112,124-127`; `panel.ts:114`).

Model / effort
- L8: `callRole` → `rt.agent(prompt, { label, schema })` (`shared.ts:182`; `dispatch.js:284`). No model or effort is passed, so all roles run on the session default model. `AgentOptions.effort` exists, unused (`types.ts:133`). There is no per-role or per-spec model field in `RoleEntry` (`types.ts:11`). This is the single biggest unexploited cost lever: the scribe, partition and evaluator roles could run on a smaller model or at lower effort.
- L9: the scribe call (`run.ts:85`) is the same: a full default-model agent for a mechanical append.

Prompt size
- L10: `buildPrompt` skeleton and stances (`roles.ts:74-155`).
- L11: `context` passing:
  - the orchestrator's discipline (`SKILL.md:74,78`)
  - chain inheritance of the parent context plus forwarded lines (`chain.ts:7-11`)
  - every role in a dispatch receives the full `spec.context`
- L12: the SKILL line, which makes each agent load the named skill (`roles.ts:127-132`). Its token cost falls on every agent of that role, for example on all 9 branches.
- L13: inputs that grow:
  - reducer BRANCH RESULTS (`fan-out.ts:149`)
  - iterative-fan-out reducer over all rounds in full (`iterative-fan-out.ts:177`)
  - best-of-n CANDIDATES (`best-of-n.ts:158`)
  - debate TRANSCRIPT plus all-to-all PRIOR ROUND (`debate.ts:80,118`)
  - relay ARTIFACTS SO FAR (`relay.ts:59`)
- L14: output schema line limits: evaluator 10, judge reasoning 5, debater 8 (`roles.ts:45,55,66`; `debate.ts:7`).

Parallelism / latency
- L15: one Workflow per dispatch, all launched in one message (`SKILL.md:84`; ADR-0003). Each run has its own concurrency cap: min(16, nproc-2), which is 2 in the cloud (ADR-0002 `:19`).
- L16: `rt.parallel` is used only for fan-out branches (`fan-out.ts:67`), best-of-n attempts (`best-of-n.ts:105`), panel lenses (`panel.ts:69`) and debaters within a round (`debate.ts:75`). Generator-evaluator, relay, chain, the reducer and judge steps, and the scribe are all sequential.
- L17: a wave barrier with no same-wave `dependsOn` (`run.ts:49-50`; `SKILL.md:100`). A rolling frontier is deferred (`docs/v2.md:5`).
- L18 (reliability): the wrapper's `scriptPath` at `${CLAUDE_PLUGIN_ROOT}/workflows/dispatch.js` (`SKILL.md:88`) was refused by Workflow in this session as not readable. Copying the file into SCRATCH worked. Every dispatch depends on this path, and the skill offers no fallback.

Result quality
- L19: return-contract truncation, which is silent, counts lines only, and has a ceiling of 20 (`shared.ts:13,55-59,71-76,135-139`).
- L20: chain forwards only the first line of each stage (`shared.ts:66-68`).
- L21: the iterative-fan-out evaluator sees only the first lines of findings (`iterative-fan-out.ts:139`).
- L22: the panel SUBMISSION is only a pointer to CONTEXT (`panel.ts:87`).
- L23: generator rounds deliberately omit the previous inline output (`generator-evaluator.ts:19-21`; `roles.ts:82`).
- L24: `pass_criteria` falls back to "the task is complete and correct" when missing (`generator-evaluator.ts:10`). `findings.md:23` says criteria must be mechanical.
- L25: tool discipline is stated in the stances but not enforced (`roles.ts:1-6`; `spike-adr0002.md:11`, item 7).
