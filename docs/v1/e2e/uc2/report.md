# Orchestrator document inconsistencies (merged, citations verified)

Paths are relative to /home/user/context-management. Short names: spec = docs/v1/spec.md; CONTEXT = docs/v1/graph-orchestrator/CONTEXT.md; ADR-0001 = docs/v1/graph-orchestrator/docs/adr/0001-claude-code-skill-first.md; ADR-0002 = docs/v1/graph-orchestrator/docs/adr/0002-topologies-as-workflow-scripts.md; spike = docs/v1/graph-orchestrator/docs/adr/spike-adr0002.md; SKILL = graph-orchestrator/skills/graph-orchestrator/SKILL.md; catalog = graph-orchestrator/skills/graph-orchestrator/catalog.md; src = graph-orchestrator/src. The debate topology (spec story 42) is deliberately unbuilt and excluded. Every citation below was re-opened against the files on disk; src line numbers reported by the branches against older line counts have been replaced with the current ones.

## spec ↔ CONTEXT (5)

1. CONTEXT.md:40 vs spec.md:97 — Signature's result parts are status, inline result, artifact paths and iteration count; the spec's DispatchResult also carries `question?` (and src/types.ts:55 adds a chain-only `stages?`).
2. spec.md:76 vs CONTEXT.md:48 (also SKILL.md:109) — the Integrate step handles blocked results by "ask or guess", but a blocked result is by definition a question only a human can answer (src/roles.ts:15), which Mode says always asks in both modes; spec.md:72 (trigger 2) and spec.md:29 (story 7) agree with CONTEXT and SKILL against spec.md:76.
3. spec.md:86 vs CONTEXT.md:24 — Role is "filled at dispatch time with a skill and task-specific instructions" and "the domain comes from the skill, never from the role"; the spec's RoleEntry makes `skill?` optional, and the implementation runs a role without one (src/types.ts:11, src/roles.ts:127).
4. CONTEXT.md:8 vs spec.md:70 — Orchestrator "never runs a loop itself" vs "Its loop is: assess → plan wave → run wave → integrate → repeat until frontier empty → render" (SKILL.md:64 states the same loop).
5. spec.md:104 vs CONTEXT.md:16,60 — "finishes by dispatching a scribe agent" applies Dispatch ("one topology instantiated") to the scribe, which CONTEXT defines as a plain agent the wave runs last, not a dispatch.

## CONTEXT ↔ CONTEXT (1)

6. CONTEXT.md:12 vs CONTEXT.md:13 — Topology is defined as "a reusable, parameterised control-flow pattern" and the next line lists "pattern" under Avoid (CONTEXT.md:3 and spec.md:19 repeat the definition's wording).

## spec ↔ src (10)

7. spec.md:94 vs src/types.ts:41-46 (also CONTEXT.md:40, SKILL.md:112, catalog.md:9 and :12, src/topologies/dispatch.ts:42-46, src/wave.ts:112-122,133) — the spec's (and CONTEXT's) status set is `done|blocked|exhausted|over_budget`, but the wave returns, SKILL integrates and the catalog defines a fifth status `failed` for an unknown topology, a malformed spec, a duplicate id, a dependency not `done` or an agent that returned nothing; spec.md:123 itself expects "a failed result", so the spec's own type is out of date.
8. spec.md:97 vs src/topologies/fan-out.ts:129-130, src/types.ts:53 (also catalog.md:79) — `question` is present "only when blocked", but a fan-out that finishes `done` with a blocked branch returns `done` plus `question` (the catalog states this behaviour).
9. spec.md:110 vs src/wave.ts:139, src/types.ts:58-59,76, src/trace/cli.ts:7-8,52 (also SKILL.md:126) — `human` trace lines are "written by the orchestrator at each intervention" (and spec.md:70: "its only writes are the state file and the wave-boundary trace lines"); in src the orchestrator never writes the trace: interventions arrive as `args.humans` and the scribe writes them, or as `--human` which the renderer appends; SKILL.md:126 ("You never write the trace yourself") matches src.
10. spec.md:104 vs src/types.ts:69-77, src/wave.ts:51,55,58 (also SKILL.md:89-95; graph-orchestrator/workflows/wave.js:4) — the Workflow args are exactly `{ now, traceFile, maxAgents, dispatches }`; `WaveArgs` also takes `wave`, `artifactDir` and `humans` (SKILL passes all three and `humans` is load-bearing for the trace), while wave.js:4 `whenToUse` (from build.mjs:8) repeats the spec's four-arg list.
11. spec.md:104 vs src/wave.ts:2-5, :83-126 (also spec.md:133, CONTEXT.md:32) — the script "runs dispatches in parallel"; runWave resolves same-wave `dependsOn`, serialises a dependant behind its dependency, forwards the dependency's status, first line and artifacts into its `context` (src/topologies/shared.ts:47-49) and fails a dependant unrun when its dependency is not `done` (src/wave.ts:117-123) — an intra-wave ordering neither spec.md:133 ("strict wave barrier only") nor CONTEXT.md:32 (a wave "waited on in full before planning again") describes.
12. spec.md:104 vs src/topologies.ts:9-10, src/topologies/fan-out.ts:22,28, src/wave.ts:12-13 (also SKILL.md:111, catalog.md:14, :75, :79; ADR-0002:19) — "The 1,000-agents-per-run runtime limit is the only hard check" and the wave "does not refuse"; a `split` list longer than 9 or a width over 9 is also refused unrun as `over_budget` (SKILL: `over_budget` means "the spec exceeded a cap"; catalog.md:14 repeats the "only hard check" wording and contradicts it in the same sentence with "as does a spec a cap refuses").
13. spec.md:102 vs src/types.ts:31, src/topologies/fan-out.ts:13-14 (also catalog.md:75) — fan-out params narrow `reducer?: role`; the implementation (and catalog) also accept `reducer: true` or a `roles.reducer` entry (`reducer?: boolean | RoleEntry`).
14. spec.md:112 vs graph-orchestrator/build.mjs:5-11,36, src/entry.ts:2-5 — esbuild bundles "with the `export const meta` block preserved"; the TypeScript source has no meta block: build.mjs generates it and prepends it after bundling.
15. spec.md:110 vs src/types.ts:79-93, src/topologies/chain.ts:25, src/topologies/shared.ts:163-176, src/wave.ts:140-143 (also catalog.md:106, spike-adr0002.md:9) — the spec enumerates the trace as wave_start, "one per dispatch" (`id, topology, iterations, status` plus chain stage statuses), wave_end and human; src (as the spike it calls the seed, and as the catalog states) also writes one `dispatch` line per chain stage tagged `parent`, and adds `demand`/`cap` to wave_start and `wave`, `dependsOn`, `question` to dispatch lines; the spec's own renderer sentence needs `dependsOn` edges that its line list never carries.
16. spec.md:102 vs src/topologies/generator-evaluator.ts:10, src/types.ts:28 (also catalog.md:48) — the spec makes `pass_criteria` a required param with no default (the type agrees); the catalog says "required in practice"; the implementation silently substitutes "the task is complete and correct" when it is missing, so neither document states the actual behaviour.

## CONTEXT ↔ src (1)

17. CONTEXT.md:60 vs src/wave.ts:139 — Scribe's "only job is to write the wave's trace events", but it also writes the human interventions recorded since the previous wave (src/types.ts:76, src/wave.ts:57-59).

## spec ↔ ADR-0001 (1)

18. 0001-claude-code-skill-first.md:6 vs spec.md:70 — ADR-0001 describes the chosen design as "a Claude Code skill where each dispatch is an `Agent` call"; the spec says the dispatch unit is a wave of specs handed to the Workflow, "not an `Agent` call" (0002-topologies-as-workflow-scripts.md:8 and SKILL.md:21 agree with the spec).

## spec ↔ ADR-0002 (1)

19. 0002-topologies-as-workflow-scripts.md:8 vs spec.md:104 (also spike-adr0002.md:6, 0002-topologies-as-workflow-scripts.md:16) — the ADR says `/wave` is invoked "with the list of dispatch specs as `args`"; the spec, spike item 2 and the ADR's own line 16 have `args` as `{ now, traceFile, maxAgents, dispatches }` with the timestamp inside it.

## spec ↔ spike (2)

20. spec.md:143 vs spike-adr0002.md:7,11 — the spec says the spike "passed all seven items"; the record marks item 3 as "queue" with "Run C not performed … behaviour change untested" and item 7 as "no", not "pass".
21. spec.md:106 vs spike-adr0002.md:11 (also 0002-topologies-as-workflow-scripts.md:17) — the spec cites spike item 7 for "`agent()` cannot name an agent definition or restrict tools"; item 7 only tested whether a `.claude/agents` definition loads, never tool restriction (ADR-0002:17 asserts the same without evidence).

## ADR-0001 ↔ ADR-0002 (1)

22. 0001-claude-code-skill-first.md:11 vs 0002-topologies-as-workflow-scripts.md:16 (also spec.md:104, src/wave.ts:146-150) — ADR-0001 says the session trace "is written to disk by topologies"; ADR-0002 and the spec say one scribe agent writes it once per wave, and in src/wave.ts:146-150 the scribe is the only writer (topologies only collect events, src/topologies/chain.ts:25).

## spec ↔ SKILL (3)

23. spec.md:70 vs SKILL.md:18 (also spec.md:104, src/wave.ts:140-143) — spec: the orchestrator's writes are "the state file and the wave-boundary trace lines"; SKILL: "You write the state file (and nothing else)"; spec.md:104 and src have the scribe append every wave event, wave_start/wave_end included, so the orchestrator and the scribe cannot both write the wave-boundary lines.
24. spec.md:72 vs SKILL.md:116 (also spec.md:32) — spec: trigger 5 (budget) "become[s] best-guess-and-record in autonomous mode" (i.e. continue); SKILL: autonomous budget overrun is "record the overrun under DECISIONS and stop with what you have"; spec.md:32 (story 10) says "stop and ask" with no mode qualifier — three different behaviours.
25. spec.md:74 vs SKILL.md:50 (also spec.md:72) — spec fixes the state-file headings as GOAL, STATUS, KNOWN, RULED OUT, FRONTIER, DECISIONS; SKILL's template adds a MODE line (spec.md:72 wants the mode recorded in the state file but its heading list has no place for it).

## SKILL ↔ SKILL (1)

26. SKILL.md:15-19 vs SKILL.md:59 (also SKILL.md:151) — the "only three exceptions" permit writing state.md (:18) but never reading it, yet :59 requires re-reading it after compaction and :151 allows Read on it.

## SKILL ↔ src (1)

27. SKILL.md:109 vs src/wave.ts:115-116,124-125 — "the blocked id in `dependsOn`, so the worker resumes rather than restarts": only same-wave ids resolve (`firstIndex`); a prior-wave id forwards nothing (it is only recorded on the trace line, src/topologies/shared.ts:171) and a fresh agent starts from the `context` line alone.

## spec ↔ catalog (2)

28. spec.md:92-99 vs catalog.md:108 (also catalog.md:9, src/types.ts:55, src/topologies/chain.ts:35,42) — the spec's DispatchResult (and the catalog's own common out-signature at :9) has no `stages` field; catalog.md:108 says a chain returns "plus `stages` statuses", and src returns `stages: ["…:done", …]`.
29. spec.md:102 vs catalog.md:102 (also catalog.md:115-116, src/topologies/chain.ts:8, src/topologies/shared.ts:59-81, spec.md:81-90) — the spec narrows chain params to `{ stages: DispatchSpec[] }`, full specs with id, context, returns and dependsOn all required (spec.md:81-90); the catalog says a stage may omit `id`, `context`, `returns` and `dependsOn` and inherit them (the :115-116 example does so); src defaults the missing fields.

## catalog ↔ catalog (2)

30. catalog.md:12 vs catalog.md:79 — "a blocked role stops its topology" vs a blocked fan-out branch "blocks only itself: the dispatch is still `done`" (src/topologies/fan-out.ts:84-98,129-130 implements :79).
31. catalog.md:106 vs catalog.md:102 (also src/topologies/chain.ts:8, src/types.ts:55, spike-adr0002.md:9) — the chain trace example shows stage ids `w3-s1:done`, but the stated rule `<chain-id>-s<n>` (and chain.ts:8, `${parent.id}-s${index + 1}`) yields `w3-d1-s1`; src/types.ts:55 and the spike repeat the short form.

## SKILL ↔ catalog (1)

32. catalog.md:12 vs SKILL.md:77 (also SKILL.md:112, src/wave.ts:112,114,122) — the catalog defines `failed` only as unknown topology / bad params / an agent that returned nothing or threw; SKILL and src also return `failed` for a same-wave dependency not `done`, a duplicate id and a dependsOn cycle.

## catalog ↔ src (1)

33. catalog.md:79 vs src/topologies/fan-out.ts:65,102 — "each branch given an equal share of `maxLines`" holds only while width ≤ maxLines: each branch gets `max(1, floor(maxLines / n))` lines and the concatenation is then cut to `maxLines`, so with 9 branches and maxLines 4 branches 5-9 vanish from the inline result.

## Gaps (one side silent or unverifiable; not counted as findings) (12)

G1. spec.md:53 vs CONTEXT.md — wave and per-wave dispatch budgets (and the `over_budget` status at spec.md:94, which the implementation uses for caps and the 1,000-agent limit, not the kickoff budgets) have no glossary entry.
G2. spec.md:72 vs CONTEXT.md — the five intervention triggers (ambiguity, blocked, exhausted, irreversible, budget; src/types.ts:62) are numbered in the spec but have no glossary entry.
G3. spec.md:96 vs CONTEXT.md — "artifact" (paths forwarded between dispatches, spec.md:35, :76) is used throughout the spec and the Signature entry but is not defined.
G4. spike-adr0002.md:7 — Run C never ran, so the 0002-topologies-as-workflow-scripts.md:19 / spec.md:114 claim that the env override is settable on a local session is unverified anywhere (the spike only shows a cloud session cannot set it).
G5. spec.md:41,139 and 0001-claude-code-skill-first.md:6 — rely on the existing `lead-orchestrator` skill (docs/v1/lead-orchestrator-skill.md); compatibility with it is outside the compared documents and src.
G6. SKILL.md:32 vs spec.md:68 — SKILL adds a `--scratch <dir>` kickoff flag; the spec names only mode and budget overrides.
G7. SKILL.md:93 vs spec.md:114 — SKILL tells the orchestrator to "assume 2" for maxAgents in a cloud session; the spec gives only `min(16, nproc − 2)` and an env override.
G8. SKILL.md:77 vs spec.md:89 — SKILL gives `dependsOn` same-wave semantics (wait, forward artifacts, `failed` unrun); the spec types the field without semantics (src/wave.ts:83-126 implements SKILL's).
G9. SKILL.md:100 vs spec.md:68 — SKILL offers `/graph-orchestrator:wave` with the same `args` as an equivalent invocation; the spec has no named-workflow registration, graph-orchestrator/.claude-plugin/plugin.json registers no workflows, and only workflows/wave.js:2 `name: 'wave'` exists, so the claim could not be checked.
G10. catalog.md:75,77 vs spec.md:43,102 — the catalog describes a partition agent (+1 demand) and a default width of 3 for a partition instruction; the spec only says "let the workers split" and gives no default (src/topologies/fan-out.ts:27-58 uses the `worker` role for the partition and shared.ts:14 DEFAULT_WIDTH = 3).
G11. catalog.md:102,106 vs spec.md:122 — the catalog says a stage inherits the chain's context and return contract and gains the prior stage's status and first result line; the spec only mentions passing "the prior stage's artifacts forward" (src/topologies/shared.ts:47-49 forwards status, first line and artifacts).
G12. catalog.md:79 vs spec.md:49,108 — the catalog defines the all-branches-blocked and blocked-reducer outcomes; the spec covers only the single-blocked-branch case (src/topologies/fan-out.ts:95-98,119 match the catalog).

## Removed in verification

Twelve draft findings were dropped: four Avoid-list items where the word plausibly named something else (spec.md:36 and SKILL.md:73 "prompt" can mean the role prompt the topology assembles, spec.md:106; spec.md:106 "agent definition" names a `.claude/agents` file, not a Role; spec.md:76 "queue" is a verb, not the Frontier) and two more of the same kind (dispatch.ts `REGISTRY` is the implementation table, not the Catalog; SKILL.md:34 "flag" names the `--mode` flag, as spec.md:72 does); one where the spec is silent rather than contradicted (spec.md:122 "respects width" vs the width cap on an explicit list); one duplicate of finding 7 (CONTEXT.md:40 `failed`); one duplicate of gap G4 (ADR-0002:19 env override); one duplicate of finding 18 (ADR-0001:6 "Agent call" as a CONTEXT Avoid breach); one where the catalog makes no claim about a stage's `dependsOn`; and one already covered by catalog.md:12 (all-branches-failed → `failed` is "an agent that returned nothing or threw").

## Blocked branches

None: all five branches completed; no branch-level gap notes are needed.

## Totals

33 findings across 15 document pairs (spec↔CONTEXT 5, CONTEXT↔CONTEXT 1, spec↔src 10, CONTEXT↔src 1, spec↔ADR-0001 1, spec↔ADR-0002 1, spec↔spike 2, ADR-0001↔ADR-0002 1, spec↔SKILL 3, SKILL↔SKILL 1, SKILL↔src 1, spec↔catalog 2, catalog↔catalog 2, SKILL↔catalog 1, catalog↔src 1); 12 gaps. Merged from 73 branch lines (18 + 21 + 13 + 9 + 12) after deduplication; 45 draft findings, 12 removed in citation verification.
