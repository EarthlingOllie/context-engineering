# Frameworks: LangChain / LangGraph, CrewAI, LlamaIndex — orchestration topologies

Branch 5 of 7 (lab-topologies fan-out). Retrieved 2026-10-31.

**How the sources were read.** This session's network blocks docs.langchain.com, langchain-ai.github.io, blog.langchain.com, www.langchain.com, docs.crewai.com and llamaindex.ai. Most sources were therefore read from the frameworks' own GitHub docs sources, cloned at the commits listed below. These are the files that build the official docs sites, so the canonical docs URL is given beside each one. Blog posts could not be fetched. Their titles, dates and key claims come from web-search excerpts of the official posts, and each one is marked **[search excerpt]**. Treat those numbers as second-hand until someone reads the post itself.

## Sources

| ID | Title | Date | Canonical URL | Read from |
|---|---|---|---|---|
| L1 | LangChain docs: Multi-agent (overview, patterns, performance comparison) | living doc, read 2026-10-31 | https://docs.langchain.com/oss/python/langchain/multi-agent | langchain-ai/docs@5ffd926 `src/oss/langchain/multi-agent/index.mdx` |
| L2 | LangChain docs: Subagents | living | https://docs.langchain.com/oss/python/langchain/multi-agent/subagents | same repo, `subagents.mdx` |
| L3 | LangChain docs: Handoffs | living | https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs | `handoffs.mdx` |
| L4 | LangChain docs: Router | living | https://docs.langchain.com/oss/python/langchain/multi-agent/router | `router.mdx` |
| L5 | LangChain docs: Skills | living | https://docs.langchain.com/oss/python/langchain/multi-agent/skills | `skills.mdx` |
| L6 | LangChain docs: Custom workflow | living | https://docs.langchain.com/oss/python/langchain/multi-agent/custom-workflow | `custom-workflow.mdx` |
| L7 | LangGraph docs: Workflows and agents | living | https://docs.langchain.com/oss/python/langgraph/workflows-agents | `src/oss/langgraph/workflows-agents.mdx` |
| L8 | LangChain docs: Migrate from langgraph-supervisor | living | https://docs.langchain.com/oss/python/migrate/langgraph-supervisor | `src/oss/python/migrate/langgraph-supervisor.mdx` |
| L9 | Deep Agents docs: Overview, Subagents, Async subagents | living | https://docs.langchain.com/oss/python/deepagents/subagents | `src/oss/deepagents/{overview,subagents,async-subagents}.mdx` |
| G1 | LangGraph concepts: Multi-agent systems (archived docs: network, supervisor, supervisor-tool-calling, hierarchical, custom) | archived, read 2026-10-31 | https://langchain-ai.github.io/langgraph/concepts/multi_agent/ | langchain-ai/langgraph@23961cf `docs/docs/concepts/multi_agent.md` |
| G2 | LangGraph concepts: Agent architectures (router, tool-calling agent, custom) | archived | https://langchain-ai.github.io/langgraph/concepts/agentic_concepts/ | same commit, `agentic_concepts.md` |
| G3 | LangGraph tutorials: Multi-agent network; Hierarchical agent teams | archived | .../tutorials/multi_agent/ | same commit, `docs/docs/tutorials/multi_agent/*.ipynb` |
| G4 | LangGraph tutorials: Plan-and-execute; ReWOO; LLMCompiler | archived | .../tutorials/plan-and-execute/ etc. | same commit, `docs/docs/tutorials/{plan-and-execute,rewoo,llm-compiler}` |
| G5 | LangGraph tutorials: Reflection; Reflexion; LATS | archived | .../tutorials/reflection/ etc. | same commit, `docs/docs/tutorials/{reflection,reflexion,lats}` |
| P1 | langgraph-supervisor-py README | living (repo HEAD 2026-07-14) | https://github.com/langchain-ai/langgraph-supervisor-py | @88859b3 |
| P2 | langgraph-swarm-py README | living (repo HEAD 2026-10-29) | https://github.com/langchain-ai/langgraph-swarm-py | @8956b13 |
| B1 | LangGraph: Multi-Agent Workflows (LangChain blog) | Jan 2024 (date not confirmed in excerpt) | https://blog.langchain.com/langgraph-multi-agent-workflows | [search excerpt] |
| B2 | Plan-and-Execute Agents (LangChain blog) | 2024-02-13 | https://blog.langchain.com/planning-agents | [search excerpt] |
| B3 | Reflection Agents (Ankush Gola, LangChain blog) | 2024-02-21 | https://blog.langchain.com/reflection-agents | [search excerpt] |
| B4 | Benchmarking Multi-Agent Architectures (Will Fu-Hinthorn, LangChain blog) | 2025-06-10 | https://blog.langchain.com/benchmarking-multi-agent-architectures | [search excerpt] |
| B5 | How and when to build multi-agent systems (Harrison Chase, LangChain blog) | 2025-06-16 | https://blog.langchain.com/how-and-when-to-build-multi-agent-systems | [search excerpt] |
| C1 | CrewAI docs: Processes | living | https://docs.crewai.com/en/concepts/processes | crewAIInc/crewAI@97bbfb6 `docs/edge/en/concepts/processes.mdx` |
| C2 | CrewAI docs: Sequential Processes; Hierarchical Process | living | https://docs.crewai.com/en/learn/sequential-process , .../hierarchical-process | `docs/edge/en/learn/*.mdx` |
| C3 | CrewAI docs: Flows | living | https://docs.crewai.com/en/concepts/flows | `docs/edge/en/concepts/flows.mdx` |
| C4 | CrewAI docs: Introduction (Flows + Crews architecture) | living | https://docs.crewai.com/en/introduction | `docs/edge/en/introduction.mdx` |
| C5 | CrewAI docs: Collaboration; Crews (planning, kickoff_for_each) | living | https://docs.crewai.com/en/concepts/collaboration , .../crews | `docs/edge/en/concepts/{collaboration,crews}.mdx` |
| Y1 | LlamaIndex docs: Multi-agent patterns in LlamaIndex | living | https://developers.llamaindex.ai/python/framework/understanding/agent/multi_agent | run-llama/llama_index@619d746 `docs/src/content/docs/framework/understanding/agent/multi_agent.md` |
| Y2 | LlamaIndex examples: Multi-Agent Report Generation with AgentWorkflow; Custom Planning Multi-Agent System | living | .../examples/agent/agent_workflow_multi , .../custom_multi_agent | same repo, `docs/examples/agent/*.ipynb` |
| Y3 | LlamaIndex Workflows docs: Introduction; Branches and loops; Concurrent execution | living | https://developers.llamaindex.ai/python/llamaagents/workflows | run-llama/workflows-py@a457071 `docs/src/content/docs/llamaagents/workflows/*.md` |
| Y4 | Introducing workflows beta (LlamaIndex blog) | 2024-08-01 | https://www.llamaindex.ai/blog/introducing-workflows-beta-a-new-way-to-create-complex-ai-applications-with-llamaindex | [search excerpt] |
| Y5 | Introducing AgentWorkflow (LlamaIndex blog) | 2025-01-22 | https://www.llamaindex.ai/blog/introducing-agentworkflow-a-powerful-system-for-building-ai-agent-systems | [search excerpt] |

Framing that recurs across the sources:
- **Start with a single agent.** L1 says "not every complex task requires this approach—a single agent with the right (sometimes dynamic) tools and prompt can often achieve similar results."
- **Context engineering is the main design problem.** L1 says "At the center of multi-agent design is context engineering—deciding what information each agent sees."
- **Why go multi-agent.** L1 names three reasons: context management, distributed development and parallelization. G1 names modularity, specialization and control. B5 says multi-agent works best for read-heavy, parallelizable tasks, and worse when agents must share context or depend heavily on each other.
- **Workflows versus agents.** L7: "Workflows have predetermined code paths... Agents are dynamic and define their own processes and tool usage."

---

## A. LangChain / LangGraph

### A1. Prompt chaining (sequential pipeline)
- **Mechanism:** LLM-call nodes run in a fixed linear order joined by normal edges. Each call processes the previous call's output. A programmatic check (a "gate") can sit between steps and branch to END or to a fix-up path. The chain terminates at the last node.
- **When to use:** "well-defined tasks that can be broken down into smaller, verifiable steps", such as translating a document or verifying content for consistency (L7).
- **Roles:** step LLMs and an optional gate function.
- **Source:** L7. This is LangGraph's rendering of the Anthropic workflow taxonomy, so the merge should dedupe it against branch 1.

### A2. Parallelization (sectioning / voting)
- **Mechanism:** START fans out to N independent LLM nodes, which run concurrently. An aggregator node fans them back in. There are two variants. In sectioning, the nodes do different subtasks. In voting, the same task runs several times to get several outputs. The workflow terminates after aggregation.
- **When to use:** sectioning "increases speed", and voting "increases confidence". Examples are a keyword pass plus a formatting check, or scoring the same document against several criteria (L7).
- **Roles:** parallel workers and an aggregator.
- **Source:** L7.

### A3. Routing / Router
- **Mechanism:** A classifier step (an LLM with structured output, or rules) reads the input. A conditional edge (`Command`) then sends it to one specialized node or agent. With `Send`, the router can instead fan out to several agents in parallel, and a synthesizer node merges their results. A stateless router handles each request independently. A stateful router either sits behind a conversational agent as a tool, or keeps its own history.
- **When to use:** "distinct verticals (separate knowledge domains that each require their own agent)" where you "need to query multiple sources in parallel" and want one combined answer (L4). G2 calls the router the agent architecture with the least LLM control: the LLM makes one decision from a fixed set of options.
- **Roles:** router/classifier, specialist agents and a synthesizer.
- **Router vs supervisor (L4):** a router is a lightweight preprocessing step. A supervisor is a full agent that keeps context and orchestrates across turns.
- **Evidence (L1, the docs' own worked example):** a one-shot request takes 3 model calls. A repeat request takes 3 more calls each turn, because the router is stateless. A three-domain comparison takes 5 calls and about 9K tokens, tied best with subagents.
- **Sources:** L4, L7, G2.

### A4. Orchestrator-worker (dynamic fan-out with `Send`)
- **Mechanism:** An orchestrator LLM breaks the task into a list of subtasks that is decided at run time. `Send` creates one worker node per subtask, and the workers run in parallel and write to a shared state key. A synthesizer node then merges the outputs. The workflow terminates after synthesis.
- **When to use:** "when subtasks cannot be predefined the way they can with parallelization", for example code edits across an unknown number of files (L7). G2 also calls this map-reduce via the Send API.
- **Roles:** orchestrator, workers and a synthesizer.
- **Source:** L7 and G2. The merge should dedupe this against Anthropic's orchestrator-workers.

### A5. Evaluator-optimizer (generator–critic loop)
- **Mechanism:** A generator LLM produces an output. An evaluator LLM, or a human through an interrupt, grades it against success criteria. If it fails, the evaluator's feedback goes back to the generator. The loop terminates when the output is "acceptable".
- **When to use:** "when there's particular success criteria for a task, but iteration is required to meet that criteria", for example translation (L7).
- **Roles:** generator, evaluator and an optional human.
- **Source:** L7. Basic reflection (A13) is close to this but uses the same model as its own critic.

### A6. Tool-calling agent (ReAct loop)
- **Mechanism:** One LLM node and one tool node form a cycle. The LLM chooses tools, the tool node runs them, and the observations go back to the LLM. The loop "terminates when the agent decides it has enough information... and it is not worth calling any more tools" (G2).
- **When to use:** "situations where problems and solutions are unpredictable" (L7). This is the baseline the other topologies are compared against.
- **Roles:** an LLM policy and a tool executor.
- **Sources:** G2, L7.

### A7. Network (many-to-many multi-agent)
- **Mechanism:** Each agent is a graph node and can route to any other agent or to END. It does this by returning `Command(goto=..., update=...)`, which may also loop back to itself. There is no central controller. The run terminates when some agent routes to END.
- **When to use:** "problems that do not have a clear hierarchy of agents or a specific sequence in which agents should be called" (G1). The tutorial (G3) presents it as divide-and-conquer across experts and says it was inspired by AutoGen.
- **Roles:** peer specialist agents.
- **Sources:** G1, G3, B1 ("Multi Agent Collaboration"). The current docs (L1) no longer list "network". It falls under Handoffs (A9).

### A8. Supervisor, in two variants
- **(a) Graph-node supervisor.** A supervisor LLM node decides which worker node runs next, using `Command` or structured output with a `next` field. Every worker's edge returns to the supervisor, which loops until it routes to END. G1 says the design "lends itself well to running multiple agents in parallel or using map-reduce". Library form: `create_supervisor` (P1). P1 describes it this way: "the supervisor controls all communication flow and task delegation". The handoff tools pass the full message history by default. Options control what is passed back: `output_mode` = `full_history` or `last_message`, and `add_handoff_messages`. A `forward_message` tool returns a worker's answer to the user word for word.
- **(b) Supervisor as tool-calling agent (subagents-as-tools).** Each worker is wrapped as a tool. The supervisor is an ordinary ReAct agent "running in a while loop calling tools until it decides to stop" (G1). This variant is now the recommended form. P1 says "We now recommend using the supervisor pattern directly via tools rather than this library". L8 says langgraph-supervisor "is no longer actively maintained" and points users to the Subagents pattern (A10).
- **When to use:** whenever a central agent should choose the next specialist. B1 describes the supervisor as "an agent whose tools are other agents".
- **Roles:** supervisor and workers.
- **Evidence (B4, [search excerpt], 2025-06-10):** tested on a modified τ-bench with an increasing number of distractor domains.
  - The single agent's token use grows with the number of domains. Supervisor and swarm stay flat.
  - Swarm "slightly outperforms supervisor across the board". The gap comes from the supervisor's "translation" step, because sub-agents cannot answer the user directly.
  - Two fixes to the supervisor gave roughly a 50% performance gain. The first removes handoff messages from the sub-agent's context. The second adds `forward_message`, which cuts errors from the supervisor paraphrasing sub-agents.
  - Even after the fixes, the supervisor "still lags behind single agent" at low domain counts.
- **Sources:** G1, P1, L8, B1, B4.

### A9. Handoffs (state-driven agent switching), including Swarm
- **Mechanism:** Tools such as `transfer_to_sales` return a `Command` that updates a persistent state variable (`active_agent` / `current_step`) and pairs it with a `ToolMessage`. The next turn reads that variable to choose the agent, or the system prompt and tool set. There are two implementations (L3).
  - A single agent whose middleware swaps prompt and tools. L3 says this is "for most handoffs use cases".
  - Separate agent subgraphs that jump between each other with `Command.PARENT`. This one needs explicit context filtering: pass the handoff AIMessage and ToolMessage pair, not the subagent's internal messages.

  Whichever agent is active talks to the user directly. A turn ends when the active agent replies with an AIMessage.
- **Swarm variant (P2):** "agents dynamically hand off control to one another based on their specializations. The system remembers which agent was last active", so the next user turn resumes with that agent. This needs a checkpointer. The default handoff passes the full shared message history, and the agents share one `messages` key unless customized.
- **When to use:** "enforce sequential constraints (unlock capabilities only after preconditions are met)", when agents must "converse directly with the user across different states", and for multi-stage conversational flows such as customer support (L3).
- **Roles:** peer agents or states, each holding handoff tools.
- **Evidence:**
  - L1 call counts: a one-shot request takes 3 calls. A repeat request takes 2, because the active agent persists, which saves 40–50%. A three-domain comparison takes 7+ calls and about 14K+ tokens, because handoffs run sequentially and cannot fan out.
  - B4: swarm beat supervisor on τ-bench.
- **Terminology:** L3 credits OpenAI with the term "handoffs".
- **Sources:** L3, L1, P2, G1 (Handoffs section), B4.

### A10. Subagents (main agent with subagents as tools)
- **Mechanism:** A main agent (a "supervisor") calls subagents as tools. By default the subagents are stateless and each starts in a clean context window. The main agent decides what to delegate, passes an input (the query alone or the full context), and gets back the result or the full history. It can call several subagents in one turn for parallelism. All routing passes through the main agent, and subagents do not talk to the user, except through interrupts.
- **Two tool shapes:**
  - Tool per agent: fine-grained control over each subagent.
  - Single `task` dispatch tool: the subagent is picked by name, the task goes in as a human message, and the subagent's final message comes back. This suits many agents built by distributed teams, and sometimes subagents identical to the parent, where the point "is really about context isolation".
- **Sync vs async:** sync blocks the main agent. Async uses three tools (start job, check status, get result), so the main agent can keep talking with the user.
- **When to use:** "multiple distinct domains (e.g., calendar, email, CRM, database), subagents don't need to converse directly with users, or you want centralized workflow control" (L2). For a few tools, use a single agent.
- **Roles:** main agent (supervisor) and subagents.
- **Evidence (L1):** a one-shot request takes 4 calls, one extra because results flow back through the main agent. A repeat request takes 4 calls every time. A three-domain comparison takes 5 calls and about 9K tokens, 67% fewer tokens than Skills because of context isolation.
- **Sources:** L2, L1, L8.

### A11. Skills (progressive disclosure inside a single agent)
- **Mechanism:** One agent stays in control. It holds lightweight "skill" descriptors and loads a skill's full prompt and knowledge on demand with a tool call, so the context arrives in the conversation only when needed. Skills can be hierarchical, can register tools dynamically, or can point to files the agent reads later. Termination is the normal agent loop.
- **When to use:** "a single agent with many possible specializations, you don't need to enforce specific constraints between skills, or different teams need to develop capabilities independently" (L5).
- **Roles:** a single agent and skill packages.
- **Evidence (L1):** a one-shot request takes 3 calls. A repeat request takes 2. A three-domain comparison takes only 3 calls but about 15K tokens, because the loaded skill text is reprocessed on every later call.
- **Source:** L5, L1. L5 says it is "conceptually identical to Agent Skills and llms.txt".

### A12. Hierarchical teams (supervisor of supervisors)
- **Mechanism:** Each team is a compiled subgraph with its own supervisor and workers. A top-level supervisor routes between the team subgraphs, and every team edge returns to the top supervisor until it routes to END. Each team can keep its own state schema. The tutorial (G3) builds a research team (search and scraper agents) and a doc-writing team, under "a top-down planning policy". In the current docs (L8), nested supervisors become nested tool-wrapped middle-tier agents, or are flattened to one tool per leaf agent.
- **When to use:** "As you add more agents... it might become too hard for the supervisor to manage all of them", which recreates the problems that motivated multi-agent in the first place (G1). G3 adds: "What if the job for a single worker becomes too complex? What if the number of workers becomes too large?"
- **Roles:** top supervisor, team supervisors and workers.
- **Sources:** G1, G3, P1 ("Multi-level Hierarchies"), B1, L8.

### A13. Custom multi-agent workflow (hybrid deterministic + agentic graph)
- **Mechanism:** You write the graph yourself: sequential steps, conditional branches, loops and parallel `Send`. Each node can be a function, an LLM call, a whole agent, or another multi-agent pattern embedded as a node. Each agent talks to only a subset of the others. Some edges are fixed (normal edges) and some are LLM-decided (`Command`). The L6 example runs a rewrite model node, then a deterministic retrieve node, then an agent node.
- **When to use:** "standard patterns... don't fit", when you "need to mix deterministic logic with agentic behavior", or need complex multi-stage routing (L6).
- **Roles:** any.
- **Sources:** L6, G1.

### A14. Plan-and-execute (planner, executor, replanner)
- **Mechanism:** A planner LLM writes a multi-step plan as a list of strings. A single-task executor agent (a ReAct agent) runs the first step. A replanner LLM looks at the original goal, the steps done and their results. It either returns a final response, which ends the run, or a revised list of remaining steps, which loops back to the executor.
- **When to use, and benefits (G4):** "Explicit long term planning (which even really strong LLMs can struggle with)". It also allows a smaller or weaker model for execution and a bigger one only for planning.
- **Limitation:** tasks run sequentially. G4 suggests using a DAG instead, as LLMCompiler does.
- **Roles:** planner, executor and replanner.
- **Lineage:** inspired by Plan-and-Solve (arXiv 2305.04091) and BabyAGI.
- **Sources:** G4, B2 (2024-02-13), which calls plan-and-execute, ReWOO and LLMCompiler "prototypical of the plan-and-execute design pattern, which separates an LLM-powered planner from the tool execution runtime". LangChain also had a 2023-05-10 Plan-and-Execute agent post [search excerpt].

### A15. ReWOO (Reasoning WithOut Observation)
- **Mechanism:** A planner LLM writes the whole tool chain in one pass, with variable placeholders, for example `#E2 = Tool[arg with #E1]`. A worker node runs the tools in order and substitutes earlier results into later arguments, with no LLM call between steps. A solver LLM then reads the plan and all the evidence and writes the answer. The run terminates after the solver, and there is no replanning.
- **When to use, and benefits (G4):**
  - Cuts token use and latency, because ReAct repeats the system prompt and previous steps on every reasoning step.
  - The planner can be fine-tuned without running the tools.
- **Roles:** planner, worker (tool executor) and solver.
- **Source:** G4, B2, citing arXiv 2305.18323. A "5x token-efficiency" figure appears only second-hand, so it is not verified.

### A16. LLMCompiler (streaming DAG planner + parallel task executor + joiner)
- **Mechanism:** A planner streams a DAG of tasks, each with a tool, arguments and dependencies. A task-fetching unit schedules each task as soon as its dependencies are met, so independent tasks run in parallel. A joiner LLM then either answers the user, which ends the run, or triggers a replan, which loops back to the planner.
- **When to use:** to "speed up" agentic tasks through eager parallel execution and to save tokens through fewer LLM calls (G4).
- **Roles:** planner, task-fetching unit/executor and joiner.
- **Source:** G4, B2, citing Kim et al., arXiv 2312.04511.

### A17. Basic reflection (generate, reflect, repeat)
- **Mechanism:** A generator writes a draft. A reflector prompt critiques it in the role of a teacher or grader. The critique goes back to the generator as a new message. The loop runs a fixed number of times, or until an LLM or other check judges the draft good enough.
- **When to use / caveat:** G5 says "self-reflection is inherently cyclic: it is much more effective if the reflection step has additional context or feedback (from tool observations, checks, etc.)". Without grounding, B3 says the "final result may not be significantly better than the original".
- **Roles:** generator and reflector (often the same model).
- **Sources:** G5, B3 (2024-02-21).

### A18. Reflexion (actor with grounded self-critique and revision)
- **Mechanism:** The initial responder gives an answer, a self-critique and search queries. A tool node runs the queries. A revisor rewrites the answer from the critique and the new evidence, and emits new critique and queries. The tool-revise loop runs for a fixed number of iterations. The paper also has an external evaluator and an episodic memory of reflections. The LangGraph version builds only the actor.
- **When to use:** it "trades off execution time for quality... usually (not always) increases the response quality but takes much longer" (G5).
- **Roles:** actor (responder and revisor), tool executor, and optionally an evaluator and memory.
- **Source:** G5, B3, citing Shinn et al., arXiv 2303.11366.

### A19. LATS (Language Agent Tree Search)
- **Mechanism:** This is Monte-Carlo tree search over agent trajectories, run in a loop:
  1. Select the node with the highest UCB, which balances exploitation against exploration.
  2. Expand it by generating N candidate actions (5 in the tutorial) and running them in parallel.
  3. Reflect and evaluate: an LLM scores each outcome, optionally using external feedback such as code execution.
  4. Backpropagate the scores up the tree.

  In the graph, a "start" node and an "expand" node each combine generation with reflection. The loop terminates when a valid solution is found or the maximum rollouts/depth is reached.
- **When to use:** quality-critical tasks where extra inference compute is acceptable. G5 says it achieves "better overall task performance compared to similar techniques like ReACT, Reflexion, or Tree of Thoughts", as claimed by the paper.
- **Roles:** expander/generator, reflector/evaluator and a tree-search controller.
- **Source:** G5, B3, citing Zhou et al., arXiv 2310.04406.

### A20. Deep agent harness (planning + filesystem + general-purpose subagents, sync or async)
- **Mechanism:** A main agent runs inside a harness that provides a todo/planning tool, a virtual filesystem for offloading context, summarization, and a `task` tool. That tool spawns subagents, including an automatic `general-purpose` one, in isolated contexts, and they return only their final result.
  - **Sync subagents** block the supervisor until they finish.
  - **Async subagents** run on Agent Protocol servers. They return a job ID at once, are stateful on their own thread, and can be checked, updated mid-flight, or cancelled while the supervisor keeps talking with the user.
- **When to use (L9):** subagents suit "multi-step tasks that would clutter the main agent's context", specialized domains, tasks that need a different model, and keeping the main agent "focused on high-level coordination". L9 says not to use them for simple single-step tasks, when intermediate context must be kept, or when the overhead outweighs the benefit. Async suits long-running, parallelizable tasks that need steering.
- **Roles:** supervisor/main agent and subagents.
- **Source:** L9. This is LangChain's current recommended built-in multi-agent path (L1 tip).

---

## B. CrewAI

### B1. Sequential process (Crew)
- **Mechanism:** A Crew holds role-playing agents, each with a role, goal and backstory, and an ordered list of Tasks, each assigned to an agent. Tasks run in list order. Each task's output becomes context for the next, or for the tasks named in `Task.context`. The process terminates after the last task (C1, C2).
- **When to use:** "ideal for projects requiring tasks to be completed in a specific order"; "Best suited for projects with clear, step-by-step tasks" (C2). This is the default process.
- **Roles:** task-assigned agents.
- **Sources:** C1, C2.

### B2. Hierarchical process (manager agent)
- **Mechanism:** Tasks are not pre-assigned. A manager agent, either auto-created from `manager_llm` or a custom `manager_agent`, "oversees task execution, including planning, delegation, and validation". It hands tasks to crew members by capability, reviews their outputs, and decides when each task is complete. Execution is bounded by `max_iter` and `max_rpm` (C1, C2).
- **When to use:** complex projects that need a "structured chain of command" and validation of results (C2). C2 says it is "designed to leverage advanced models like GPT-4" for the manager.
- **Roles:** manager and specialist workers.
- **Known failure modes (C5):** "Delegation Loops", where agents delegate back and forth forever. C5 fixes this by letting only the manager delegate (`allow_delegation=False` on the specialists). It also notes "Too Much Back-and-Forth".
- **Sources:** C1, C2, C5.

### B3. Peer delegation / ask-question collaboration (within a Crew)
- **Mechanism:** Setting `allow_delegation=True` gives an agent two tools. "Delegate Work" assigns a subtask to a teammate. "Ask Question" queries a teammate. The callee runs and returns its result to the caller. This works in either process. C5 names two patterns: "Research → Write → Edit" and "Collaborative Single Task".
- **When to use:** tasks that need several specialists' expertise. Enable delegation strategically to avoid loops.
- **Roles:** peer agents.
- **Source:** C5.

### B4. Crew planning (AgentPlanner pre-step)
- **Mechanism:** With `planning=True`, before each Crew iteration "all Crew data is sent to an AgentPlanner that will plan the tasks and this plan will be added to each task description" (C5). Execution then follows the chosen process. This is a plan-then-execute layer on top of a sequential or hierarchical crew, with an optional `planning_llm`.
- **Roles:** planner and crew agents.
- **Source:** C5 (crews.mdx).

### B5. Flows (event-driven state machine orchestrating crews, agents and code)
- **Mechanism:** A `Flow` class holds structured (Pydantic) or unstructured state. Methods are wired with decorators:
  - `@start()` marks entry points. Several starts run in parallel, and they can be gated.
  - `@listen(m)` fires a method when `m` emits output.
  - `or_(...)` fires on any listed method, and `and_(...)` waits for all of them (fan-in).
  - `@router()` returns a label that selects which listeners fire (conditional branching and loops).
  - `@human_feedback` pauses for human approval and can map free-text feedback onto route labels with an LLM.
  - `@persist` checkpoints state, so a run can resume or fork.

  A step can be plain code, a single Agent, or a whole Crew. The final output is the output of the last method to complete (C3).
- **When to use:** C4 calls Flows "the backbone": "Think of a Flow as the 'manager' or the 'process definition' of your application". Use them for structured, stateful, event-driven production automation where you need "precise control". Delegate open-ended collaborative subproblems to Crews.
- **Roles:** the flow (deterministic orchestrator) and crews or agents as workers.
- **Sources:** C3, C4.

### B6. Flow → Crew composition ("Flows + Crews")
- **Mechanism:** This is a two-level hierarchy. C4 gives it as six steps:
  1. The Flow triggers an event or starts a process.
  2. The Flow manages state and decides what to do next.
  3. The Flow delegates a complex task to a Crew.
  4. The Crew's agents collaborate on it.
  5. The Crew returns the result to the Flow.
  6. The Flow continues execution based on that result.

  Deterministic control sits outside, and agent autonomy sits inside each crew. CrewAI says this design "balance[s] autonomy with control".
- **When to use:** CrewAI's recommended production architecture (C4).
- **Roles:** flow, crews and agents.
- **Source:** C4.

### B7. Batch fan-out of a crew (`kickoff_for_each` / async kickoff)
- **Mechanism:** One crew runs once per input in a collection. `kickoff_for_each` runs them in sequence. `akickoff_for_each` (native async) and `kickoff_for_each_async` (thread-based) run them concurrently. The results come back as a list (C5). This is data-parallel map over a whole crew.
- **When to use:** many independent inputs. C5 recommends the native async version "for high-concurrency workloads".
- **Source:** C5 (crews.mdx).

---

## C. LlamaIndex

### C1. Workflows (event-driven step graph)
- **Mechanism:** A step is an async function that receives a typed event and returns an event. The return type decides which step runs next, so the event types are the edges.
  - `StartEvent` is the entry point, and `StopEvent` terminates the run with a result.
  - Branches are `if` statements that return different event types.
  - A loop is a step that returns an event handled by an earlier step.
  - Fan-out is a step that returns `list[Event]`. Fan-in is a step that takes `list[Event]`, and it can release early with `Collect(Take(n))` for "first n" or race semantics.
  - `ctx.send_event` dispatches events dynamically, and `num_workers` sets per-step concurrency.
  - Shared state lives in `Context`. Steps can be durable and retried, and human-in-the-loop is supported (Y3).
- **When to use / rationale:** Y3 contrasts this with DAG frameworks: in a DAG, "Logic like loops and branches needed to be encoded into the edges of graphs, which made them hard to read". Workflows replace that with an event-based, plain-Python model. Y4 (2024-08-01) introduced Workflows as a move away from graph-based design toward event-driven orchestration of compound AI systems.
- **Roles:** steps and events.
- **Sources:** Y3, Y4.

### C2. AgentWorkflow ("linear swarm" / handoff pattern)
- **Mechanism:** You list agents and name a root agent. The root agent gets the user message and runs the tools it chooses. Any agent can hand off control to another agent, using the agents' names and descriptions to decide. The loop "repeat[s] until an agent returns a final answer". The active agent can return control to the user at any time, and state is shared through `Context` (Y1). Y2's example passes control from ResearchAgent to WriteAgent to ReviewAgent.
- **When to use:** "multi-agent behaviour out-of-the-box with almost no extra code", accepting the default handoff heuristics. Y1 says to start here when prototyping.
- **Roles:** root agent and peer specialist agents.
- **Sources:** Y1, Y2, Y5 (2025-01-22).

### C3. Orchestrator agent (sub-agents as tools)
- **Mechanism:** Each specialist agent's `run` method is exposed as a tool to a top-level orchestrator `FunctionAgent`. The specialists never hand off to each other: "tools always return back to the orchestrator". The run terminates when the orchestrator answers.
- **When to use:** "a single place that decides every step so you can inject custom logic", while keeping the declarative agent-as-tool style (Y1).
- **Roles:** orchestrator and sub-agents.
- **Source:** Y1. This is the same topology as LangChain's Subagents (A10).

### C4. Custom planner (DIY plan → execute → check loop)
- **Mechanism:** A planner LLM is prompted to emit a structured plan in XML, JSON or YAML. Workflow code parses the plan and invokes the sub-agents imperatively (FunctionAgents, RAG pipelines or services). Afterwards an LLM checks whether more steps are needed. If they are, it replans and loops. If not, the run stops. The Y2 example plans sequential steps and leaves parallel steps as an exercise (Y1, Y2).
- **When to use:** "ultimate flexibility": a specific plan format, external schedulers, or extra metadata. Y1 says to use it "only when the first two patterns cannot express the flow you need". Y1's table gives this approach five stars for flexibility and three for lines of code.
- **Roles:** planner, executor (your code) and sub-agents.
- **Sources:** Y1, Y2.

---

## Cross-framework equivalence (for the merge)

| Canonical topology | LangChain/LangGraph | CrewAI | LlamaIndex |
|---|---|---|---|
| Sequential pipeline / prompt chain | Prompt chaining (A1) | Sequential process (B1) | Workflow linear steps (C1) |
| Parallel fan-out / fan-in | Parallelization (A2) | Flow `and_` fan-in, parallel `@start` (B5); `kickoff_for_each` (B7) | `list[Event]` fan-out/fan-in (C1) |
| Router | Routing / Router (A3) | Flow `@router` (B5) | Workflow branch (C1) |
| Orchestrator-workers (dynamic) | Orchestrator-worker with `Send` (A4) | Hierarchical process (B2) | Custom planner (C4) |
| Evaluator-optimizer / reflection | Evaluator-optimizer (A5), Reflection (A17), Reflexion (A18) | Flow loop with `@router`; `@human_feedback` (B5) | Workflow loop (C1) |
| Supervisor / subagents-as-tools | Supervisor (A8), Subagents (A10), Deep agents (A20) | Hierarchical manager (B2) | Orchestrator agent (C3) |
| Handoff / swarm (decentralized) | Handoffs, Swarm, Network (A7, A9) | Peer delegation (B3) | AgentWorkflow (C2) |
| Hierarchical teams | Supervisor of supervisors (A12) | Flow → Crew (B6) | (nested workflows; not named) |
| Plan-and-execute family | Plan-and-execute (A14), ReWOO (A15), LLMCompiler (A16) | Crew planning (B4) | Custom planner (C4) |
| Tree search | LATS (A19) | – | – |
| Progressive disclosure | Skills (A11) | – | – |
| Hybrid deterministic + agentic graph | Custom workflow (A13) | Flows + Crews (B5, B6) | Workflows (C1) |
