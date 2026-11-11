#!/usr/bin/env python3
"""Builds SCRATCH/lab-topologies.md from the merged entry data below."""
import sys, re

OUT = sys.argv[1]

SRC = {
 # Anthropic (branch 1)
 "AN.S1": "https://www.anthropic.com/engineering/building-effective-agents",
 "AN.S2": "https://www.anthropic.com/engineering/multi-agent-research-system",
 "AN.S3": "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents",
 "AN.S4": "https://claude.com/blog/building-agents-with-the-claude-agent-sdk",
 "AN.S5": "https://www.anthropic.com/engineering/code-execution-with-mcp",
 "AN.S6": "https://www.anthropic.com/engineering/advanced-tool-use",
 "AN.S7": "https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents",
 "AN.S8": "https://www.anthropic.com/engineering/building-c-compiler",
 "AN.S9": "https://www.anthropic.com/engineering/harness-design-long-running-apps",
 "AN.S10": "https://www.anthropic.com/engineering/managed-agents",
 "AN.S11": "https://claude.com/blog/new-in-claude-managed-agents",
 "AN.S12": "https://claude.com/blog/building-agents-when-to-fold-subagents-into-your-main-agent-loop",
 "AN.D1": "https://code.claude.com/docs/en/sub-agents",
 "AN.D2": "https://code.claude.com/docs/en/agent-sdk/subagents",
 "AN.D3": "https://code.claude.com/docs/en/agent-teams",
 "AN.D4": "https://code.claude.com/docs/en/workflows",
 "AN.D5": "https://code.claude.com/docs/en/best-practices",
 # OpenAI (branch 2)
 "OA.S1": "https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf",
 "OA.S2": "https://openai.github.io/openai-agents-python/multi_agent/",
 "OA.S3": "https://openai.github.io/openai-agents-python/handoffs/",
 "OA.S4": "https://openai.github.io/openai-agents-python/tools/",
 "OA.S5": "https://openai.github.io/openai-agents-python/guardrails/",
 "OA.S6": "https://github.com/openai/openai-agents-python/tree/main/examples/agent_patterns",
 "OA.S7": "https://github.com/openai/openai-agents-python/tree/main/examples/research_bot",
 "OA.S8": "https://openai.github.io/openai-agents-python/sandbox/guide/",
 "OA.S9": "https://github.com/openai/swarm",
 "OA.S10": "https://cookbook.openai.com/examples/orchestrating_agents",
 "OA.S11": "https://cookbook.openai.com/examples/structured_outputs_multi_agent",
 "OA.S12": "https://cookbook.openai.com/examples/agents_sdk/parallel_agents",
 "OA.S13": "https://cookbook.openai.com/examples/agents_sdk/multi-agent-portfolio-collaboration/multi_agent_portfolio_collaboration",
 "OA.S14": "https://cookbook.openai.com/examples/deep_research_api/introduction_to_deep_research_api_agents",
 "OA.S15": "https://cookbook.openai.com/examples/codex/codex_mcp_agents_sdk/building_consistent_workflows_codex_cli_agents_sdk",
 "OA.S16": "https://cookbook.openai.com/articles/codex_exec_plans",
 "OA.S17": "https://cookbook.openai.com/examples/agentkit/agentkit_walkthrough",
 "OA.S18": "https://cookbook.openai.com/examples/partners/agentic_governance_guide/agentic_governance_cookbook",
 "OA.S19": "https://cookbook.openai.com/examples/agents_sdk/building_reliable_agents_memory_compaction",
 "OA.S20": "https://cookbook.openai.com/examples/partners/AWS/policy_to_review_prior_authorization_agents_sdk_agentcore",
 "OA.S21": "https://github.com/openai/openai-cookbook/tree/main/examples/agents_api/apps/sev_bot",
 # Google / DeepMind (branch 3)
 "GO.patterns": "https://google.github.io/adk-docs/workflows/patterns/",
 "GO.collabblog": "https://cloud.google.com/blog/topics/developers-practitioners/building-collaborative-ai-a-developers-guide-to-multi-agent-systems-with-adk",
 "GO.devblog": "https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/ [snippet]",
 "GO.infoq": "https://www.infoq.com/news/2026/01/multi-agent-design-patterns/",
 "GO.graphs": "https://google.github.io/adk-docs/graphs/",
 "GO.routes": "https://google.github.io/adk-docs/graphs/routes/",
 "GO.dynamic": "https://google.github.io/adk-docs/graphs/dynamic/",
 "GO.collab": "https://google.github.io/adk-docs/workflows/collaboration/",
 "GO.routing": "https://github.com/google/adk-docs (docs/agents/routing.md, RoutedAgent)",
 "GO.arch": "https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system [snippet]",
 "GO.maarch": "https://docs.cloud.google.com/architecture/multiagent-ai-system [snippet]",
 "GO.agentengine": "https://cloud.google.com/blog/topics/partners/building-scalable-ai-agents-design-patterns-with-agent-engine-on-google-cloud",
 "GO.a2a": "https://a2a-protocol.org (spec: https://github.com/a2aproject/A2A)",
 "GO.du": "https://arxiv.org/abs/2305.14325 [snippet]",
 "GO.sparse": "https://aclanthology.org/2024.findings-emnlp.427/ [snippet]",
 "GO.kenton": "https://arxiv.org/abs/2407.04622 [snippet]",
 "GO.scaling": "https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/ (arXiv 2512.08296) [snippet]",
 "GO.mass": "https://research.google/pubs/multi-agent-design-optimizing-agents-with-better-prompts-and-topologies/ (arXiv 2502.02533) [snippet]",
 "GO.sc": "https://arxiv.org/abs/2203.11171 [memory]",
 "GO.coa": "https://arxiv.org/abs/2406.02818 [snippet]",
 "GO.cosci": "https://arxiv.org/abs/2502.18864 ; https://docs.cloud.google.com/gemini/enterprise/docs/co-scientist-and-alphaevolve [snippet]",
 "GO.alphaevolve": "Google DeepMind AlphaEvolve blog + white paper, 2025-05-14 (URL not captured by branch) [snippet/secondary]",
 "GO.concordia": "https://arxiv.org/abs/2312.03664 ; https://arxiv.org/abs/2507.08892 [snippet]",
 # Microsoft (branch 4)
 "MS.M1": "https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns",
 "MS.M2": "https://learn.microsoft.com/en-us/semantic-kernel/frameworks/agent/agent-orchestration/",
 "MS.M3": "https://github.com/microsoft/agent-framework/tree/main/python/packages/orchestrations",
 "MS.M4": "https://github.com/microsoft/agent-framework/tree/main/python/samples/03-workflows",
 "MS.M5": "https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/intro.html",
 "MS.M6": "https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/",
 "MS.M7": "https://github.com/microsoft/autogen/blob/main/python/packages/autogen-agentchat/src/autogen_agentchat/agents/_society_of_mind_agent.py",
 "MS.M8": "https://github.com/microsoft/autogen/tree/main/python/packages/autogen-agentchat/src/autogen_agentchat/teams/_group_chat/_magentic_one",
 "MS.M9": "https://arxiv.org/abs/2411.04468 (not fetched; figures from memory)",
 "MS.M10": "https://microsoft.github.io/autogen/0.2/docs/tutorial/conversation-patterns",
 "MS.M11": "https://github.com/microsoft/autogen/blob/0.2/notebook/agentchat_nestedchat.ipynb",
 "MS.M12": "https://microsoft.github.io/autogen/0.2/blog/2024/02/11/FSM-GroupChat",
 "MS.M13": "https://microsoft.github.io/autogen/0.2/blog/2024/02/29/StateFlow",
 "MS.M14": "https://microsoft.github.io/autogen/0.2/blog/2023/11/09/EcoAssistant",
 "MS.M15": "https://microsoft.github.io/autogen/0.2/blog/2023/11/26/Agent-AutoBuild",
 "MS.M16": "https://microsoft.github.io/autogen/0.2/blog/2024/05/24/Agent",
 "MS.M17": "https://docs.ag2.ai/latest/docs/user-guide/advanced-concepts/orchestration/",
 "MS.M18": "https://docs.ag2.ai/latest/docs/user-guide/advanced-concepts/pattern-cookbook/overview/",
 "MS.M19": "https://github.com/ag2ai/ag2/blob/main/website/docs/user-guide/network/pattern_cookbook/pattern_cookbook.mdx",
 "MS.M20": "https://github.com/ag2ai/ag2/tree/main/website/docs/_blogs/2026-05-15-AG2-Network-Choreography-Dial",
 # Frameworks (branch 5)
 "FW.L1": "https://docs.langchain.com/oss/python/langchain/multi-agent",
 "FW.L2": "https://docs.langchain.com/oss/python/langchain/multi-agent/subagents",
 "FW.L3": "https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs",
 "FW.L4": "https://docs.langchain.com/oss/python/langchain/multi-agent/router",
 "FW.L5": "https://docs.langchain.com/oss/python/langchain/multi-agent/skills",
 "FW.L6": "https://docs.langchain.com/oss/python/langchain/multi-agent/custom-workflow",
 "FW.L7": "https://docs.langchain.com/oss/python/langgraph/workflows-agents",
 "FW.L8": "https://docs.langchain.com/oss/python/migrate/langgraph-supervisor",
 "FW.L9": "https://docs.langchain.com/oss/python/deepagents/subagents",
 "FW.G1": "https://langchain-ai.github.io/langgraph/concepts/multi_agent/",
 "FW.G2": "https://langchain-ai.github.io/langgraph/concepts/agentic_concepts/",
 "FW.G3": "https://langchain-ai.github.io/langgraph/tutorials/multi_agent/",
 "FW.G4": "https://langchain-ai.github.io/langgraph/tutorials/plan-and-execute/ (also rewoo, llm-compiler)",
 "FW.G5": "https://langchain-ai.github.io/langgraph/tutorials/reflection/ (also reflexion, lats)",
 "FW.P1": "https://github.com/langchain-ai/langgraph-supervisor-py",
 "FW.P2": "https://github.com/langchain-ai/langgraph-swarm-py",
 "FW.B1": "https://blog.langchain.com/langgraph-multi-agent-workflows [search excerpt]",
 "FW.B2": "https://blog.langchain.com/planning-agents [search excerpt]",
 "FW.B3": "https://blog.langchain.com/reflection-agents [search excerpt]",
 "FW.B4": "https://blog.langchain.com/benchmarking-multi-agent-architectures [search excerpt]",
 "FW.B5": "https://blog.langchain.com/how-and-when-to-build-multi-agent-systems [search excerpt]",
 "FW.C1": "https://docs.crewai.com/en/concepts/processes",
 "FW.C2": "https://docs.crewai.com/en/learn/hierarchical-process",
 "FW.C3": "https://docs.crewai.com/en/concepts/flows",
 "FW.C4": "https://docs.crewai.com/en/introduction",
 "FW.C5": "https://docs.crewai.com/en/concepts/collaboration",
 "FW.Y1": "https://developers.llamaindex.ai/python/framework/understanding/agent/multi_agent",
 "FW.Y2": "https://github.com/run-llama/llama_index (docs/examples/agent/agent_workflow_multi, custom_multi_agent)",
 "FW.Y3": "https://developers.llamaindex.ai/python/llamaagents/workflows",
 "FW.Y4": "https://www.llamaindex.ai/blog/introducing-workflows-beta-a-new-way-to-create-complex-ai-applications-with-llamaindex [search excerpt]",
 "FW.Y5": "https://www.llamaindex.ai/blog/introducing-agentworkflow-a-powerful-system-for-building-ai-agent-systems [search excerpt]",
 # Meta / Together / others (branch 6)
 "OT.T1": "https://arxiv.org/abs/2406.04692",
 "OT.T2": "https://www.together.ai/blog/together-moa",
 "OT.T3": "https://github.com/togethercomputer/MoA",
 "OT.T4": "https://github.com/togethercomputer/together-cookbook/tree/main/agents",
 "OT.T5": "https://docs.together.ai/docs/workflows [snippet]",
 "OT.T6": "https://github.com/togethercomputer/open_deep_research ; https://www.together.ai/blog/open-deep-research",
 "OT.T7": "https://github.com/togethercomputer/together-cookbook/tree/main/agents (Nemotron3Ultra_RalphLoop, Nemotron3Ultra_ContentWriter)",
 "OT.M1": "https://github.com/facebookresearch/collaborative-reasoner",
 "OT.M2": "https://github.com/facebookresearch/sweet_rl",
 "OT.M3": "https://arxiv.org/abs/2506.01716 [snippet]",
 "OT.M4": "https://arxiv.org/abs/2510.24684 [snippet]",
 "OT.M5": "https://github.com/facebookresearch/meta-agents-research-environments",
 "OT.M6": "https://github.com/meta-llama/llama-stack/tree/main/docs",
 "OT.X1": "https://github.com/mistralai/cookbook/tree/main/mistral/agents",
 "OT.X2": "https://mistral.ai/news/agents-api [snippet] ; https://github.com/mistralai/client-python/blob/main/docs/sdks/conversations/README.md",
 "OT.X3": "https://docs.mistral.ai/workflows/building-workflows/durable_agents [snippet]",
 "OT.C1": "https://docs.cohere.com/v2/docs/tool-use-usage-patterns ; https://docs.cohere.com/page/agentic-multi-stage-rag",
 "OT.D1": "https://arxiv.org/abs/2512.02556 [snippet]",
 "OT.Q1": "https://qwenlm.github.io/blog/qwen-agent-2405/",
 "OT.Q2": "https://github.com/QwenLM/Qwen-Agent",
 "OT.Q3": "https://github.com/Alibaba-NLP/DeepResearch ; https://arxiv.org/abs/2510.24701 [snippet]",
 "OT.H1": "https://huggingface.co/blog/smolagents",
 "OT.H2": "https://huggingface.co/blog/beating-gaia",
 "OT.H3": "https://huggingface.co/blog/open-deep-research",
 "OT.H4": "https://huggingface.co/blog/structured-codeagent",
 "OT.H5": "https://huggingface.co/docs/smolagents",
 # Academic (branch 7)
 "AC.P1": "https://arxiv.org/abs/2210.03629",
 "AC.P2": "https://arxiv.org/abs/2203.11171",
 "AC.P3": "https://arxiv.org/abs/2303.17651",
 "AC.P4": "https://arxiv.org/abs/2303.11366",
 "AC.P5": "https://arxiv.org/abs/2305.10601",
 "AC.P6": "https://arxiv.org/abs/2308.09687",
 "AC.P7": "https://arxiv.org/abs/2310.04406",
 "AC.P8": "https://arxiv.org/abs/2305.18323",
 "AC.P9": "https://arxiv.org/abs/2312.04511",
 "AC.P10": "https://arxiv.org/abs/2305.14325",
 "AC.P11": "https://aclanthology.org/2024.emnlp-main.992",
 "AC.P12": "https://arxiv.org/abs/2508.17536",
 "AC.P13": "https://arxiv.org/abs/2306.05685",
 "AC.P14": "https://arxiv.org/abs/2404.18796",
 "AC.P15": "https://arxiv.org/abs/2308.07201",
 "AC.P16": "https://arxiv.org/abs/2406.04692",
 "AC.P17": "https://arxiv.org/abs/2502.00674",
 "AC.P18": "https://arxiv.org/abs/2308.00352",
 "AC.P19": "https://aclanthology.org/2024.acl-long.810",
 "AC.P20": "https://arxiv.org/abs/2303.17760",
 "AC.P21": "https://arxiv.org/abs/2308.10848",
 "AC.P22": "https://arxiv.org/abs/2406.07155",
 "AC.P23": "https://arxiv.org/abs/2505.19591",
 "AC.P24": "https://proceedings.neurips.cc/paper_files/paper/2024/hash/ee71a4b14ec26710b39ee6be113d7750-Abstract.html",
 "AC.P25": "https://proceedings.mlr.press/v235/zhuge24a.html",
 "AC.P26": "https://arxiv.org/abs/2410.02506",
 "AC.P27": "https://icml.cc/virtual/2025/poster/45567",
 "AC.P28": "https://openreview.net/forum?id=z5uVAKwmjf",
 "AC.P29": "https://arxiv.org/abs/2408.08435",
 "AC.P30": "https://arxiv.org/abs/2502.02533",
 "AC.P31": "https://arxiv.org/abs/2503.13657",
 "AC.P32": "https://arxiv.org/abs/2512.08296",
 "AC.P33": "https://arxiv.org/abs/2503.01935",
 "AC.P34": "https://arxiv.org/abs/2402.01680",
 "AC.P35": "https://arxiv.org/abs/2501.06322",
 "AC.P36": "https://arxiv.org/abs/2502.14321",
 "AC.P37": "https://arxiv.org/abs/2505.22467",
}

# Each entry: (group, name, aliases, mechanism, use_when, roles, params, sources, branch_refs)
E = []
def e(group, name, aliases, mech, use, roles, params, srcs, refs):
    E.append(dict(group=group, name=name, aliases=aliases, mech=mech, use=use,
                  roles=roles, params=params, srcs=srcs.split(), refs=refs))

G1 = "A. Single-agent atoms"
G2 = "B. Sequential compositions"
G3 = "C. Routing and cascades"
G4 = "D. Parallel and ensemble compositions"
G5 = "E. Centralised delegation"
G6 = "F. Decentralised and conversational multi-agent"
G7 = "G. Planning-led compositions"
G8 = "H. Refinement and verification loops"
G9 = "I. Debate and evaluation panels"
G10 = "J. Search and evolution"
G11 = "K. Orchestration runtimes and meta-design"
G12 = "L. Protocol, simulation and training topologies"
G13 = "M. Cross-cutting wrappers"

# ---------------- A ----------------
e(G1, "Single call (augmented LLM)",
  "augmented LLM; direct model call; simple processor (smolagents agency 0/3); single-turn agent",
  "One LLM call, optionally with retrieval, tools and memory exposed, and no loop. The node type every other topology composes.",
  "The task fits one well-prompted call. Every lab's ladder starts here: Microsoft 'use the lowest level of complexity that reliably meets your requirements'; HF 'regularize towards not using any agentic behaviour'.",
  "model (plus its augmentations)",
  "model; tools[]; output schema",
  "AN.S1 MS.M1 OT.H1", "AN A1; MS 0; OT 12")

e(G1, "Agent tool loop (ReAct)",
  "autonomous agent; single-agent run loop (OpenAI); single agent with tools (Microsoft); tool-calling agent (LangGraph); ReAct; gather-act-verify loop (Agent SDK); multi-step tool use / agentic RAG (Cohere); assistant-executor two-agent pair (AutoGen); MultiStepAgent (smolagents)",
  "One LLM in a self-loop through tools: think, call tool(s), observe environment ground truth, repeat. Parallel tool calls per step, self-correction and multi-stage retrieval are in-loop behaviours (Cohere). Ends on a final-output tool or schema, a reply with no tool calls, `Finish[...]`, or a max-turns cap. Optional human checkpoints.",
  "Open-ended tasks whose step count cannot be predicted; the default first build per OpenAI, Anthropic, Microsoft, LangChain and HF. Expect compounding errors and higher cost; sandbox it.",
  "agent; tools/environment; optional human",
  "model; tools[]; maxTurns; exit condition (final-output schema | no tool calls | stop token); verification method (tests, screenshots, LLM judge)",
  "AN.S1 AN.S4 OA.S1 OA.S9 OA.S10 MS.M1 MS.M6 MS.M10 FW.G2 FW.L7 OT.C1 OT.H5 AC.P1", "AN C0; OA 1; MS 0, 10; FW A6; OT 10, 18; AC A1")

e(G1, "Single loop with progressive disclosure",
  "folded subagents (Anthropic 2026); skills pattern (LangChain); always-on memory + progressive skills (Together/Deep Agents); parameterised prompt template (OpenAI); routine / NL SOP as system prompt (OpenAI Swarm cookbook)",
  "One agent, one context. Domain procedures are loaded on demand (skill name+description visible, full text read when matched); policy variables fill one base prompt; validation and approval limits live in tools; harness enforces turn/cost budgets and write gates. Routers, planners and domain subagents are folded into this loop.",
  "Default for many enterprise agents (late 2026). Keep a subagent only where the single loop measurably degrades (context bloat, parallel throwaway work, tool overload, conflicting instructions). Split signals (OpenAI): complex conditional logic, overlapping tools (some fail with <10 overlapping, others manage >15 distinct).",
  "single agent; skill/instruction packages",
  "skills[] (name, description, body); prompt variables; turn budget; cost budget; write gates",
  "AN.S12 AN.D5 FW.L5 FW.L1 OT.T7 OA.S1 OA.S10", "AN C0'; FW A11; OT 27; OA 1a, 1b")

e(G1, "Code-as-orchestrator (programmatic tool calling)",
  "programmatic tool calling (Anthropic, OpenAI); code execution with MCP; CodeAct / CodeAgent (smolagents); structured CodeAgent",
  "Instead of one tool call per model turn, the model writes a program (Python or JS) that runs in a sandbox and calls allowed tools with loops, branches, parallel calls and filtering; only the final value returns to context. CodeAct makes every agent action a code snippet ('a dynamic graph of tool execution in each action'). Tool definitions can be loaded on demand (tool search / filesystem).",
  "3+ dependent tool calls, large intermediate data where only summaries matter, parallel operations over many items, >10 tools. Skip for single simple calls. Evidence: 150K to 2K tokens (Anthropic MCP); -37% tokens (PTC); code actions ~30% fewer steps; GAIA 55% vs 33% with JSON actions (HF).",
  "model (author); sandbox runtime; tools",
  "allowed tools[]; sandbox limits (network/filesystem); output schema; max steps",
  "AN.S5 AN.S6 OA.S4 OT.H1 OT.H4 OT.H5", "AN E2; OA 15; OT 10")

# ---------------- B ----------------
e(G2, "Sequential pipeline (prompt chain with gates)",
  "prompt chaining; chain subagents (Claude Code); deterministic chain / code-orchestrated chaining (OpenAI); SequentialAgent / Sequential Pipeline (ADK); sequential orchestration / pipes-and-filters / linear delegation (Microsoft); Pipeline (AG2); sequential process (CrewAI); serial chain (Together, Mistral); nested sequential sub-agents (Qwen-Agent); linear workflow steps (LlamaIndex)",
  "Fixed linear order; each stage consumes the previous stage's output (or shared state keys). Optional programmatic gates between stages stop, divert or exit early; AG2 adds well-defined stage interfaces and early termination on error. Ends after the last stage. Application code, not a model, picks the next stage (OpenAI 2026 regulated example: 'no agent selects the next stage').",
  "Tasks that decompose into known, dependent steps; trading latency for accuracy; regulated domains where code must own control flow; per-stage model tiers. Avoid for embarrassingly parallel work, backtracking, or dynamic routing (Microsoft).",
  "stage agents; gate functions; controller (code)",
  "stages[] (each may itself be a topology); gate per edge; what context passes (full | summary | keys); per-stage model",
  "AN.S1 AN.D1 OA.S2 OA.S6 OA.S17 OA.S20 GO.patterns GO.devblog GO.arch MS.M1 MS.M2 MS.M3 MS.M5 MS.M18 FW.L7 FW.C1 FW.C2 FW.Y3 OT.T4 OT.T5 OT.M6 OT.X1 OT.Q2", "AN B1; OA 5; GO A2, B1; MS 1; FW A1, B1, C1; OT 2, 15")

e(G2, "Staged dialogue chain (sequential chats with carryover)",
  "sequential chat with carryover (AutoGen v0.2 / AG2); chat chain of dual-agent seminars (ChatDev); Sequential Team Ops (FSM group chat)",
  "A chain whose stages are bounded multi-turn two-agent dialogues rather than single calls. Each stage ends on a consensus token, max_turns or termination rule; a summarizer (last message or LLM reflection) condenses it and the summary is carried into the next stage's opening message (carryover accumulates). ChatDev adds 'communicative dehallucination' (assistant asks instructor for specifics).",
  "Interdependent sub-tasks where each step benefits from negotiation or review inside it, but the overall order is fixed (software lifecycle, curriculum design).",
  "driver/instructor; per-stage assistant; summarizer",
  "stages[] (pair, maxTurns, termination); summary method; carryover policy (accumulate | last)",
  "MS.M10 MS.M17 MS.M12 AC.P19", "MS 2; AC E2")

e(G2, "Artifact-gated role pipeline (SOP)",
  "SOP role pipeline with publish-subscribe message pool (MetaGPT); gated hub with return handoffs / PM gatekeeper (OpenAI Codex cookbook); Code = SOP(Team)",
  "Human SOP encoded as fixed specialist roles (PM, architect, engineer, QA...). Each role emits schema-bound artifacts (docs, files) to a shared pool or filesystem; roles subscribe to the artifact types they need. A gatekeeper (or the next role) checks required artifacts exist before unblocking the next stage; stages may run in parallel (frontend || backend). Engineer stage has an executable-feedback self-loop.",
  "Multi-artifact work with a known human process (software projects, JIRA-like rollouts, QA sign-offs). Structured outputs curb idle chatter and hallucination cascades.",
  "role agents; gatekeeper/PM; shared artifact pool",
  "roles[] with output schemas; required artifacts per gate; retry cap for executable feedback; parallel stage groups",
  "AC.P18 OA.S15", "AC E1; OA 11")

e(G2, "Rolling-summary chunk chain (Chain of Agents)",
  "Chain of Agents (Google); sequential workers + manager",
  "Long input split into chunks; worker i reads chunk i plus worker i-1's 'communication unit' and writes an updated unit; a manager reads the final unit and answers. Single pass, training-free.",
  "Inputs longer than the context window (long-doc QA, summarisation, code completion) as an alternative to RAG or full context. Up to ~10% over RAG/full-context baselines.",
  "workers (sequential); manager",
  "chunk size; worker prompt; manager prompt",
  "GO.coa AC.P24", "GO D7; AC E4")

# ---------------- C ----------------
e(G3, "Router (classify then dispatch)",
  "routing (Anthropic, LangGraph); structured-output routing (OpenAI); triage router; Coordinator/Dispatcher in its routing role (ADK); context-aware routing / deterministic dispatcher (Microsoft, AG2); conditional router (Together); Router (Qwen-Agent); routing queries to data sources (Cohere); Flow @router (CrewAI); RoutedAgent programmatic router with fallback (ADK)",
  "A classifier (LLM with structured output, rules, or a small model) labels the input and code sends it down exactly one branch (prompt, tool set, model or agent); that branch's output is returned. Variants: router may ask a clarifying question first (AG2); router fans out to several branches and a synthesizer merges (LangGraph Send); developer-written router with error fallback that re-routes excluding failed keys (ADK RoutedAgent); cost/quality tiering across models.",
  "Distinct input categories that can be classified accurately; target identifiable from the initial input (Microsoft recommends a dispatcher over handoff then). Stateless routers re-pay calls every turn (LangChain worked example). Anthropic 2026: LLM routers in front of specialists are often better folded into one loop.",
  "router/classifier; specialist handlers; optional synthesizer",
  "routes[] (label, handler, description); classifier (model | rules); fallback route; multi-route fan-out flag",
  "AN.S1 AN.S12 OA.S2 OA.S6 OA.S11 OA.S18 GO.patterns GO.routing MS.M1 MS.M18 FW.L4 FW.L7 FW.G2 FW.C3 OT.T4 OT.T5 OT.M6 OT.Q2 OT.C1 OT.H1", "AN B2; OA 3a, 6; GO A1, A12; MS 9; FW A3; OT 3")

e(G3, "Model cascade / escalation",
  "escalation pattern (AG2); Assistant Hierarchy (EcoAssistant); executor-advisor (Together, after Minions); cost tiering",
  "Agents ranked by cost and capability. Cascade form: send to the cheapest tier first; each returns an answer with a confidence score; below threshold (e.g. <8/10) or on failure, escalate to the next tier with context kept. Advisor form: a cheap executor runs its loop with a zero-arg `advisor` tool that forwards the transcript to a frontier model for brief advice, capped by an advisor-call budget.",
  "Cost reduction where most queries are easy; tiered support; moderation moving to human review. Minions: ~30x lower remote cost at ~87% of frontier quality.",
  "tiers (cheap to expensive); triage/controller; advisor",
  "tiers[] (model, cost); confidence threshold; max escalations; advisor call budget; advice length cap",
  "MS.M18 MS.M14 OT.T4", "MS 15; OT 6")

# ---------------- D ----------------
e(G4, "Parallel fan-out / fan-in (sectioning)",
  "parallelization: sectioning (Anthropic, LangGraph); parallel fan-out/fan-in (OpenAI); ParallelAgent + gather (ADK); concurrent orchestration / scatter-gather / map-reduce (Microsoft); parallel review by lens (Claude Code agent teams); Independent architecture (Google scaling study); parallel @start + and_ (CrewAI); list[Event] fan-out (LlamaIndex); Heavy mode (Tongyi: parallel research agents + synthesis model)",
  "The same input (or distinct aspects of it) goes to N independent workers concurrently with no cross-talk; outputs fan in to an aggregator: code merge, vote, weighted merge, or an LLM synthesizer. Branches write to distinct state keys to avoid races (ADK). Two implementations (OpenAI): code-level gather (deterministic, lowest latency) vs agents-as-tools with parallel tool calls (planner picks branches, extra latency). A guardrail running beside the main call is a sectioning case.",
  "Independent subtasks for speed, or concerns that each deserve full attention (several review lenses, several analysts on one ticker). Avoid when agents must build on each other, with shared mutable state, or without a conflict-resolution strategy. Google scaling study: independent agents amplify errors 17.2x vs 4.4x centralised.",
  "parallel workers; aggregator/synthesizer",
  "workers[] (prompt/lens each); width; aggregation (concat | vote | weighted | LLM synthesis); join (all | first-n | any)",
  "AN.S1 AN.D3 OA.S2 OA.S6 OA.S12 OA.S13 GO.patterns GO.devblog GO.arch GO.scaling MS.M1 MS.M2 MS.M3 MS.M4 MS.M5 FW.L7 FW.C3 FW.Y3 OT.T5 OT.Q3 AC.P32", "AN B3, C3; OA 7; GO A3, B2, D4; MS 3; FW A2, B5, C1; OT 26; AC H2")

e(G4, "Map over items (batch fan-out with isolated workspaces)",
  "headless fan-out loop (`claude -p` per file); `/batch`; parallel sessions in git worktrees; workflow `pipeline(items, fn)`; `kickoff_for_each` (CrewAI); sandboxed agents-as-tools (OpenAI); chunk-parallel map-filter-reduce reader (Qwen-Agent Lv2); multi-selection edge group (MAF)",
  "One sub-topology is applied to every item of a collection (files, chunks, inputs), concurrently up to a limit, each in its own context and often its own workspace (worktree, sandbox, container) so edits cannot collide; results return as a list for a reduce/merge step (or as separate PRs). Qwen's reader maps each 512-token chunk to relevant sentences or 'None', filters, then answers from the survivors.",
  "Large mechanical migrations; per-file review then merge-dedupe-rank; long documents far beyond the window (Qwen: 1M tokens with an 8k model). Pilot on a few items first (Claude Code).",
  "mapper (per-item agent or sub-topology); reducer",
  "items source; per-item sub-topology; concurrency; isolation (worktree | sandbox | none); reducer; pilot size; per-item maxTurns and OK/FAIL contract",
  "AN.D4 AN.D5 OA.S8 MS.M4 FW.C5 OT.Q1 OT.Q2", "AN E1, G3, G4; OA 16; FW B7; OT 14")

e(G4, "Sample-and-vote (self-consistency)",
  "parallelization: voting (Anthropic, LangGraph); self-consistency; aggregate block (MASS); claim voting (`/deep-research`); parallel-fewest-step (DeepSeek); majority-rule concurrent aggregation (Microsoft)",
  "The same task runs N times (same or varied prompts, temperature > 0) in parallel with no communication; a deterministic reducer takes a majority vote or threshold, or picks by a rule such as fewest steps.",
  "Tasks with an extractable answer or a binary decision where several attempts raise confidence (vulnerability flags, content-policy judgments with tunable thresholds). It is the equal-compute baseline that debate and MoA must beat: majority voting explains most debate gains (Debate-or-Vote, NeurIPS 2025).",
  "N samplers; voter",
  "N; prompt variants; temperature; vote rule (majority | threshold | fewest-steps)",
  "AN.S1 AN.D4 FW.L7 GO.sc GO.mass MS.M1 OT.D1 AC.P2 AC.P12", "AN B4; FW A2; GO D6; OT 25; AC A2, C3")

e(G4, "Best-of-N with judge (redundant solvers)",
  "Redundant pattern (AG2); best-of-N picker (OpenAI parallelization example); diverse solvers + evaluator; rubric-gated parallel drafts (Spiral on Managed Agents)",
  "N solvers, each isolated with only the task message and ideally a different method or model, produce candidates in parallel; an evaluator scores them against criteria and selects the best or synthesises a composite.",
  "Critical outputs where errors must be minimised, creative work with no single best approach, second opinions, cross-validation of findings.",
  "coordinator; diverse solvers; judge",
  "N; solver methods/models[]; judge rubric; select vs synthesize",
  "MS.M18 MS.M19 OA.S6 AN.S11", "MS 4; OA 7; AN D3")

e(G4, "Mixture-of-Agents (layered proposers + aggregator)",
  "MoA; MoA-Lite; Self-MoA (single-model variant); Parallel Agent Workflow (Together cookbook); mixture of agents (AutoGen Core)",
  "Feed-forward layered DAG: layer 1 has n proposers (usually different models) answering independently; every agent in layer i+1 sees all layer-i outputs under an aggregate-and-synthesize prompt; a final aggregator writes the answer. Fixed number of layers, no early stop.",
  "Open-ended answer quality from several open models without fine-tuning (AlpacaEval 65.1% vs GPT-4o 57.5%). Counter-evidence: Self-MoA (many samples of the single best model) beats mixed MoA by 6.6% on AlpacaEval; weak proposers drag quality down.",
  "proposers; intermediate aggregators; final aggregator",
  "layers; width per layer; proposer models[]; aggregator model; aggregate prompt",
  "OT.T1 OT.T2 OT.T3 OT.T4 MS.M5 AC.P16 AC.P17", "OT 1; MS 18; AC C4")

# ---------------- E ----------------
e(G5, "Orchestrator-workers (supervisor / manager / agents-as-tools)",
  "orchestrator-workers (Anthropic, LangGraph Send); manager pattern / agents-as-tools (OpenAI); supervisor (graph-node and tool-calling variants) and subagents (LangChain); deep agent harness (`task` tool); orchestrator agent (LlamaIndex); hierarchical process / manager agent (CrewAI); Coordinator with AgentTool (ADK); Star / hub-and-spoke / Coordinator (AG2, Microsoft); managed agents (smolagents); subagent context isolation (Claude Code/Agent SDK); managed multiagent orchestration (Claude Managed Agents); hosted multi-agent (OpenAI Responses API); orchestrator-subtask / parallel subtask (Together, Mistral); lead agent with dynamic sub-agents (Mistral); Centralized architecture (Google scaling study)",
  "A central agent decomposes the task at run time (number and shape of subtasks not predefined), delegates each subtask to a worker with its own fresh context, tools and model (edges are tool calls / nested runs), receives condensed results and synthesises. Two forms: one-shot (plan, fan out once, synthesise; Anthropic/Together workflow form) and looping supervisor (keeps the user conversation, calls workers repeatedly until it decides to stop; LangChain/OpenAI agent form). Workers never talk to each other or the user. Delegation can be sync or async (start/check/get), parallel, chained, forked, resumable; orchestration loop may run client-side, in a script, or provider-side.",
  "Complex tasks whose subtasks cannot be predicted; one agent should own the final answer and shared guardrails; context isolation for verbose side work (subagent returns ~1-2K tokens after using tens of thousands). Not for heavy shared context or inter-agent dependencies (most coding, per Anthropic). Supervisor 'translation' loses to handoffs unless workers can forward answers verbatim (LangChain B4, excerpt). Centralised contains errors (4.4x vs 17.2x amplification). Known failures: spawning too many workers, vague briefs duplicating work, delegation loops (CrewAI: only the manager may delegate).",
  "orchestrator/supervisor (also synthesiser); workers/specialists",
  "worker roster (name, description, tools, model); max workers per turn; nesting depth; concurrency; brief template (objective, output format, boundaries); return mode (last message | full history | summary); sync vs async; maxTurns per worker",
  "AN.S1 AN.S3 AN.S4 AN.S11 AN.D1 AN.D2 AN.D5 OA.S1 OA.S2 OA.S4 OA.S6 OA.S13 GO.patterns GO.collabblog GO.arch GO.scaling MS.M18 MS.M19 MS.M6 FW.L7 FW.G1 FW.G2 FW.P1 FW.L2 FW.L8 FW.L9 FW.B1 FW.B4 FW.C1 FW.C2 FW.C5 FW.Y1 OT.T4 OT.X1 OT.M6 OT.H2 OT.H5 AC.P32", "AN B5, C2, D4; OA 2, 14; GO A1, B6, D4; MS 13; FW A4, A8, A10, A20, B2, C3; OT 4, 9, 17; AC H2")

e(G5, "Hierarchical teams (supervisor of supervisors)",
  "hierarchical task decomposition (ADK, Google Cloud); hierarchical / tree (AG2); hierarchical agent teams (LangGraph); multi-level hierarchies (langgraph-supervisor); tree protocol (MARBLE); Hybrid architecture (Google scaling study, when peer links are added)",
  "A tree of depth > 1: an executive decomposes and delegates to managers, each manager decomposes further to specialists and aggregates before reporting up. Each team can be a compiled subgraph with its own state. Tasks get more specific downward; results are aggregated upward.",
  "When one supervisor has too many workers or a worker's job becomes too complex; multi-team research reports, tiered approvals.",
  "executive; team managers; specialists",
  "tree spec (levels, fan-out per level); per-level synthesis; depth cap",
  "GO.patterns GO.arch MS.M18 MS.M19 FW.G1 FW.G3 FW.P1 FW.L8 AC.P33 GO.scaling", "GO A4, B7; MS 12; FW A12; AC H3")

e(G5, "Nested team-as-agent (composite)",
  "Society of Mind agent; nested chat (AutoGen/AG2); NestedChatTarget / GroupChatTarget; workflow.as_agent / sub-workflows (MAF); Composite pattern (ADK guide); nested workflows (ADK graphs); Flow-to-Crew composition (CrewAI); multi-agent interface vs architecture (Chi Wang)",
  "Any sub-topology is wrapped behind a single agent interface. On each call the wrapper runs the inner team, then one LLM call turns the inner transcript into a standalone answer; the outer context never sees inner chatter. Composite designs nest patterns freely: router, then parallel stage, then generator-critic loop; deterministic flow outside, autonomous crew inside.",
  "Reuse a workflow as a component; keep inner chatter out of the outer context; give one conversational face to a team; production systems that need several properties at once.",
  "wrapper agent; inner team (any topology); response summariser",
  "inner topology spec; trigger condition; summary prompt; reset-after-call flag",
  "MS.M7 MS.M10 MS.M11 MS.M17 MS.M3 MS.M4 MS.M16 GO.devblog GO.infoq GO.routes FW.C4", "MS 11; GO A8; FW B6")

# ---------------- F ----------------
e(G6, "Handoff (decentralised transfer of control)",
  "decentralized pattern / handoffs (OpenAI); Swarm (OpenAI Swarm, langgraph-swarm, AutoGen Swarm); transfer_to_agent (ADK); handoff orchestration / routing / triage / transfer (Microsoft); network (LangGraph); AgentWorkflow 'linear swarm' (LlamaIndex); handoff network server/client-executed (Mistral); Swarm all-to-all (Google Cloud guide); Decentralized architecture (Google scaling study); peer delegation / ask-question (CrewAI, call-and-return variant); collaborative team with chat/task/single-turn modes (ADK 2.0)",
  "One agent is active at a time. A handoff is a tool (`transfer_to_<agent>`) that transfers full control and the conversation state to a peer, who then talks to the user directly; the run is one top-level run whose active agent changes. The system remembers the last active agent for the next turn. Options: input filters on what history the receiver sees, return-handoffs, a declared handoff graph, server- vs client-executed handoffs, human as a handoff target. Hybrid: a specialist reached by handoff calls further agents as tools.",
  "No single agent needs to keep control or synthesise; conversation triage; multi-stage support flows where the right specialist emerges during processing. Saves 40-50% calls on repeat turns vs routers (LangChain), beat supervisor on tau-bench (excerpt). Avoid when the target is clear up front, when concurrency is needed, or when bouncing loops are hard to stop; disable parallel tool calls so only one handoff fires.",
  "triage/front-door agent; peer specialists; optional human",
  "agents[] with allowed handoff targets (graph); start agent; history filter per handoff; return-to-previous policy; max handoffs",
  "OA.S1 OA.S2 OA.S3 OA.S6 OA.S8 OA.S9 OA.S10 OA.S18 GO.patterns GO.collab GO.arch GO.scaling MS.M1 MS.M2 MS.M3 MS.M5 MS.M6 MS.M17 FW.L3 FW.L1 FW.P2 FW.G1 FW.G3 FW.B4 FW.C5 FW.Y1 FW.Y2 FW.Y5 OT.X1 OT.X2 OT.X3", "OA 3, 3a, 4; GO A1, A11, B8; MS 8; FW A7, A9, B3, C2; OT 16")

e(G6, "Group chat (manager-selected speaker over a shared thread)",
  "group chat / roundtable / council (Microsoft); RoundRobinGroupChat, SelectorGroupChat (AutoGen); AutoPattern / Organic, RoundRobin, Random, Manual, Default patterns (AG2); GroupChat with host / round_robin / random / manual (Qwen-Agent); discussion adapter (AG2 Network); FSM-constrained group chat",
  "Agents (and optionally humans) share one accumulating thread. A chat manager picks the next speaker by a policy (round-robin, LLM selector reading descriptions, random, manual, custom function with LLM fallback, candidate filter, or a constrained transition graph); the speaker's message is broadcast to all. Ends on max rounds, a keyword (APPROVE/TERMINATE/[STOP]) or a custom condition. A planning agent may assign `<agent>: <task>` each turn.",
  "Brainstorming, consensus decisions, editorial or compliance review, cross-functional problems; transparent auditable thread suits HITL. Limit to ~3 agents (Microsoft); avoid when the manager has no objective completion test or for real-time needs. Prefer rule-based selection when rules suffice.",
  "chat manager/selector; participants; optional human; optional planner",
  "participants[] (name, description); selection policy; allowed transitions; max rounds; termination keyword/condition; allow repeat speaker",
  "MS.M1 MS.M2 MS.M3 MS.M5 MS.M6 MS.M10 MS.M17 MS.M18 MS.M20 OT.Q2", "MS 5, 14, 21; OT 13")

e(G6, "Shared task board (self-claiming peers)",
  "agent team with shared task list + mailbox (Claude Code); decentralised parallel swarm on a shared repo (Anthropic C compiler); shared message pool (survey term); AG2 Network channels with durable write-ahead log",
  "Peers coordinate through shared state instead of a controller. Claude Code agent teams: a lead spawns full sessions; a shared task list with dependency blocking; teammates self-claim the next unblocked task (file locks); a mailbox for direct peer messages; hooks as quality gates. C-compiler swarm: N identical agents in containers loop forever, claim work by lock files, pull-merge-push to git, specialists for dedupe/perf/docs, and a test oracle partitions failures into parallel-fixable bugs.",
  "Large decomposable work with a strong automated oracle (tests), or research/review/debugging where each teammate owns separate files. Avoid for same-file edits and heavy dependencies; token cost scales linearly with teammates. Evidence: ~2,000 sessions, ~$20K, 100K-line compiler building Linux.",
  "lead (optional); peer workers (generalist + specialist); task board/repo; oracle",
  "team size; task list with dependencies; claim/lock mechanism; messaging (mailbox | none); quality-gate hooks; oracle/test command; stop condition",
  "AN.D3 AN.S8 MS.M20 AC.P34", "AN C3, C4; MS 21; AC H4")

# ---------------- G ----------------
e(G7, "Plan-and-execute (planner, executor, replanner)",
  "plan-and-execute (LangGraph); ReWOO (plan once, no observation); LLMCompiler (streaming DAG + parallel executor + joiner); custom planner plan-execute-check (LlamaIndex); crew planning / AgentPlanner (CrewAI); periodic re-planning every N steps (smolagents); Triage with Tasks (AG2: typed, dependency-ordered task queue); living execution plan / ExecPlan (OpenAI Codex)",
  "A planner LLM writes an explicit multi-step plan; an executor (agent or tool runner) carries out steps; a replanner/joiner inspects results and either finishes or revises the remaining plan. Variants: ReWOO writes the whole tool chain with placeholders and a solver answers with no replanning (token-cheap); LLMCompiler streams a DAG and dispatches tasks as dependencies resolve (parallel); smolagents re-plans every N steps from a facts summary and a fresh plan (not the old plan, which anchors); a living plan document as externalised state for a single long-running agent.",
  "Explicit long-term planning; cheaper executor model with a strong planner; foreseeable tool chains (ReWOO 5x tokens); many independent tool calls (LLMCompiler up to 3.7x latency speedup).",
  "planner; executor(s); replanner/joiner/solver",
  "plan format (list | DAG | document); replan policy (never | every step | every N | on failure); executor sub-topology; max replans",
  "FW.G4 FW.B2 FW.Y1 FW.Y2 FW.C5 OT.H2 OT.H5 MS.M18 MS.M19 OA.S16 AC.P8 AC.P9", "FW A14, A15, A16, B4, C4; OT 11; MS 16; OA 17; AC A5, A6")

e(G7, "Ledger-based adaptive orchestration (Magentic)",
  "Magentic orchestration / Magentic-One; task-ledger orchestration; dynamic orchestration; adaptive planning; MagenticBuilder (MAF), MagenticOrchestration (SK), MagenticOneGroupChat (AutoGen)",
  "Two nested loops. Outer (task ledger): survey facts (given, to look up, to derive, guesses), draft a plan using the team roster, broadcast. Inner (progress ledger): each turn answer is_request_satisfied / is_in_loop / is_progress_being_made / next_speaker / instruction, then direct that agent. A stall counter rises on no progress or loops; past max_stalls the orchestrator re-enters the outer loop to update facts and replan. Ends when satisfied or max_turns, with a final-answer prompt. Optional human plan review before execution.",
  "Open-ended problems with no predetermined path, tool-wielding agents that change external systems (SRE remediation), when an auditable plan is required. Avoid for deterministic paths, time-sensitive work; slow to converge, most variable cost.",
  "orchestrator (ledgers); specialists (web, file, coder, terminal); optional human plan reviewer",
  "team roster; max_stalls; max_turns; ledger prompts; plan-review gate",
  "MS.M1 MS.M2 MS.M3 MS.M6 MS.M8 MS.M9", "MS 7")

e(G7, "Deep-research pipeline (plan, parallel search, gap loop, write, cite)",
  "lead-researcher multi-agent research system (Anthropic); planner-workers-writer-verifier research bot (OpenAI); plan-search-reflect (Together Open Deep Research); `/deep-research` workflow (Claude Code); agentic multi-stage RAG (Cohere); Open Deep Research (HF)",
  "A lead plans and saves the plan to memory; spawns parallel search subagents with explicit briefs; each searches iteratively and returns compressed findings; the lead (or a gap evaluator) checks completeness and spawns follow-up searches until a budget; a writer synthesises a report; a citation/verifier pass attributes or audits claims (Claude Code variant votes per claim). Effort scaling rules in the prompt (1 agent for facts, 2-4 for comparisons, 10+ for complex).",
  "Breadth-first, high-value research exceeding one context window. Anthropic: +90.2% over single agent on internal eval; token use explains 80% of BrowseComp variance; ~15x chat tokens. Not for tasks with shared context or real-time coordination.",
  "lead/planner; searchers; gap evaluator; writer; citation agent/verifier",
  "max subagents; effort-scaling rules; research budget (rounds, queries); source cap; verify mode (cite | audit | claim vote)",
  "AN.S2 AN.D4 OA.S7 OT.T6 OT.C1 OT.H3", "AN C1; OA 9; OT 7, 18")

e(G7, "Clarify, brief, execute (spec-first pipeline)",
  "clarify-then-execute (OpenAI deep research); interview then spec then fresh build session (Claude Code best practices); communicative dehallucination (ChatDev); clarifying-question agent (SWEET-RL ColBench)",
  "Before the expensive executor runs, a triage step checks whether context is missing; a clarifier asks the user follow-up questions; an instruction builder writes a precise brief/spec; the executor then runs from the brief in a clean context, and the spec doubles as the reviewer's rubric.",
  "Expensive long tasks where prompt enrichment raises quality; underspecified requests.",
  "triage; clarifier; brief/spec writer; executor",
  "clarification policy (skip if sufficient); max questions; brief schema; executor sub-topology",
  "OA.S14 AN.D5 AC.P19 OT.M2", "OA 10; AN G2; AC E2; OT 22")

# ---------------- H ----------------
e(G8, "Evaluator-optimizer (generator-critic loop)",
  "evaluator-optimizer (Anthropic, LangGraph); evaluator loop / LLM-as-a-judge loop (OpenAI); Generator-Critic / generate-and-review, LoopAgent iterative refinement, review-and-critique (ADK, Google Cloud); maker-checker loop, reflection pattern, feedback loop (Microsoft, AutoGen, AG2); looping generator-evaluator (Together); basic reflection (LangGraph); Self-Refine (same model); graded outcome loop with rubric (Claude Managed Agents Outcomes); goal / Stop-hook verification loop (Claude Code); writer/reviewer split (single-pass review variant); final_answer_checks (smolagents)",
  "A generator produces an artifact; a separate evaluator (ideally its own context, sceptical, rubric-calibrated) returns structured feedback {pass|fail, feedback}; on fail the generator revises. Ends on pass or an iteration cap, with fallback at the cap (escalate, or return best with a warning). Variants: same-model self-critique (Self-Refine); harness-enforced (Stop hook exit 2 blocks stop); human as checker; one-pass review only.",
  "Clear acceptance criteria exist and feedback measurably improves output (translation, code review, docx/pptx generation +8-10 points). Ungrounded self-reflection may not help (Huang et al.); grounding in tool/test feedback does. Tell reviewers to report correctness gaps, not style.",
  "generator/maker; evaluator/checker/critic; optional human",
  "iterations (max); acceptance rubric/criteria; evaluator model (often larger than generator); feedback schema; fallback at cap; evaluator context isolation",
  "AN.S1 AN.S9 AN.S11 AN.D5 OA.S2 OA.S6 GO.patterns GO.devblog GO.arch MS.M1 MS.M4 MS.M5 MS.M6 MS.M18 FW.L7 FW.G5 FW.B3 OT.T4 OT.T5 OT.M6 OT.H5 AC.P3", "AN B6, D3, G1, G5; OA 8; GO A5, A6, B3-B5; MS 6; FW A5, A17; OT 5; AC A3")

e(G8, "Planner-generator-evaluator harness",
  "GAN-inspired harness with sprint contracts (Anthropic 2026); plan-build-QA",
  "A planner expands a short prompt into a product spec; a generator builds in sprints, one feature at a time; before each sprint generator and evaluator negotiate a contract (what done means, how verified); the evaluator drives the running artefact (e.g. Playwright) and grades each criterion against hard thresholds, failing the sprint with feedback. Files carry state; context resets with structured handoffs replace compaction. V2 drops sprints and evaluates once at the end but keeps the planner.",
  "Tasks at or beyond the model's solo capability (full apps); overhead otherwise. Example: solo 20 min/$9 broken vs harness 6 h/$200 working.",
  "planner; generator; evaluator/QA",
  "sprint count or single-shot; contract template; grading thresholds per criterion; max QA rounds; context-reset policy",
  "AN.S9", "AN D2")

e(G8, "Trial loop with reflection memory (Reflexion)",
  "Reflexion; verbal reinforcement; LAST_ATTEMPT_AND_REFLEXION",
  "Outer loop over whole attempts: an actor (ReAct/CoT agent) attempts the task; an evaluator scores the trajectory (environment reward, unit tests, judge); a self-reflection model turns a failure into a natural-language lesson stored in episodic memory; the next attempt is conditioned on the memory. Ends on success or max trials. LangGraph's version uses tool-grounded critique and revision.",
  "Retry-able environments with an evaluable success signal (coding with tests, ALFWorld). HumanEval 91.0 pass@1 (snippet).",
  "actor; evaluator; reflector; memory store",
  "max trials; evaluator type; memory window (last k reflections)",
  "AC.P4 FW.G5 FW.B3", "AC A4; FW A18")

e(G8, "Fresh-context relay loop",
  "initializer + incremental coding-agent relay (Anthropic); Ralph loop (Together, after ghuntley); IterResearch rounds (Tongyi); Discard-all context reset (DeepSeek-V3.2); context reset with structured handoff (Anthropic harness)",
  "A sequence of fresh agent sessions on the same task with zero conversation carried over; state passes only through artifacts (progress file, feature list with pass flags, git log, PROGRESS.md/DONE.md, compact workspace). An optional initializer session writes the scaffolding; each later session re-orients from artifacts, makes one increment, tests, commits and updates progress. Ends when a done artifact appears or all features pass, or at an iteration cap.",
  "Multi-context-window builds that compaction cannot sustain; long-running coding, research or document work. DeepSeek Discard-all scored 67.6 on BrowseComp, about matching parallel scaling with far fewer steps (snippet).",
  "initializer (optional); repeated worker session; artifacts as memory",
  "iteration cap; progress-artifact schema; per-session routine (orient, smoke test, one increment, commit); done condition",
  "AN.S7 AN.S9 OT.T7 OT.Q3 OT.D1", "AN D1; OT 8, 25, 26")

# ---------------- I ----------------
e(G9, "Multi-agent debate (symmetric peers)",
  "multiagent debate / society of minds (Du et al.); sparse-topology debate (Google; AutoGen Core ring); collaborative reasoning / self-collaboration (Meta Coral); competing-hypotheses debate (Claude Code agent teams); AgentVerse horizontal decision-making; debate block (MASS)",
  "N peers answer independently, then for R synchronous rounds each reads the others' (or only its graph neighbours') latest answers and updates; a final majority vote or agreement ends it. No judge, no role asymmetry. Coral uses two instances of one model that must reach agreement; Claude Code teammates try to disprove each other's theories.",
  "Factuality and reasoning with verifiable answers; countering anchoring in debugging. Du: GSM8K 77.0 to 85.0. Sparse graphs match full connectivity at lower cost. Counter-evidence: majority vote alone explains most gains (Debate-or-Vote); models over-agree (>90% regardless of correctness, Coral).",
  "N peer debaters; aggregator/vote",
  "participants; rounds; communication graph (full | ring | sparse); final rule (vote | agreement); heterogeneous models flag",
  "GO.du GO.sparse MS.M5 OT.M1 AN.D3 AC.P10 AC.P12 AC.P21 GO.mass", "GO D1, D2; MS 19; OT 21; AN C3; AC C1, C3, F1")

e(G9, "Adversarial debate with judge",
  "MAD (Liang et al.); debate vs consultancy (DeepMind scalable oversight); devil/angel debate",
  "Two debaters argue opposing answers over rounds (tit-for-tat); a judge (possibly weaker) monitors, can stop early when resolved (adaptive break) or decides after max rounds. Consultancy baseline: one consultant argues to the judge.",
  "Counter-intuitive reasoning where one model's self-reflection gets stuck (Degeneration-of-Thought); scalable oversight with weak judges (debate beats consultancy when sides are assigned). Judges favour debaters sharing their backbone; moderate disagreement works best.",
  "affirmative; negative; judge",
  "rounds; side assignment (assigned | open); judge model; early-stop rule",
  "AC.P11 GO.kenton", "AC C2; GO D3")

e(G9, "Judge panel (jury / referee team)",
  "LLM-as-a-judge (single); Panel of LLM evaluators / PoLL (Cohere); ChatEval referee team (one-by-one, simultaneous, with summariser); voting judges with thresholds (Anthropic voting example)",
  "Evaluation topology downstream of generation. Single judge: pairwise (both orders), absolute, or reference-guided grading. Jury: K smaller judges from disjoint model families score independently in parallel and scores are pooled (max vote or average). Referee team: persona-diverse judges discuss in turns before verdicts are aggregated.",
  "Scalable evaluation of open-ended outputs and the evaluator slot inside loops. GPT-4 judges agree with humans >80%; PoLL correlates better than one GPT-4 judge at 7-8x lower cost; identical personas degrade ChatEval.",
  "candidates; judges; aggregator; optional summariser",
  "judges[] (model, persona); grading mode (pairwise | absolute | reference); pooling rule; discussion mode (none | one-by-one | simultaneous)",
  "AC.P13 AC.P14 AC.P15 AN.S1", "AC D1-D3; AN B4")

e(G9, "Two-agent role-play dialogue",
  "two-agent chat / conversable pair (AutoGen, AG2); role-playing user/assistant with inception prompting (CAMEL); instructor/assistant seminar (ChatDev); consulting and conversation adapters (AG2 Network); agent with simulated human collaborator (SWEET-RL)",
  "Two agents with fixed roles alternate turns (one instructs or holds hidden requirements, the other executes or asks); optional task-specifier first; ends on a done token, max turns or human stop, then a summariser condenses the transcript.",
  "Base unit for composing staged dialogue chains and nested chats; tool/code loops where one side acts; generating conversational data; training agents to elicit requirements. Known failures: role flipping, instruction repetition, infinite loops.",
  "instructor/user; assistant/executor; optional task specifier",
  "roles (system prompts); maxTurns; termination token; summary method",
  "MS.M10 MS.M17 MS.M20 AC.P20 AC.P19 OT.M2", "MS 10, 21; AC E3; OT 22")

# ---------------- J ----------------
e(G10, "Tree / graph search over thoughts or trajectories",
  "Tree of Thoughts (BFS/DFS); Graph of Thoughts (graph of operations with aggregate/refine); LATS (MCTS over agent trajectories, ported to LangGraph and LlamaIndex)",
  "A non-LLM search controller expands candidate partial solutions with an LLM proposer, scores them with an LLM value function or environment reward, and keeps/backtracks: beam per level (ToT BFS), depth-first with pruning (ToT DFS), UCT selection with backpropagation and Reflexion-style lessons on failure (LATS), or a declared graph with Aggregate and Refine operations that merge branches (GoT).",
  "Problems needing exploration, lookahead or backtracking with a usable evaluator: Game of 24 (CoT 4% vs ToT 74%), programming with tests, WebShop. Spends much more inference.",
  "proposer/expander; evaluator/value function; search controller; reflector (LATS)",
  "branching factor k; beam width b; depth/rollout cap; search algorithm (BFS | DFS | MCTS); evaluator; aggregate operations (GoT)",
  "AC.P5 AC.P6 AC.P7 FW.G5", "AC B1-B3; FW A19")

e(G10, "Population search (tournament / evolution)",
  "AI co-scientist supervisor + tournament evolution; AlphaEvolve evolutionary coding loop; MAP-Elites program database",
  "A population of candidates is generated, scored and recombined in an asynchronous loop. Co-scientist: a supervisor schedules generation, reflection (peer review), ranking (Elo tournament via simulated debates), proximity (dedupe), evolution (combine top hypotheses) and meta-review agents on a task queue. AlphaEvolve: a prompt sampler builds prompts from parent programs and scores, an LLM ensemble (fast + strong) proposes diffs, automated evaluators score them, and results return to a database balancing exploration and exploitation. Ends on budget.",
  "Problems with machine-checkable evaluation (AlphaEvolve: 48-multiplication 4x4 complex matmul, 0.7% fleet compute) or expert-rankable hypotheses; quality scales with test-time compute.",
  "supervisor; generators; reviewers; ranker; evolver; evaluator",
  "population size; generations/budget; selection rule (Elo | MAP-Elites); evaluator function; model ensemble",
  "GO.cosci GO.alphaevolve", "GO D8, D9")

# ---------------- K ----------------
e(G11, "Graph / state-machine workflow",
  "graph-based workflow (ADK 2.0); custom logic (Google Cloud); GraphFlow, FSM group chat, StateFlow (AutoGen); WorkflowBuilder with edge groups (MAF); custom workflow (LangChain/LangGraph); Flows (CrewAI); Workflows event-driven steps (LlamaIndex); Agent Builder canvas (OpenAI AgentKit); TransitionGraph (AG2 Network); MacNet DAG and MARBLE graph protocol (research)",
  "Nodes are agents, LLM calls, code functions or human-input tasks; directed edges (fixed or condition-gated, switch-case, multi-select) carry typed events/state; supports sequence, branch, fan-out with join semantics (all | any | first-n), loops via back-edges with explicit exit, nested sub-workflows, checkpointing and HITL. A separate message graph can limit what each node sees (GraphFlow). StateFlow separates process grounding (states, transitions) from sub-task solving.",
  "Execution order, routing, parallelism, checkpoints or human input are part of the product contract (MAF); long prompt procedures becoming unreliable (ADK); mixing deterministic steps with agentic ones. Avoid forcing determinism on inherently open tasks (and vice versa). StateFlow: best performance at lowest cost vs ReAct on InterCode/ALFWorld.",
  "node-defined",
  "nodes[]; edges[] with conditions; join semantics; loop exit conditions; per-node visibility filter; checkpoint policy",
  "GO.graphs GO.routes GO.arch MS.M4 MS.M6 MS.M11 MS.M12 MS.M13 MS.M19 FW.L6 FW.G1 FW.C3 FW.C4 FW.Y3 FW.Y4 OA.S17 AC.P22 AC.P33", "GO A9, B10; MS 17; FW A13, B5, C1; OA (meta S1/S17); AC F2, H3")

e(G11, "Dynamic code-defined workflow (script orchestrator)",
  "dynamic workflows (Claude Code `agent()/pipeline()/parallel()`); dynamic agent workflows / dynamic nodes (ADK 2.0); code-first orchestration (OpenAI Agents SDK)",
  "Orchestration is ordinary code run by a runtime outside the conversation: the script spawns subagents (optionally with output schemas), maps over items, runs parallel joins, loops until a check passes or converges, and holds intermediate results so only the final answer reaches the conversation. Deterministic replay (no clock or randomness) gives checkpoint and resume. Named shapes: fan-out audit with adversarial verification, fix-until-check-passes (stop on two no-progress rounds), find-until-saturation, per-file review then merge-dedupe-rank, plan from several angles then weigh.",
  "More agents than one conversation can coordinate (dozens to hundreds), complex branching where a declared graph is unwieldy, or orchestration you want to rerun. 'With a workflow, the script decides.'",
  "script (orchestrator); worker subagents; verifier/judge subagents",
  "concurrency; max agents per run; per-agent output schema; convergence rule (n rounds without progress); replay/resume key",
  "AN.D4 AN.D2 GO.dynamic OA.S1 OA.S2", "AN E1; GO A10; OA meta")

e(G11, "Automatic team construction (runtime role recruitment)",
  "AutoBuild / AgentBuilder, CaptainAgent (AutoGen/AG2); AgentVerse recruit-decide-execute-evaluate loop; lead agent that creates specialised sub-agents at runtime (Mistral HubSpot)",
  "A builder/recruiter LLM reads the task, generates expert agents (names, system prompts, tools, optionally from a library), assembles them into a team topology (group chat, horizontal or vertical decision), runs it, and in AgentVerse re-recruits from evaluator feedback until the goal is met or a round cap.",
  "Tasks where the needed specialists are not known in advance; fast team setup with minimal prompting.",
  "builder/recruiter; generated experts; evaluator",
  "max experts; expert library; inner topology; re-recruit rounds; evaluator criteria",
  "MS.M15 AC.P21 OT.X1", "MS 20; AC F1; OT 17")

e(G11, "Learned topology optimisation (offline search)",
  "GPTSwarm (edge/node optimisation); AgentPrune (communication pruning); G-Designer (per-query GNN topology); AFlow (MCTS over code workflows); ADAS / Meta Agent Search; MASS (staged prompt + topology search); Puppeteer (RL-trained orchestrator); topological structure learning (position paper)",
  "Topology becomes an optimised object: candidate graphs or workflow programs built from blocks (generate, review, revise, ensemble, debate, reflect, tool use) are sampled, scored on a validation set and improved by REINFORCE, MCTS, a meta-agent writing code, GNN decoding per query, pruning of redundant edges, or an RL-trained central policy that activates agents step by step. The learned topology is then executed.",
  "A benchmarked task family with a validation signal and an unknown best pattern. MASS: prompts often matter more than topology; AFlow lets small models beat GPT-4o at ~4.55% cost (memory); AgentPrune cuts tokens 28-72%.",
  "optimizer (algorithm or meta-agent); candidate agents/blocks; evaluator",
  "block library; search algorithm; validation set; budget (rounds); cost-quality trade-off weight",
  "AC.P25 AC.P26 AC.P27 AC.P28 AC.P29 AC.P30 AC.P23 AC.P37 GO.mass", "AC G1-G7, H4; GO D5")

# ---------------- L ----------------
e(G12, "Remote agent delegation (A2A)",
  "Agent2Agent protocol client/remote agent; RemoteA2aAgent in an ADK tree; orchestrator + sub-agents over A2A with tools over MCP (Agent Engine); Agent2Agent app sub-agents (Meta ARE/Gaia2)",
  "A client agent discovers an opaque remote agent by its Agent Card and sends JSON-RPC requests that return a message or a stateful task (SUBMITTED, WORKING, INPUT_REQUIRED, AUTH_REQUIRED; terminal COMPLETED, CANCELED, REJECTED, FAILED); long work streams or pushes via webhook; refinements are new tasks in the same contextId. A2A is horizontal (agent to agent) while MCP is vertical (agent to tool). Gaia2 replaces apps with app-agents the main agent must message.",
  "Agents owned by other teams or orgs, in other frameworks or languages, or needing a formal contract; prefer local sub-agents in-process. Gaia2: decomposition helps weaker models but can hurt stronger ones (snippet).",
  "client agent; remote agent(s); user",
  "agent card endpoint; auth; delivery (poll | stream | push); input-required handling; task timeout",
  "GO.a2a GO.agentengine OT.M5", "GO B11, C1; OT 24")

e(G12, "Game-master mediation (simulation hub)",
  "Concordia Game Master; generative agent-based modelling",
  "Player agents state intended actions in natural language; a central Game Master checks plausibility, resolves outcomes, updates world state (possibly via real tools/APIs) and narrates observations back; turn-taking or simultaneous moves; nested games; loops per step until the scenario ends.",
  "Social simulation and evaluating agents in shared environments.",
  "game master; players",
  "players[]; turn mode (sequential | simultaneous); steps; world-state tools",
  "GO.concordia", "GO D10")

e(G12, "Self-play challenger-executor (training-time)",
  "Self-Challenging agents (Meta FAIR); SPICE challenger-reasoner; Code-as-Task",
  "One model alternates roles: a challenger explores tools or mines a corpus and writes tasks with verifiers; an executor attempts them; rewards go to the executor for correctness and to the challenger for tasks at the edge of the executor's ability. A training loop rather than an inference topology.",
  "Generating training data or curricula without human labels (Llama-3.1-8B roughly doubled tool-use success; SPICE +8.9% math).",
  "challenger; executor; verifier",
  "rounds; difficulty reward; verifier type",
  "OT.M3 OT.M4", "OT 23")

e(G12, "Offline improvement loop (cross-session learning)",
  "dreaming / offline memory consolidation (Claude Managed Agents); self-improving agent with eval-and-rewrite-own-prompt outer loop (Llama Stack/OGX); experiential co-learning (ChatDev); memory across runs (OpenAI compaction+memory cookbook)",
  "A scheduled outer loop runs between task sessions: it reviews past sessions or scores the agent on test cases with a separate judge model, extracts recurring mistakes and converged workflows, and rewrites memory or the system prompt (auto-applied or held for review). The inner loop is any agent topology.",
  "Agents that run repeatedly and should improve across sessions; avoid self-grading bias by using a different judge. Harvey ~6x completion gain with dreaming plus orchestration.",
  "worker sessions; evaluator/judge; consolidator/prompt rewriter",
  "schedule (every N runs); eval set; judge model; apply mode (auto | review); memory store",
  "AN.S11 OT.M6 AC.P19 OA.S19", "AN D5; OT 20; AC E2; OA 18")

# ---------------- M ----------------
e(G13, "Guardrail wrapper (layered tripwires)",
  "input/output/tool guardrails with tripwires (OpenAI); guardrail-sandwiched agent loop / shields (Llama Stack); SecurityPlugin + policy engine (ADK); guardrail screening in parallel (Anthropic sectioning example)",
  "Checks run around any topology: input guardrails on the first agent (optimistic in parallel with the agent, or blocking), tool guardrails before/after each tool call, output guardrails on the final answer. A tripwire raises and halts the run. Layering several specialised checks (relevance, jailbreak, PII, moderation, regex) gives defence in depth; a cheap fast model screens before an expensive one.",
  "Any production agent; tool-level guards are preferred in manager or handoff systems.",
  "guardrail checks; wrapped topology",
  "input checks[]; tool checks[]; output checks[]; parallel vs blocking; tripwire action",
  "OA.S1 OA.S5 OA.S6 OA.S18 OT.M6 GO.patterns AN.S1", "OA 12; OT 19; GO A7; AN B3")

e(G13, "Human approval gate (interrupt and resume)",
  "human-in-the-loop (all labs); needs_approval + interruptions + serialised run state (OpenAI); policy-gated confirmation (ADK); request_info / human plan review (MAF); @human_feedback (CrewAI); plan-approval gate (Claude Code agent teams); HITL plan gate on PlanningStep (smolagents)",
  "The run pauses at a defined point (sensitive tool call, plan ready, failure threshold, before aggregation), serialises state, surfaces a request to a human (UI, Slack button, ticket), and resumes with approve/reject/edit as the tool result or route label. Placements: observer in group chat, checker in maker-checker, escalation target in handoff, plan reviewer in magentic.",
  "High-risk or irreversible actions and exceeded failure thresholds (OpenAI's two triggers), plan review before costly execution, governance rules.",
  "agent/topology; human approver; policy engine (optional)",
  "gate points (tool list | plan | pre-aggregation); policy rule; timeout/default action; resume channel",
  "OA.S1 OA.S6 OA.S21 GO.patterns MS.M1 MS.M3 FW.C3 AN.D3 OT.H5", "OA 13; GO A7, B9; MS (HITL placements); FW B5; AN C3; OT 11")


# -------------- render --------------
def urls(ids):
    out = []
    for i in ids:
        if i not in SRC:
            raise SystemExit(f"unknown source id {i}")
        out.append(f"{i} {SRC[i]}")
    return out

lines = []
L = lines.append
L("# Lab topologies: merged candidate list")
L("")
L("Merged 2026-10-31 from seven research branches (files in `labs/`): anthropic.md (AN), openai.md (OA), google-deepmind.md (GO), microsoft.md (MS), frameworks-langchain-crewai-llamaindex.md (FW), meta-together-others.md (OT), academic-canon.md (AC).")
L("One entry per distinct topology. Synonyms across sources are folded into **aliases**. 'Params' are the dispatch parameters the topology would need if added to a catalog whose topologies take `roles{}` and `params{}`.")
L("`Branch refs` point at section numbers inside each branch file, for evidence and quotes not repeated here. Source tags: [snippet] / [search excerpt] = known only from search-result text; [memory] = model prior knowledge, unverified this session.")
L("")
L("## Coverage gaps")
L("")
L("- **Failed branches: none.** All 7 branches returned done.")
L("- **Partial coverage, every branch:** the session's network blocked most lab domains (anthropic.com was reachable; openai.com, cdn.openai.com, openai.github.io, learn.microsoft.com, google.github.io, docs.cloud.google.com, deepmind.google, research.google, arxiv.org, huggingface.co, together.ai, mistral.ai, docs.cohere.com, ai.meta.com, docs.langchain.com, blog.langchain.com, docs.crewai.com, llamaindex.ai were not). Branches read the same docs from GitHub source repos instead; blog posts and papers on blocked hosts are snippet-only.")
L("- Specific unverified items: Anthropic Oct 2026 'fold subagents' post read only via a model summary, Managed Agents outcome iteration limits not stated; OpenAI 2025 blog posts (New tools for building agents, AgentKit launch) unread; Google Cloud Architecture Center pattern page and DeepMind papers snippet-only; Magentic-One benchmark figures from memory; LangChain multi-agent benchmark (swarm vs supervisor, ~50% supervisor fix gain) excerpt-only; MoA ablations, Mistral, DeepSeek, Meta FAIR results snippet-only; academic evidence tagged [R]/[S]/[M] in academic-canon.md.")
L("")
L("## Index")
L("")
groups = []
for x in E:
    if x["group"] not in groups:
        groups.append(x["group"])
n = 0
for g in groups:
    names = []
    for x in E:
        if x["group"] == g:
            n += 1
            x["num"] = n
            names.append(f"{n}. {x['name']}")
    L(f"- **{g}:** " + "; ".join(names))
L("")
L("---")
for g in groups:
    L("")
    L(f"## {g}")
    for x in E:
        if x["group"] != g:
            continue
        L("")
        L(f"### {x['num']}. {x['name']}")
        L(f"- **Aliases:** {x['aliases']}")
        L(f"- **Mechanism:** {x['mech']}")
        L(f"- **Use when:** {x['use']}")
        L(f"- **Roles:** {x['roles']}")
        L(f"- **Params:** {x['params']}")
        L(f"- **Branch refs:** {x['refs']}")
        L("- **Sources:**")
        for u in urls(x["srcs"]):
            L(f"  - {u}")

L("")
L("---")
L("")
L("## Not topologies: adjuncts, taxonomies and evidence lenses")
L("")
L("These recur in the sources and shape topology choice, but are not composition patterns themselves.")
L("")
L("- **Context-management adjuncts (single-agent long horizon):** compaction, clearing old tool results, structured note-taking (NOTES.md, progress files), just-in-time retrieval with hybrid preload (Anthropic S3/S4/S9: AN F1-F3); compaction + cross-run memory (OpenAI S19: OA 18); Summary / Discard-75% / Discard-all on context overflow (DeepSeek: OT 25). The reset variants become a topology in entry 'Fresh-context relay loop'.")
L("- **Complexity ladders:** direct call, single agent with tools, multi-agent (Microsoft M1: MS 0); agency spectrum processor, router, tool call, multi-step agent, multi-agent (smolagents H1: OT 12); workflows vs agents (Anthropic S1, LangGraph L7); orchestrate via LLM vs via code (OpenAI S2).")
L("- **Architecture taxonomies:** single / independent / centralised / decentralised / hybrid with error-amplification and coordination-tax findings (Google scaling study: GO D4, AC H2); star / chain / tree / graph protocols (MARBLE: AC H3); layered / decentralised / centralised / shared message pool (Guo et al. survey), cooperation / competition / coopetition (Tran et al.), system-level vs internal communication (Yan et al.) (AC H4); choreography-to-orchestration dial (AG2 Network: MS 21).")
L("- **Failure lens:** MAST, 14 failure modes in 3 categories (specification, inter-agent misalignment, verification); verifier and termination nodes are where systems fail (AC H1). Anthropic S12 lists lossy handoffs, subagent sprawl mirroring the org chart, Frankenprompts and nested-loop latency.")
L("- **Brain/hands decoupling (Anthropic S10):** stateless harness, sandboxes behind a uniform execute interface, append-only session log; infrastructure, not a topology.")
L("")
L("## Cross-source takeaways")
L("")
L("1. Every lab says to start with a single agent loop and add structure only when evals show it helps (Anthropic S1/S12, OpenAI S1, Microsoft M1, LangChain L1, HF H1).")
L("2. The Anthropic Dec 2024 workflow set (chain, route, parallelize, orchestrator-workers, evaluator-optimizer) is restated almost verbatim by LangGraph, Together, Mistral and Llama Stack, so it is the common vocabulary.")
L("3. The main split among multi-agent designs is who holds control: a hub that keeps it (orchestrator-workers, supervisor, magentic) vs. peers that pass it (handoff) vs. a shared thread (group chat) vs. shared state (task board).")
L("4. Equal-compute baselines (sample-and-vote, Self-MoA) erase much of the claimed gain from debate and MoA. An entry for either should name that baseline.")
L("5. Context isolation is the most-cited reason for sub-agents. Context reset or compression is the most-cited lever for long single-agent runs.")

open(OUT, "w").write("\n".join(lines) + "\n")
print(n, "entries")
for x in E:
    print(x["name"])
