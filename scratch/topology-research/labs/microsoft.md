# Microsoft: agent and workflow orchestration topologies

Branch 4 of 7. Sources: the Azure Architecture Center guide "AI agent orchestration patterns", Semantic Kernel Agent Orchestration docs, Microsoft Agent Framework (MAF) orchestrations and workflows, AutoGen v0.4+ (Core design patterns and AgentChat teams), Magentic-One, AutoGen v0.2 conversation patterns and blog, and AG2 (the AutoGen fork) orchestration docs, Pattern Cookbook and 2026 Network posts.

## Access caveats (read first)

- This session's network allowed only github.com and raw.githubusercontent.com. learn.microsoft.com failed DNS. I did not try microsoft.com/research, arxiv.org or docs.ag2.ai, since the same block applies to them.
- **Everything below was read from the Markdown or notebook source in GitHub repos.** These are the same files that render on learn.microsoft.com, microsoft.github.io/autogen and docs.ag2.ai:
  - `MicrosoftDocs/architecture-center` at docs/ai-ml/guide/ai-agent-design-patterns.md (HEAD 2026-10-30)
  - `MicrosoftDocs/semantic-kernel-docs` at semantic-kernel/Frameworks/agent/agent-orchestration/*.md
  - `microsoft/agent-framework` (HEAD 2026-10-30)
  - `microsoft/autogen`: main (2026-10-28), plus branch `0.2` (2025-05-28) for the v0.2 docs and blog
  - `ag2ai/ag2`: tag v0.14.0 (2026-06-26) holds the classic docs, and main (2026-10-31) holds the AG2 Network/beta docs
- **Magentic-One benchmark numbers** were not re-fetched, because arxiv.org/abs/2411.04468 was blocked. The figures in §7 come from memory of the technical report and are marked as such. The mechanism in §7 was verified against the orchestrator source code and prompts in `microsoft/autogen`.
- The MAF conceptual docs on learn.microsoft.com/agent-framework were not reachable. MAF facts come from the repo READMEs, sample indexes and the `skills/agent-framework-builder-python` reference.

## Source index

| # | Title | URL (canonical) | Date |
|---|---|---|---|
| M1 | AI agent orchestration patterns (Azure Architecture Center; Kittel, Siemens et al.) | https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns | ms.date 2026-02-12 |
| M2 | Semantic Kernel Agent Orchestration (index, concurrent, sequential, handoff, group-chat, magentic, advanced-topics) | https://learn.microsoft.com/en-us/semantic-kernel/frameworks/agent/agent-orchestration/ | ms.date 2025-05-19 (experimental) |
| M3 | Microsoft Agent Framework: Orchestrations package README + orchestration samples README | https://github.com/microsoft/agent-framework/tree/main/python/packages/orchestrations , .../python/samples/03-workflows/orchestrations | living, read 2026-10-31 |
| M4 | Microsoft Agent Framework: Workflows samples index (control-flow, parallelism, composition, HITL) + workflow-builder skill reference | https://github.com/microsoft/agent-framework/tree/main/python/samples/03-workflows | living |
| M5 | AutoGen Core: Multi-agent design patterns (Intro, Concurrent Agents, Sequential Workflow, Group Chat, Handoffs, Mixture of Agents, Multi-Agent Debate, Reflection, Code Execution) | https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/intro.html | living (v0.4+) |
| M6 | AutoGen AgentChat: Teams, Termination, Selector Group Chat, Swarm, GraphFlow (Workflows), Magentic-One | https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/ | living |
| M7 | AutoGen AgentChat `SocietyOfMindAgent` (docstring) | https://github.com/microsoft/autogen/blob/main/python/packages/autogen-agentchat/src/autogen_agentchat/agents/_society_of_mind_agent.py | living |
| M8 | Magentic-One orchestrator source + prompts (`_magentic_one_orchestrator.py`, `_prompts.py`) | https://github.com/microsoft/autogen/tree/main/python/packages/autogen-agentchat/src/autogen_agentchat/teams/_group_chat/_magentic_one | living |
| M9 | Magentic-One: A Generalist Multi-Agent System for Solving Complex Tasks (Fourney et al.) + MSR blog | https://arxiv.org/abs/2411.04468 ; https://aka.ms/magentic-one-blog | Nov 2024 (not fetched) |
| M10 | AutoGen v0.2 tutorial: Conversation Patterns | https://microsoft.github.io/autogen/0.2/docs/tutorial/conversation-patterns | 2024 (branch 0.2) |
| M11 | AutoGen v0.2 notebooks: SocietyOfMindAgent; Solving Complex Tasks with Nested Chats; FSM GroupChat | https://github.com/microsoft/autogen/blob/0.2/notebook/agentchat_society_of_mind.ipynb , agentchat_nestedchat.ipynb , agentchat_groupchat_finite_state_machine.ipynb | 2024 |
| M12 | AutoGen blog: "FSM Group Chat: User-specified agent transitions" | https://microsoft.github.io/autogen/0.2/blog/2024/02/11/FSM-GroupChat | 2024-02-11 |
| M13 | AutoGen blog: "StateFlow: Build State-Driven Workflows with Customized Speaker Selection in GroupChat" (paper arXiv 2403.11322) | https://microsoft.github.io/autogen/0.2/blog/2024/02/29/StateFlow | 2024-02-29 |
| M14 | AutoGen blog: "EcoAssistant: Using LLM Assistants More Accurately and Affordably" | https://microsoft.github.io/autogen/0.2/blog/2023/11/09/EcoAssistant | 2023-11-09 |
| M15 | AutoGen blog: "Agent AutoBuild: Automatically Building Multi-agent Systems" | https://microsoft.github.io/autogen/0.2/blog/2023/11/26/Agent-AutoBuild | 2023-11-26 |
| M16 | AutoGen blog: "Agents in AutoGen" (C. Wang; single vs multi-agent interface/architecture) | https://microsoft.github.io/autogen/0.2/blog/2024/05/24/Agent | 2024-05-24 |
| M17 | AG2 docs: Orchestrating agents (two-agent, sequential, group, nested chat) + Group Chat (Overview, Orchestration Patterns, Handoffs) + Custom GroupChat | https://docs.ag2.ai/latest/docs/user-guide/advanced-concepts/orchestration/ (source: ag2 v0.14.0 website/docs/user-guide/advanced-concepts/) | v0.14.0, 2026-06 |
| M18 | AG2 Pattern Cookbook (Context-Aware Routing, Escalation, Feedback Loop, Hierarchical, Organic, Pipeline, Redundant, Star, Triage with Tasks) | https://docs.ag2.ai/latest/docs/user-guide/advanced-concepts/pattern-cookbook/overview/ | v0.14.0 |
| M19 | AG2 Network Pattern Cookbook (adds "Coordinator"; maps classic patterns to TransitionGraph) | https://github.com/ag2ai/ag2/blob/main/website/docs/user-guide/network/pattern_cookbook/pattern_cookbook.mdx | main, 2026 |
| M20 | AG2 blog: "One Coherent Agent Isn't Enough: Action-Driven Networking with AG2" and "Choreography You Can Dial In" (M. Sze) | https://github.com/ag2ai/ag2/tree/main/website/docs/_blogs/2026-05-14-AG2-Action-Driven-Network , .../2026-05-15-AG2-Network-Choreography-Dial | 2026-05-14, 2026-05-15 |

## Top-level taxonomy in Microsoft's own words

- **M1 (the canonical Microsoft taxonomy)** names five "fundamental orchestration patterns": **Sequential, Concurrent, Group chat (with the Maker-checker sub-pattern), Handoff, Magentic.** These sit above a complexity ladder: **Direct model call → Single agent with tools → Multiagent orchestration.** The guide says to "Use the lowest level of complexity that reliably meets your requirements". It also says single agent with tools is "often the right default for enterprise use cases". M1 lists aliases for each pattern and compares them in a table (see §§1-7). SK (M2) and MAF (M3) ship exactly these five as built-in builders. Both link to M1 for when and when not to use each pattern.
- **AutoGen Core (M5)** defines a design pattern as "a structure that emerges from message protocols". Its catalogue is: group chat ("for task decomposition"), reflection ("for robustness"), concurrent agents, sequential workflow, handoffs, mixture of agents, multi-agent debate, plus ReAct (the tool-using agent) as the single-agent baseline.
- **AutoGen AgentChat (M6)** has team presets: RoundRobinGroupChat, SelectorGroupChat, MagenticOneGroupChat, Swarm, GraphFlow. It also has SocietyOfMindAgent for nesting. It advises: "start with a single agent for simpler tasks, and transition to a multi-agent team when a single agent proves inadequate."
- **AutoGen v0.2 / AG2 classic (M10, M17)** has four conversation patterns: **Two-agent chat, Sequential chat (carryover), Group chat (auto / round_robin / random / manual / custom function / constrained transitions), Nested chat.** In the docs' words: "You can compose these patterns like LEGO blocks". AG2's Pattern Cookbook (M18) adds nine named application topologies, and the AG2 Network (M19-20) adds a "Coordinator" pattern and a choreography-to-orchestration "dial".

---

## 0. Complexity ladder: Direct model call / Single agent with tools (baseline levels)

- **Mechanism.** *Direct model call:* one LLM call, no tools, no loop. *Single agent with tools:* one agent loops over model calls and tool invocations, needs an iteration cap, and covers "varied queries within a single domain". *Multiagent orchestration:* multiple specialized agents with an orchestrator or a peer protocol.
- **When to use.** The guide says to move up a level only when "a single agent can't reliably handle certain tasks due to prompt complexity, tool overload, or security requirements". It also notes that "security boundaries, network line of sight, and other factors can still render a single-agent approach infeasible". An anti-pattern listed in M1: "Creating unnecessary coordination complexity by using a complex pattern when basic sequential or concurrent orchestration would suffice."
- **Related.** AutoGen's "Single-Agent Team" (M6) runs one AssistantAgent inside RoundRobinGroupChat until a termination condition fires. Since v0.6.2 `max_tool_iterations` replaces this. Chi Wang's M16 separates multi-agent *interface* from multi-agent *architecture*: a system can have a single-agent interface and a multi-agent back end.
- **Source.** M1 "Start with the right level of complexity"; M6 Teams; M16.

## 1. Sequential orchestration (pipeline / prompt chaining / linear delegation)

- **Mechanism.** Agents are chained in a predefined linear order, and each one processes the previous agent's output, so the chain is a pipeline of specialized transformations. In M1's words, "The choice of which agent gets invoked next is deterministically defined as part of the workflow and isn't a choice given to agents". All agents can read a common state. The run ends after the last agent. M1 compares it to the Pipes-and-Filters cloud pattern.
  - SK `SequentialOrchestration` and MAF `SequentialBuilder` pass the conversation context along. MAF adds plumbing nodes (`input-conversation`, `to-conversation:<p>`, `complete`) and emits only the last participant's output by default.
  - AutoGen Core implements it with pub/sub: each agent publishes to the topic of the next agent.
  - AG2's Pipeline pattern adds "Well-Defined Interfaces" between stages and early termination on error, which sends error information back to the user.
- **When to use (M1).** Multistage processes with clear linear dependencies; data-transformation pipelines; stages that can't be parallelized; progressive refinement ("draft, review, polish").
- **When to avoid (M1).** Stages that are embarrassingly parallel; few stages that one agent could handle; early-stage failures with no way to stop propagation; agents that need to collaborate rather than hand off; work that needs backtracking or iteration; dynamic routing.
- **Roles.** Stage agents, for example template selection → clause customization → regulatory compliance → risk assessment (M1 law-firm example), or concept extractor → writer → format/proof → user (M5).
- **Source.** M1 §Sequential; M2 sequential.md; M3; M5 sequential-workflow; M18 pipeline.

## 2. Sequential chat with carryover (chained two-agent chats)

- **Mechanism.** A sequence of *two-agent chats* (see §10). When each chat terminates, a summarizer condenses it: `summary_method` = `last_msg` by default, or `reflection_with_llm`. The summary becomes the **carryover**, which is injected into the next chat's opening message. Carryover *accumulates*, so chat k sees the summaries of chats 1..k-1. Recipients may repeat, and senders may differ (`autogen.agentchat.initiate_chats`). Each chat has its own `max_turns` or termination rule. A GroupChatManager can be one of the chats, so a group chat can sit inside a sequence.
- **When to use.** "complex tasks that can be broken down into interdependent sub-tasks."
- **Roles.** A driver agent (for example a teacher) chats in turn with a curriculum designer, a lesson planner (two iterations of feedback) and a formatter.
- **How it differs from §1.** Each stage is a bounded multi-turn dialogue rather than a single call, and context passes forward as a *summary*, not the full transcript.
- **Source.** M10 "Sequential Chats"; M17 sequential-chat.mdx.

## 3. Concurrent orchestration (parallel / fan-out-fan-in / scatter-gather / map-reduce)

- **Mechanism.** An initiator/collector sends the *same* task to N agents at once. The agents work independently, may run their own sub-orchestrations, and "don't hand off results to each other". Results may be aggregated, but aggregation isn't required. M1 names the strategies: "vote or use majority-rule for classification, apply weighted merging for scored recommendations, or use a language-model-synthesized summary".
  - The agent set can be fixed (deterministic broadcast) or chosen dynamically per task.
  - SK `ConcurrentOrchestration`: broadcast, then collect, with no guaranteed order.
  - MAF `ConcurrentBuilder`: a default aggregator, or a custom aggregator callback (for example an LLM summarizer), plus `.with_request_info()` so a human can review outputs before aggregation.
  - MAF also has a *multi-selection edge group*, which fans out to a dynamically chosen subset (M4).
  - AutoGen Core variants (M5):
    - **Single message & multiple processors:** every agent subscribes to one topic.
    - **Multiple messages & multiple processors:** routing by topic type, for example urgent vs normal, with a ClosureAgent collecting results.
    - **Direct messaging:** worker instances are created per AgentId.
- **When to use (M1).** Parallelizable tasks; work that benefits from independent perspectives or specializations, such as brainstorming, ensemble reasoning, or "quorum and voting-based decisions"; latency-sensitive work.
- **When to avoid (M1).** Agents that must build on each other's work; a required order or reproducibility; quota limits; shared mutable state ("Sharing mutable state between concurrent agents" is a listed anti-pattern); no conflict-resolution strategy; aggregation that degrades quality.
- **Roles.** Initiator/collector plus parallel specialists, for example fundamental, technical, sentiment and ESG analysts evaluating one ticker (M1).
- **Source.** M1 §Concurrent; M2 concurrent.md; M3; M4 parallelism; M5 concurrent-agents.

## 4. Redundant (same task, diverse methods, then evaluator selects or synthesizes)

- **Mechanism.** A coordinator sends the same task to several agents. Each gets "an isolated nested chat where each agent has access to only the task message", and each uses a *different methodology*. After a collection phase, an **evaluator** scores the solutions against domain criteria and either *selects the best* or *synthesizes a composite*. This is a specialization of §3 with an explicit judge, and isolation prevents cross-contamination between agents.
- **When to use.** "Critical systems where errors must be minimized", creative tasks that benefit from distinct perspectives, problems with no clear best approach, medical second opinions, cross-validation of security threats.
- **Roles.** Coordinator, N diverse solvers, evaluator.
- **Note.** In AG2 Network (M19) the pattern is marked "Partial: No parallel dispatch; one specialist at a time".
- **Source.** M18 redundant.mdx; M19.

## 5. Group chat orchestration (roundtable / collaborative / multiagent debate / council)

- **Mechanism.** Agents (and optionally humans) share one **accumulating chat thread**. A **chat manager** picks who speaks next. The chosen agent's message is **broadcast** to all participants. In the classic implementations only one agent works at a time. Termination comes from the manager (a max-round count, a keyword such as "APPROVE"/"TERMINATE", or a custom condition).
  - The AutoGen Core message protocol: GroupChatMessage → the manager sends RequestToSpeak to the chosen agent → the agent publishes GroupChatMessage → repeat until termination.
  - SK's manager hook order on each round: `ShouldRequestUserInput` → `ShouldTerminate` → `FilterResults` (only on termination, to summarize) → `SelectNextAgent`.
  - Speaker-selection policies vary by framework:
    - **Round-robin:** AutoGen RoundRobinGroupChat, SK RoundRobinGroupChatManager, AG2 RoundRobinPattern.
    - **LLM selector / "auto":** AutoGen SelectorGroupChat and AG2 AutoPattern. Selection uses the history plus participants' names and *descriptions*, and by default blocks the same speaker twice in a row.
    - **Random:** AG2 RandomPattern, which excludes the current speaker.
    - **Manual:** a human picks the next speaker.
    - **Custom function:** `selector_func` / `selection_func`; returning None falls back to the LLM.
    - **Candidate filtering:** `candidate_func` narrows who the LLM may pick.
    - **Constrained transitions:** a graph (see §13).
    - **Explicit handoffs only:** AG2 DefaultPattern, where "Conversation terminates if no valid handoff is defined".
  - MAF `GroupChatBuilder` takes a `selection_func`, or an agent-based manager via `with_orchestrator(agent=)`. AutoGen Core also allows group chats to nest hierarchically: "each participant a recursive group chat".
  - AG2 `send_introductions=True` makes the manager tell every agent about the others before the chat starts.
- **When to use (M1).** Brainstorming; debate- and consensus-based decisions; iterative refinement through discussion; cross-functional problems; structured QA, compliance review and editorial review. It suits HITL, since humans can act as the manager or as observers, and the single thread "provides transparency and auditability". Agents are "typically in a read-only mode".
- **When to avoid (M1).** A plain pipeline would do; real-time requirements; hierarchical or deterministic flows; "The chat manager has no objective way to determine whether the task is complete." M1 also says to "consider limiting group chat orchestration to three or fewer agents."
- **Guidance on prompting the selector (M6).** "if you find yourself writing multiple conditions for each agent, it is a sign that you should consider using a custom selection function, or breaking down the task into smaller, sequential tasks". With reasoning models (o3-mini), keep the selector prompt minimal and drop the planning agent: "the SelectorGroupChat that uses a reasoning model can do that on its own." On the Core group chat (M5): "you can avoid using LLM when simple rules are sufficient and more reliable."
- **Roles.** Chat manager; specialist participants (writer, illustrator, editor; or community-engagement, environmental and budget agents in M1's park-planning example); optional human participant or observer; optional planning agent (M6 web-search example: the planner assigns `<agent> : <task>` and says TERMINATE when done).
- **Source.** M1 §Group chat; M2 group-chat.md; M3; M5 group-chat; M6 Teams/Selector; M10 Group Chat; M17 patterns.mdx.

## 6. Maker-checker loop (evaluator-optimizer / generator-verifier / critic loop / reflection loop / Reflection pattern / Feedback Loop)

- **Mechanism.** A *maker* produces an artifact and a *checker* evaluates it against defined criteria. Failures go back to the maker with specific feedback, and the loop repeats until the checker approves or an **iteration cap** is reached. M1 treats this as a turn-based subtype of group chat driven by the chat manager, and requires "clear acceptance criteria", an iteration cap, and fallback behaviour at the cap (escalate to a human, or return the best result with a quality warning).
  - **AutoGen "Reflection" (M5).** "an LLM generation is followed by a reflection, which in itself is another LLM generation conditioned on the output of the first one." It is implemented as coder → `CodeReviewTask` → reviewer → `CodeReviewResult` → (approved ? return : revise).
  - **AutoGen Teams tutorial (M6).** Builds it as a two-agent RoundRobinGroupChat with `TextMentionTermination("APPROVE")`.
  - **AG2 "Feedback Loop" (M18).** Creation → Review → Revision → Repeat, with "Quality-Based Termination" and context variables tracking how the document evolves.
  - **MAF (M4).** `workflow_as_agent_reflection_pattern` (a Worker plus a Reviewer with retry, wrapped as an agent) and `simple_loop` (an agent judges ABOVE/BELOW/MATCHED).
  - **AutoGen GraphFlow (M6).** Expresses the loop as a cyclic graph: generator ⇄ reviewer exits on "APPROVE", then a summarizer that sees only the first user message and the last review.
  - **Nested-chat variant (M11 scenario 1).** A critic sits *inside* the user_proxy, so every writer draft triggers a nested critique whose summary goes back to the writer.
- **When to use.** Quality assurance, editorial review, code review, compliance validation, "Content creation workflows that require editorial review with a clear separation of concerns between creation and validation" (M1).
- **Roles.** Maker/generator/writer/coder; checker/reviewer/critic/editor; optionally a human reviewer as the checker.
- **Source.** M1 §Maker-checker loops; M5 reflection; M6; M18 feedback_loop; M4.

## 7. Magentic orchestration (dynamic orchestration / task-ledger-based orchestration / adaptive planning), from Magentic-One

- **Mechanism (M1).** A **manager agent** builds and refines a **task ledger** of goals and subgoals by consulting specialist agents. Unlike group chat, those agents typically have *tools that change external systems*. The manager "iterates, backtracks, and delegates as many times as needed", regularly checks whether the request is "satisfied or stalled", and updates the plan. The ledger doubles as a reviewable, auditable plan. M1 calls it "an extension of the group chat pattern".
- **Mechanism (Magentic-One orchestrator, verified in M8 source and prompts).** Two nested loops:
  - **Outer loop (Task Ledger).**
    1. A "pre-survey" splits facts into GIVEN OR VERIFIED FACTS / FACTS TO LOOK UP / FACTS TO DERIVE / EDUCATED GUESSES.
    2. Given the team roster, the orchestrator drafts a short bullet-point plan ("there is no requirement to involve all team members").
    3. Task, team, facts and plan are combined into the ledger, which is broadcast to the team.
  - **Inner loop (Progress Ledger).** Each turn the orchestrator answers five JSON questions: `is_request_satisfied`, `is_in_loop`, `is_progress_being_made`, `next_speaker`, `instruction_or_question`. It then directs the chosen agent with that instruction.
    - A **stall counter** goes up when there is no progress or a loop is detected, and decays otherwise.
    - When `n_stalls >= max_stalls`, the orchestrator **re-enters the outer loop**: it updates the facts, revises the plan and resets the team.
    - The run ends when the request is satisfied or `max_turns` is reached. Either way the orchestrator writes a final answer through a final-answer prompt.
  - **Original agents.** Orchestrator, WebSurfer (browser), FileSurfer, Coder and ComputerTerminal (code execution).
- **Framework versions.** SK `MagenticOrchestration` with `StandardMagenticManager` ("inspired by", not a direct implementation; needs structured output). MAF `MagenticBuilder`, which supports **human plan review** before execution, checkpoint resume and custom ledger prompts. AutoGen `MagenticOneGroupChat` (a drop-in replacement for SelectorGroupChat) and the `MagenticOne` helper.
- **When to use (M1).** Open-ended problems with no predetermined path; cases needing input from several specialists to build the path; cases that need "a fully developed plan of approach that a human can review before or after implementation"; tool-wielding agents that change running systems (M1 example: SRE incident remediation with diagnostics, infrastructure, rollback and communication agents).
- **When to avoid (M1).** Deterministic solution paths; no need for a ledger; low complexity; time-sensitive work ("not optimizing for speed"); expected frequent stalls. M1 comparison: "Slow to converge. Stalls on ambiguous goals." Cost is "the most variable" of the five patterns.
- **Evidence.** M6 says Magentic-One achieves "competitive performance on a number of agentic benchmarks" and shows a GAIA trace. *From memory of M9, not re-verified this session:* the report found it statistically competitive with the state of the art at the time on GAIA (about 38% test with o1 + GPT-4o), AssistantBench (about 27.7%) and WebArena (about 32.8%), and its ablations showed that removing the orchestrator's ledgers or individual agents hurt performance. M6 also lists safety cautions: containers, human oversight, prompt injection from web pages.
- **Source.** M1 §Magentic; M2 magentic.md; M3; M6 magentic-one; M8; M9.

## 8. Handoff orchestration (routing / triage / transfer / dispatch / delegation / Swarm)

- **Mechanism.** One agent is active at a time. Each agent decides whether to handle the task or **transfer full control** to a better-suited agent. Usually the transfer is a special tool call (a "delegate tool" or handoff tool), and the receiving agent takes over with the **same shared context**. Escalation to a human is just another handoff target. The run ends when an agent decides the task is done, or on a termination condition. The pattern comes from OpenAI Swarm; AutoGen Core credits it explicitly.
  - **AutoGen Swarm (M6).** "the speaker agent is selected based on the most recent HandoffMessage". Agents "make local decisions about task planning, rather than relying on a central orchestrator". Handing off to `"user"` pauses the team for input, and the reply goes back to the agent that asked. The docs say to disable parallel tool calls so that several handoffs can't fire at once.
  - **AutoGen Core (M5).** Pub/sub with UserTask, AgentResponse and per-session topics; delegate tools publish to the target agent's topic.
  - **SK (M2).** `OrchestrationHandoffs` declares which agent may hand off to which, and an `InteractiveCallback` handles human input.
  - **MAF `HandoffBuilder` (M3).** `with_start_agent`; `.add_handoff(source, targets)`. By default a user reply goes back to the agent that asked, and `enable_return_to_previous(False)` makes the start agent re-triage every turn. `.with_autonomous_mode()` lets specialists iterate on their own until they call a handoff tool. Participants must persist history per service call.
  - **AG2 (M17).** Handoff kinds:
    - LLM-based conditions (`OnCondition`).
    - Context-variable conditions (`OnContextCondition`).
    - After-work fallback.
    - Explicit returns from tools (`ReplyResult`).
  - **AG2 transition targets:** AgentTarget/AgentNameTarget, FunctionTarget (runs custom logic and validation before choosing), AskUserTarget, NestedChatTarget, GroupManagerTarget, GroupChatTarget (a nested group chat), RandomAgentTarget, RevertToUserTarget, StayTarget, TerminateTarget.
- **When to use (M1).** The right specialist or sequence "can't be predetermined"; expertise needs that emerge during processing; multi-domain problems with one specialist at a time; capability-limit signals that can be predefined.
- **When to avoid (M1).** The right agent is clear from the initial input: "use deterministic routing or a simpler dispatcher that doesn't take an active role in processing. This dispatcher first classifies the input and then sends it to the appropriate agent." Also avoid it for rule-based routing, when bad routing would frustrate users, when concurrency is needed, or when handoff loops ("excessive bouncing") are hard to prevent.
- **Roles.** Triage agent, specialists (technical, billing, refunds, account access), human support agent, user proxy.
- **Source.** M1 §Handoff; M2 handoff.md; M3; M5 handoffs; M6 swarm; M17 handoffs.mdx.

## 9. Context-aware routing (router / dispatcher / classifier-then-route)

- **Mechanism.** A central **router** analyses each request's content and intent ("keywords, themes, and intent") and sends it to the single best domain specialist. If the domain is ambiguous, the router asks for clarification before routing. It keeps conversation state so later turns can be re-routed as the topic shifts. Information flows hub-and-spoke: Analysis → Decision Point → Specialization → Return Path. M1's "deterministic dispatcher" is the non-LLM-agent version: classify first, then send, with no active role in processing.
- **When to use.** Customer support routing to departments, multi-domain assistants, routing questions to domain experts, content moderation by type (M18). M1 recommends a dispatcher over Handoff when the target is identifiable from the initial input.
- **Roles.** Router, domain specialists, optional clarification step.
- **Source.** M18 context_aware_routing; M1 §Handoff "When to avoid"; M12 "Decision tree flow".

## 10. Two-agent chat (conversable pair; includes the code-writer/executor pair)

- **Mechanism.** A sender calls `initiate_chat` with a message and context, and the two agents alternate until a termination rule fires (`max_turns`, an is-termination message, or a human). A chat summarizer then condenses the transcript (`last_msg`, or `reflection_with_llm` using the recipient's LLM first) and reports cost. The canonical instance is an **assistant (LLM, writes code) ⇄ executor (UserProxy, runs code and returns output)** loop; see also M5 "Code Execution". EcoAssistant (M14) builds on this pair.
- **When to use.** The base unit for composing the other classic patterns (§2, §11). Good for tool or code loops where one side acts in the environment.
- **Source.** M10; M17 two-agent-chat.mdx; M5 code-execution; M14.

## 11. Nested chat / Society of Mind (team-as-agent, encapsulated inner monologue)

- **Mechanism.** A whole sub-workflow is packaged behind a single agent interface.
  - **AutoGen v0.2/AG2 nested chats.** When a message arrives (after the HITL step), a pluggable *nested-chats handler* on the receiving agent checks trigger conditions. If they match, it runs a **sequence of nested chats** in the sequential-chat pattern, with the triggering agent always as sender. It then replies with the result (by default the summary of the last nested chat). The outer agents never see the inner transcript. M11: "Nested chats allow AutoGen agents to use other agents as their inner monologue". Uses include hiding tool use (tool-caller ⇄ tool-executor inside one agent) and attaching a critic, or a critic plus executor, to every message.
  - **SocietyOfMindAgent (M7, M11).** Wraps an inner *team* (any group chat). On each call it runs the inner team, then makes one LLM call with the instruction "Here is a transcript of that conversation:" and the response prompt "Output a standalone response to the original request, without mentioning any of the intermediate discussion". Then it resets the inner team.
  - **Stated benefits of SocietyOfMindAgent (M11).** "a clean way of producing a hierarchy of agents, hiding complexity as inner monologues"; "a consistent way of extracting an answer from a lengthy group chat"; recovery when inner agents overflow their context.
  - **MAF equivalents (M3, M4).** `workflow.as_agent()` turns any orchestration into an agent, with Intermediate Output surfaced as `text_reasoning`. Sub-workflows wrap a workflow as an executor and support request interception.
  - **AG2 equivalents.** `NestedChatTarget` and `GroupChatTarget` handoff targets.
  - **AutoGen Core.** "nest group chats into a hierarchy with each participant a recursive group chat."
- **When to use.** To give a single conversational interface ("question-answering bots and personal assistants"); to reuse a workflow as a component in a larger one; to keep inner chatter out of the outer context; to get a clean final answer.
- **Roles.** Outer-facing wrapper agent, inner team (any topology), summarizer/response LLM.
- **Source.** M10 "Nested Chats"; M11; M7; M17 nested-chat.mdx; M3; M4 composition; M16 ("agents that are composed of multiple simpler agents. One can recursively build up more powerful agents").

## 12. Hierarchical / Tree (executive → managers → specialists)

- **Mechanism.** A three-level tree:
  - An **executive** breaks the problem down, delegates to domain **managers**, and synthesizes the final output.
  - Each manager breaks its part into subtasks, delegates to **specialists**, monitors progress, and aggregates results before reporting up.
  - Specialists do narrow tasks "without needing to understand the entire problem context".
  - Information flows *downstream* (tasks become more specific at each level) and *upstream* (results are aggregated and refined at each level).
  - AG2 builds it with group-chat handoffs. AG2 Network marks it Partial: there is no NestedChatTarget, so sub-flows run on separate channels.
- **When to use.** Complex research reports that need oversight plus deep dives, multi-team product development, multi-level approvals, tiered enterprise support.
- **Related.** M12 "Sequential Team Ops", where team managers talk to each other; nesting via §11.
- **Source.** M18 hierarchical.mdx; M19.

## 13. Star / Hub-and-spoke and Coordinator (orchestrator-workers with a central synthesizer)

- **Mechanism.** A flat, two-level structure. A **coordinator (hub)** holds the overall context, decomposes the task, sends targeted instructions to **specialist spokes**, and synthesizes their reports. Spokes report only to the hub and never to each other ("all communication passes through the central coordinator").
  - **AG2 Network "Coordinator" (M19).** One generic parameterized `handoff(to)` tool plus a `finish` tool, with control reverting to the initiator by default. It is the network-era translation of classic "Organic" auto-selection, with "No graph rewrite when specialists are added or removed".
  - **AutoGen Swarm stock-research example (M6).** A Planner hub hands off to the financial analyst, news analyst and writer, and each hands back to the planner, over a *shared* message history.
  - **SelectorGroupChat with a `selector_func`.** Forces "the Planning Agent to speak immediately after any specialized agent to check the progress".
- **When to use.** Support systems with specialist agents, research needing diverse domain expertise, travel guides, multi-domain planning, product recommendation (M18).
- **Roles.** Coordinator/planner/hub; specialists/spokes.
- **Source.** M18 star.mdx; M19 coordinator; M6 swarm, selector-group-chat; M12 "Hub and Spoke".

## 14. Organic (LLM auto-selection by agent description; no explicit routing rules)

- **Mechanism.** "The simplest of the Group Chat patterns". The Group Chat Manager (AG2 AutoPattern) picks the next agent purely from the messages plus each agent's `description`. No handoffs are defined. Context variables can still be updated through tools but don't affect routing. This is the same mechanism as AutoGen's SelectorGroupChat without a selector function, and as v0.2 `speaker_selection_method="auto"`. AG2 Network maps it to Coordinator.
- **When to use.** "situations where conversation flow is unpredictable or where defining explicit rules would be overly complex": collaborative creative work, educational assistants, consultative diagnosis.
- **Source.** M18 organic.mdx; M17 patterns.mdx (AutoPattern); M19.

## 15. Escalation / Assistant hierarchy (cost cascade by confidence)

- **Mechanism.** Agents are ranked by capability and cost. A triage agent sends the query to the **cheapest/basic** agent first. Each agent returns a structured answer with a **confidence score**. Below a threshold ("typically < 8/10") the query escalates to the next tier, and above it the answer is returned. Context variables track scores, escalation count and reasons, and all context is kept across tiers. The final answer goes back to the user through triage.
- **EcoAssistant "Assistant Hierarchy" (M14).** Each LLM gets its own assistant+executor pair, starting with the most cost-effective. "If the conversation ... concludes without successfully resolving the query, EcoAssistant would then restart the conversation with the next more expensive LLM assistant".
- **Evidence (M14).** "this strategy significantly reduces costs while still effectively addressing queries". Combined with *Solution Demonstration* (retrieving past successful query→code pairs), the two parts "have a synergistic effect".
- **When to use.** Tiered support, varying computational difficulty, moderation that moves from automated to human review, healthcare triage (M18). The goal is cost or efficiency.
- **Related.** M1 tells implementers to "Assign each agent a model that matches the complexity of its task."
- **Source.** M18 escalation.mdx; M14.

## 16. Triage with Tasks (decompose into a typed, dependency-ordered task queue)

- **Mechanism.**
  1. A **triage agent** splits the request into categorized, predefined task types (for example research tasks and writing tasks).
  2. A central **task manager** holds the queue, enforces prerequisites ("research tasks must complete before dependent writing tasks begin") and sends each task to its type's specialist.
  3. When all tasks are done, results are consolidated into a summary that reflects how the outputs relate.
  - AG2 uses it inside `DocAgent`. In AG2 Network it is a `TransitionGraph.sequence` over the plan triage produced.
- **When to use.** Research-before-writing pipelines, phased product development, multi-stage support (diagnosis before fix), report generation.
- **Roles.** Triage, task manager, typed specialists, summarizer.
- **Source.** M18 triage_with_tasks.mdx; M19.

## 17. Graph / state-machine workflow (GraphFlow, FSM group chat, StateFlow, MAF WorkflowBuilder)

- **Mechanism.** Agents (or executors) are **nodes**, and allowed transitions are **directed edges**, optionally conditioned on message content or state. The graph decides control flow; the LLM works inside each state.
  - **AutoGen GraphFlow (M6, experimental).** A DiGraph that supports "Sequential chains, Parallel fan-outs, Conditional branching, Loops with safe exit conditions". Execution starts at all source nodes and ends when no nodes remain.
    - **Activation groups** set join semantics: `activation_condition="all"` waits for every incoming edge, `"any"` fires on the first (for example "proceed with the fastest result").
    - A separate **message graph**, set through MessageFilterAgent and PerSourceFilter, controls what each node *sees*. The docs say this helps "Reduce hallucinations", "Control memory load" and "Focus agents only on relevant information".
  - **FSM GroupChat (M11, M12).** `allowed_or_disallowed_speaker_transitions` limits which speakers can follow which, while the LLM still chooses among allowed ones. The motivation: as agents increase, transition pairs grow and so does "the risk of sub-optimal transitions, which leads to wastage of tokens and/or poor outcomes". The listed shapes are one-pass (A→B→C), decision tree, hub-and-spoke, and "sequential team ops". Cycles are allowed.
  - **StateFlow (M13).** Models task solving "as state machines", separating "process grounding" (states and transitions, by rules or the LLM) from "sub-task solving" (actions within a state). It includes an explicit error state, and is built as a GroupChat with a custom speaker-selection function.
  - **MAF `WorkflowBuilder` (M4).** Executors and edges with *edge conditions*, *switch-case edge groups*, *multi-selection edge groups* (subset fan-out), fan-out/fan-in edges, loops, sub-workflows, checkpointing and `ctx.request_info()` for HITL. There is also a declarative YAML version (`WorkflowFactory`). MAF's guidance: "Use a workflow when execution order, routing, parallelism, multiple participants, checkpoints, human input, or intermediate outputs are part of the product contract."
  - **AG2.** DefaultPattern with explicit handoffs, and AG2 Network's `TransitionGraph` with rules FromSpeaker, ContextEquals and ToolCalled, plus dynamic `Handoff` returns.
- **When to use.** "Use Graph when you need strict control over the order in which agents act, or when different outcomes must lead to different next steps. Start with a simple team ... if ad-hoc conversation flow is sufficient." (M6). M1's anti-patterns list both "Using deterministic patterns for workflows that are inherently nondeterministic" and the reverse.
- **Evidence (M13).** On InterCode SQL and Bash (GPT-3.5-Turbo and GPT-4-Turbo) and on ALFWorld, compared with ReAct, Plan & Solve and ALFChat: "For both tasks, StateFlow achieves the best performance with the lowest cost" (details in arXiv 2403.11322).
- **Source.** M6 graph-flow; M11 FSM notebook; M12; M13; M4; M17 custom-group-chat.mdx; M20.

## 18. Mixture of Agents (layered feed-forward ensemble)

- **Mechanism.** Modelled on a feed-forward neural network. Worker agents are arranged in **L layers of K workers**, with one **orchestrator**.
  1. The orchestrator sends the task to layer 1.
  2. It synthesizes layer 1's results and sends the updated task, *with* those prior results, to layer 2. This repeats layer by layer.
  3. At the final layer it aggregates everything into one answer.
  - The example uses 3×3 workers on gpt-4o-mini, implemented with direct messaging so cancellation and error handling can be added. It follows Together's MoA (arXiv 2406.04692).
- **When to use.** Hard reasoning, such as math or IMO-style problems, where iterative cross-pollination of independent drafts helps.
- **Roles.** Orchestrator (dispatcher and aggregator); workers (models can differ per type).
- **Source.** M5 mixture-of-agents.

## 19. Multi-agent debate (sparse communication topology + majority vote)

- **Mechanism.**
  1. An **aggregator** sends the problem to N **solver** agents.
  2. Each solver answers and publishes its answer to its *neighbours only*. The example uses a sparse ring A–B–C–D, built with topic subscriptions.
  3. For a fixed number of rounds, solvers refine using their neighbours' answers.
  4. In the final round each publishes a final response, and the aggregator takes a **majority vote**.
  - It follows "Improving Multi-Agent Debate with Sparse Communication Topology" (arXiv 2406.11776). The demo uses GSM8K.
  - M1 also uses "multiagent debate" as an alias for group chat (§5), but the AutoGen version is a parallel, round-based, peer-to-peer topology, not a manager-led thread.
- **When to use.** Questions with verifiable answers where independent solvers plus peer critique and voting reduce error.
- **Roles.** Aggregator, solvers, communication graph.
- **Source.** M5 multi-agent-debate.

## 20. Automatic team construction (AutoBuild / AgentBuilder; CaptainAgent)

- **Mechanism.** A *builder* LLM reads a building-task description, generates the participant expert agents (names, system prompts, optionally retrieved from an expert or tool library), and assembles them into a group chat that then runs the execution task. AG2 ships `CaptainAgent`, which builds a team adaptively and has a tool retriever. Its blog post is not in the classic docs read here; only the code was seen.
- **When to use.** "building multi-agent system automatically, fast, and easily for complex tasks with minimal user prompt required" (M15).
- **Source.** M15; ag2 v0.14.0 `autogen/agentchat/contrib/captainagent/`.

## 21. AG2 Network conversation shapes and the "choreography dial" (2026)

- **Mechanism (M20).** Orchestration is set per **channel** by an **adapter**. The adapter is stateless code that decides who may speak next and when the channel closes; its state is a fold of the channel's write-ahead log. Four shipped shapes:
  - **consulting:** 1↔1, one question and one answer, auto-closes.
  - **conversation:** 1↔1 free-form, closed explicitly or by TTL.
  - **discussion:** N agents in round-robin.
  - **workflow:** N agents under a declared `TransitionGraph`. It "correlates closely with AG2's classic group chat with handoffs".
- **The dial.** "Pure choreography is loose; full orchestration is rigid. The framework offers control as a dial." The other dials are **audience addressing**, which opens private side-channels without polluting the main thread, and time-based **expectations/SLAs** (`acks_within`, `reply_within`, `max_silence` with handlers `auto_close`, `notify_channel`, `audit`).
- **Motivation.** The central coordinator "turns out to be a bottleneck, a single point of failure, and the place where all the state lives in memory"; so state should live in the durable channel.
- **Source.** M20; M19.

---

## Cross-cutting guidance from these sources (for the merge)

- **Pattern composition (M1).** "Don't try to make one workflow fit into a single pattern when different stages of your workload have different characteristics". For example, sequential for intake followed by concurrent for analysis. AutoGen v0.2 says the same: "compose these patterns like LEGO blocks".
- **Context handoff between agents (M1).** Decide what each next agent needs: full raw context, a compacted summary, or "only requires a new instruction set". Compact between agents, and persist shared state externally for long-running work. GraphFlow's message graph (§17) and SocietyOfMind's standalone response (§11) are mechanisms for this.
- **Termination toolbox (M6).** MaxMessage, TextMention, TokenUsage, Timeout, Handoff, SourceMatch, External, StopMessage, TextMessage, FunctionCall and Functional termination conditions, combinable with AND/OR. M1 requires iteration caps for maker-checker and loop or stall guards for group chat, handoff and magentic.
- **HITL placements (M1).** Observer in group chat, reviewer in maker-checker, escalation target in handoff and magentic, plan approval in magentic (MAF "human plan review"), and tool-scoped approval gates. MAF supports `.with_request_info()` on every builder plus tool-approval middleware.
- **Reliability (M1).** Timeouts and retries, graceful degradation, "Validate agent output before you pass it to the next agent", circuit breakers, compute isolation, and checkpoints (MAF checkpointing for handoff and magentic).
- **Cost (M1).** Sequential and handoff accumulate cost step by step, concurrent causes spikes, magentic is "the most variable". Right-size the model per agent.
- **Evaluation (M1).** "use scoring rubrics or language-model-as-judge evaluations rather than exact-match assertions."
- **General multi-agent evidence cited by Microsoft.** AutoGen Core intro: "Research works like AutoGen, MetaGPT and ChatDev have shown multi-agent systems out-performing single agent systems at complex tasks like software development." M16 argues that the benefit of a multi-agent architecture is mostly modularity and maintainability.

## Canonical names contributed by this branch

Direct model call; Single agent with tools; Sequential orchestration (pipeline); Sequential chat with carryover; Concurrent orchestration (fan-out/fan-in); Redundant (diverse solvers + evaluator); Group chat (manager-led shared thread: round-robin, LLM selector, random, manual, custom function); Maker-checker loop (reflection / evaluator-optimizer / feedback loop); Magentic orchestration (task and progress ledgers); Handoff (Swarm); Context-aware routing (dispatcher); Two-agent chat (assistant–executor pair); Nested chat / Society of Mind (team-as-agent); Hierarchical / Tree; Star / Hub-and-spoke / Coordinator; Organic (description-based auto-selection); Escalation / Assistant hierarchy; Triage with Tasks; Graph / state-machine workflow (GraphFlow, FSM, StateFlow); Mixture of Agents; Multi-agent debate (sparse topology + vote); Automatic team construction (AutoBuild / CaptainAgent); Choreography adapters (consulting / conversation / discussion / workflow).
