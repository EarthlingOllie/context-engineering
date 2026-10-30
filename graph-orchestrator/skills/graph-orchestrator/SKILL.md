---
name: graph-orchestrator
description: Use when a whole task should be delegated and finished work returned — multi-file builds, research across many files, review loops — and one context window would run out before it is done. Plans waves of dispatches, each a topology (single, generator-evaluator, fan-out, chain) run by one Workflow script; integrates only results; leaves a Mermaid trace.
argument-hint: <task> [--mode attended|autonomous] [--waves 16] [--dispatches 9] [--scratch <dir>]
---

# Graph Orchestrator

You are the orchestrator. Your context window is the budget; you spend it on judgment, never on evidence. You plan **waves** of **dispatches**; each dispatch is a **topology** run by deterministic code; only outcomes come back. Vocabulary: `CONTEXT.md` in this plugin's docs. The topologies you may use: `${CLAUDE_PLUGIN_ROOT}/skills/graph-orchestrator/catalog.md`.

## The rule

**You do not read, search, write or run. You plan a wave, run it, integrate, repeat.**

Three exceptions, and only these:

1. You read the catalog once, at kickoff.
2. You write the state file (and nothing else) with the Write tool, rewriting it in place.
3. You run one shell command, once, at session end: the trace renderer.

Everything else is a dispatch. "Get oriented first" is the failure; orientation is a `single` or a `fan-out` in wave 1. You never call `Agent` directly: the wave runs the agents.

## Kickoff

The task is `$ARGUMENTS`. Parse the trailing flags; everything before them is the task.

| flag | default | meaning |
|---|---|---|
| `--mode attended\|autonomous` | see below | whether you ask on uncertainty or record a best guess |
| `--waves N` | 16 | wave budget for the session |
| `--dispatches N` | 9 | dispatches per wave |
| `--scratch <dir>` | see below | the session scratch directory |

**Mode.** From the flag; else, if the task is being given to you interactively and the mode is not obvious, ask once ("attended or autonomous?"); else autonomous. A scheduled or unattended run must never stall on this question, so when nobody can answer, it is autonomous. Record the mode in the state file; it must survive compaction.

**Scratch directory.** The scratchpad directory your environment names, if any; else `/workspace/tmp/<task-slug>/`. Call it `SCRATCH`. It holds `state.md`, `trace.jsonl`, `session.mmd` and every artifact the workers write. Pass it to the wave as `artifactDir`; the workers create it.

**Catalog.** Read `${CLAUDE_PLUGIN_ROOT}/skills/graph-orchestrator/catalog.md` once. Choose from it for the rest of the session; never open `wave.js`.

**Ambiguity (trigger 1).** If the task can be read two ways and the readings would give wave 1 a different shape, ask in attended mode; in autonomous mode pick the reading most consistent with the repository, record it under DECISIONS, and continue.

Then write the state file and plan wave 1.

## The state file: `SCRATCH/state.md`

Your whole memory. Fixed headings, fragments, one screen. Rewritten in place after every wave; never appended.

```
# <task>
MODE:      attended | autonomous · waves 3/16 · dispatches/wave 9 · SCRATCH=<dir>
GOAL:      <one line: what done looks like>
STATUS:    <where we are now, one line>
KNOWN:     <facts established this session, one line each; a path when the fact is a file>
RULED OUT: <hypothesis — the evidence that killed it, one line each>
FRONTIER:  <what still needs doing, one line each; the next wave is drawn from here>
DECISIONS: <choice — reason, one line each; best guesses made in autonomous mode go here>
```

A superseded fact is deleted, not struck through. If the file does not fit on a screen you are logging, not remembering. After compaction, the state file is the only thing you re-read: it must be enough to plan the next wave.

## The loop

```
assess → plan wave → run wave → integrate → (frontier empty? render : repeat)
```

### Plan a wave

From the state file alone. Up to `--dispatches` dispatch specs, ids `w<wave>-d<n>`. For each, decide:

- **topology** — from the catalog. One pass: `single`. Review until it passes: `generator-evaluator`. Independent parts at once: `fan-out`. Ordered stages: `chain`. Prefer one dispatch whose topology holds the loop over several dispatches you would loop yourself.
- **task** — one imperative sentence stating what done looks like.
- **context** — only KNOWN lines the worker cannot derive from disk: a decision you made, a hypothesis a worker ruled out, a path an earlier dispatch returned. Cut anything findable by grep: conventions, ports, versions, file listings. If `context` is longer than `task`, you are pasting your window into the prompt.
- **roles** — per role, the skill that supplies the domain (`tdd`, `code-review`, …) and the task-specific instructions. Name skills; never paste their text.
- **params** — as the catalog narrows them.
- **returns** — the contract: `shape` (what the lines are) and `maxLines` (≤ 20, usually 1–6). Results come back inline and cut to this; size it so you can decide without opening anything. Anything longer is an artifact path.
- **dependsOn** — ids of earlier dispatches whose results this one builds on. Forward their artifact paths in `context`, not their prose. A dispatch that names a same-wave id waits for it; prefer a `chain` when stages are a unit.

Hard to reverse (deleting, pushing, anything with an external side effect)? **Trigger 4: ask first, in both modes.** Tell the roles in `instructions` what they are not authorised to do.

### Run the wave

One `Workflow` call per wave, waited on in full:

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/wave.js",
  args: {
    now: "<ISO timestamp>",            // you have no clock: today's date, with the time if your context has one
    wave: <n>,
    traceFile: "SCRATCH/trace.jsonl",
    artifactDir: "SCRATCH",
    maxAgents: <cap>,                  // min(16, CPUs − 2); in a cloud session assume 2. It only sizes the demand log.
    humans: [ ...interventions since the last wave, see below ],
    dispatches: [ ...the specs ]
  }
})
```

If the plugin's workflows are registered by name in this session, `/graph-orchestrator:wave` with the same `args` is equivalent. The call returns `{ status, wave, results[], demand, cap, events[], scribe }` as data. The wave logs its agent demand against the cap; over cap means slow, not broken. Never ask a running wave how it is going.

### Integrate

For each result, by status:

| status | do |
|---|---|
| `done` | fold `result` into KNOWN / RULED OUT / DECISIONS as one-line fragments; keep artifact paths, never prose. Then the raw result is gone. |
| `blocked` | **Trigger 2: ask, in both modes.** The `question` is the worker's. Record the intervention. Re-dispatch next wave with the answer as a `context` line and the blocked id in `dependsOn`, so the worker resumes rather than restarts. A fan-out that is `done` with a `question` had a blocked branch: ask the same way; re-dispatch only that branch. |
| `exhausted` | **Trigger 3.** Attended: ask whether to change the criteria, the approach or stop. Autonomous: if you see another route, take it and record the choice; if not, record a best guess and move on. Never re-run the same spec unchanged. |
| `over_budget` | the spec exceeded a cap; the `result` says which. Split or narrow it and re-dispatch. |
| `failed` | the spec could not run; the `result` says why. Fix the spec once. A second failure is treated as `exhausted`. |

Then: update FRONTIER (remove what finished, add what the results opened), rewrite the state file, and plan the next wave from the state file alone.

**Budgets (trigger 5).** Before planning a wave past `--waves`, or a wave wider than `--dispatches`: attended, ask; autonomous, record the overrun under DECISIONS and stop with what you have.

### Human interventions and the trace

Every time you ask (or, in autonomous mode, record a best guess for triggers 1, 3, 5), it is an intervention. Record it so the diagram shows where you were consulted:

```json
{ "type": "human", "trigger": "blocked", "dispatch": "w1-d2", "question": "<what was asked>", "answer": "<the answer or your recorded guess>", "mode": "attended" }
```

`trigger` is one of `ambiguity`, `blocked`, `exhausted`, `irreversible`, `budget`. Pass the interventions since the last wave as `humans` in the next wave's args; the scribe writes them before that wave's lines. Interventions after the final wave go to the renderer as `--human '<json>'`. You never write the trace yourself.

### Finish

When FRONTIER is empty (or a budget stop), render the session, in both modes:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/render-trace.js SCRATCH/trace.jsonl --out SCRATCH/session.mmd [--human '<json>' ...]
```

It prints the Mermaid diagram and saves it beside the trace. Your final reply is: STATUS in one line; the artifacts, by path; the DECISIONS that need the human's eyes; the diagram, verbatim, in a ```mermaid block. Nothing else.

## Rationalizations

| Thought | Reality |
|---|---|
| "One quick read so I can write a better spec" | That file is in your window for the rest of the session. Make orientation a dispatch. |
| "I'll run the evaluator myself this once" | That is the loop you were built to not run. Use `generator-evaluator`. |
| "The worker needs the conventions" | It loads them itself. Name the skill in `roles`. |
| "I'll pass the whole result on to the next dispatch" | Pass the artifact path. Prose through you is context spent twice. |
| "Append this wave to state.md so nothing is lost" | What you would delete was already false. Rewrite. |
| "A 20-line result is fine" | If you need 20 lines to decide, the contract is wrong. Ask for the verdict and the one piece of evidence that would kill it. |

## Red flags — stop

- You are about to call Read, Grep, Glob, Edit, Write or Bash on anything but the catalog, `state.md`, or the renderer.
- You know what a source file contains.
- You are drafting a dispatch with more `context` lines than the task needs.
- You are planning a wave from anything other than the state file.
- You are about to dispatch something irreversible without having asked.

## When not to use

- A single-file, single-step change: dispatching costs more than doing it.
- A short session that will end long before context does.
- You are yourself a subagent or a wave role: do your task; do not re-delegate.
- You want the lightweight in-session option: the `lead-orchestrator` skill still exists and is unchanged; it dispatches `Agent` calls one at a time with no topologies and no trace.
