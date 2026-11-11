# OpenAI: agent and workflow orchestration topologies

Branch 2 of 7. Sources: OpenAI's "A practical guide to building agents", the Agents SDK docs and examples (openai-agents-python), Swarm, the OpenAI Cookbook, and OpenAI writings from 2025-2026.

## Access caveats (read first)

- This session's network allowed only github.com and raw.githubusercontent.com. These hosts failed DNS: cdn.openai.com, openai.com, openai.github.io (rendered SDK docs), medium.com, maginative.com, ibl.ai.
- **Practical guide.** The text came from a verbatim PDF-to-text transcription hosted on GitHub (`HelgeSverre/swarm/docs/literature/a-practical-guide-to-building-agents.txt`). Quotes below come from that copy. The canonical URL is listed, but I could not fetch it.
- **SDK docs.** Read as Markdown source from `github.com/openai/openai-agents-python/docs/*.md` on the main branch as of 2026-10-31. These are the same pages that render at openai.github.io/openai-agents-python.
- **Cookbook.** Read from `github.com/openai/openai-cookbook`. Dates come from the cookbook's `registry.yaml`.
- **Not read.** I could not fetch OpenAI blog posts on openai.com, such as "New tools for building agents" (2025-03) and "Introducing AgentKit" (2025-10). I also could not fetch the platform.openai.com / developers.openai.com Agents guides.

## Source index

| # | Title | URL | Date |
|---|---|---|---|
| S1 | A practical guide to building agents (OpenAI) | https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf | Apr 2025 |
| S2 | Agents SDK: Agent orchestration | https://openai.github.io/openai-agents-python/multi_agent/ (source: docs/multi_agent.md) | living doc, read 2026-10-31 |
| S3 | Agents SDK: Handoffs | https://openai.github.io/openai-agents-python/handoffs/ | living doc |
| S4 | Agents SDK: Tools, section "Agents as tools" and "Programmatic Tool Calling" | https://openai.github.io/openai-agents-python/tools/ | living doc |
| S5 | Agents SDK: Guardrails | https://openai.github.io/openai-agents-python/guardrails/ | living doc |
| S6 | Agents SDK examples/agent_patterns (README plus deterministic.py, routing.py, agents_as_tools*.py, llm_as_a_judge.py, parallelization.py, input/output_guardrails.py, human_in_the_loop*.py, hosted_multi_agent_beta.py) | https://github.com/openai/openai-agents-python/tree/main/examples/agent_patterns | living, read 2026-10-31 |
| S7 | Agents SDK examples: research_bot and financial_research_agent | https://github.com/openai/openai-agents-python/tree/main/examples/research_bot , .../financial_research_agent | living |
| S8 | Agents SDK: Sandbox agents, Concepts guide | https://openai.github.io/openai-agents-python/sandbox/guide/ | 2026 |
| S9 | Swarm (experimental, educational; superseded by the Agents SDK) | https://github.com/openai/swarm | Oct 2024 |
| S10 | Cookbook: Orchestrating Agents: Routines and Handoffs | https://cookbook.openai.com/examples/orchestrating_agents | 2024-10-10 |
| S11 | Cookbook: Structured Outputs for Multi-Agent Systems | https://cookbook.openai.com/examples/structured_outputs_multi_agent | 2024-08-06 |
| S12 | Cookbook: Parallel Agents with the OpenAI Agents SDK | https://cookbook.openai.com/examples/agents_sdk/parallel_agents | 2025-05-01 |
| S13 | Cookbook: Multi-Agent Portfolio Collaboration with OpenAI Agents SDK | https://cookbook.openai.com/examples/agents_sdk/multi-agent-portfolio-collaboration/multi_agent_portfolio_collaboration | 2025-05-28 |
| S14 | Cookbook: Deep Research API with the Agents SDK | https://cookbook.openai.com/examples/deep_research_api/introduction_to_deep_research_api_agents | 2025-06-25 |
| S15 | Cookbook: Building Consistent Workflows with Codex CLI & Agents SDK (now marked archived) | https://cookbook.openai.com/examples/codex/codex_mcp_agents_sdk/building_consistent_workflows_codex_cli_agents_sdk | 2025-10-01 |
| S16 | Cookbook: Using PLANS.md for multi-hour problem solving | https://cookbook.openai.com/articles/codex_exec_plans | 2025-10-07 |
| S17 | Cookbook: Build, deploy, and optimize agentic workflows with AgentKit | https://cookbook.openai.com/examples/agentkit/agentkit_walkthrough | 2025-10-17 |
| S18 | Cookbook: Building Governed AI Agents, A Practical Guide to Agentic Scaffolding | https://cookbook.openai.com/examples/partners/agentic_governance_guide/agentic_governance_cookbook | 2026-02-23 |
| S19 | Cookbook: Building Reliable Agents with Memory and Compaction | https://cookbook.openai.com/examples/agents_sdk/building_reliable_agents_memory_compaction | 2026-05-01 |
| S20 | Cookbook: Build a prior authorization review assistant with the OpenAI Agents SDK and Amazon Bedrock AgentCore | https://cookbook.openai.com/examples/partners/AWS/policy_to_review_prior_authorization_agents_sdk_agentcore | 2026-08-10 |
| S21 | Cookbook: Build an SRE agent for incident response (Agents API) | https://github.com/openai/openai-cookbook/tree/main/examples/agents_api/apps/sev_bot | 2026-09-10 |

## Top-level taxonomy in OpenAI's own words

- **S1 (guide).** Orchestration patterns fall into two categories:
  - "Single-agent systems, where a single model equipped with appropriate tools and instructions executes workflows in a loop"
  - "Multi-agent systems, where workflow execution is distributed across multiple coordinated agents"
- **S1, multi-agent categories.** The guide names two "broadly applicable categories": **Manager (agents as tools)** and **Decentralized (agents handing off to agents)**. It frames both as graphs: "In the manager pattern, edges represent tool calls whereas in the decentralized pattern, edges represent handoffs that transfer execution between agents."
- **S2 (SDK docs).** The docs split on a second axis: **orchestrating via LLM** (manager agents-as-tools, handoffs, or both combined) versus **orchestrating via code** (structured-output routing, chaining, evaluator while-loop, parallel execution). Code orchestration is described as "more deterministic and predictable" in speed, cost and performance.
- **S1, recommended progression.** "Maximize a single agent's capabilities first … often a single agent with tools is sufficient." Move to multiple agents only "when needed".

---

## Patterns

### 1. Single-agent run loop (agent loop with exit conditions)
- **Mechanism.** There is one node: an LLM with instructions, tools, guardrails and hooks. The edge is a self-loop through tool calls. The "run" is "typically implemented as a loop that lets agents operate until an exit condition is reached."
  - **General exit conditions:** "tool calls, a certain structured output, errors, or reaching a maximum number of turns."
  - **In the Agents SDK,** `Runner.run()` loops until (1) "a final-output tool is invoked, defined by a specific output type" or (2) "the model returns a response without any tool calls."
  - **Swarm** uses the same loop: get a completion, execute tools, switch agent if a handoff occurred, update context variables, and stop when there are no new function calls. Its `max_turns` defaults to infinity.
- **When to use.** This is the default starting point. "A single agent can handle many tasks by incrementally adding tools, keeping complexity manageable and simplifying evaluation and maintenance."
- **Roles.** One agent, plus the user.
- **Sources.** S1 (Orchestration, Single-agent systems); S9; S10.

### 1a. Parameterised prompt template (single agent, many use cases)
- **Mechanism.** One base prompt takes policy variables (for example `{{user_first_name}}` and policy text). You do not keep many prompts, and you do not split into many agents. The topology stays a single agent; only the instructions change per invocation.
- **When to use.** S1 calls this "an effective strategy for managing complexity without switching to a multi-agent framework". As new use cases arise, you update variables rather than rewriting workflows.
- **Split signals.** S1 gives two:
  - *Complex logic:* "many conditional statements … and prompt templates get difficult to scale".
  - *Tool overload:* similarity or overlap matters, not just count. "Some implementations successfully manage more than 15 well-defined, distinct tools while others struggle with fewer than 10 overlapping tools."
- **Sources.** S1.

### 1b. Routine (natural-language SOP as system prompt)
- **Mechanism.** A "routine" is "a list of instructions in natural language (… a system prompt), along with the tools necessary to complete them". It can contain conditionals "much like a state machine". The LLM gives "soft" adherence: it can steer the conversation without getting stuck in dead-ends. When one routine grows too large, you split it into several routines (agents) joined by handoffs (pattern 3).
- **When to use.** Small and medium-sized flows, such as a customer-service triage → fix-or-refund routine.
- **Sources.** S10 (2024-10-10); S9.

### 2. Manager pattern / agents-as-tools (hub-and-spoke)
- **Mechanism.** A central manager LLM is the hub. Each specialist agent is a tool on it (`Agent.as_tool()`), so edges are tool calls.
  - The manager calls specialists, and each call starts a **nested run** with its own turn loop, `max_turns`, approvals and optional session (S4, S8).
  - The manager receives the specialist outputs and synthesises them. It keeps the user-facing conversation the whole time.
  - The run terminates when the manager produces its final output.
  - The SDK adds structured tool input (`parameters`, `input_builder`), `custom_output_extractor`, `is_enabled` for conditionally exposing sub-agents, streaming nested events (`on_stream`), and `needs_approval`.
- **When to use.**
  - S1: "ideal for workflows where you only want one agent to control workflow execution and have access to the user."
  - S2: when "one agent should own the final answer, combine outputs from several specialists, or enforce shared SDK guardrails in one place."
  - S13: "keeps a single thread of control … simplify[ies] coordination" and "allows parallel execution of sub-tasks". Handoffs, by contrast, "can make it harder to maintain a global view".
- **Roles.** Manager or orchestrator; specialist sub-agents.
- **Examples.** Translation manager with Spanish/French/Italian agents (S1, S4, S6 `agents_as_tools.py`). Portfolio Manager hub with Macro, Fundamental and Quant spokes plus a memo-editor tool (S13).
- **Evidence.** S13 argues qualitatively: an overloaded single agent "leads to shallow, generic outputs". Specialisation gives "deeper, higher-quality research", modularity, parallelism and auditability. The source gives no quantitative benchmark.
- **Sources.** S1, S2, S4, S6, S13.

### 3. Decentralized pattern / handoffs (peer-to-peer transfer of control)
- **Mechanism.** Agents sit "on equal footing". A handoff is "a one way transfer": it is exposed to the LLM as a tool named `transfer_to_<agent>`.
  - When an agent calls the handoff, execution "immediately" starts on the target agent, and the latest conversation state transfers with it.
  - There is one top-level run whose active agent changes; the run is not nested (S8).
  - Optional customisations: `input_filter` (control what history the receiver sees, for example `remove_all_tools`), opt-in nested-history summarisation, an `on_handoff` callback, an `input_type` for model-supplied metadata, and an `is_enabled` gate.
  - The target can be given a handoff back to the original agent.
  - The run ends when the active agent produces a final output.
  - Swarm implements this by having a tool function return an `Agent` object. If several handoffs are called, only the last applies.
- **When to use.**
  - S1: "optimal when you don't need a single agent maintaining central control or synthesis—instead allowing each agent to take over execution and interact with the user as needed." It is "especially effective for scenarios like conversation triage".
  - S2: when "the specialist should respond directly, prompts should stay focused, or the active instructions should switch without the manager narrating the result."
- **Roles.** Triage or front-door agent; peer specialists (for example Sales, Repairs, Orders, Issues).
- **Guardrail interaction.** Input guardrails run only on the first agent. Output guardrails run only on the agent that produces the final output (S3, S5).
- **Sources.** S1, S2, S3, S9, S10; S18 (PE-firm triage assistant, 2026).

### 3a. Triage router (handoff-based routing)
- **Mechanism.** This is a common special case of pattern 3. A front-line triage agent has only handoffs to specialists (for example one per language, or per domain) and immediately transfers. The specialist answers the user directly. Each specialist's `handoff_description` tells the triage agent when to route there; S18 calls it "critical".
- **When to use.** Customer service, help desks, multi-domain assistants.
- **Sources.** S6 (`routing.py`), S1, S18.

### 4. Hybrid: handoff plus agents-as-tools
- **Mechanism.** A triage agent hands off to a specialist (pattern 3). That specialist then calls further agents as tools for narrow subtasks (pattern 2).
  - In the financial research example (S7), the writer agent calls fundamentals and risk analyst agents as tools inside a code-driven pipeline.
  - In sandbox setups (S8), a non-sandbox intake agent hands off to a sandbox reviewer, or an orchestrator exposes several sandbox agents as tools.
- **When to use.** When you want both direct specialist ownership of the conversation and bounded sub-delegation.
- **Sources.** S2 ("Combined"), S7, S8.

### 5. Deterministic chain / sequential pipeline (code-orchestrated)
- **Mechanism.** Application code calls agent A, passes its output as agent B's input, and so on. Edges are fixed in code, optionally with programmatic checks or gates between steps. The pipeline terminates after the last stage.
  - S2's example decomposes a blog post into research → outline → write → critique → revise.
  - S17 builds a visual Agent Builder workflow: resume-extraction (structured JSON) → career-gap analysis → course recommendation (web search), with `{{input.output_text}}` passing context between nodes.
  - S20 (2026) runs three agents (evidence inventory → criterion mapping → citation recheck and human-review queue), each on a different model tier. "Application code fixes the order and validates every handoff; no agent selects the next stage." Any bypass rule should be "an application-owned rule rather than a model decision."
- **When to use.** When tasks decompose into known steps and you want predictability in speed, cost and performance (S2). In regulated domains, code should own control flow (S20).
- **Roles.** Stage agents; application code as controller.
- **Sources.** S2, S6 (`deterministic.py`), S17, S20.

### 6. Structured-output routing (classifier + code dispatch)
- **Mechanism.** A classifier agent emits a schema-constrained output, such as a category or the next agent. Code inspects it and invokes the matching downstream agent or agents.
  - S11 (2024) uses a triaging agent that "decides which agent(s) to call" among pre-processing, analysis and visualisation agents, each with its own tool group.
  - S11 notes that Structured Outputs guarantee schema validity, but app code must still validate semantics.
- **When to use.** When tool count or overlap degrades function-calling accuracy. "Logically group the tools together and have specialized 'agents'" (S11). Also when you want deterministic routing (S2).
- **Sources.** S2, S11.

### 7. Parallel fan-out / fan-in (with aggregator, or best-of-N selection)
- **Mechanism.** Several independent agents run concurrently on the same input, for example with `asyncio.gather`. Their outputs fan in to a downstream "meta" agent that synthesises the final answer (S12). A variant generates N candidates (for example several translations) and has a picker agent choose the best (S6 `parallelization.py`).
  - S12 contrasts two implementations:
    - (a) **Code-level `asyncio.gather`:** deterministic order, lowest latency, custom multi-layer graphs.
    - (b) **Agents-as-tools with `parallel_tool_calls`:** the planner decides dynamically which branches to run, "at the expense of higher latency" from the extra planning call and longer tool-call context.
- **When to use.** "Several independent questions about the same piece of content", such as customer-support triage or content moderation. The goal is to reduce latency and avoid retries of serial chains (S12). S2: run independent tasks in parallel "for speed".
- **Evidence.** S12 includes a timeline visualisation showing the latency reduction on a toy task. No numeric benchmark is given.
- **Sources.** S2, S6, S12, S13 (`run_all_specialists_parallel` tool).

### 8. Evaluator loop / LLM-as-a-judge (generator–evaluator while-loop)
- **Mechanism.** A generator agent produces output. An evaluator agent returns structured feedback `{feedback, score: pass | needs_improvement | fail}`. Code loops, feeding the feedback back to the generator, until the score is `pass` or a max-rounds cap is hit (the example uses 3 in auto mode).
- **When to use.** When quality criteria can be judged by a model. S6 suggests a smaller generator model with a larger feedback model. S2 lists "introspect and improve" (self-critique loops, feeding back error messages) as a core tactic.
- **Roles.** Generator; judge or evaluator.
- **Sources.** S2, S6 (`llm_as_a_judge.py`).

### 9. Planner → parallel workers → writer (→ verifier)
- **Mechanism.**
  - A planner agent emits a structured list of search items, each with a term and a reason.
  - Code fans out one search agent per item in parallel. Each search agent uses web search and summarises.
  - A writer agent synthesises the report.
  - The richer variant (financial research) adds analyst agents exposed as tools to the writer, and a final **verifier** agent that audits the report for inconsistencies or missing sourcing.
  - The pipeline terminates after the writer (or the verifier).
- **When to use.** Research and report generation. The README's suggested improvement is to "add an evaluation step so that the model can choose to improve its results, search for more stuff". That would turn the pipeline into a loop.
- **Roles.** Planner, searcher (×N), writer, sub-analysts, verifier.
- **Sources.** S7.

### 10. Clarify-then-execute pipeline (triage → clarifier → instruction builder → executor)
- **Mechanism.** A four-agent handoff pipeline in front of a long-running deep-research model:
  1. A triage agent inspects the query. It routes to a Clarifier if context is missing, otherwise to the Instruction Builder.
  2. The Clarifier asks follow-up questions and waits for the user's answers.
  3. The Instruction Builder turns the enriched input into a precise research brief.
  4. The Research agent runs web search plus internal MCP search and emits the final artifact.
- **When to use.** Expensive, long tasks where prompt enrichment raises output quality. Do not use deep research for trivial lookups.
- **Sources.** S14 (2025-06-25).

### 11. Gated hub with return handoffs (project-manager gatekeeper)
- **Mechanism.** A star topology built from **handoffs**, not tool calls.
  - The PM agent alone receives the task and writes the planning artifacts (REQUIREMENTS.md, TEST.md, AGENT_TASKS.md).
  - The PM hands off to Designer. Every specialist's only handoff is back to the PM.
  - The PM verifies that the required files exist before unblocking the next stage: Designer → (Frontend ∥ Backend) → Tester. If something is missing, it asks the owning agent and re-checks.
  - Termination comes when the Tester's artifacts exist and the PM stops handing off.
  - Shared state lives in files, which act as a blackboard.
- **When to use.** Enterprise-style workflows with artifact gates, such as "JIRA task orchestration, long-chained rollouts, and QA sign-offs".
- **Evidence.** One example run took about 11 minutes end to end and produced a working game plus a backend. No comparative metric is given.
- **Sources.** S15 (2025-10-01; now marked archived because Codex MCP server is deprecated).

### 12. Guardrails as a layered, parallel tripwire (cross-cutting)
- **Mechanism.** Guardrail functions or agents run beside the main agent. Common checks include relevance, safety/jailbreak, PII, moderation API, regex/blocklist, and tool safeguards.
  - **Input guardrails** run on the first agent only. They are *optimistic/parallel* by default: the guardrail and the agent start together, and a tripwire cancels the run. They can be made *blocking* with `run_in_parallel=False`, so a tripwire prevents any token use or tool calls.
  - **Output guardrails** run after the final agent completes.
  - **Tool guardrails** wrap each function tool before and after execution. They are recommended over agent-level guardrails for checking every tool call in manager or handoff workflows.
  - A tripwire raises an exception and halts the run.
  - S1 frames this as "a layered defense mechanism. While a single one is unlikely to provide sufficient protection, using multiple, specialized guardrails together creates more resilient agents."
  - S5's common pattern: a fast, cheap model screens input in front of an expensive model.
  - S18 (2026) builds a full pipeline: pre-flight → input guardrails → orchestration (triage + handoffs) → output guardrails, with red-team inputs and a GuardrailEval feedback loop tuning policy.
- **Sources.** S1, S5, S6, S18.

### 13. Human-in-the-loop interrupt / approval (pause-resume)
- **Mechanism.** The run pauses on sensitive tool calls (`needs_approval` on a function tool or `as_tool`). Pending items surface as `result.interruptions`. The run state is serialised (`to_state()`), a human approves or rejects, and the run resumes.
  - Server variant: a server-owned snapshot with owner-checked, single-use approvals.
  - S21 (2026, Agents API): webhook `agent.session.action_required`, then Slack approval buttons, then a tool result is posted back to the session.
- **When to use.** S1 names "two primary triggers":
  - "Exceeding failure thresholds": limits on retries or actions.
  - "High-risk actions … sensitive, irreversible, or have high stakes", for example cancelling orders, large refunds or payments, "until confidence in the agent's reliability grows."
- **Sources.** S1, S6 (`human_in_the_loop*.py`), S21.

### 14. Hosted multi-agent (server-side subagent spawning) — 2026, experimental
- **Mechanism.** The root agent runs on `OpenAIHostedMultiAgentModel`. The **Responses API itself** spawns and coordinates server-hosted subagents, with a config such as `max_concurrent_subagents: 3`. The local SDK Runner still executes local function tools, and metadata identifies which subagent called each one.
  - The example instructs the root to create two subagents, assign one proposal to each, wait for both, and return a comparison.
  - Stream items include `multi_agent_call`, `multi_agent_call_output` and `agent_message`.
- **Character.** This is a dynamic, model-decided fan-out/fan-in where the orchestration loop runs in the provider, not in client code.
- **Sources.** S6 (`hosted_multi_agent_beta.py`, under `agents.extensions.experimental`).

### 15. Programmatic tool calling (model-written orchestration program) — 2026
- **Mechanism.** The model writes a JavaScript program that runs in a fresh hosted V8 sandbox with no network or filesystem access. The program calls only explicitly allowed tools (`allowed_callers=["programmatic"]`), uses loops, branches and parallel calls to combine results, and returns one result to the model. This replaces many model round trips with a single generated program.
- **When to use.** "Bounded workflows that benefit from loops, branching, parallel calls, or intermediate calculations without a model round trip after every tool call."
- **Sources.** S4.

### 16. Sandbox agents with isolated workspaces (agents-as-tools or handoff into a sandbox) — 2026
- **Mechanism.** `SandboxAgent` is an Agent whose tools run against a persistent workspace (filesystem and shell). Two orchestration forms:
  - (a) A non-sandbox intake agent hands off to a sandbox reviewer. The run is the same top-level run, and approvals stay on it.
  - (b) An orchestrator exposes several sandbox agents via `as_tool`, each with its own `SandboxRunConfig`, so each sub-agent gets its own workspace and session. Each is a nested run, and approvals bubble up and resume the nested run.
- **When to use.** "Multi-agent patterns with separate workspaces, for example giving each reviewer or coding sub-agent its own workspace". Also when sub-agents must edit files independently.
- **Sources.** S8.

### 17. Living execution plan (ExecPlan / PLANS.md) for long-horizon single agents
- **Mechanism.** A single coding agent first writes a self-contained, living design-and-execution document that a beginner could follow, with milestones and progress logging. It then implements against that document and updates it as it goes. AGENTS.md says when to trigger it. The plan acts as externalised state and control for a long loop.
- **When to use.** "Complex features or significant refactors", "from design to implementation".
- **Evidence.** A very similar PLANS.md "has enabled Codex to work for more than seven hours from a single prompt" (anecdotal).
- **Sources.** S16 (2025-10-07).

### 18. Compaction + memory for long-running runs (context-management adjunct)
- **Mechanism.** Within a run, compaction carries forward the needed state while shrinking context. Across runs, memory carries reusable workflow guidance. A human-reviewed artifact, such as a memo, remains the source of truth. This is not a multi-node topology. It supports pattern 1 over long horizons.
- **Sources.** S19 (2026-05-01); S8 (memory and compaction sandbox capabilities).

---

## Meta-guidance stated by OpenAI

- **Declarative vs code-first graphs (S1).** Declarative frameworks make you "explicitly define every branch, loop, and conditional … upfront". That "can quickly become cumbersome" as workflows grow dynamic. The Agents SDK takes a "code-first approach … without needing to pre-define the entire graph upfront". AgentKit's Agent Builder (S17, 2025-10) later added a visual node-and-edge canvas for the declarative style.
- **Model selection (S1).** Build the prototype with the most capable model to set a baseline, then swap in smaller models per agent where evals allow. S20 does this with per-stage model tiers.
- **Common principles (S1).** "Keep components flexible, composable, and driven by clear, well-structured prompts." Invest in evals (S2).

## Canonical pattern names (for merge)

Single-agent run loop; Parameterised prompt template; Routine; Manager / agents-as-tools; Decentralized handoffs; Triage router; Hybrid handoff + agents-as-tools; Deterministic chain; Structured-output routing; Parallel fan-out/fan-in (incl. best-of-N); Evaluator loop / LLM-as-judge; Planner-workers-writer(-verifier); Clarify-then-execute pipeline; Gated hub with return handoffs; Layered guardrails / tripwires; Human-in-the-loop approval; Hosted multi-agent subagents; Programmatic tool calling; Sandboxed agents-as-tools; Living execution plan; Compaction + memory.
