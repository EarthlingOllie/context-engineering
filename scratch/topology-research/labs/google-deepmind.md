# Google / Google Cloud / Google DeepMind — agent orchestration topologies

Branch 3 of 7 (lab-topologies fan-out). Compiled 2026-10-31.

## Provenance and access notes

- **Read in full (primary):** ADK docs source, cloned from `github.com/google/adk-docs` (HEAD 97b313e, 2026-10-30). Files: `docs/workflows/patterns.md`, `docs/workflows/collaboration.md`, `docs/workflows/index.md`, `docs/graphs/{index,routes,dynamic}.md`, `docs/agents/workflow-agents/{loop,parallel,sequential}-agents.md`, `docs/agents/routing.md`, `docs/a2a/intro.md`. The published site is google.github.io/adk-docs (same paths). A2A spec and docs, cloned from `github.com/a2aproject/A2A` (HEAD 2026-10-30): `docs/specification.md`, `docs/topics/{key-concepts,life-of-a-task,a2a-and-mcp,what-is-a2a}.md`. Two Google Cloud blog posts, fetched directly (dated below).
- **Known only from search-engine snippets (WebSearch):** google.github.io, docs.cloud.google.com, developers.googleblog.com, arxiv.org, research.google and deepmind.google all failed DNS from this session, so they could not be fetched. Details from the Cloud Architecture Center page, the Dec 2025 Developers Blog guide and the DeepMind/Google papers come from search snippets of those primary pages, plus InfoQ and the NeurIPS/ACL proceedings pages. Each entry marks these as **[snippet]**. Figures marked **[secondary]** came from third-party summaries and were not checked against the paper.
- **[memory]** marks a few dates or details the assistant supplied from prior knowledge without re-checking them here.

---

## A. Agent Development Kit (ADK): template workflow agents and multi-agent patterns

Primary: "Multi-agent workflow patterns", ADK docs (`docs/workflows/patterns.md`, retrieved 2026-10-31; formerly /agents/multi-agents/), https://google.github.io/adk-docs/workflows/patterns/

Also: "Building Collaborative AI: A Developer's Guide to Multi-Agent Systems with ADK", Annie Wang, Google Cloud Blog, 2025-11-05, https://cloud.google.com/blog/topics/developers-practitioners/building-collaborative-ai-a-developers-guide-to-multi-agent-systems-with-adk

Also: "Developer's guide to multi-agent patterns in ADK", Shubham Saboo, Google Developers Blog, 2025-12-16, https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/ **[snippet]**. It names 8 patterns, from Sequential Pipeline to Human-in-the-loop, and adds a Composite pattern. InfoQ's coverage: "Google's Eight Essential Multi-Agent Design Patterns", 2026-01-05, https://www.infoq.com/news/2026/01/multi-agent-design-patterns/

**Underlying primitives (ADK):**

- **Agent hierarchy.** `sub_agents` forms a tree, and each agent has exactly one parent. The Nov 2025 blog compares it to an org chart.
- **Workflow agents.** `SequentialAgent`, `ParallelAgent` and `LoopAgent` are deterministic orchestrators: "not controlled by an AI model". They direct sub-agents but do no work themselves.
- **LLM-driven delegation.** An `LlmAgent` calls `transfer_to_agent(agent_name=…)` based on the sub-agents' `description`s.
- **Explicit invocation.** `AgentTool` wraps an agent as a callable tool. In the blog's framing, a sub-agent is "a permanent member of the org chart" and an AgentTool is "an external consultant".
- **Shared session state.** Agents write with `output_key` and read with `{key}` templating. The blog calls it a "shared whiteboard".

### A1. Coordinator / Dispatcher (LLM router)

- **Mechanism.** A central `LlmAgent` (the Coordinator) holds specialists in `sub_agents`. Its LLM reads the user's intent and either calls `transfer_to_agent` to hand off control (for example "My payment failed" → Billing, "I can't log in" → Support), or calls specialists wrapped as `AgentTool` in its `tools`.
  - Topology: a star with one hub and N leaves; the edge is chosen at runtime by the LLM.
  - Termination: the chosen specialist answers. Under transfer, control stays with the specialist until it transfers back. Under AgentTool, the result returns to the coordinator.
- **When to use.** "Route incoming requests to the appropriate specialist agent", when routing depends on natural-language intent. It needs clear sub-agent `description`s.
- **Roles.** Coordinator, specialists.

### A2. Sequential Pipeline

- **Mechanism.** A `SequentialAgent` runs its `sub_agents` once each, in a fixed order. Each step writes its result to state through `output_key`, and later steps read it (e.g. `validation_status` → `result`).
  - Topology: a linear chain.
  - Termination: after the last node runs.
- **When to use.** "A multistep process where the output of one step feeds into the next", such as fetch → clean → analyze → summarize. The Dec 2025 guide calls it the simplest pattern, an "assembly line" **[snippet]**.
- **Roles.** Stage agents.

### A3. Parallel Fan-out / Gather

- **Mechanism.** A `ParallelAgent` runs its sub-agents concurrently. Each sub-agent runs in its own branch, and there is "*no* automatic sharing of conversation history or state between these branches". Each branch writes to a distinct state key (e.g. `api1_data`, `api2_data`). The ParallelAgent is usually nested in a `SequentialAgent` whose next step, a Gather or synthesizer agent, reads all the keys.
  - Topology: fan-out, then join. Result order is not deterministic.
  - Termination: when all branches finish and the gather step completes.
  - The Dec 2025 guide warns that parallel sub-agents share session state, so each should "write its data to a unique key" to avoid race conditions **[snippet]**.
- **When to use.** "Independent tasks simultaneously to reduce latency", such as multi-source retrieval or heavy computation. The guide's example is a code review whose synthesizer approves or rejects a PR **[snippet via InfoQ]**.
- **Roles.** Parallel workers, aggregator/synthesizer.

### A4. Hierarchical Task Decomposition

- **Mechanism.** A multi-level `parent_agent`/`sub_agents` tree. Higher-level agents break goals into sub-tasks and delegate them through LLM-driven delegation or `AgentTool`. Results come back up the tree as tool responses or state. Example: ReportWriter → `AgentTool(ResearchAssistant)` → `AgentTool(WebSearcher)` and `AgentTool(Summarizer)`.
  - Topology: a tree of depth >1, with recursive calls.
  - Termination: when the root returns.
- **When to use.** "Solve complex problems by recursively breaking them down into simpler, executable steps."
- **Roles.** Planner/manager agents at each level, leaf workers.

### A5. Generator–Critic (ADK: "Generate and review")

- **Mechanism.** Two agents inside a `SequentialAgent`. The generator writes `draft_text` to state, and the reviewer reads it and writes `review_status` or feedback.
  - Topology: a two-node chain, run as a single pass.
  - The Dec 2025 guide presents it as a loop in which the critic checks the draft "against specific, hard-coded criteria" and sends it back on failure **[snippet]**.
- **When to use.** "Improve the quality or validity of generated output by having a dedicated agent review it." The guide frames it as "separating content creation from validation".
- **Roles.** Generator, critic/reviewer.

### A6. Iterative Refinement (Loop)

- **Mechanism.** A `LoopAgent` runs its sub-agents in order, repeatedly. A typical body is refiner → quality checker → stop-checker. Each pass overwrites the working artifact in state (e.g. `current_code`).
  - Termination: `max_iterations` (e.g. 5), or a sub-agent emitting `EventActions(escalate=True)` once quality passes. "The `LoopAgent` itself does *not* inherently decide when to stop looping. You *must* implement a termination mechanism."
  - ADK's full example is a Writer and a Critic that "return a STOP signal". The Dec 2025 guide's version uses Generator → Critique → Refiner **[snippet]**.
- **When to use.** "Progressively improve a result (e.g., code, text, plan) … until a quality threshold is met or a maximum number of iterations is reached." Also polling, or retrying until success.
- **Roles.** Generator/refiner, critic, termination checker.

### A7. Human-in-the-loop

- **Mechanism.** A custom tool pauses execution and sends a request to an external system (UI, ticketing). The human's response comes back as the tool result. Alternatively, `transfer_to_agent` hands off to a conceptual "Human Agent".
  - Policy variant: a `SecurityPlugin` intercepts every tool call and consults a `BasePolicyEngine`. If `evaluate()` returns `PolicyOutcome.CONFIRM`, execution pauses on an ask-user-confirmation FunctionCall until the human sends a FunctionResponse. The docs call this "more robust for enforcing governance and security rules".
  - ADK 2.0 graphs and dynamic workflows add first-class human-input nodes.
- **When to use.** "Human oversight, approval, correction, or tasks that AI cannot perform."
- **Roles.** Agent, human approver, policy engine.

### A8. Composite

- **Source.** Dec 2025 Developers Blog **[snippet via InfoQ]**.
- **Mechanism.** Nest the patterns above. Example: a coordinator for routing, a parallel stage for speed, then a generator–critic loop for quality.
  - Workflow agents can be sub-agents of other workflow agents ("Nested workflows", `docs/graphs/routes.md`).
- **When to use.** Production systems that need several properties at once.

### A9. Graph-based workflow (ADK 2.0)

- **Source.** "Graph-based agent workflows" and "Build graph routes", ADK docs (Python/TS/Go v2.0.0), https://google.github.io/adk-docs/graphs/ and /graphs/routes/
- **Mechanism.** An explicit graph. Nodes can be agents, tools, plain code functions or human-input tasks. Edges include:
  - sequence routes;
  - conditional branch routes;
  - parallel fan-out into a `JoinNode` ("nodes that feed a JoinNode must produce output");
  - nested workflows;
  - loops, expressed as a back-edge with a route condition. "A graph cycle is not bounded automatically."
  - Data moves through Events and typed input/output schemas.
- **When to use.** When prompt-based procedures get long and unreliable: "Moving from prompt-based agents to graph-based workflow agents allows you to explicitly break out the tasks of a procedure". It mixes deterministic code with LLM steps for "control, predictability, and reliability".
- **Roles.** Node-defined.

### A10. Dynamic (code-defined) workflow (ADK 2.0)

- **Source.** "Dynamic agent workflows", https://google.github.io/adk-docs/graphs/dynamic/
- **Mechanism.** A parent "dynamic node", written as a Python decorator or Go constructor, calls child nodes as functions. Control flow is ordinary language constructs: `while` loops, branching, parallel calls. Each child run gets a deterministic execution ID, used for automatic checkpointing and resume. Child outputs come back as return values, with no state-key plumbing.
- **When to use.** "If the logic path for your workflow is more complex, with iterative loops or complex branching logic", where a graph "may become too unwieldy".

### A11. Collaborative agent team with operating modes (ADK 2.0)

- **Source.** "Build collaborative agent teams", https://google.github.io/adk-docs/workflows/collaboration/
- **Mechanism.** A coordinator delegates to subagents. Each subagent has a mode:
  - **Chat:** full user interaction; returns to the parent manually via `transfer_to_agent`.
  - **Task:** may ask the user clarifying questions; returns to the parent automatically when it calls `finish_task`; must be a leaf.
  - **Single-turn:** no user interaction; returns automatically.
- **Context isolation.** Task and single-turn agents run in isolated session branches. Parallel peers "cannot see what its peer agents are doing", and the parent receives the collected results.
- **Reuse.** The same agent can be a graph node, where control advances along the graph, or a transfer target, where control returns to the caller.
- **When to use.** "Less structured procedures, particularly for iterative processes with several, substantial sub-tasks", for "self-managing agent systems".

### A12. Programmatic router with fallback: `RoutedAgent` (experimental, TypeScript)

- **Source.** `docs/agents/routing.md`
- **Mechanism.** A developer-written router function, not an LLM handoff, picks **one** agent per invocation.
  - If the chosen agent fails before emitting events, the router is called again with `errorContext.failedKeys`. Failed keys cannot be chosen again.
  - The router may call a lightweight classifier LLM to route by complexity.
- **When to use.** "Agent fallback on error, A/B testing, planning modes, and auto-routing by input complexity." The docs contrast it with workflow agents (fixed patterns) and with LLM-driven delegation.

---

## B. Google Cloud Architecture Center: agent design-pattern guide

- **Source.** "Choose a design pattern for your agentic AI system", Cloud Architecture Center, https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system (also cloud.google.com/architecture/…). Last-updated date unknown, because the page could not be fetched. **All B entries are [snippet].**
- **Versions.** Snippets show two versions of the page. One lists Sequential, Parallel, Loop, Coordinator, Hierarchical task decomposition and Custom logic. The other adds Multi-agent review and critique, Iterative refinement, Swarm and Human-in-the-loop. It also covers single-agent and ReAct baselines **[memory]**.
- **B1 Sequential, B2 Parallel, B3 Loop.** Same mechanics as A2, A3 and A6.
  - The Parallel pattern uses a "hardcoded workflow".
  - The Loop pattern "repeatedly runs a sequence of specialized subagents until a termination condition is met"; the exit check "can happen at any point in the flow".
- **B4 Review and critique.** Described as an implementation of the loop pattern. A generator produces output, and a critic approves it, rejects it, or returns it with feedback for revision. The guide says it "adds a dedicated verification step" that improves quality and reliability.
- **B5 Iterative refinement.** Agents modify a result stored in session state until a quality threshold or iteration cap is reached.
- **B6 Coordinator.** "An AI model orchestrates and dynamically routes tasks." The guide contrasts it with the hardcoded parallel and sequential patterns. A third-party catalog notes it risks non-convergence.
- **B7 Hierarchical task decomposition.** A multi-level tree of agents that decompose and delegate (as in A4).
- **B8 Swarm.**
  - Mechanism: peer-to-peer, "all-to-all" collaboration with no central controller. A dispatcher only routes the initial request. Agents then hand off to and communicate with each other until an exit condition is met.
  - When to use: "ambiguous or highly complex problems" where agents need to debate and refine.
  - Trade-offs: high latency and operating cost from all-to-all messaging, and a risk that agents never converge.
- **B9 Human-in-the-loop.** As in A7.
- **B10 Custom logic.** Code-defined orchestration that mixes the patterns above with conditional branching (the equivalent of A9 and A10).

Related reference architecture: "Multi-agent AI system in Google Cloud", https://docs.cloud.google.com/architecture/multiagent-ai-system **[snippet]**. It shows a coordinator agent driving sequential and iterative-refinement flows.

### B11. Orchestrator + sub-agents over A2A, with tools over MCP (deployment topology)

- **Source.** "Building scalable AI agents: Design patterns with Agent Engine on Google Cloud", S. Larbi and D. Peterside, Google Cloud Blog, 2025-10-20, https://cloud.google.com/blog/topics/partners/building-scalable-ai-agents-design-patterns-with-agent-engine-on-google-cloud
- **Mechanism.** A root orchestration agent discovers specialist sub-agents through A2A **agent cards** and routes to them; in the supply-chain example these are Order, Distributor and Tracking. Sub-agents can hand off laterally (Distributor → Tracking) and can call external partner agents over A2A. Each agent reaches data (BigQuery) through separately deployed MCP servers on Cloud Run or GKE.
- **When to use.** Workflows that span domains or systems, or agents owned by different teams or organizations.

---

## C. Agent2Agent (A2A) protocol: interaction topology between opaque agents

- **Sources.** A2A spec and docs, `github.com/a2aproject/A2A` (`docs/specification.md`, `docs/topics/*`), https://a2a-protocol.org. ADK "Introduction to A2A" (`docs/a2a/intro.md`).
- **Dates.** Announced by Google 2025-04-09 and moved to the Linux Foundation in 2025-06 **[memory]**.

### C1. Client agent → Remote agent delegation (horizontal, peer protocol)

- **Nodes.** User; A2A Client (client agent); A2A Server (remote agent, opaque).
- **Discovery.** The client reads the remote agent's **Agent Card**: identity, endpoint, skills and auth requirements.
- **Edges.** JSON-RPC 2.0 over HTTP(S). A request gets back either a stateless `Message` or a stateful `Task`. Long work is delivered by polling, SSE streaming, or webhook push notifications.
- **Control flow.** Task states:
  - non-terminal: SUBMITTED, WORKING, INPUT_REQUIRED, AUTH_REQUIRED;
  - terminal: COMPLETED, CANCELED, REJECTED, FAILED.
  - INPUT_REQUIRED and AUTH_REQUIRED hand the turn back to the client, giving multi-turn negotiation.
- **Grouping and refinement.** `contextId` groups related tasks and messages into one shared session. A refinement is a new task in the same `contextId` that points at the original through `referenceTaskIds`.
- **Termination.** Once a task reaches a terminal state it is immutable.
- **Outputs.** Results come back as `Artifact`s made of `Part`s (text, raw, url or data).
- **Positioning.** "MCP is vertical" (agent → tool) and "A2A is horizontal" (agent ↔ agent, across team or org boundaries). A2A exposes agents "as they are, with no wrapping", unlike agent-as-tool.
- **When to use.** Per the ADK docs, use A2A when:
  - the agent is a separate service;
  - it belongs to a different team or org;
  - it uses a different language or framework;
  - you want a formal contract.
  - Prefer local sub-agents for in-process code organization. A remote A2A agent can sit in an ADK tree as a sub-agent (`RemoteA2aAgent`).
- **Example topologies in the docs.** A travel assistant coordinating flight, hotel, currency and tours agents (a hub). An auto-repair shop: user → Shop Manager → Mechanic → (MCP tools) and → Parts Supplier agent, which is a chain of A2A hops.

---

## D. Google DeepMind / Google Research papers on agent composition and debate

### D1. Multi-agent debate (fully connected, multi-round)

- **Source.** Du, Li, Torralba, Tenenbaum, Mordatch (MIT and Google Brain), "Improving Factuality and Reasoning in Language Models through Multiagent Debate", arXiv 2305.14325, May 2023; ICML 2024. **[snippet]**
- **Mechanism.** N LLM instances each answer independently. In each round, every agent reads all the other agents' answers and updates its own. After R rounds the answers converge to a final answer. The main setup is 3 agents and 2 rounds. It is black-box, and the prompts are the same across tasks.
- **Evidence.** Arithmetic 67.0 → 81.8%, GSM8K 77.0 → 85.0%, MMLU 63.9 → 71.1%, biography factuality 66.0 → 73.8% **[secondary]**. Reduces hallucination. A caveat from later work: under equal compute, single agents can match it.

### D2. Sparse-topology multi-agent debate

- **Source.** Li et al. (Google and Google DeepMind), "Improving Multi-Agent Debate with Sparse Communication Topology", arXiv 2406.11776, Jun 2024; Findings of EMNLP 2024. https://aclanthology.org/2024.findings-emnlp.427/ **[snippet]**
- **Mechanism.** The same debate loop as D1, but each agent reads only its neighbors' answers in a sparse graph, not all agents (for example ring or neighbor-connected graphs).
- **Evidence.** Matches or beats fully connected debate "while significantly reducing computational costs". Also helps on alignment labeling. Putting stronger LLMs on more-connected nodes improves overall performance.

### D3. Debate vs. consultancy under a weak judge (scalable oversight)

- **Source.** Kenton et al. (Google DeepMind), "On scalable oversight with weak LLMs judging strong LLMs", arXiv 2407.04622, Jul 2024; NeurIPS 2024. **[snippet]**
- **Mechanism.**
  - **Debate:** two strong debaters argue for opposing answers over rounds, then a weaker judge decides.
  - **Consultancy:** one consultant argues for an answer to the judge.
  - **Direct QA:** baseline.
  - Variants: assigned sides vs. self-chosen sides ("open").
- **Evidence.**
  - Debate beats consultancy on every task when sides are assigned.
  - Debate beats direct QA on extractive QA with information asymmetry; results are mixed elsewhere.
  - In open consultancy, judges are convinced equally whether the consultant is right or wrong. Debate fools judges less often.
  - The authors call the evidence "encouraging but not decisive".
- **Related DeepMind theory [memory].** Brown-Cohen, Irving, Piliouras, "Scalable AI Safety via Doubly-Efficient Debate" (arXiv 2311.14125, 2023), and "Prover-Estimator Debate" (2025).

### D4. Architecture taxonomy and scaling laws for agent systems

- **Source.** Kim et al. (Google Research, Google DeepMind and MIT), "Towards a Science of Scaling Agent Systems", arXiv 2512.08296, Dec 2025. Blog: https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/ **[snippet]**
- **Topologies compared.**
  - **Single-agent (SAS)** baseline.
  - **Independent:** parallel agents, no communication, outputs aggregated.
  - **Centralized:** an orchestrator assigns work to and verifies workers.
  - **Decentralized:** peer-to-peer exchange.
  - **Hybrid:** orchestrator plus peer links.
- **Evidence.**
  - 180 configurations in v1 (260 in v2) across benchmarks and the GPT, Gemini and Claude families.
  - Coordination "dramatically improves performance on parallelizable tasks but degrades it on" sequential ones.
  - Error amplification: independent 17.2×, centralized 4.4×, because the orchestrator contains errors.
  - A predictive model picks the best architecture for 87% of held-out configurations; out-of-sample MAE is 0.071 on GPT-5.2.
- **Use.** Choose the topology from task properties (parallelizability, tool count, single-agent baseline strength); do not default to multi-agent.

### D5. Topology + prompt search (MASS)

- **Source.** Zhou et al. (Google and Cambridge), "Multi-Agent Design: Optimizing Agents with Better Prompts and Topologies", arXiv 2502.02533, Feb 2025; ICLR 2026. https://research.google/pubs/multi-agent-design-optimizing-agents-with-better-prompts-and-topologies/ **[snippet]**
- **Mechanism.** Topologies are composed from building blocks: aggregate (self-consistency style parallel sampling and voting), reflect (self-refine loop), debate, summarize, and tool-use executor.
- **Search stages.**
  1. Block-level prompt optimization.
  2. Workflow-topology search over the influential blocks.
  3. Workflow-level (global) prompt optimization.
- **Evidence.**
  - Beats hand-designed self-consistency, self-refine and multi-agent debate, as well as ADAS and AFlow.
  - The global stage adds about 2%.
  - Debate was the best single block on MATH.
  - Prompt optimization often matters more than adding agents.

### D6. Self-consistency (parallel sample-and-vote)

- **Source.** Wang et al. (Google Brain), "Self-Consistency Improves Chain of Thought Reasoning in Language Models", arXiv 2203.11171, 2022; ICLR 2023. **[memory]**
- **Mechanism.** Sample K chain-of-thought paths in parallel, then take a majority vote over the final answers. There is no inter-agent communication.
- **Evidence.** GSM8K +17.9 points over greedy CoT **[memory]**. This is the "aggregate" block in D5 and the "independent" architecture in D4.

### D7. Chain of Agents (sequential workers + manager)

- **Source.** Zhang et al. (Google Cloud AI Research and Penn State), "Chain of Agents: Large Language Models Collaborating on Long-Context Tasks", arXiv 2406.02818, Jun 2024; NeurIPS 2024. Google Research blog post (2025). **[snippet]**
- **Mechanism.** The long input is split into chunks. Worker agents run in a unidirectional chain: each reads its chunk plus the previous worker's "communication unit" and passes an updated unit on. A manager agent reads the last unit and produces the answer. Termination comes after the manager. It is training-free and task-agnostic.
- **When to use.** Long-context QA, summarization and code completion, as an alternative to RAG or full-context windows.
- **Evidence.** Up to about 10% over RAG, full-context and multi-agent baselines; text-bison gained 13.30% on NarrativeQA and 10.22% on MuSiQue.

### D8. Supervisor + tournament-evolution (AI co-scientist)

- **Source.** Gottweis et al. (Google and Google DeepMind), "Towards an AI co-scientist", arXiv 2502.18864, Feb 2025. Google Cloud doc: https://docs.cloud.google.com/gemini/enterprise/docs/co-scientist-and-alphaevolve **[snippet]**
- **Mechanism.** A Supervisor parses the research goal and schedules specialized agents on an asynchronous task queue:
  - **Generation:** literature search and hypothesis drafting.
  - **Reflection:** peer review for correctness, quality and safety.
  - **Ranking:** an Elo tournament of pairwise comparisons through simulated scientific debates.
  - **Proximity:** a similarity graph for matchmaking and deduplication.
  - **Evolution:** refines and combines the top-ranked hypotheses.
  - **Meta-review:** synthesizes feedback across reviews and feeds it back into the other agents' prompts.
  - The cycle repeats, scaling test-time compute. Termination is by budget or by the scientist.
- **Evidence.** Elo correlates with accuracy, and quality improves as compute scales **[memory]**. It beat unmodified Gemini 2.0 and o1 in expert ratings, with wet-lab validation in drug repurposing and AMR mechanisms **[secondary]**.

### D9. Evolutionary search loop with automated evaluators (AlphaEvolve)

- **Source.** Google DeepMind, "AlphaEvolve: A Gemini-powered coding agent for designing advanced algorithms", blog and white paper, 2025-05-14. **[snippet/secondary]**
- **Mechanism.**
  - A prompt sampler builds prompts from parent programs in a program database, with their scores and instructions.
  - An LLM ensemble proposes code diffs: Gemini Flash for breadth, Pro for depth.
  - Automated evaluators execute and score the candidates.
  - Scored programs go back into the database, which balances exploration and exploitation (MAP-Elites style).
  - It runs as an asynchronous distributed loop until the budget runs out.
- **When to use.** Problems with machine-checkable evaluation functions.
- **Evidence.**
  - A 4×4 complex matrix multiplication using 48 scalar multiplications, beating Strassen's 49.
  - 0.7% of fleet compute recovered by a Borg scheduling heuristic.
  - 23% kernel speedup, 1% less Gemini training time.
  - Run on 50+ open math problems.

### D10. Game Master–mediated multi-agent simulation (Concordia)

- **Source.** Vezhnevets, Agapiou, Leibo et al. (Google DeepMind), "Generative agent-based modeling with actions grounded in physical, social, or digital space using Concordia", arXiv 2312.03664, 2023-12-06. Follow-up: "Multi-Actor Generative AI as a Game Engine", arXiv 2507.08892, 2025. **[snippet]**
- **Mechanism.** Player agents state intended actions in natural language. A central Game Master (GM) agent checks plausibility, resolves the outcome, updates world state (calling real tools or APIs in digital settings), and narrates observations back. It supports turn-taking or simultaneous moves, and nested games.
  - Topology: a hub mediator over the players, looping per step until the scenario ends.
- **When to use.** Social simulation and evaluating agents in shared environments.

---

## Canonical topology names (for merge)

Coordinator/Dispatcher (LLM router), Sequential Pipeline, Parallel Fan-out/Gather, Hierarchical Task Decomposition (agent-as-tool tree), Generator–Critic / Review-and-Critique, Iterative Refinement Loop, Human-in-the-loop (incl. policy-gated approval), Composite (nested patterns), Swarm (peer-to-peer), Custom logic / Graph workflow (conditional routes, join, back-edge loops), Dynamic code-defined workflow, Collaborative team with delegation modes, Programmatic router with fallback, Remote-agent delegation over A2A (task lifecycle), Multi-agent Debate, Sparse-topology Debate, Adversarial Debate with Judge (vs Consultancy), Independent/Centralized/Decentralized/Hybrid architecture taxonomy, Topology search (MASS), Self-consistency sample-and-vote, Chain of Agents (sequential workers + manager), Supervisor tournament-evolution (co-scientist), Evolutionary search with evaluators (AlphaEvolve), Game Master mediation (Concordia).
