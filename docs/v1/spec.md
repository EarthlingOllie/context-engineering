# Spec: Graph Orchestrator v1

Labels: `ready-for-agent`
Glossary: `CONTEXT.md`. Decisions: ADR-0001 (skill first), ADR-0002 (topologies as one Workflow script, accepted after spike).

## Seams (confirm before implementing)

1. **The wave boundary** — the primary and ideally only seam. `runWave(args, runtime)` is a pure function over an injected runtime `{ agent, parallel, log }`. Tests call it with a fake `agent()` that returns scripted structured outputs and assert on the returned dispatch results and the events handed to the scribe. Every topology, the budget log, blocked short-circuiting and chain composition are tested here. The real `wave.js` is a thin entry that calls `runWave(args, { agent, parallel, log })`.
2. **The trace renderer** — `trace.jsonl` in, Mermaid text out. Tested with fixture trace files.

No seam inside the orchestrator skill: it is prose executed by an LLM and is tested by the dogfood task only.

## Problem Statement

Ollie wants to delegate whole tasks to an agent and get finished work back, but a single agent session runs out of context long before a multi-file, multi-step task is done. The existing `lead-orchestrator` skill mitigates this by discipline (never read, always dispatch) but every loop — generate, review, retry; fan out, collect — still has to be run by the orchestrator itself, step by step, with every intermediate result landing in its context. The orchestrator cannot express "review this until it passes" or "research these five things in parallel and merge" as a single unit of work, so its context fills with coordination noise, and there is no record afterwards of what actually happened.

## Solution

A Claude Code plugin, `graph-orchestrator`, in which the orchestrator is a skill that plans **waves** of **dispatches**, and each dispatch is a **topology** — a reusable control-flow pattern (single, generator-evaluator, fan-out, debate, chain) run by deterministic code inside one Workflow script. The orchestrator chooses and configures topologies from a short **catalog**, hands over the task and the facts the workers cannot derive, waits for the wave, folds the short results into a one-screen **state file**, and plans the next wave. Loops and parallelism happen inside the topology; only the outcome comes back. When the **frontier** is empty, a renderer turns the **trace** into a Mermaid diagram of the session.

## User Stories

1. As Ollie, I want to hand the orchestrator a task in one message, so that I do not have to decompose it myself.
2. As Ollie, I want the orchestrator to choose a topology per sub-task from a catalog, so that review loops and parallel research are expressed as one dispatch rather than many steps.
3. As Ollie, I want to run the orchestrator by slash command with the task as the argument, so that it starts without preamble.
4. As Ollie, I want to say up front whether the session is attended or autonomous, so that it either asks me when unsure or records a best guess and continues.
5. As Ollie, I want the orchestrator to default to autonomous when nobody has said otherwise, so that scheduled runs do not stall.
6. As Ollie, I want the orchestrator to ask me when a task is ambiguous in a way that would change the first wave's shape, so that it does not spend a wave on the wrong reading.
7. As Ollie, I want the orchestrator to ask me when a dispatch comes back blocked on a question only I can answer, so that the worker's question reaches me.
8. As Ollie, I want the orchestrator to ask me when a topology exhausts its iterations and it sees no other route, so that I can redirect rather than it looping.
9. As Ollie, I want the orchestrator to always ask before dispatching anything hard to reverse, so that deletions, pushes and external side effects never happen unattended.
10. As Ollie, I want the orchestrator to stop and ask when it hits the wave or dispatch budget, so that a runaway session cannot burn unbounded agents.
11. As Ollie, I want the orchestrator to keep a one-screen state file that it rewrites in place after every wave, so that its memory survives compaction without becoming a transcript.
12. As Ollie, I want the orchestrator to fold results into the state file as one-line fragments and paths, so that raw worker output never accumulates in its context.
13. As Ollie, I want the orchestrator to forward artifact paths rather than prose when a later dispatch needs an earlier result, so that large results move between workers without passing through it.
14. As Ollie, I want every dispatch to carry only the facts established this session that the worker cannot derive from disk, so that the dispatch prompt stays small and the worker loads its own conventions.
15. As Ollie, I want every dispatch to name a return contract (shape and line limit), so that what comes back is sized for the orchestrator's context.
16. As Ollie, I want every dispatch result to come back inline and within its line limit, so that the orchestrator never has to open a file to decide.
17. As Ollie, I want a `single` topology, so that a plain one-agent task is a dispatch like any other.
18. As Ollie, I want a `generator-evaluator` topology with a configurable iteration cap and pass criteria, so that code or plans are reviewed until they pass without the orchestrator seeing each round.
19. As Ollie, I want the generator to see the evaluator's feedback each round but not its own previous full output, so that each round converges rather than drifting.
20. As Ollie, I want a `fan-out` topology with a configurable width up to 9 and an optional reducer, so that independent sub-tasks run in parallel and merge inside the dispatch.
21. As Ollie, I want fan-out to accept either an explicit list of sub-tasks or a partition instruction, so that I can split precisely or let the workers split.
22. As Ollie, I want a `debate` topology with up to 6 participants, a round count and a mandatory judge, so that contested decisions return a verdict rather than a transcript.
23. As Ollie, I want a `chain` topology whose stages are themselves dispatches, so that "fan out research, then review the synthesis, then write it up" is one dispatch.
24. As Ollie, I want only chain to compose topologies in v1, so that the design does not become a general graph language before it has been used.
25. As Ollie, I want each role inside a topology to have a fixed stance and output shape, with the domain supplied by a skill named at dispatch time, so that the same topology serves code review and plan review.
26. As Ollie, I want a role that hits a question only a human can answer to return blocked and the topology to short-circuit, so that iterations are not burned on an unanswerable task.
27. As Ollie, I want a blocked branch in a fan-out to block only itself, so that the reducer runs over the branches that finished and notes the gap.
28. As Ollie, I want the orchestrator to re-dispatch a blocked task with my answer in its context, so that the worker resumes rather than restarts from nothing.
29. As Ollie, I want the catalog to be a fixed, short description of every topology loaded once at session start, so that the orchestrator can choose without reading implementation.
30. As Ollie, I want the catalog fixed per plugin version, so that ad-hoc topologies become proper additions rather than one-offs.
31. As Ollie, I want wave and per-wave dispatch budgets with defaults of 16 and 9 that I can override at kickoff, so that cost is bounded without being rigid.
32. As Ollie, I want the wave to log its agent demand against the effective concurrency cap, so that I know when a wide wave will be slow in a cloud session.
33. As Ollie, I want each wave's events written to a trace file by a scribe agent at the end of the wave, so that the record exists without the orchestrator ever reading it.
34. As Ollie, I want human interventions recorded in the trace, so that the diagram shows where I was consulted.
35. As Ollie, I want a Mermaid diagram of the session when the frontier is empty, showing waves, dispatches, iteration counts, dependencies, statuses and human interventions, so that I can see how the work actually went.
36. As Ollie, I want that diagram both in the final reply and saved to disk, so that it survives the session.
37. As Ollie, I want the diagram rendered in autonomous mode too, so that unattended runs leave a receipt.
38. As Ollie, I want the topologies written in TypeScript with a typed dispatch spec and result, so that the signature is checked and the planning prompt has a schema to target.
39. As Ollie, I want the TypeScript bundled to one plain `wave.js`, so that it runs in the Workflow runtime, which takes neither imports nor TypeScript.
40. As Ollie, I want the whole thing shipped as a plugin, so that it installs in any project with its skill, catalog, workflow and renderer together.
41. As Ollie, I want the existing `lead-orchestrator` skill to keep working alongside this, so that I have a lightweight in-session option and the two do not drift.
42. As Ollie, I want the first real task run through the orchestrator to be building the `debate` topology itself, so that the design is proven by use before anything else depends on it.

## Implementation Decisions

**Packaging.** A plugin repository, `graph-orchestrator`, containing: the orchestrator skill; the catalog; the Workflow script; the trace renderer; TypeScript source and a build that bundles it. The skill is invoked as a slash command with the task and optional flags as arguments.

**The orchestrator skill.** Prose, executed by the LLM. It carries over the `lead-orchestrator` discipline (never read, search, write or run; dispatch instead) with these changes: its dispatch unit is a wave of dispatch specs handed to the Workflow, not an `Agent` call; its only shell call is the trace renderer at session end; its only writes are the state file and the wave-boundary trace lines. It loads the catalog once. Its loop is: assess → plan wave → run wave → integrate → repeat until frontier empty → render.

**Mode.** Attended or autonomous. Set by a kickoff flag, else by a kickoff question, else autonomous. Recorded in the state file so it survives compaction. Triggers 1, 3 and 5 (ambiguity, exhaustion, budget) become best-guess-and-record in autonomous mode; triggers 2 and 4 (human-only question, irreversible action) always ask.

**State file.** Fixed headings: GOAL, STATUS, KNOWN, RULED OUT, FRONTIER, DECISIONS. Rewritten in place, never appended; must fit on one screen. Lives in the session scratch directory alongside the trace and per-dispatch artifacts.

**Integrate step.** After a wave returns: handle blocked results (ask or guess, queue re-dispatch); fold each done result into KNOWN / RULED OUT / DECISIONS as fragments, never pasted; update FRONTIER; rewrite the state file; plan the next wave from the state file alone. Raw results are treated as gone after this. Results that must carry forward verbatim are referenced by artifact path.

**Dispatch spec and result.** From the design session, the types the planning prompt targets and the Workflow consumes:

```ts
type DispatchSpec = {
  id: string;                        // "w3-d2"
  topology: "single" | "generator-evaluator" | "fan-out" | "debate" | "chain";
  task: string;                      // one imperative sentence
  context: string[];                 // KNOWN lines the worker cannot derive
  roles: Record<string, { skill?: string; instructions: string }>;
  params: Record<string, unknown>;   // narrowed per topology
  returns: { shape: string; maxLines: number };   // maxLines ≤ 20
  dependsOn: string[];
};

type DispatchResult = {
  id: string;
  status: "done" | "blocked" | "exhausted" | "over_budget";
  result: string;                    // ≤ maxLines, always inline
  artifacts: string[];
  question?: string;                 // only when blocked
  iterations: number;
};
```

Chain narrows `params` to `{ stages: DispatchSpec[] }`. Fan-out: `{ width ≤ 9, reducer?: role, split: string[] | partition instruction }`. Generator-evaluator: `{ max_iterations = 3, pass_criteria }`. Debate: `{ participants ≤ 6 with stances, rounds = 2, judge: role (required) }`.

**The Workflow script.** One script, invoked once per wave with `{ now, traceFile, maxAgents, dispatches }` as structured args. It cannot read the clock, the filesystem or the shell; the orchestrator supplies `now`. All topologies are functions in this one file because scripts cannot import and concurrent runs are undocumented. The core is `runWave(args, runtime)` with the runtime (`agent`, `parallel`, `log`) injected, so topologies are testable without the harness. It runs dispatches in parallel, collects events in memory, and finishes by dispatching a scribe agent that appends the events to the trace file in one write. It logs total agent demand against the effective cap and does not refuse a wave; the runtime queues over-cap agents safely (spike item 3). The 1,000-agents-per-run runtime limit is the only hard check.

**Roles.** Six prompt fragments — worker, generator, evaluator, judge, reducer, debater — each a stance plus a structured-output schema. `agent()` cannot name an agent definition or restrict tools (spike item 7), so tool discipline is stated in the stance, not enforced. The dispatch-time role entry supplies the skill to load and the task-specific instructions; the topology assembles the prompt from stance + task + context + instructions + return contract.

**Blocked handling.** A role's structured output carries `blocked` and `question`. A topology that receives `blocked` stops its loop and returns the dispatch as blocked with the question. In fan-out, only that branch is blocked; the reducer runs over finished branches.

**Trace and renderer.** JSON lines: `wave_start`, one per dispatch (`id, topology, iterations, status`, and for chains the stage statuses), `wave_end`, and `human` lines written by the orchestrator at each intervention. The renderer is a script run once by the orchestrator at session end: waves become subgraphs, dispatches nodes labelled with topology and iteration count, `dependsOn` edges, status as node style, human interventions as nodes. Output to the final reply and to a `.mmd` file beside the trace.

**Build.** TypeScript source; esbuild bundles to a single plain JavaScript file with the `export const meta` block preserved and no runtime imports. The build must run before the workflow is testable in the harness.

**Concurrency.** Effective cap is `min(16, nproc − 2)` by default; the env override is only settable for local sessions. Wide waves in the cloud are slow, not broken.

## Testing Decisions

Good tests here exercise the wave boundary only: feed `runWave` a list of dispatch specs and a fake `agent()` that returns scripted structured outputs, then assert on the returned results, the events the scribe is asked to write, and the prompts the fake agent received (role stance present, context lines present, return contract present). No test inspects internal loop variables.

Modules tested:

- Each topology through `runWave`: single returns one result; generator-evaluator stops on first pass, returns exhausted at the cap, short-circuits on blocked, feeds evaluator feedback into the next generator prompt; fan-out respects width, runs the reducer when given, isolates a blocked branch; debate runs the stated rounds and returns the judge's verdict; chain runs stages in order, passes the prior stage's artifacts forward, and records stage statuses.
- Result shaping: inline result cut to `maxLines`; unknown topology returns a failed result rather than throwing.
- Demand logging: the logged demand matches the sum of each dispatch's agent need.
- The renderer: fixture trace files for a single wave, multiple waves with dependencies, a blocked-then-resumed dispatch, and a human intervention; assert on the Mermaid text.

Prior art: none in this repository yet; the spike script is the shape to start from. The orchestrator skill has no unit tests; its test is the dogfood task.

## Out of Scope

- Contract validation (reject-with-feedback and reattempt) — v2.
- File-returned results for long contracts — v2.
- Rolling frontier; strict wave barrier only.
- Composition beyond chain.
- Tool restriction per role.
- Ad-hoc topologies defined mid-session.
- Token and wall-clock budgets.
- The Python port.
- Any change to the existing `lead-orchestrator` skill.

## Further Notes

- The spike (`Spike ADR0002`) passed all seven items; the spike's `wave.js`, including the chain topology added during the spike, is the seed for the TypeScript source.
- The dogfood task is the acceptance test for v1: "build the `debate` topology" run through the orchestrator — expected to need a fan-out for research, a generator-evaluator for the script, a chain for the catalog entry, and one human intervention on the judge's verdict format.
- Vocabulary in this spec is the `CONTEXT.md` glossary; "workflow" refers only to the Claude Code runtime feature, never to a topology.
