# Topology candidates for the graph-orchestrator catalog

Report date 2026-10-31. Inputs: `repo-topologies.md` (repo definition and catalog, from `docs/v1/graph-orchestrator/` and `graph-orchestrator/` at HEAD f5ef282), `lab-topologies.md` (45 merged lab patterns, numbered #1-#45 below as in its index) and the per-lab notes in `labs/*.md`. The repo was not modified.

**How to read this.** Each of the 45 lab patterns gets exactly one disposition, in exactly one of three places: §2 (already covered by an existing topology), §3 (a ranked new candidate) or §4 (rejected as a topology, with the reason). The tally is in §6. Elsewhere, a pattern named in prose is a cross-reference, not a second disposition.

**Verification caveat (applies throughout).** The lab research is only partly verified. The session's network blocked most lab domains (openai.com, learn.microsoft.com, google.github.io, docs.cloud.google.com, deepmind.google, research.google, arxiv.org, huggingface.co, together.ai, docs.cohere.com, ai.meta.com, docs.langchain.com, docs.crewai.com, llamaindex.ai and others). Of the lab domains, only anthropic.com (with claude.com and code.claude.com) was reachable. github.com and raw.githubusercontent.com were also reachable, so most framework docs were read from their GitHub source repos. Blog posts and papers on blocked hosts are known only from search snippets ([snippet], [search excerpt], [S]) or from model memory ([memory], [M]). Where a ranking leans on such evidence, the entry says so. §5 lists the gaps.

---

## 1. What a topology is in this repo, and the constraints a candidate must meet

**Definition** (`docs/v1/graph-orchestrator/CONTEXT.md:11-13`): "A reusable, parameterised control-flow pattern with a fixed signature and no task-specific content. A template, not a run. Only a chain's stages may themselves be topologies." "Workflow", "pattern", "building block" and "tool" are explicitly not synonyms. "Workflow" refers only to the Claude Code runtime (`spec.md:145`).

A candidate must satisfy these constraints:

| # | Constraint | Source |
|---|---|---|
| K1 | **Fixed signature.** In: `{ id, topology, task, context[], roles{}, params{}, returns{shape,maxLines≤20}, dependsOn[] }`. Out: `{ id, status: done\|blocked\|exhausted\|over_budget\|failed, result, artifacts[], question?, iterations }`. | `catalog.md:7-10`; `src/types.ts:15,46,48` |
| K2 | **Parameterised, no task content.** Task detail arrives through `task`, `context` and role `instructions`. The domain comes from a skill named at dispatch time, never from the role. | `CONTEXT.md:12,23-24`; spec story 25 |
| K3 | **Fixed roles.** Six stances only: worker, generator, evaluator, judge, reducer, debater. A role is filled at dispatch time with a skill and task-specific instructions; it has no model slot. | `src/roles.ts:9`; `spec.md:106`; `CONTEXT.md:23-24` |
| K4 | **Only chain composes.** No other topology may contain topologies in v1. Fan-out of topologies and nested debate are v2. | `CONTEXT.md:12`; ADR-0002:15; `docs/v2.md:6`; spec story 24 |
| K5 | **Caps are enforced, not requested.** MAX_LINES=20, MAX_WIDTH=9, MAX_PARTICIPANTS=6. Defaults: iterations 3, rounds 2, width 3. A spec over a cap returns `over_budget` without spending an agent. The only hard run limit is 1,000 agents. | `shared.ts:9-14`; `catalog.md:14` |
| K6 | **No human in the loop inside a topology.** A blocked role short-circuits the topology, and the orchestrator asks the human. | ADR-0002:18; spec story 26 |
| K7 | **Deterministic control flow.** A topology is a function in the single Workflow script `wave.js`. "Only the topologies are deterministic." | ADR-0002:4-8; ADR-0001:10 |
| K8 | **Catalog fixed per version.** Adding a topology is a proper addition: a `TOPOLOGIES` entry, a `*Params` type, a `TopologyImpl` with `demand()` and `run()`, a REGISTRY entry, a catalog entry and tests. | `catalog.md:3`; spec stories 29-30; `dispatch.ts:17` |

The repo's own choice rule (`SKILL.md:71`): "Prefer one dispatch whose topology holds the loop over several dispatches you would loop yourself." This report uses that rule as the main test of value. A candidate is worth adding when it moves a loop or selection the orchestrator would otherwise run by hand, across waves, into one deterministic dispatch.

---

## 2. Coverage map: lab patterns the existing catalog already covers

The existing topologies are single, generator-evaluator, fan-out and chain (built), plus debate (planned). Debate already has its signature, caps, roles and catalog entry, but its `run` returns `failed` (`catalog.md:124-136`; `debate.ts:11-18`). The aliases column lists what the labs call the same thing.

| Lab # | Lab pattern | Covered by | Aliases | Residual difference (not a new topology) |
|---|---|---|---|---|
| #1 | Single call (augmented LLM) | `single` | augmented LLM; direct model call; simple processor; single-turn agent | none |
| #2 | Agent tool loop (ReAct) | `single` | autonomous agent; single-agent run loop; tool-calling agent; gather-act-verify loop; MultiStepAgent | The tool loop runs inside the worker agent, and topologies only order agents. A `maxTurns` param does not exist; it is a runtime setting, not control flow. |
| #3 | Single loop with progressive disclosure | `single` plus the role's skill | folded subagents; skills pattern; parameterised prompt template; routine as system prompt | The skill named at dispatch time is the repo's progressive-disclosure mechanism (spec story 25). Anthropic's 2026 advice to fold subagents into one loop was read only through a model summary (§5). |
| #5 | Sequential pipeline (prompt chain with gates) | `chain` | prompt chaining; chain subagents; SequentialAgent; sequential orchestration; pipes-and-filters; sequential process; serial chain | Chain's gate is fixed: the first stage that is not `done` stops it. A judged gate is a generator-evaluator stage. Per-stage models are not available (K3). |
| #11 | Parallel fan-out / fan-in (sectioning) | `fan-out` (+ `reducer`) | sectioning; scatter-gather; map-reduce; concurrent orchestration; ParallelAgent; parallel review by lens; Heavy mode | Join is always "all finished or blocked". There is no first-n or any join. Choosing among outputs is candidate C2. |
| #12 | Map over items (batch fan-out, isolated workspaces) | `fan-out` with an explicit `split` list | headless fan-out loop; `/batch`; `pipeline(items, fn)`; `kickoff_for_each`; chunk-parallel map-filter-reduce | Capped at 9 items (K5); more items take several fan-outs in a wave. A per-item sub-topology is v2 "fan-out of topologies" (`v2.md:6`). Worktree isolation is a runtime matter. |
| #16 | Orchestrator-workers (supervisor / agents-as-tools) | `fan-out` with a partition instruction (+ `reducer`); the looping-supervisor form is the graph-orchestrator itself | supervisor; manager pattern; agents-as-tools; subagents; Coordinator; hub-and-spoke; Centralized architecture | The one-shot form (plan, fan out once, synthesise) is exactly a partition-instruction fan-out: the partition agent decides the sub-tasks at run time. The looping form is the orchestrator issuing dispatches wave by wave (Dispatch, `CONTEXT.md:15-16`). The width cap answers the labs' "spawning too many workers" failure. |
| #26 | Evaluator-optimizer (generator-critic loop) | `generator-evaluator` | maker-checker; reflection; Generator-Critic; LoopAgent refinement; LLM-as-a-judge loop; Self-Refine; graded outcome loop | `exhausted` at the cap is the labs' "fallback at cap". A human checker is excluded by K6. |
| #28 | Trial loop with reflection memory (Reflexion) | `generator-evaluator` | Reflexion; verbal reinforcement | The evaluator's feedback conditions the next attempt. Whether lessons from all past rounds accumulate, or only the last, is a param question for generator-evaluator (§5), not a new topology. |
| #30 | Multi-agent debate (symmetric peers) | `debate` (planned) | society of minds; sparse-topology debate; collaborative reasoning (Coral); competing-hypotheses debate; debate block (MASS) | Planned debate has a required judge. Symmetric peers are participants given the same or neutral stances, and the judge stands in for the final vote. See the debate design inputs below. |
| #31 | Adversarial debate with judge | `debate` (planned) | MAD; debate vs consultancy; devil/angel debate | Exact match: `participants: [{name, stance}]` with opposing stances, `rounds`, `judge`. An early-stop rule ("adaptive break") could be a debate param. |
| #33 | Two-agent role-play dialogue | `generator-evaluator` (instructor = evaluator, assistant = generator), or `debate` with 2 participants | conversable pair; CAMEL role-playing; instructor/assistant seminar | Using it to generate conversational data or simulate users is out of scope for a task orchestrator. |

**Debate design inputs (for the existing planned spec, not a new proposal).** Building debate is the v1 dogfood acceptance test (`spec.md:144`). The labs give the following inputs for that build:
- **Equal-compute baseline.** Majority voting alone explains most of the gains attributed to debate (Debate-or-Vote, NeurIPS 2025, https://arxiv.org/abs/2508.17536, [S] snippet). Debate's acceptance should be compared against candidate C2 run in vote mode at the same agent count (participants × rounds + 1).
- **Over-agreement.** Models agree more than 90% of the time regardless of correctness (Meta Coral, https://github.com/facebookresearch/collaborative-reasoner; the number is snippet-only). Assigned opposing stances, which the spec already has, are the stated counter.
- **Cheaper communication.** Sparse graphs (a ring instead of all-to-all) match full connectivity at lower cost (https://aclanthology.org/2024.findings-emnlp.427/, [snippet]). This could become an optional `graph` param. It is not needed for v1.
- **Judge bias.** Judges favour debaters that share their backbone (MAD, https://aclanthology.org/2024.emnlp-main.992). Under K3 the repo cannot vary models per role, so stance and skill are its only levers for diversity.

---

## 3. Ranked candidates

Ranking is by value to this repo, not by source. Value means: (a) the candidate moves a loop or selection out of the orchestrator's hands into a topology (`SKILL.md:71`); (b) it serves the plugin's stated use cases (multi-file builds, research across many files, review loops, where one context window runs out); (c) it fits K1-K8 without changing them; (d) the evidence is strong; (e) the build effort is low.

Tiers: **Tier 1** = add next. **Tier 2** = consider. **Tier 3** = watch. Every params, demand and cap value below is a **proposal** written in the catalog's style. None of it is taken from a source.

| Rank | Candidate | Tier | Lab patterns folded in | Fits K1-K8 unchanged? |
|---|---|---|---|---|
| 1 | `relay` | 1 | #29 | Yes, with the evaluator done-check. Option (b) would change a role output (K3). |
| 2 | `best-of-n` | 1 | #13, #14 | Yes |
| 3 | `iterative-fan-out` | 2 | #24 | Yes |
| 4 | `panel` | 2 | #32 | Yes. Model diversity would need K3 changed. |
| 5 | `escalation` | 3 | #10 | No. Needs K3 changed (a model per role, a confidence output). |
| 6 | `tree-search` | 3 | #34 | No. Needs K3 changed (a scoring output). |

### C1. `relay` (Tier 1)

- **Aliases:** fresh-context relay loop; initializer + incremental coding-agent relay (Anthropic); Ralph loop (Together, after ghuntley); IterResearch rounds (Tongyi); Discard-all context reset (DeepSeek-V3.2); context reset with structured handoff (Anthropic harness).
- **Lab pattern:** #29.
- **Mechanism:** The same worker stance runs in up to `max_sessions` fresh agents, one after another. Nothing carries over between sessions except artifact paths and a progress artifact that each session reads, advances by one increment and rewrites. An optional initializer session runs first and writes the scaffolding: the progress file and the feature or todo list. The loop stops when the done criteria are met, or returns `exhausted` at the cap.
- **Roles:** `worker` (every session); `initializer` (optional slot, worker stance, session 0); `evaluator` (the done-check; judges `done_criteria` and changes nothing).
- **Params:** `done_criteria` (string, required); `max_sessions` (default 3, proposed cap 10); `progress` (string, required: the path convention for the progress artifact, which the orchestrator fills from the task, so the topology carries no task content); `check` (`"evaluator"` default, or `"every:k"` to check every k sessions).
  ```json
  { "id": "w2-d1", "topology": "relay",
    "task": "Implement every feature in /scratch/features.json until all pass",
    "context": ["feature list written by w1-d1"],
    "roles": { "worker": { "skill": "tdd", "instructions": "one failing feature per session; commit; update the progress file" },
               "evaluator": { "instructions": "run npm test; pass only if every feature in the list passes" } },
    "params": { "done_criteria": "all features pass and the progress file says DONE", "max_sessions": 6, "progress": "/scratch/progress.md" },
    "returns": { "shape": "features passing / total, then the last progress line", "maxLines": 3 },
    "dependsOn": ["w1-d1"] }
  ```
- **Demand:** `max_sessions` (+1 initializer) (+`max_sessions` done-checks with `check: "evaluator"`, or ⌈max_sessions / k⌉ with `"every:k"`). This is an upper bound; the loop stops early when done.
- **Returns:** `done` when the check passes (`iterations` = sessions used); `exhausted` at the cap with the last progress line; `blocked` if any role blocks.
- **Use when:** One deliverable is too large for one context window and must be built in order in one place, such as a multi-file feature in a single tree or a long document, where fan-out would collide on the same files and generator-evaluator's "attempt the whole thing, then judge" cycle is the wrong unit.
- **Gap it fills:** The plugin exists for work where "one context window would run out before it is done". Today the orchestrator gets that by issuing a `single` per wave and reading progress itself, which the `SKILL.md:71` rule advises against. Generator-evaluator also loops, but each round is a full attempt judged against pass criteria. Relay is incremental progress through an artifact, which the labs describe as the most-cited lever for long single-agent runs (lab-topologies cross-source takeaway 5).
- **Fit:** K1, K2, K4-K8 are met: no composition, and the workers are agents, not topologies. On K3, the done signal must be deterministic. Option (a), recommended: an `evaluator` done-check, which costs agents but changes nothing. Option (b): add a completion flag to the worker stance's output, which changes one of the six fixed stances.
- **Sources:**
  - Anthropic: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents (AN.S7); https://www.anthropic.com/engineering/harness-design-long-running-apps (AN.S9). Both are on anthropic.com, which was reachable, and were read.
  - Together: https://github.com/togethercomputer/together-cookbook/tree/main/agents (Nemotron3Ultra_RalphLoop; OT.T7, read on GitHub).
  - Alibaba/Tongyi: https://github.com/Alibaba-NLP/DeepResearch ; https://arxiv.org/abs/2510.24701 (OT.Q3, [snippet]).
  - DeepSeek: https://arxiv.org/abs/2512.02556 (OT.D1, [snippet]).
- **Evidence strength:** Moderate. The mechanism was read in primary text from two labs (Anthropic S7, Together T7). Anthropic's evidence is qualitative: browser testing "dramatically improved" performance, and S7 leaves open whether specialised QA agents would do better. The only number, DeepSeek Discard-all at 67.6 on BrowseComp, is snippet-only and measures a single-agent context reset, not a multi-session relay.
- **Effort / risk:** Low to medium effort; the loop has the same shape as generator-evaluator's. The main risk is premature "victory", the failure mode S7 names, which the evaluator done-check mitigates. Cost grows linearly with sessions.

### C2. `best-of-n` (Tier 1)

- **Aliases:** best-of-N picker (OpenAI parallelization example); Redundant pattern (AG2); diverse solvers + evaluator; rubric-gated parallel drafts (Managed Agents); self-consistency; parallelization: voting (Anthropic, LangGraph); claim voting (`/deep-research`); majority-rule concurrent aggregation (Microsoft); parallel-fewest-step (DeepSeek); aggregate block (MASS); "drafting a plan from several independent angles and weighing them" (a shape named in the Claude Code workflows docs).
- **Lab patterns:** #13 (sample-and-vote) and #14 (best-of-N with judge), folded together because they differ only in the selection rule.
- **Mechanism:** n isolated workers attempt the *same* task in parallel. Each can optionally get a different approach hint. A `judge` then either selects the best candidate or synthesises one, against the criteria. In `vote` mode, code tallies identical first result lines with no agent, and the judge runs only when there is no majority.
- **Roles:** `worker` (each attempt); `judge` (the existing stance, which planned debate also uses; returns the verdict).
- **Params:** `n` (≤ 9, reusing MAX_WIDTH; default 3); `variants` (optional list of length n of generic approach hints, such as "minimal change" or "restructure"); `criteria` (string, required); `mode` (`"select"` default, `"synthesize"` or `"vote"`).
  ```json
  { "id": "w3-d2", "topology": "best-of-n",
    "task": "Propose a fix for the flaky trace-renderer test",
    "context": ["failing test and log at /scratch/flake.md"],
    "roles": { "worker": { "skill": "diagnosing-bugs", "instructions": "write the patch to a new file; do not apply it" },
               "judge": { "instructions": "pick the patch most likely to remove the root cause with the smallest diff" } },
    "params": { "n": 3, "variants": ["minimal change", "fix the timing assumption", "restructure the test"], "criteria": "root cause addressed; no new flakiness; smallest diff", "mode": "select" },
    "returns": { "shape": "path of the chosen patch, then one line why", "maxLines": 2 },
    "dependsOn": [] }
  ```
- **Demand:** n + 1. In vote mode it is n, plus 1 only when there is no majority.
- **Returns:** `done` with the judge's verdict (or the vote winner) and all candidates' artifacts; `blocked` if the judge blocks or every worker blocks.
- **Use when:** Several approaches are viable and a wrong pick is costly (a design, a risky fix). Also for binary or extractable decisions where repeated attempts raise confidence. Also as the equal-compute baseline before paying for debate.
- **Gap it fills:** Fan-out runs *different* sub-tasks and its reducer *merges* them. Nothing in the catalog runs the *same* task n times and *chooses*. The catalog already improvises this shape: debate's documented stand-in is "generator-evaluator or fan-out + reducer" (`catalog.md:124-136`), and fan-out's own use-when lists "N candidate approaches". A judge stance already exists, and no built topology uses it yet. The lab evidence that voting explains most of debate's gains makes this the baseline debate must beat (§2, debate design inputs).
- **Fit:** K1-K8 are met unchanged, with no composition. The vote tally is deterministic code (K7).
- **Sources:**
  - Anthropic: https://www.anthropic.com/engineering/building-effective-agents (AN.S1, read); https://code.claude.com/docs/en/workflows (AN.D4); https://claude.com/blog/new-in-claude-managed-agents (AN.S11).
  - OpenAI: https://github.com/openai/openai-agents-python/tree/main/examples/agent_patterns (OA.S6, read on GitHub).
  - Microsoft / AG2: https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns (MS.M1, read from its GitHub source); https://docs.ag2.ai/latest/docs/user-guide/advanced-concepts/pattern-cookbook/overview/ (MS.M18) and https://github.com/ag2ai/ag2/blob/main/website/docs/user-guide/network/pattern_cookbook/pattern_cookbook.mdx (MS.M19), read on GitHub.
  - LangChain: https://docs.langchain.com/oss/python/langgraph/workflows-agents (FW.L7, read from GitHub source).
  - Google: https://research.google/pubs/multi-agent-design-optimizing-agents-with-better-prompts-and-topologies/ (MASS, [snippet]); https://arxiv.org/abs/2203.11171 (self-consistency; GO tags it [memory], AC lists it as P2).
  - DeepSeek: https://arxiv.org/abs/2512.02556 ([snippet]).
  - Academic: https://arxiv.org/abs/2508.17536 (Debate-or-Vote, [S]).
- **Evidence strength:** Strong for the mechanism. It was read in primary text from Anthropic, OpenAI, Microsoft and AG2, and appears in 6+ labs. Moderate for the numbers: Debate-or-Vote, MASS and DeepSeek are snippet-level.
- **Effort / risk:** Low effort; it reuses fan-out's branch machinery plus one judge call. The risks are n-fold cost, and near-duplicate candidates when all workers share one model (K3). Variants are the only diversity lever, though Self-MoA suggests that same-model samples are not a handicap.

### C3. `iterative-fan-out` (Tier 2)

- **Aliases:** deep-research gap loop; lead researcher with follow-up subagents (Anthropic); planner-workers-writer-verifier research bot (OpenAI); plan-search-reflect (Together Open Deep Research); agentic multi-stage RAG (Cohere); Open Deep Research (HF); find-until-saturation (a shape named in the Claude Code workflows docs).
- **Lab pattern:** #24.
- **Mechanism:** Round 1 is a fan-out. After each round, an `evaluator` checks the accumulated findings against coverage criteria and returns pass, or numbered follow-up sub-tasks (the gaps). The next round fans out over those gaps. The loop stops on pass, when a round produces no new sub-tasks (borrowing the docs' "stop when two rounds in a row find nothing new"), or at `max_rounds`. A `reducer` then writes the synthesis. Writing and citation steps are left out on purpose: they compose as `chain [iterative-fan-out, generator-evaluator]`.
- **Roles:** `worker` (every branch); `evaluator` (the gap check; its feedback lines become the next round's split); `reducer` (required; the final merge).
- **Params:** `split` (as in fan-out: a list, or a partition instruction); `width` (≤ 9 per round); `coverage_criteria` (string, required); `max_rounds` (default 2, proposed cap 3).
  ```json
  { "id": "w1-d3", "topology": "iterative-fan-out",
    "task": "Map every place the codebase reads or writes the trace file",
    "context": [],
    "roles": { "worker": { "instructions": "cite file:line" },
               "evaluator": { "instructions": "list each module or call path not yet covered as one follow-up sub-task per line" },
               "reducer": { "instructions": "one line per call site, grouped by module" } },
    "params": { "split": "one branch per top-level directory under src/", "width": 6, "coverage_criteria": "every import of the trace module is accounted for", "max_rounds": 2 },
    "returns": { "shape": "path of the findings note, then the count of call sites", "maxLines": 2 },
    "dependsOn": [] }
  ```
- **Demand:** `max_rounds` × `width` + `max_rounds` (gap checks) + 1 (reducer) (+1 for a partition instruction). For example, width 6 over 2 rounds is 12 + 2 + 1 + 1 = 16. This is an upper bound.
- **Returns:** `done` with the reducer's result; `exhausted` if the cap is hit with gaps still listed, keeping the reducer's result and the open gaps; branch-blocking behaves as in fan-out.
- **Use when:** Research across many files or sources where some gaps only show up after the first pass.
- **Gap it fills:** Today a fan-out's reducer can report gaps, but closing them takes another wave planned by the orchestrator. That loop lives in the orchestrator's context, against `SKILL.md:71`. Chain cannot loop.
- **Fit:** K1-K8 are met. The branches are worker agents, not topologies, so K4 holds. It needs one convention: evaluator feedback is read as one sub-task per line. That uses the existing stance; no new stance is needed.
- **Sources:**
  - Anthropic: https://www.anthropic.com/engineering/multi-agent-research-system (AN.S2, read); https://code.claude.com/docs/en/workflows (AN.D4).
  - OpenAI: https://github.com/openai/openai-agents-python/tree/main/examples/research_bot (OA.S7, read on GitHub).
  - Together: https://github.com/togethercomputer/open_deep_research (OT.T6, repo read on GitHub); https://www.together.ai/blog/open-deep-research (OT.T6) [snippet], since together.ai was blocked.
  - Cohere: https://docs.cohere.com/v2/docs/tool-use-usage-patterns ; https://docs.cohere.com/page/agentic-multi-stage-rag (OT.C1).
  - Hugging Face: https://huggingface.co/blog/open-deep-research (OT.H3).
  - Cohere and HF were read from their GitHub doc sources, since the hosts themselves were blocked. For Together only the open_deep_research repo was read; the blog and its benchmark claims are known from search snippets.
- **Evidence strength:** Moderate to strong. Anthropic S2, read in primary text, reports +90.2% over a single agent on an internal eval, about 15x chat tokens, and token use explaining 80% of BrowseComp variance. The caveat: that evidence is for the whole lead-plus-subagents research system against a single agent, not for the gap loop alone.
- **Effort / risk:** Medium effort. Risks: cost, given Anthropic's ~15x tokens; tuning the stop rule; and overlap with the orchestrator's own re-planning, which raises the question of when a human or the orchestrator should see the intermediate gaps. That overlap is why it is Tier 2, not Tier 1.

### C4. `panel` (Tier 2)

- **Aliases:** judge panel; LLM jury; Panel of LLM evaluators (PoLL, Cohere); ChatEval referee team (without its discussion mode); LLM-as-a-judge (single); voting judges with thresholds (Anthropic voting example).
- **Lab pattern:** #32.
- **Mechanism:** k evaluators, each with its own lens and ideally its own skill, judge one existing artifact independently and in parallel against shared pass criteria. Code pools their pass/fail results by rule and concatenates the numbered feedback. There are no discussion rounds; discussion among judges is debate's shape.
- **Roles:** `evaluator` (one per lens; pass/fail plus feedback, changes nothing); `reducer` (optional; dedupes and merges the feedback).
- **Params:** `lenses`: `[{ name, focus }]` (≤ 6, reusing MAX_PARTICIPANTS); `pass_criteria` (string, required); `pool` (`"all"` default, or `"majority"`).
  ```json
  { "id": "w4-d1", "topology": "panel",
    "task": "Review the wave.js bundle change before release",
    "context": ["diff at /scratch/release.diff"],
    "roles": { "evaluator": { "instructions": "judge only your lens; cite file:line" } },
    "params": { "lenses": [ { "name": "correctness", "focus": "behaviour vs spec" }, { "name": "caps", "focus": "every cap still enforced" }, { "name": "docs", "focus": "catalog matches code" } ], "pass_criteria": "no lens finds a blocking defect", "pool": "all" },
    "returns": { "shape": "PASS or FAIL, then one line per failing lens", "maxLines": 4 },
    "dependsOn": [] }
  ```
- **Demand:** k (+1 with a reducer).
- **Returns:** `done` with the pooled verdict and merged feedback; `blocked` if any evaluator blocks.
- **Use when:** A finished artifact must clear several independent reviews and the answer should be one pass/fail. Typical spot: a gate stage at the end of a chain.
- **Gap it fills:** A fan-out over review lenses returns findings but no pooled pass/fail. Generator-evaluator has exactly one evaluator.
- **Design alternative (possibly better):** Add `evaluators` and `pool` params to `generator-evaluator`, so the loop is gated by a panel. That changes an existing topology's params, which means a catalog version bump (K8), but it adds no new name. Making the evaluator slot itself a topology would need composition beyond chain (K4, v2).
- **Fit:** K1, K2 and K4-K8 are met unchanged. On K3: PoLL's benefit comes from judges in *disjoint model families*, which K3 rules out. Within K3, the panel gets only lens and skill diversity.
- **Sources:**
  - Academic: https://arxiv.org/abs/2306.05685 (LLM-as-a-judge); https://arxiv.org/abs/2404.18796 (PoLL, Cohere); https://arxiv.org/abs/2308.07201 (ChatEval).
  - Anthropic: https://www.anthropic.com/engineering/building-effective-agents (voting example).
- **Evidence strength:** Moderate to weak. PoLL correlates better with human judgments than a single GPT-4 judge at 7-8x lower cost, and GPT-4 judges agree with humans more than 80% of the time. Both are [S] snippets, since arxiv.org was blocked. "Identical personas degrade ChatEval" is [M], unverified.
- **Effort / risk:** Low effort. Risk: k-fold evaluator cost, every round if the panel is used inside a loop. Same-model judges may be correlated, so the gain over a single evaluator with a multi-lens rubric is unproven for this repo.

### C5. `escalation` (Tier 3)

- **Aliases:** model cascade; escalation pattern (AG2); Assistant Hierarchy (EcoAssistant); executor-advisor (Together, after Minions); cost tiering.
- **Lab pattern:** #10.
- **Mechanism:** The cheapest tier attempts the task and reports a confidence score. Below a threshold, or on failure, the task escalates to the next tier with context kept. In the advisor variant, a cheap executor may call a stronger model for brief advice, within a call budget.
- **Roles:** `worker` (one per tier).
- **Params:** `tiers`: `[{ model }]` (≤ 3); `threshold` (0-10, default 8); `max_escalations` (default tiers − 1).
- **Demand:** ≤ the number of tiers.
- **Use when:** Many dispatches are mostly easy and cost matters.
- **Gap it fills:** The catalog has no cost lever. Every role runs on whatever model the runtime gives it.
- **Fit: needs constraints changed.** K3 twice over: roles are filled with a skill and instructions only, with no model slot, so tiers cannot be expressed; and the worker stance has no confidence output. Both would have to change.
- **Sources:**
  - AG2: https://docs.ag2.ai/latest/docs/user-guide/advanced-concepts/pattern-cookbook/overview/ (MS.M18, read on GitHub).
  - Microsoft: https://microsoft.github.io/autogen/0.2/blog/2023/11/09/EcoAssistant (MS.M14, read on GitHub).
  - Together: https://github.com/togethercomputer/together-cookbook/tree/main/agents (OT.T4).
- **Evidence strength:** Weak to moderate. The mechanism was read in primary text. The headline number (about 30x lower remote cost at about 87% of frontier quality) comes from Minions as cited in the Together cookbook, not from the paper itself.
- **Effort / risk:** Medium effort plus a contract change. Low priority until the repo has a reason to vary models per role.

### C6. `tree-search` (Tier 3)

- **Aliases:** Tree of Thoughts (BFS/DFS); Graph of Thoughts; LATS (MCTS over trajectories).
- **Lab pattern:** #34.
- **Mechanism:** This proposal is bounded to beam search; MCTS and GoT's merge operations are out of scope. Each round, a generator expands each of the b frontier candidates into k next steps, an evaluator scores them, and code keeps the top b. It repeats to depth d and returns the best leaf. Partial solutions travel between rounds as artifacts.
- **Roles:** `generator` (expand); `evaluator` (score).
- **Params:** `branching` k (≤ 3); `beam` b (≤ 3); `depth` d (≤ 3); `criteria` (string).
- **Demand:** d × b × (1 + k), an upper bound. With every param at 3 that is 36.
- **Use when:** A problem needs lookahead or backtracking and has a usable evaluator, for example programming against tests.
- **Gap it fills:** No topology in the catalog backtracks.
- **Fit: needs constraints changed.** K3: the evaluator stance returns pass/fail plus feedback, but beam selection needs a comparable score. That means either a new output field or a new stance.
- **Sources:**
  - Academic: https://arxiv.org/abs/2305.10601 (ToT); https://arxiv.org/abs/2308.09687 (GoT); https://arxiv.org/abs/2310.04406 (LATS).
  - LangGraph: https://langchain-ai.github.io/langgraph/tutorials/reflection/ (LATS port).
- **Evidence strength:** Moderate on benchmarks: Game of 24 is solved 4% of the time with CoT and 74% with ToT ([S], from the abstract). Its relevance to this repo's delegated build and research tasks is unproven, and it spends much more inference.
- **Effort / risk:** Medium to high effort, plus a role change. Watch for evidence on agentic coding tasks before building it.

---

## 4. Patterns considered and rejected as topologies

Reason codes:
- **RT**: a runtime feature, protocol or substrate, not control flow between agents.
- **CH**: already expressible as a `chain` of existing topologies, so it needs no new name.
- **V2**: needs composition beyond chain or a general graph language (K4; `v2.md:6`; spec story 24).
- **OR**: the orchestrator's own job, or LLM-directed control flow that conflicts with K6/K7.
- **TR**: training-time, offline or cross-session.
- **OS**: out of scope for a task orchestrator.

| Lab # | Lab pattern | Code | Reason |
|---|---|---|---|
| #4 | Code-as-orchestrator (programmatic tool calling) | RT | A capability inside one agent: it writes code that calls tools. Any worker could use it; no inter-agent control flow is involved. |
| #6 | Staged dialogue chain (sequential chats with carryover) | CH | `chain` of `generator-evaluator` stages, with each stage's summary handed on as an artifact. |
| #7 | Artifact-gated role pipeline (SOP / MetaGPT) | CH | `chain` whose stages emit artifacts, with "not done stops the chain" as the gate and parallel groups as `fan-out` stages. SOP roles such as PM or architect are task content, which comes from skills (K2). |
| #8 | Rolling-summary chunk chain (Chain of Agents) | CH | `chain` of `single` stages, one per chunk, with the running summary passed as an artifact. `fan-out` + `reducer` is the parallel alternative. It may be worth revisiting if order-dependent long-input reading becomes common. |
| #9 | Router (classify then dispatch) | OR / V2 | The orchestrator already picks the topology per dispatch at plan time. Routing inside a dispatch to sub-dispatches would make the branches topologies (V2). Anthropic's 2026 advice to fold routers into one loop is noted, but was read only via a model summary. |
| #15 | Mixture-of-Agents (layered proposers + aggregator) | CH | `chain [fan-out, fan-out, single]`: each layer reads the previous layer's artifacts. Self-MoA counter-evidence (same-model samples beat mixed models by 6.6% on AlpacaEval, [S]) and K3 (no per-role models) remove most of the point. |
| #17 | Hierarchical teams (supervisor of supervisors) | V2 | A tree of depth greater than 1 is fan-out of topologies, which is v2 (`v2.md:6`). Across waves, the orchestrator already supplies the top level. |
| #18 | Nested team-as-agent (composite) | V2 | General nesting is v2. Its main benefit, keeping inner chatter out of the outer context, is already built into every topology: only the result comes back (`spec.md:19`). |
| #19 | Handoff (decentralised transfer of control) | OR | The pattern transfers control of a user conversation between peers. Topologies never talk to the user (K6), and the next agent is chosen by an LLM, not by code (K7). |
| #20 | Group chat (manager-selected speaker) | OR | LLM speaker selection is non-deterministic control flow (K7), and it returns a transcript, while the repo wants a verdict. Its deterministic round-robin decision form is what planned `debate` provides. |
| #21 | Shared task board (self-claiming peers) | RT / OR | Needs shared mutable state, locks and a peer mailbox (the Claude Code agent-teams runtime). The deterministic equivalent, dependency-ordered dispatch, is the orchestrator's waves with `dependsOn`. |
| #22 | Plan-and-execute (planner, executor, replanner) | OR | This is the orchestrator's own loop: it plans a wave, issues dispatches and re-plans from results. LLMCompiler-style DAG execution corresponds to waves plus `dependsOn`. |
| #23 | Ledger-based adaptive orchestration (Magentic) | OR | An LLM picks the next speaker on every turn (K7) and duplicates the orchestrator's role. Its stall counter and no-progress rule are worth borrowing as stop rules (used in C3). Its benchmark numbers are [memory]. |
| #25 | Clarify, brief, execute (spec-first pipeline) | CH | `chain [single (write the brief; block with a question if context is missing), <executor topology>]`. Clarification goes through the existing blocked-role path (K6). |
| #27 | Planner-generator-evaluator harness | CH | `chain [single planner, generator-evaluator]`. That matches the V2 harness, which keeps the planner and evaluates once at the end. Sprint-by-sprint execution is a relay (C1) or a chain of generator-evaluators. |
| #35 | Population search (tournament / evolution) | OS | Needs a persistent population database, asynchronous generations that end on budget, and a machine-checkable evaluator. That does not fit one bounded dispatch. C6 is its bounded relative. Evidence is snippet or secondary only, and the AlphaEvolve URL was not captured. |
| #36 | Graph / state-machine workflow | V2 | A general graph language is exactly what spec story 24 defers. It is a runtime for topologies, not a topology. |
| #37 | Dynamic code-defined workflow (script orchestrator) | RT | It is the substrate every topology already runs on: one Workflow script (ADR-0002). The shapes its docs name map onto this report: fix-until-check-passes → generator-evaluator; per-file review then merge → fan-out + reducer; find-until-saturation → C3; plan from several angles then weigh → C2. |
| #38 | Automatic team construction (runtime role recruitment) | OR | It generates roles at run time, but roles are six fixed stances (K3). Choosing skills and instructions per role is already the orchestrator's job at dispatch time. |
| #39 | Learned topology optimisation (offline search) | TR | Offline search over a validation set, while the catalog is fixed per version (K8). It may inform future catalog decisions. MASS's finding that prompts often matter more than topology is [snippet]. |
| #40 | Remote agent delegation (A2A) | RT | A protocol for reaching opaque remote agents, not a control-flow shape. The labs prefer local sub-agents in-process. |
| #41 | Game-master mediation (simulation hub) | OS | Social simulation produces no deliverable for a task orchestrator. |
| #42 | Self-play challenger-executor | TR | A training loop, not an inference topology. |
| #43 | Offline improvement loop (cross-session learning) | TR | A scheduled loop between sessions that rewrites memory or prompts. It sits outside any dispatch, and the catalog is fixed per version. |
| #44 | Guardrail wrapper (layered tripwires) | RT | Checks that wrap any topology belong to the runtime or harness. The repo's caps are its analogue and are already enforced (K5). |
| #45 | Human approval gate (interrupt and resume) | RT | Topologies cannot ask the human (K6). The blocked-role → orchestrator-asks path is the repo's gate. |

---

## 5. Open questions and verification gaps

**Lab-evidence gaps that affect this report**
1. **C1 relay.** The quantitative support (DeepSeek Discard-all 67.6 on BrowseComp; Tongyi IterResearch) is snippet-only. The Anthropic sources were read but are qualitative. Tier 1 rests on fit to the repo's purpose more than on measured gains.
2. **C2 best-of-n.** The mechanism is verified in several labs. Debate-or-Vote, MASS and DeepSeek numbers are snippet-level. GO tags self-consistency as [memory]; AC lists the paper (P2) without a tag on this claim.
3. **C3 iterative-fan-out.** Anthropic S2's figures were read but measure the whole research system, not the gap loop. Cohere and HF pages are canonical URLs read via GitHub sources, and the blog hosts were blocked. The Together Open Deep Research blog (together.ai, blocked) is [snippet] only: its claims of beating base models on FRAMES, SimpleQA and HotPotQA, and of higher answer quality than LangChain's Open Deep Research and HF smolagents, are unverified. Only the open_deep_research GitHub repo was read.
4. **C4 panel.** All academic evidence is [S] or [M] because arxiv.org was blocked. That includes PoLL, the >80% judge agreement and ChatEval's persona finding.
5. **C5 escalation.** The Minions numbers are second-hand, via the Together cookbook.
6. **C6 tree-search.** Benchmark numbers are [S] abstract snippets.
7. **Rejections.** The Anthropic 2026 "fold subagents" post (S12) was read only via a model summary; it supports the #3 coverage note and the #9 rejection. Magentic-One numbers (#23) are [memory]. The LangChain swarm-vs-supervisor benchmark (#19, #16) is [search excerpt]. Google Cloud Architecture Center and DeepMind papers are snippet-only. The OpenAI 2025 blog posts (New tools for building agents, AgentKit launch) were unread. The AlphaEvolve source URL was not captured (#35).
8. **No local measurement.** No candidate has been tried in this repo. The ranks are judgements against K1-K8 and the plugin's stated use cases, not results.

**Repo-side design questions**
1. **Sequencing against the dogfood plan.** v1 acceptance is building `debate` through the orchestrator (`spec.md:144`). Should Tier 1 additions wait for that, ship as v1.x, or be dogfooded the same way?
2. **Relay's done signal.** Evaluator done-check (no contract change, more agents) or a completion field on the worker stance (a K3 change)?
3. **Caps for new topologies.** The caps in §3 (relay 10 sessions, iterative-fan-out 3 rounds, best-of-n n ≤ 9 reusing MAX_WIDTH, panel ≤ 6 reusing MAX_PARTICIPANTS) are proposals. They should be added to `shared.ts` beside the existing caps, so they are enforced, not requested.
4. **Vote inside debate.** Should debate's planned spec gain a `final: judge | vote` option, as some symmetric-debate sources do? Or should vote live only in `best-of-n`, which keeps the debate-vs-vote comparison clean?
5. **Panel placement.** New topology, or `evaluators` + `pool` params on generator-evaluator? The latter adds no name but changes an existing topology's params (version bump).
6. **Reflexion residual (#28).** Does generator-evaluator pass only the last round's feedback or all of them? If only the last, would an "accumulate lessons" param be worth it?
7. **Map width (#12).** Is the 9-branch cap right for "same check on N items" when N is large, or should a wide map wait for v2 "fan-out of topologies"?
8. **K3 is the recurring limit.** Per-role model choice would unlock C5, real judge diversity in C4 and C2, and heterogeneous debate. If the runtime ever allows it, revisit the Tier 3 entries.

---

## 6. Tally (each lab pattern exactly once)

- **Covered by existing topologies (§2), 12:** #1, #2, #3, #5, #11, #12, #16, #26, #28, #30, #31, #33.
- **Ranked candidates (§3), 7 patterns in 6 candidates:**
  - Tier 1: C1 relay (#29); C2 best-of-n (#13, #14).
  - Tier 2: C3 iterative-fan-out (#24); C4 panel (#32).
  - Tier 3: C5 escalation (#10); C6 tree-search (#34).
- **Rejected (§4), 26:** #4, #6, #7, #8, #9, #15, #17, #18, #19, #20, #21, #22, #23, #25, #27, #35, #36, #37, #38, #39, #40, #41, #42, #43, #44, #45.
- **Total:** 12 + 7 + 26 = 45.
