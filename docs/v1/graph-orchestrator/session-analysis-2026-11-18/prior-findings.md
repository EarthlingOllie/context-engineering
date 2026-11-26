# graph-orchestrator: prior findings baseline (before 2026-11-18)

Built 2026-11-18, read-only. Use it to mark today's findings as **new** or **known**.

**Status key:** `fixed (<commit>)`, `open`, or `decided-against (<where>)`. Deferred-to-v2 and won't-fix decisions count as decided-against.

**Basis for status.**
- `git log` on `graph-orchestrator/` shows the plugin source, skill and catalog last changed in 557e8b1 (2026-11-03).
- After that date, only two commits touch the plugin, both on 2026-11-11: 3096bd5 (removes one SKILL.md line about lead-orchestrator) and a5161eb (changes the repo URL in plugin.json and README).
- `docs/v1/spec.md` last changed in b7fe806 (11-01). CONTEXT.md and the ADRs last changed in 237335c and 557e8b1 (11-03).
- So nothing found by the 11-08 retro (gDC2) has been fixed since. Each "open" item below was also re-checked against the current file at the line cited.

**Sources.**
- **R**: retro session_016jSC3gDC2bAB3AE8BXjvik, 2026-11-08. Final synthesis is result `ee0e29de-c5ef-48e8-b5b1-f0903d8de444`. Subagent handbacks are system `94f83899-c2ca-4427-922c-cf4dac5c9123` and result `ee0e29de` origin. Sub-ids such as R-A4 are handback-only items that the synthesis does not list.
- **E**: `docs/v1/e2e/findings.md`, from the three pre-release runs UC1-UC3 in 661ccd4.
- **U**: the UC2 run's report of 33 document inconsistencies, `git show 661ccd4:docs/v1/e2e/uc2/report.md`. This file was removed from the tree in 3143221.
- **C**: the pre-release `/code-review high` findings C1-C10 (Spec review session cyG3, 2026-10-30).
- **A**: ADRs 0001-0004 and spike-adr0002.md.
- **V**: `docs/v1/graph-orchestrator/docs/v2.md`.
- **T**: open TODOs. A grep for TODO, FIXME, XXX and HACK over `graph-orchestrator/{src,skills,test,README.md}` and `docs/v1` returned none.

**Counts:** 62 open, 19 fixed, 11 decided-against (92 issues; T0 is not counted). The U gaps G1-G12 are listed at the end and not counted.

## Retro gDC2 (2026-11-08)

| id | summary | source | status | evidence |
|---|---|---|---|---|
| R1 | The launch path in SKILL.md fails in cloud sessions (`scriptPath must be a script path this tool returned…`). Agents copy dispatch.js into SCRATCH with Bash, or announce a wave that already failed. | R #1 (fnVU, dQHS, emtE, d6Vc, gfXZ, eSSw) | open | SKILL.md:88 still has `workflow({ scriptPath: '${CLAUDE_PLUGIN_ROOT}/workflows/dispatch.js' })`. README:43 has the same. This session also copied the file (state.md). |
| R2 | The orchestrator breaks "the rule" because nothing sanctions housekeeping, diagnosis or post-compaction work: docker and disk cleanup, pkill, editing state.md with sed or python, and editing source after compaction ($75 session). | R #2; handback A#7, B#4 | open | SKILL.md:15-19 still allows only three exceptions. The state template (SKILL.md:50) has no "after compaction" line, and Red flags has no "Write, not Edit" rule. |
| R3 | The wave model does not fit a rolling ticket frontier. The wave budget was raised to 25, then 40, then 52, and agents invented `-r` continuations. | R #3; handback B#5 | open (also deferred in V, see V3) | SKILL.md:100 says to "integrate once every workflow of the wave has reported". There is no pipeline mode. |
| R4 | No CI or pre-commit hook. A red test was committed through `npm run check \| grep`, and a stale built bundle is caught only by hand. | R #4; handback A#1 | open | The repo has no `.github/` directory and no hooks. |
| R5 | Adding a topology touches about 12 places with no consistency test. The `meta.description` topology list is hand-written. | R #5; handback A#10 | open | build.mjs:7 hand-lists the 9 topologies. No test compares the lists with `TOPOLOGIES`. |
| R5a | The workflow `meta` summary listed 4 topologies after debate shipped. | handback A#10 | fixed (b7fe806) | build.mjs:7 now lists all 9. It is still manual (see R5). |
| R6 | Tests key on display labels, so every label change needs a sed pass over about 8 files. | R #6 | open | ADR-0004 consequences: "Tests key fake agent outputs by label substrings". 4c9f089 added the `roleOf` helper but kept the label keys. |
| R7 | A stop hook was treated as approval for trigger 4 (irreversible action), and a hook forced a WIP commit after the user said "pause". | R #7; handback A#12, B#9 | open | `grep hook SKILL.md` finds nothing. Trigger 4 has no line saying hook output is never a human's answer. |
| R8 | Expensive checks run several times per ticket: the generator, the evaluator and the PR stage each run a 60-90 min suite, so each ticket takes 4-6 h ($1,949 session). | R #8; handback B#1 | open | catalog.md has no guidance on reusing a test log or gating once. |
| R8a | A generator-evaluator burned all 3 rounds on one wording nit. There is no way to mark nits non-blocking. | R #8 (related) | open | catalog.md:48 `pass_criteria` has no severity notion. |
| R9 | Workers poll with `until` loops, leaving 19 orphaned loops that looked like "stalled" workflows. The orchestrator also polled `.output` files. | R #9; handback A#11, B#6 | open | SKILL.md:100 forbids polling only for the orchestrator. roles.ts has no run_in_background or Monitor guidance. |
| R10 | The two-axis review passed while 10 real bugs remained, because there was no standards document and no failure-path tests. | R #10; handback A#2 | open | There is no CODING_STANDARDS.md in the repo. The bugs themselves were fixed: see C1-C10. |
| R10a | Debate dropped the judge's required `reasoning`. | handback A#3 | fixed (b7fe806) | debate.ts:129 now reads `reasoning` into the "decisive" line. |
| R10b | No test asserts that each required role-schema field is either read or dropped on purpose. | handback A#3; R #10 | open | test/ has no schema-coverage test. |
| R11 | Made-up `now` timestamps, because SKILL says "you have no clock", so diagrams show fake times. | R #11; handback A#6 | open | SKILL.md:90 `now: "<ISO timestamp>", // you have no clock`. |
| R11a | maxAgents was hard-coded to 2: the cap is supplied, not measured. | handback A#6 (cyG3 S1) | decided-against (cyG3 S1 "won't fix"; ADR-0002 "slow in the cloud, not broken") | ADR-0002 consequences, last bullet. |
| R12 | Templated dispatches lose their names: six workflows were all shown as "Build the standard ship-one-ticket chain…" (custom ship.js). | R #12; handback B#2 | open | There is no template entry point. `meta.name` must be a literal (README:46). |
| R13 | Agent labels show a 40-character task excerpt instead of the stage or dispatch title, which truncates ticket ids. | R #13; handback B#7 | open | labels.ts:102 `const excerpt = taskExcerpt(parts.task)`. |
| R14 | SCRATCH is taken literally: a worker wrote to `SCRATCH/SCRATCH/orientation.md`. | R #14; handback B#8 | open | SKILL.md:91 example passes `scratch: "SCRATCH"`. Nothing in the code substitutes the path. |
| R15 | The renderer orphans a kickoff or pre-dispatch human node, because the scribe writes humans before the dispatch line. | R #15 | open | render.ts:187 `if (h.dispatch && known.has(h.dispatch))`. |
| R15a | Failed launches leave no trace, and the trace cannot be rendered on demand mid-session (it was never rendered in a 3.5-day run). | R #15; handback B#11 | open | SKILL.md:132 renders only when FRONTIER is empty or a budget stops the session. |
| R16 | The version is hard to find and bumped by hand in 4 places. Five behaviour changes all shipped as 0.3.1. | R #16 | open | 0.3.1 appears in package.json:3, plugin.json:3 and twice in package-lock.json. There is no bump script or test. |
| R17 | The ambiguity trigger was used for a large change of scope (autonomous mode decided to write the tickets itself) when required input was missing. Shared files were logged as "ambiguity". | R #17; handback B#9 | open | SKILL.md is unchanged since 11-03. |
| R18 | `workflows/dispatch.js` appears as the skill `graph-orchestrator:dispatch`, which costs description context in every session. | R #18 | open | It is in this session's skill list ("Not for direct use"). |
| R19 | Doc drift: README says `trace.jsonl`, and spec.md says `wave.js`/`runWave`. | R #19 | open | README:14 "trace.jsonl → Mermaid". spec.md:8, :61, :105, :119 still describe `runWave`/`wave.js`. |
| R20 | Navigation: no CLAUDE.md saying `graph-orchestrator/` is the source and the synced copy is stale; no pointer to `docs/v1/`. A session used the wrong spec path. | R #20; handback A#10 | open | The repo root has no CLAUDE.md. |
| R20a | Install path and mod visibility are unclear: claude.ai sync vs the CLI, user scope does not survive the container, and mods do not render on the web. | handback A#8 | open | README "Install" (line 22) shows only `claude plugin marketplace add/install`. |
| R21 | Environment: no setup script (`npm ci`, dockerd), no CPU or disk preflight before a wave (6 tickets on 4 CPUs), `git push` hung behind the proxy, an unpushed $42 branch was lost. | R #21; handback B#10 | open | SKILL.md kickoff has no preflight. The environment has no setup script. |
| R-A4 | Subagent worktrees branched from `main`, which had no plugin, causing 11 symlink failures and "command too complex" refusals. | handback A#4 | open | Environment issue. No guidance was added. |

## Pre-release end-to-end runs (661ccd4, docs/v1/e2e/findings.md)

| id | summary | source | status | evidence |
|---|---|---|---|---|
| E1 | `pass_criteria` must be mechanical, countable checks. UC3's contradictory criteria were accepted. | E #1 | open | catalog.md:48 "pass_criteria (string, required in practice)" has no countability rule. The retro (R #19) confirms the fix never landed. |
| E2 | The reducer uses "gap" for unverifiable items rather than blocked branches. | E #2 | open | roles.ts:97 "A blocked branch, lens or round is a gap". catalog.md:79 "the reducer is told the gap". |
| E3 | The dotted "resumed after" edge reached same-wave dispatches that had run before the intervention. | E #3 | fixed (661ccd4) | render.ts change plus the test/fixtures/uc3-release.jsonl fixture. |
| E4 | The spec contradicts itself, for example spec.md:76 "ask or guess" against blocked-always-asks. | E #4 | open | spec.md:76 still says "handle blocked results (ask or guess…)". Details in U2. |
| E5 | Paths never exercised live: over_budget, scribe failure, all branches blocked, reducer returning nothing, debate. | E #5 | open | Unit tests only. No later e2e run is recorded in the repo. |
| E6 | findings.md has the typo "found 33, for instance: for instance". | cyG3 assessment of findings.md | open | docs/v1/e2e/findings.md:26. |

## Pre-release code review C1-C10 (cyG3, all fixed before the v1 merge f5ef282)

| id | summary | source | status | evidence |
|---|---|---|---|---|
| C1 | A scribe throw rejected the whole wave. | C | fixed (bb623ac) | |
| C2 | Malformed `humans` threw after the dispatches had run. | C | fixed (907d16c) | |
| C3 | A throwing role agent wiped the accumulated artifacts and iterations. | C | fixed (9390ff5, 9e3d48d) | |
| C4 | parseTrace aborted on a malformed line. | C | fixed (118a344, 37e6eaa) | |
| C5 | A bad `--human` left the trace half-appended. | C | fixed (9efecea) | |
| C6 | A fan-out reducer that returned nothing lost the result. | C | fixed (29f8127) | |
| C7 | The hard limit did not skip refused demand. | C | fixed (a676634) | |
| C8 | A blocked fan-out reducer dropped the branch questions. | C | fixed (d949801) | |
| C9 | A same-wave dependant ran although its dependency was not done. | C | fixed (9a76a45; later replaced by ADR-0003 same-wave → failed, 237335c) | |
| C10 | wave_end status counts were not rendered. | C | fixed (80935b8) | |

## UC2 document inconsistencies (661ccd4 uc2/report.md; U1-U33)

| id | summary | source | status | evidence |
|---|---|---|---|---|
| U1 | The Signature in CONTEXT omits `question` (and chain `stages`). | U #1 | open | CONTEXT.md:40 is unchanged. |
| U2 | spec.md:76 "ask or guess" contradicts blocked-always-asks. | U #2 | open | spec.md:76. |
| U3 | Role "filled with a skill", but `skill?` is optional and roles run without one. | U #3 | open | CONTEXT.md:24 against spec.md:87. |
| U4 | CONTEXT says the orchestrator "never runs a loop", but the spec and SKILL describe its loop. | U #4 | open | CONTEXT.md:8. |
| U5 | spec.md says the scribe is "dispatched", applying Dispatch to a plain agent. | U #5 | open | spec.md:105. |
| U6 | The Topology definition uses "pattern", a word its own Avoid list bans. | U #6 | open | CONTEXT.md:12-13. |
| U7 | The spec and CONTEXT status sets lack `failed`. | U #7 | open | spec.md:95. CONTEXT.md:40. |
| U8 | `question` is "only when blocked", but a done fan-out carries one. | U #8 | open | spec.md:98. |
| U9 | The spec says the orchestrator writes `human` trace lines, but the scribe or renderer writes them. | U #9 | open | spec.md:70 and :110 are unchanged. |
| U10 | The spec's Workflow args `{now, traceFile, maxAgents, dispatches}` do not match the code. | U #10 | open | spec.md:105. The code now takes `{now, scratch, dispatch, humans}` (README:46). The spec is staler than before. |
| U11 | Same-wave `dependsOn` ordering was undocumented in the spec. | U #11 | fixed (237335c, ADR-0003) | Same-wave waiting was removed. A same-wave id now returns `failed` (run.ts:49-50, catalog.md:14). |
| U12 | "The 1,000-agent limit is the only hard check", but caps also refuse as over_budget. | U #12 | open | spec.md:105. catalog.md:14 still says "only hard check" while relay, panel and fan-out caps return over_budget. |
| U13 | The spec narrows fan-out `reducer?: role`, but the code accepts `true` or a `roles.reducer`. | U #13 | open | spec.md:103. |
| U14 | The spec says esbuild preserves the meta block, but build.mjs generates it. | U #14 | open | spec.md:113. build.mjs:5-11. |
| U15 | The spec's trace line list omits chain-stage lines and extra fields. | U #15 | open | spec.md:110 is unchanged. Since ADR-0003 it also lists wave_start/wave_end lines that no longer exist. |
| U16 | A missing `pass_criteria` is silently replaced by a default. | U #16 | open | generator-evaluator.ts:10 "the task is complete and correct". |
| U17 | CONTEXT says the scribe's "only job" is dispatch events, but it also writes humans. | U #17 | open | CONTEXT.md:60. |
| U18 | ADR-0001 says each dispatch is an `Agent` call, but it is a Workflow run. | U #18 | open | ADR-0001:6 is unchanged. |
| U19 | ADR-0002 says `/wave` args are a list of specs, against `{now,…}`. | U #19 | fixed (237335c) | ADR-0002 status is now "one run per wave superseded by ADR-0003". |
| U20 | The spec says the spike "passed all seven items", but item 3 was "queue" and item 7 "no". | U #20 | open | spec.md:144. |
| U21 | Spike item 7 is cited for "cannot restrict tools", which it never tested. | U #21 | open | spec.md:106. ADR-0002 consequences. |
| U22 | ADR-0001 says topologies write the trace, but the scribe does. | U #22 | open | ADR-0001 consequences, bullet 2. |
| U23 | spec.md:70 says the orchestrator writes wave-boundary trace lines, but SKILL says it writes only state.md. | U #23 | open | spec.md:70. |
| U24 | Three different budget-overrun behaviours across spec.md:72, spec.md:32 and SKILL. | U #24 | open | SKILL.md:118 "autonomous, record… and stop". spec.md is unchanged. |
| U25 | The spec's state-file headings lack MODE. | U #25 | open | spec.md:74. SKILL.md:50 has MODE. |
| U26 | SKILL's "three exceptions" never permit reading state.md, yet it must be re-read after compaction. | U #26 | open | SKILL.md:15-19 against :59. |
| U27 | "Blocked id in dependsOn so the worker resumes", but a prior-wave dependsOn forwards nothing. | U #27 | open | SKILL.md:111. src uses dependsOn only for the same-wave check (run.ts:49) and the trace. |
| U28 | The spec's DispatchResult has no `stages` field, but the catalog and src return it. | U #28 | open | spec.md is unchanged. catalog.md:106. types.ts:81. |
| U29 | The spec requires full specs as chain stages, but stages may omit fields and inherit them. | U #29 | open | spec.md:103 is unchanged. |
| U30 | catalog says "a blocked role stops its topology", against a fan-out branch that blocks only itself. | U #30 | fixed (b7fe806) | catalog.md:12 adds "except where an entry says a blocked branch or attempt only drops out". |
| U31 | The chain stage id example `w3-s1` does not match the rule `<chain-id>-s<n>`. | U #31 | open | catalog.md:106. types.ts:81 still show `w3-s1`. |
| U32 | The catalog's `failed` definition omits the same-wave dependency, duplicate id and cycle cases. | U #32 | fixed (237335c) | catalog.md:14 now states the same-wave id → `failed` case. The duplicate-id and cycle cases are gone with one workflow per dispatch. |
| U33 | Fan-out's "equal share of maxLines" drops branches when width > maxLines. | U #33 | open | fan-out.ts:136 `max(1, floor(maxLines/n))`, then `cutLines(…, maxLines)` at :145. |

## ADR, spike and v2 decisions

| id | summary | source | status | evidence |
|---|---|---|---|---|
| A1 | Contract validation (reject with feedback and reattempt) is not done in v1. | ADR-0001 consequences; spec.md:132 | decided-against (deferred to v2) | v2.md bullet 1. |
| A2 | Tool discipline is stated, not enforced: roles are prompt fragments, and `agent()` cannot restrict tools. | ADR-0002 consequences | decided-against (v2, "once agent() can…") | v2.md bullet 5. Spike item 7 = no. |
| A3 | The cloud concurrency cap is 2, so wide waves are slow. The env override cannot be set in the cloud. | ADR-0002; spike item 3 | decided-against ("slow, not broken") | ADR-0002 last bullet. |
| A4 | Same-wave dispatches cannot wait on each other. Ordered steps must be a chain. | ADR-0003 | decided-against (by design) | run.ts:49-50. |
| A5 | ADR-0003's "to verify in a live session" items were never closed. Live sessions have since shown that item 2 (an inline wrapper calling `workflow({scriptPath})` on a plugin file) fails in the cloud (see R1). | ADR-0003 "To verify" | open | The ADR text is unchanged since 237335c. |
| A6 | Spike Run C (the env cap override on a local session) never ran, so the claim is unverified. | spike item 3; U gap G4 | open | spike-adr0002.md item 3. |
| A7 | The one-run-per-wave design was superseded. | ADR-0002 → ADR-0003 | fixed (237335c) | ADR-0002 status header. |
| V1 | File-returned results for contracts longer than the inline ceiling. | V; spec.md:133 | decided-against (v2) | v2.md. |
| V2 | Rolling frontier: re-plan as dispatches return. | V | decided-against (v2); re-raised as R3 | v2.md. |
| V3 | Composition beyond chain (fan-out of topologies, nested debate). | V | decided-against (v2) | v2.md. |
| V4 | Ad-hoc topologies defined mid-session. | V | decided-against (v2) | v2.md. |
| V5 | Token and wall-clock budgets: budgets are waves and dispatches only. | V | decided-against (v2) | v2.md. Relevant to any cost finding. |
| V6 | Python port of the loop and topologies. | V; ADR-0001 | decided-against (v2) | v2.md. |
| V7 | Debate topology unbuilt in v1 (spec story 42). | spec; cyG3 | fixed (b7fe806) | src/topologies/debate.ts. |
| T0 | Open TODO/FIXME markers in code or docs. | grep | none found | No TODO, FIXME, XXX or HACK in graph-orchestrator or docs/v1. |

## Not counted: UC2 gaps (one side silent)

These are known but unresolved:
- G1: no glossary entry for budgets or `over_budget`.
- G2: no glossary entry for the 5 triggers.
- G3: "artifact" is undefined.
- G4: Run C never ran (same as A6).
- G5: lead-orchestrator compatibility. Moot now: lead-orchestrator was removed in 3096bd5.
- G6: the `--scratch` flag is not in the spec.
- G7: "assume 2" for maxAgents is not in the spec.
- G8: `dependsOn` semantics are not in the spec.
- G9: the named-workflow claim could not be checked.
- G10: the partition agent and default width 3 are not in the spec.
- G11: what a chain stage inherits is not in the spec.
- G12: the all-branches-blocked outcome is not in the spec.
