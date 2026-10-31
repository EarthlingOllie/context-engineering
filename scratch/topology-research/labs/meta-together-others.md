# Meta, Together AI and other labs: agent and workflow orchestration topologies

Branch 6 of 7. Labs covered: Together AI (Mixture-of-Agents, cookbook agent workflows, Open Deep Research), Meta (FAIR multi-agent research, Llama Stack/OGX, ARE/Gaia2), Mistral, Cohere, DeepSeek, Qwen/Alibaba (Qwen-Agent, Tongyi DeepResearch) and Hugging Face (smolagents, Transformers Agents).

## Access caveats (read first)

- The session's egress proxy allowed only github.com, raw.githubusercontent.com and pypi.org. These hosts were refused: arxiv.org, together.ai, docs.together.ai, docs.mistral.ai, mistral.ai, docs.cohere.com, ai.meta.com, huggingface.co, qwenlm.github.io, qwen.readthedocs.io, api-docs.deepseek.com and proceedings.iclr.cc.
- **Read from primary text on GitHub.** Most sources below were read verbatim from the labs' own GitHub repositories. Examples: the Hugging Face blog sources in `huggingface/blog`, the Qwen blog source in `QwenLM/qwenlm.github.io`, Cohere's docs source in `cohere-ai/cohere-developer-experience` and the Mistral SDK docs in `mistralai/client-python`. Repository content is as of 2026-10-31.
- **Search snippets only (marked [snippet]).** The MoA paper's ablations, the Mistral Agents API announcement and the Durable Agents docs, the DeepSeek-V3.2 paper and API guide, and the Meta FAIR paper abstracts (Coral, Self-Challenging, SPICE, ARE) came from WebSearch result summaries. I could not read their full text. Their numbers are given as the snippets reported them.
- **Dates.** Cookbook notebooks are living documents, and the shallow clones have no history, so they are cited as "living, read 2026-10-31".

## Source index

| # | Title | URL | Date |
|---|---|---|---|
| T1 | Mixture-of-Agents Enhances Large Language Model Capabilities (Wang, Wang, Athiwaratkun, Zhang, Zou; Together AI/Duke/Stanford/UChicago; ICLR 2025) | https://arxiv.org/abs/2406.04692 | 2024-06 (ICLR 2025) |
| T2 | Together MoA: collective intelligence of open-source models pushing the frontier of LLM capabilities (Together blog) | https://www.together.ai/blog/together-moa | 2024-06-11 |
| T3 | togethercomputer/MoA reference implementation (README, moa.py, advanced-moa.py, bot.py) | https://github.com/togethercomputer/MoA | last commit 2025-01-06 |
| T4 | Together cookbook, agents/ (Serial Chain, Conditional Router, Parallel, Orchestrator Subtask, Looping and Cross-Provider Advisor workflows, Zain Hasan) | https://github.com/togethercomputer/together-cookbook/tree/main/agents | living, read 2026-10-31 |
| T5 | Together docs: Agent workflows overview (sequential/parallel/conditional/iterative) [snippet] | https://docs.together.ai/docs/workflows | living |
| T6 | Together Open Deep Research (repo, cookbook notebook, blog) | https://github.com/togethercomputer/open_deep_research ; https://www.together.ai/blog/open-deep-research | 2025-04 (coverage dates 2025-04-16) |
| T7 | Together cookbook: Ralph Loop with Nemotron 3 Ultra; Content Writer (Deep Agents memory and skills) | .../agents/Nemotron3Ultra_RalphLoop ; .../agents/Nemotron3Ultra_ContentWriter | 2026, living |
| M1 | Collaborative Reasoner: Self-Improving Social Agents with Synthetic Conversations (Meta FAIR; Coral and MATRIX) | https://github.com/facebookresearch/collaborative-reasoner ; https://ai.meta.com/research/publications/collaborative-reasoner-self-improving-social-agents-with-synthetic-conversations/ | 2025-04-17; NeurIPS 2025 |
| M2 | SWEET-RL: Training Multi-Turn LLM Agents on Collaborative Reasoning Tasks (FAIR and UC Berkeley; ColBench) | https://github.com/facebookresearch/sweet_rl ; arXiv 2503.15478 | 2025-03 |
| M3 | Self-Challenging Language Model Agents (FAIR; NeurIPS 2025) [snippet] | https://arxiv.org/abs/2506.01716 | 2025-06 |
| M4 | SPICE: Self-Play In Corpus Environments Improves Reasoning (FAIR) [snippet] | https://arxiv.org/abs/2510.24684 | 2025-10-28 |
| M5 | ARE: Scaling Up Agent Environments and Evaluations / Gaia2 (Meta Superintelligence Labs), repo docs `foundations/scenarios.rst`, `user_guide/gaia2_evaluation.rst` | https://github.com/facebookresearch/meta-agents-research-environments ; arXiv 2509.17158 | 2025-09 |
| M6 | Llama Stack (now "OGX") docs: Agent Execution Loop; notebook "Build and Monitor Agent Workflows with OGX + Anthropic's Best Practice"; blog "Building a Self-Improving Agent with OGX" | https://github.com/meta-llama/llama-stack/tree/main/docs | living; blog 2026-03-01 |
| X1 | Mistral cookbook: Parallel Subtask Agent Workflow; HubSpot Dynamic Multi-Agent System (Magistral); MAECAS; Agents API travel_assistant (handoffs) | https://github.com/mistralai/cookbook/tree/main/mistral/agents | living |
| X2 | Mistral Agents API announcement [snippet]; mistralai/client-python docs (conversations `handoff_execution`) | https://mistral.ai/news/agents-api ; https://github.com/mistralai/client-python/blob/main/docs/sdks/conversations/README.md | 2025-05-27 |
| X3 | Mistral Workflows docs: Durable Agents [snippet] | https://docs.mistral.ai/workflows/building-workflows/durable_agents | 2026, living |
| C1 | Cohere docs: Usage patterns for tool use; Multi-step Tool Use (Agents); Building Agentic RAG with Cohere (6-part tutorial); cookbook: Agentic Multi-Stage RAG | https://docs.cohere.com/v2/docs/tool-use-usage-patterns ; https://docs.cohere.com/docs/multi-step-tool-use ; https://docs.cohere.com/v2/docs/agentic-rag ; https://docs.cohere.com/page/agentic-multi-stage-rag | 2024-02 to 2024-06 (createdAt/updatedAt), living |
| D1 | DeepSeek-V3.2: Pushing the Frontier of Open LLMs, search-agent context management section [snippet] | https://arxiv.org/abs/2512.02556 | 2025-12 |
| D2 | DeepSeek-V3.2 Release note and API Thinking Mode guide [snippet] | https://api-docs.deepseek.com/news/news251201 ; https://api-docs.deepseek.com/guides/thinking_mode | 2025-12-01 |
| D3 | DeepSeek-V3.1 model card (search-agent and code-agent templates) [snippet] | https://huggingface.co/deepseek-ai/DeepSeek-V3.1 | 2025-08 |
| Q1 | Generalizing an LLM from 8k to 1M Context using Qwen-Agent (Qwen blog) | https://qwenlm.github.io/blog/qwen-agent-2405/ (source: QwenLM/qwenlm.github.io content/blog/qwen-agent-2405/index.md) | 2024-06-06 |
| Q2 | Qwen-Agent docs: Agent Introduction (Assistant, GroupChat, nested agents); source router.py, group_chat.py, group_chat_auto_router.py, doc_qa/parallel_doc_qa*.py | https://github.com/QwenLM/Qwen-Agent | living |
| Q3 | Tongyi DeepResearch (Alibaba Tongyi Lab) README and Technical Report (Heavy mode) [report: snippet] | https://github.com/Alibaba-NLP/DeepResearch ; https://arxiv.org/abs/2510.24701 | 2025-09/10 |
| H1 | Introducing smolagents: simple agents that write actions in code (HF blog) | https://huggingface.co/blog/smolagents | 2024-12-31 |
| H2 | Our Transformers Code Agent beats the GAIA benchmark (HF blog) | https://huggingface.co/blog/beating-gaia | 2024-07-01 |
| H3 | Open-source DeepResearch: Freeing our search agents (HF blog) | https://huggingface.co/blog/open-deep-research | 2025-02-04 |
| H4 | CodeAgents + Structure: A Better Way to Execute Actions (HF blog) | https://huggingface.co/blog/structured-codeagent | 2025-05-28 |
| H5 | smolagents docs (v1.27.0.dev0): guided_tour, conceptual_guides/react, tutorials/building_good_agents, examples/multiagents, examples/plan_customization | https://huggingface.co/docs/smolagents (source: github.com/huggingface/smolagents/docs/source/en) | living, read 2026-10-31 |

---

## Patterns

### 1. Mixture-of-Agents (MoA): layered proposers and aggregator
- **Source:** T1, T2, T3 (Together AI). Re-presented as "Parallel Agent Workflow" in T4.
- **Mechanism:** A feed-forward, layered DAG. Layer 1 has n proposer LLMs, usually different models, that each answer the user prompt independently and in parallel. Every agent in layer i+1 receives all n outputs of layer i, injected into its system prompt under an "Aggregate-and-Synthesize" instruction ("synthesize these responses into a single, high-quality response... critically evaluate... some of it may be biased or incorrect"), plus the original prompt. The final layer is a single aggregator model that streams the answer. There are no loops and no early stopping: the run ends after a fixed number of layers (code: `layers = 3`, CLI `--rounds` = layers − 1). The edges are fully connected between consecutive layers.
- **Roles:** proposers ("generate useful reference responses"), aggregators (synthesize a refined answer). Some models work well in both roles (Qwen1.5, LLaMA-3). Others are better only as proposers (WizardLM, Mixtral-8x22B) [snippet].
- **When to use:** To get above single-model quality by combining several open models, through prompting only (no fine-tuning). Use the 2-layer "Lite" form when cost matters. The underlying claim is the "collaborativeness of LLMs": models give better answers when they can see other models' outputs, even weaker ones.
- **Evidence:** Together MoA (6 open proposers, 3 layers, Qwen1.5-110B-Chat aggregator) scored 65.1% LC win rate on AlpacaEval 2.0, against 57.5% for GPT-4o. MoA-Lite (2 layers, Qwen1.5-72B aggregator) scored 59.3% [snippet]. MoA was also top of MT-Bench at the time. On FLASK it beat Qwen1.5-110B on harmlessness, robustness, correctness, efficiency, factuality, commonsense, insightfulness and completeness, and beat GPT-4o on correctness, factuality, insightfulness, completeness and metacognition (T3 README). The paper's RQ2 studies how the number and diversity of proposers affect quality; I could not read those ablation figures.
- **Variants:** "Interactive CLI" multi-turn MoA (bot.py), where every turn is re-aggregated from the reference models.

### 2. Serial chain (prompt chaining) with optional gates
- **Source:** T4 "Serial Chain Agent Workflow"; T5 "Sequential"; M6 notebook "1.1 Prompt Chaining"; Mistral X1 serial_chain_agentic_workflow.
- **Mechanism:** A linear pipeline. Each call consumes the previous call's output. Together adds "optionally... a check between every consecutive LLM call that determines if we should break out of the chain earlier and return the response or terminate the workflow entirely". In the example, a PDF goes through extract, outline, script (structured JSON) and then TTS. The run ends at the last stage or at a gate exit.
- **When to use:** Tasks that break down into fixed, dependent steps (T5: "later steps depend on earlier ones"). Inspect intermediate outputs while tuning each step.
- **Roles:** step-specialised LLM calls plus a non-LLM tool step (TTS).

### 3. Conditional router (LLM selects one route or model)
- **Source:** T4 "Conditional Router Agent Workflow"; T5 "Conditional"; M6 "1.2 Routing" (1 routing agent and 4 support agents); Qwen-Agent `Router` (Q2); Cohere agentic RAG part 1 "Routing queries to data sources" (C1); smolagents agency level ★☆☆ "Router" (H1).
- **Mechanism:** A router LLM gets the task and a schema of routes (models, prompts or action sequences) and returns JSON `{model_choice, reason}`. Exactly one downstream path runs ("activates only one path per LLM call"), and its output is returned. Qwen's `Router` prompt lets the router either answer directly or emit `Call: <agent>`. Generation stops at `Reply:`, and the chosen agent then answers. In Cohere's version each data source is a tool and the model chooses which one to query.
- **When to use:** Inputs fall into categories best served by different models or prompts (for example, code goes to Qwen-Coder or DeepSeek and planning goes to a reasoning model), or different data sources.

### 4. Orchestrator–subtask (orchestrator–workers) parallel workflow
- **Source:** T4 "Orchestrator Subtask Agent Workflow"; Mistral X1 "Parallel Subtask Agent Workflow" (with Tavily search per worker); M6 "3. Orchestrator-Workers".
- **Mechanism:** An orchestrator LLM breaks the task into distinct subtasks (JSON). A worker LLM runs for each subtask in parallel, with its own prompt and possibly its own model. Results are either returned individually or merged by a synthesizer LLM. The fan-out happens once, with no loop. The run ends after synthesis.
- **Contrast with MoA (stated by Together):** MoA sends the same task to every worker. This pattern sends a different aspect of the task to each worker.
- **When to use:** Tasks with separable facets, such as planning, coding and testing, or multi-angle content.

### 5. Looping generator–evaluator
- **Source:** T4 "Looping Agent Workflow"; T5 "Iterative"; M6 "2. Evaluator-Optimizer" (loop until evaluator returns "PASS").
- **Mechanism:** A two-node cycle. The generator proposes a solution (CoT, told to take feedback into account). A constrained evaluator checks it against given criteria and returns structured JSON `{PASS|FAIL, feedback}`. On FAIL, the feedback goes back to the generator. The loop ends on PASS (or a max-iterations cap).
- **When to use:** There are explicit acceptance criteria and iterative refinement adds value. T5 warns that iterative workflows are "great for optimizing... until a termination condition is met but can be costly".

### 6. Executor–advisor escalation (cheap executor, frontier advisor on demand)
- **Source:** T4 "Cross-Provider Advisor Agent Workflow". The notebook credits Minions (Narayan et al., Stanford Hazy Research, arXiv 2502.15964).
- **Mechanism:** One executor agent (a cheap model on Together) runs a normal tool loop. It has a single zero-parameter `advisor` tool with `tool_choice="auto"`. The executor decides when to call it, and orchestration code decides what context to send: it forwards the full transcript to a frontier advisor (Claude Opus on Anthropic) with role labels TASK, EXECUTOR and YOUR EARLIER ADVICE, plus a "<120 words, task-focused, don't critique" instruction. The advice comes back as the tool result. A budget cap counts advisor calls, and once the cap is hit the tool is removed and `tool_choice` is set to "none". The run ends when the executor gives its final answer.
- **When to use:** To cut frontier-model cost while keeping most of its quality. Advisor brevity is the main cost lever.
- **Evidence (cited from Minions):** Minion protocol: about 30.4x lower remote cost at about 87% of frontier quality. MinionS (the cloud model decomposes into parallel local subtasks): about 5.7x lower cost at about 97.9% of frontier quality.
- **Failure mode noted:** If the raw `advisor()` calls are not stripped from the history, the advisor reads them as a delegation loop and answers with meta-commentary.

### 7. Plan → parallel search → reflect-on-gaps loop → write (deep-research workflow)
- **Source:** T6 (Together Open Deep Research). A similar pattern appears in Cohere C1 "Agentic Multi-Stage RAG".
- **Mechanism:** (1) A planning model generates research queries and a separate JSON model structures them. (2) All queries are searched in parallel (Tavily), and a summary model filters and summarizes each result against the topic. (3) An iterative-refinement loop has an LLM evaluate completeness against the research goal, find gaps and generate follow-up queries, then search again. The loop is bounded by a research budget (number of cycles) and query limits. (4) Sources are filtered and capped, then a writer model synthesizes a cited long-form report. Each stage can use a different model.
- **When to use:** Complex, multi-hop research questions that need cited reports.
- **Evidence [snippet]:** Together reports beating base models without search on FRAMES, SimpleQA and HotPotQA, and higher answer quality than LangChain's Open Deep Research and HF smolagents. Coverage notes that early-stage errors propagate through the chain.

### 8. Fresh-context iteration loop ("Ralph" loop, filesystem as the only memory)
- **Source:** T7 (Together cookbook, Nemotron 3 Ultra on LangChain Deep Agents; credits ghuntley.com/ralph).
- **Mechanism:** `while not done: fresh_agent(same_task)`. Each iteration starts a new agent with zero conversation history. It re-orients by reading the workspace (`PROGRESS.md` holds the running state and is read first), makes incremental progress, and writes everything back. The loop ends when the agent writes `DONE.md` or the iteration cap is reached. Re-running on the same work-dir resumes the work. Inside each iteration the Deep Agents harness offers planning (`write_todos`), filesystem tools and sub-agent delegation (`task`).
- **When to use:** Long-running coding, research or document-generation tasks. Context never grows, so no summarization or compaction is needed.

### 9. Hierarchical manager–managed-agent (agent-as-tool) multi-agent
- **Source:** H2, H3, H5 (Hugging Face smolagents and Transformers Agents). Qwen-Agent nested agents (Q2) and Qwen Lv3-over-Lv2 (Q1) are close analogues.
- **Mechanism:** A tree. Each sub-agent has a `name` and `description`, which are embedded in the manager's system prompt like a tool. The manager (a CodeAgent) calls `managed_agents` the way it calls tools, and each sub-agent runs its own ReAct loop with its own tools and memory, then returns only the useful result. The canonical example is a manager CodeAgent with a code interpreter and a web-search agent (a ToolCallingAgent with search and visit_webpage, max_steps=10). The manager ends with `final_answer`.
- **When to use (stated):** "Rather than using a do-it-all system... specialize units on sub-tasks... having agents with separate tool sets and memories allows to achieve efficient specialization... why fill the memory of the code generating agent with all the content of webpages visited by the web search agent?" (H5). Context isolation for context-heavy activities like browsing (H2). The docs say multi-agent "empirically yields better performance on most benchmarks". Use JSON tool-calling sub-agents for strictly sequential, single-timeline work like browsing, and CodeAgents for the planner.
- **Evidence:** In H2, a ReactCodeAgent manager with file_inspector, visualizer and a search_agent wrapper (JSON agent with browser tools), using GPT-4o, scored 44.2% on GAIA validation (#1, 4 points above second) and 33.3% on test (#2, ahead of Autogen, best on Level 3). In H3, Open Deep Research reached 55.15% on GAIA validation, against about 46% for Magentic-One. The gain was attributed mostly to code actions, since the same setup with JSON actions dropped to 33%.

### 10. Code-action ReAct agent (CodeAct) and structured CodeAgent
- **Source:** H1, H4, H5 (Hugging Face). H4 notes that CodeAct comes from Wang et al. 2024.
- **Mechanism:** A single-agent ReAct loop (`MultiStepAgent`). Each step writes memory to messages, calls the model, parses the action and executes it, logs an ActionStep and runs step callbacks. In a CodeAgent the action is a Python snippet that calls tools as functions inside loops and conditionals, which the blog calls "a dynamic graph of tool execution in each action", and it runs in a restricted AST interpreter or sandbox. The structured variant forces JSON `{thoughts, code}`. The loop ends when `final_answer` is called and passes every `final_answer_checks` validator (a failing check logs an error and the loop continues), or when max_steps is reached.
- **When to use:** Tasks needing composition, variables and state across tool calls. Use structured output with capable models. JSON tool calling remains fine for sequential web browsing.
- **Evidence:** Code actions take about 30% fewer steps and tokens than JSON (CodeAct paper, cited in H2/H3). GAIA dropped from 55% to 33% with JSON (H3). Structured CodeAgent scored 2 to 7 points above a plain CodeAgent across GAIA, MATH, SimpleQA and Frames for capable models, with a "structure tax" on small models. Traces with a first-call parsing error succeeded 42.3% of the time versus 51.3% without (H4, 15,724 traces).

### 11. Periodic re-planning step (plan every N steps, facts plus plan, no prior plan)
- **Source:** H2, H5 (`planning_interval`); H5 plan_customization (HITL).
- **Mechanism:** Every N action steps a tool-free PlanningStep runs. It (a) updates a summary of known facts, derived facts and facts still to discover, and (b) writes a fresh step-by-step plan. Both are injected as context for the following actions. Optionally a step callback on PlanningStep pauses the run so a human can approve, edit or cancel the plan, and execution then resumes with memory preserved (human-in-the-loop plan gate).
- **When to use / evidence:** H2 used N=2 for the manager and N=5 for the web agent. "If we do not provide the previous version of the plan as input, the score goes up", because LLMs anchor on the old plan.

### 12. Agency spectrum: processor → router → tool call → multi-step agent → multi-agent
- **Source:** H1 (and H2's graph framing: "agents are systems where the LLM outputs will change the structure of the graph").
- **Mechanism:** A taxonomy, not a topology. ☆☆☆ simple processor; ★☆☆ router (`if llm_decision()`); ★★☆ tool call; ★★★ multi-step agent (`while llm_should_continue()`); ★★★ multi-agent ("one agentic workflow can start another").
- **Guidance:** "Regularize towards not using any agentic behaviour." Use a deterministic workflow if it fits every query, and add agency only when "the pre-determined workflow falls short too often". From H5 building_good_agents: "Reduce the number of LLM calls as much as you can", merge tools, and prefer deterministic functions to agentic decisions.

### 13. GroupChat with speaker selection (host-selected, round-robin, random, manual)
- **Source:** Q2 (Qwen-Agent `GroupChat`, `GroupChatAutoRouter`).
- **Mechanism:** A shared-transcript group conversation. On each turn a speaker is chosen: `auto` uses a host LLM, which reads the history ("newer turns matter more") and returns the next role name or `[STOP]`; the alternatives are `round_robin`, `random` and `manual` (the user picks). The user is itself an agent, so the chat can ask the human for input, and the user can interrupt at any time. Each speaker's view of the messages is rewritten for that speaker (`_manage_messages`). The run ends at `max_round` (default 3) or when the host returns `[STOP]`.
- **When to use:** Role-play and multi-party interaction (Gomoku example, group_chat_demo).

### 14. Long-document map-filter-reduce agent (chunk-by-chunk reading) and sub-question agent over it
- **Source:** Q1, Q2 (`ParallelDocQA`, members and summary).
- **Mechanism:** Three levels, each built on the one before. Lv1 is RAG: the LLM splits the query into information and instruction parts, generates multilingual keywords, and BM25 picks chunks. Lv2 is chunk-by-chunk: for each 512-token chunk, in parallel, the LLM returns the relevant sentences or "None". The non-None outputs become the retrieval query (BM25), and the answer is generated within an 8k window (a map-filter-reduce fan-out). Lv3 is step-by-step: a tool-calling or ReAct agent wraps Lv2 as a tool. While it cannot answer from memory, it poses a sub-question, asks Lv2, and adds the reply to memory, then answers.
- **When to use:** Question answering over documents far longer than the model window (up to 1M tokens with an 8k model). Also useful for synthesizing long-context training data, by distilling the agent into a model.
- **Evidence:** On NeedleBench and LV-Eval (256k), the 4k-Agent consistently beat both the 32k-context model and 4k-RAG. It also passed a 1M-token single-needle pressure test.

### 15. Nested sequential sub-agents (custom agent composing Assistants)
- **Source:** Q2 (Qwen-Agent "Nested Development", VisualStorytelling example).
- **Mechanism:** A custom `Agent._run` is a fixed pipeline. A VL assistant describes the image, and its output is appended to the messages. A writing assistant with its own system prompt, tools and RAG files then composes the essay. The run ends after the last sub-agent.
- **Stated rationale:** "Each Agent can use independent prompts, tools, and LLMs to achieve the best result at each stage."

### 16. Handoff network (peer agents transfer control; server- or client-executed)
- **Source:** X1 travel_assistant, X2 (Mistral Agents API, May 2025), X3 (Durable Agents on Mistral Workflows) [snippets].
- **Mechanism:** Agents are created server-side, each with its own model, tools and instructions. Each agent's `handoffs` list names the agents it may pass the conversation to, which forms a directed graph. In the cookbook a triage agent can hand off to trip-itinerary, hotel-search and customer-care agents, and those agents can hand off among themselves (a mesh). With `handoff_execution="server"` (the default in SDK examples) Mistral performs the handoff inside the conversation, so "a single request can trigger tasks across multiple agents". With `"client"` the handoff is returned to the caller to execute. Conversation state persists server-side, and conversations can be restarted from an entry. The run ends when an agent replies without a further handoff. Durable Agents (X3) runs the same loop in a Runner on Mistral Workflows with a RemoteSession (production) or LocalSession.
- **When to use:** Multi-domain assistants where specialists own distinct tools, such as a financial agent handing off to web-search or computation agents.

### 17. Lead-agent planner with dynamically created sub-agents and synthesis
- **Source:** X1 HubSpot Dynamic Multi-Agent System (Magistral); X1 MAECAS (multi-agent earnings-call analysis).
- **Mechanism:** An AgentOrchestrator runs the flow. A LeadAgent (Magistral reasoning, `<think>`) analyses the query and writes an execution plan naming which specialised sub-agents to create at runtime. Those sub-agents are instantiated, execute analysis and CRM updates, and a synthesis step produces the final insight and recommendations. The run ends after synthesis.
- **When to use:** Enterprise queries whose required specialists are not known in advance.

### 18. Agentic RAG tool-use patterns: parallel calls, multi-step sequential, parallel-within-sequential, self-correction, multi-stage retrieval
- **Source:** C1 (Cohere).
- **Mechanism:** A single-agent tool loop. Repeat `while res.message.tool_calls`. Each step emits a `tool_plan` (a reflection on next steps) and then one or more tool calls. The documented patterns are:
  - **Parallel tool calling:** several calls to the same or different tools in one step. State is one assistant message plus one tool message per call.
  - **Directly answering:** the model calls no tool.
  - **Multi-step tool use:** the output of one call feeds the next.
  - **Multi-step + parallel:** for example, find the top-3 companies, then look up their 3 CEOs in parallel.
  - **Self-correction:** when one source returns nothing relevant, the agent changes plan midway and tries another tool.
  - **Forced tool use.**
  - **Multi-faceted queries:** structured filters.
  - **Query expansion:** parallel queries across multiple sources.
  - **Multi-stage retrieval:** keep retrieving the references found inside retrieved docs.

  The run ends when the model returns text without tool calls, with citations.
- **When to use:** Diverse sources, sequential reasoning, multi-part questions, document comparison and structured data (C1). Use multi-stage RAG "where accuracy is a top priority and latency is not" (lawyers searching contracts).
- **Evidence:** A qualitative table in the multi-stage RAG cookbook: simple RAG gets the multi-stage question wrong and agentic RAG gets it right.

### 19. Guardrail-sandwiched agent execution loop
- **Source:** M6 (Llama Stack/OGX "Agent Execution Loop").
- **Mechanism:** Each turn runs (1) an input guardrail (shield) check, (2) optional RAG retrieval injected as a tool response, then (3) an inference loop: generate, and if there are tool calls, guardrail-check the tool inputs, execute, and feed results back. The loop ends with a final response without tool calls, max iterations or the token limit. Last comes (4) an output guardrail check on the final response.
- **When to use:** Any production agent that needs safety screening at its boundaries and on tool inputs.

### 20. Self-improving agent: agentic task loop plus periodic deterministic eval-and-rewrite-own-prompt
- **Source:** M6 blog "Building a Self-Improving Agent with OGX" (2026-03-01).
- **Mechanism:** Two layers. The inner layer is an agentic Responses-API `while True` loop: server-side file_search plus client tools to list, read and index local files, ending when no function calls are emitted. The outer layer is deterministic: every N `research()` calls it runs `evaluate_self()` (test cases scored by a different judge model, logged to a SQLite ledger) and then `improve_self()`, which proposes a new system prompt from the feedback and stores a new version via the Prompts API.
- **When to use:** Steadily improving an agent's prompt in production, with a separate judge model to avoid self-grading bias.

### 21. Multi-agent collaborative reasoning conversation (self-collaboration: same model in two roles, debate to agreement)
- **Source:** M1 (Meta FAIR, Coral and MATRIX).
- **Mechanism:** Two agents (two instances of the same LLM) hold a multi-turn conversation on a reasoning problem (MATH, MMLU-Pro, GPQA, ExploreToM, HiToM). They propose, challenge, persuade and must reach agreement. MATRIX is the multi-agent communication backend for evaluation and for generating synthetic conversations. The conversations are then used for SFT and DPO, so the topology is used both at inference and for training.
- **Evidence [snippet]:** Self-improvement gains of up to 29.4% over single-agent chain-of-thought (Meta page). The NeurIPS abstract reports up to 16.7% absolute over finetuned CoT. A finding: current models "cannot consistently use collaboration to improve" and are overly agreeable (agreement above 90% regardless of correctness).

### 22. Agent–simulated-collaborator multi-turn loop (with privileged critic for training)
- **Source:** M2 (FAIR and Berkeley, SWEET-RL, ColBench).
- **Mechanism:** An LLM agent and a simulated human collaborator (an LLM with hidden information) exchange turns to co-produce an artifact (backend code or a frontend design). The agent must ask clarifying questions before submitting. For training, a critic with access to the hidden reference gives turn-level credit. The run ends at submission or at the turn limit.
- **When to use:** Building agents that must elicit requirements from a human over many turns.

### 23. Challenger–executor (Challenger–Reasoner) self-play
- **Source:** M3, M4 (FAIR) [snippets].
- **Mechanism:** One model alternates between two roles. The challenger explores tools (M3) or mines a document corpus (M4) and writes tasks with verifiers. M3 uses "Code-as-Task": an instruction, a verification function, and solution and failure cases. The executor or reasoner attempts the tasks, without the source document in M4. Rewards go to the executor for correctness and to the challenger for tasks at the edge of the executor's ability (variance of success in M4). The two roles form a training loop.
- **Evidence:** M3: Llama-3.1-8B roughly doubled its success on M³ToolEval and TauBench using only self-generated data. M4: +8.9% on math and +9.8% on general reasoning benchmarks.

### 24. Agent2Agent: apps replaced by communicating sub-agents
- **Source:** M5 (Meta ARE/Gaia2).
- **Mechanism:** The main agent can no longer call some app tools directly. Each such app is represented by an app-agent with its own LLM policy and the app's tools, and the main agent must message it instead. In Gaia2-mini, 70% of apps become sub-agents running the same model as the main agent, "since good agent2agent scores require being both good as 'main' agent and as 'sub' agent" (160 scenarios). The design mirrors Google's A2A protocol.
- **Evidence [snippet]:** Decomposition helps weaker models but can hurt stronger ones, and heterogeneous teams beat homogeneous ones.

### 25. Search-agent context-management strategies (Summary, Discard-75%, Discard-all) vs parallel fan-out (Parallel-fewest-step)
- **Source:** D1 (DeepSeek-V3.2 paper) [snippet].
- **Mechanism:** A single ReAct search agent. When token use passes 80% of the window, one of three actions runs: Summary compresses the trajectory, Discard-75% drops the oldest three quarters of tool history, and Discard-all resets the tool history and continues with the task. The baseline, Parallel-fewest-step, runs N independent agents in parallel and takes the answer from the run that used the fewest steps.
- **Evidence:** On BrowseComp, Discard-all scored 67.6, about matching parallel scaling with far fewer steps. Later papers (Step 3.5 Flash, QuarkMedSearch) confirm large gains from Discard-all.
- **Related guidance (D2, D3):** V3.2 is DeepSeek's first model to "integrate thinking directly into tool-use". Multi-turn tool calls in thinking mode must pass `reasoning_content` back on every turn. V3.1 ships separate search-agent and code-agent templates, and its benchmarks used internal frameworks (search API + page filter + 128K context; an internal code-agent framework for SWE-bench).

### 26. Research–Synthesis "Heavy mode" (parallel IterResearch agents and a synthesis model)
- **Source:** Q3 (Alibaba Tongyi DeepResearch) [report snippet].
- **Mechanism:** Each of n research agents runs IterResearch. Research is split into discrete rounds, and each round rebuilds a compact workspace instead of keeping the whole history. Each agent ends with a compressed final report that keeps the core reasoning and findings. A separate synthesis model then merges the n reports into the answer. The standard alternative mode is plain ReAct.
- **When to use:** As test-time scaling to reach peak performance. Use ReAct to measure the model's intrinsic ability.
- **Evidence:** Heavy mode: HLE 38.3%, BrowseComp 58.3%, BrowseComp-ZH 58.1%.

### 27. Always-on memory plus progressive-disclosure skills (single agent configured by files)
- **Source:** T7 Content Writer (Together and LangChain Deep Agents).
- **Mechanism:** `AGENTS.md` is injected into the system prompt on every turn. Skills (`skills/*/SKILL.md`) show only their name and description, and the agent reads the full file when a request matches. Behaviour changes by editing files, not code. This is a context-composition pattern rather than a multi-node topology.

---

## Cross-source notes

- **Many labs restate Anthropic's workflow set.** Together (T4/T5), Meta Llama Stack/OGX (M6, explicitly citing "Building Effective Agents") and Mistral (X1) each publish prompt chaining, routing, parallelization, orchestrator-workers and evaluator-optimizer as cookbook patterns. Together's distinct addition is parallel same-task workers merged by an aggregator, i.e. MoA.
- **Same-task vs different-task fan-out.** Together explicitly separates MoA (same prompt to every worker, then aggregate) from orchestrator-subtask (different subtasks, then synthesize).
- **Context isolation is the main stated reason for sub-agents** (HF H2/H5; Qwen Lv2-as-tool). Context reset or compression is the main stated lever for long-horizon single agents (DeepSeek Discard-all, Tongyi IterResearch, Ralph loop).
- **Evidence on multi-agent value is mixed.** HF reports that multi-agent helps on GAIA, partly because of code actions. Meta FAIR (Coral, Gaia2 A2A) finds that collaboration often fails to help, with over-agreement, and that decomposition hurts strong models.

## Canonical pattern names (for merge)

Mixture-of-Agents (layered proposer/aggregator); Serial chain with gates; Conditional router; Orchestrator-subtask (orchestrator-workers); Looping generator-evaluator; Executor-advisor escalation; Plan-search-reflect deep-research loop; Fresh-context Ralph loop; Hierarchical manager/managed agents (agent-as-tool); Code-action ReAct agent (CodeAct / structured CodeAgent); Periodic re-planning with HITL plan gate; Agency spectrum (taxonomy); GroupChat with speaker selection; Chunk-parallel map-filter-reduce reader with sub-question agent; Nested sequential sub-agents; Handoff network (server/client-executed); Lead-agent with dynamic sub-agent creation; Agentic-RAG tool-use patterns (parallel / multi-step / self-correction / multi-stage); Guardrail-sandwiched agent loop; Self-improving agent (eval-and-rewrite-prompt outer loop); Collaborative reasoning conversation (self-collaboration debate); Agent-simulated-collaborator loop; Challenger-executor self-play; Agent2Agent app sub-agents; Context-management resets vs Parallel-fewest-step; Research-Synthesis heavy mode (parallel IterResearch + synthesizer); Always-on memory + progressive-disclosure skills.
