# Academic canon: agent and workflow topologies

Branch 7 of 7. This branch covers peer-reviewed and arXiv papers that define how LLM calls and agents are composed. It runs from single-agent loops (ReAct, Reflexion, Self-Refine), through search over thoughts (ToT, GoT, LATS), to multi-agent topologies (debate, juries, role pipelines, AgentVerse, MacNet, Mixture-of-Agents). It also covers graph-optimized and automatically designed systems (GPTSwarm, AgentPrune, G-Designer, AFlow, ADAS, MASS, Puppeteer) and the critical literature (MAST, Debate-or-Vote, Self-MoA, scaling-agent-systems, surveys).

## Access caveats (read first)

- Network policy blocked arxiv.org, huggingface.co, openreview.net, *.github.io project pages and alphaxiv for both curl and WebFetch. github.com and raw.githubusercontent.com were reachable.
- **Provenance tags** appear on every evidence claim:
  - **[R]** I read it directly in the paper's official GitHub repo (README or code) on 2026-10-31.
  - **[S]** It came from a WebSearch result that quotes the abstract, proceedings page or slides. I did not open the PDF.
  - **[M]** It comes from my prior knowledge of the paper and was not re-verified this session. Treat it as plausible but unconfirmed.
- Where secondary summaries disagreed with each other, the disagreement is noted next to the claim.

## Source index

| # | Title (venue) | URL | Date |
|---|---|---|---|
| P1 | ReAct: Synergizing Reasoning and Acting in Language Models (ICLR 2023), Yao et al. | https://arxiv.org/abs/2210.03629 ; repo https://github.com/ysymyth/ReAct | 2022-10 |
| P2 | Self-Consistency Improves Chain of Thought Reasoning (ICLR 2023), Wang et al. | https://arxiv.org/abs/2203.11171 | 2022-03 |
| P3 | Self-Refine: Iterative Refinement with Self-Feedback (NeurIPS 2023), Madaan et al. | https://arxiv.org/abs/2303.17651 ; repo https://github.com/madaan/self-refine | 2023-03 |
| P4 | Reflexion: Language Agents with Verbal Reinforcement Learning (NeurIPS 2023), Shinn et al. | https://arxiv.org/abs/2303.11366 ; repo https://github.com/noahshinn/reflexion | 2023-03 |
| P5 | Tree of Thoughts: Deliberate Problem Solving with LLMs (NeurIPS 2023), Yao et al. | https://arxiv.org/abs/2305.10601 ; repo https://github.com/princeton-nlp/tree-of-thought-llm | 2023-05 |
| P6 | Graph of Thoughts: Solving Elaborate Problems with LLMs (AAAI 2024), Besta et al. | https://arxiv.org/abs/2308.09687 ; repo https://github.com/spcl/graph-of-thoughts | 2023-08 |
| P7 | Language Agent Tree Search (LATS) (ICML 2024), Zhou et al. | https://arxiv.org/abs/2310.04406 ; repo https://github.com/lapisrocks/LanguageAgentTreeSearch | 2023-10 |
| P8 | ReWOO: Decoupling Reasoning from Observations (2023), Xu et al. | https://arxiv.org/abs/2305.18323 ; repo https://github.com/billxbf/ReWOO | 2023-05 |
| P9 | An LLM Compiler for Parallel Function Calling (ICML 2024), Kim et al. | https://arxiv.org/abs/2312.04511 ; repo https://github.com/SqueezeAILab/LLMCompiler | 2023-12 |
| P10 | Improving Factuality and Reasoning in LMs through Multiagent Debate (ICML 2024), Du, Li, Torralba, Tenenbaum, Mordatch | https://arxiv.org/abs/2305.14325 ; repo https://github.com/composable-models/llm_multiagent_debate | 2023-05 |
| P11 | Encouraging Divergent Thinking in LLMs through Multi-Agent Debate (EMNLP 2024), Liang et al. | https://aclanthology.org/2024.emnlp-main.992 ; repo https://github.com/Skytliang/Multi-Agents-Debate | 2023-05 / 2024-11 |
| P12 | Debate or Vote: Which Yields Better Decisions in Multi-Agent LLMs? (NeurIPS 2025), Choi, Zhu, Li | https://arxiv.org/abs/2508.17536 | 2025-08 |
| P13 | Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (NeurIPS 2023 D&B), Zheng et al. | https://arxiv.org/abs/2306.05685 | 2023-06 |
| P14 | Replacing Judges with Juries: Evaluating LLM Generations with a Panel of Diverse Models (PoLL), Verga et al. (Cohere) | https://arxiv.org/abs/2404.18796 | 2024-04-29 |
| P15 | ChatEval: Towards Better LLM-based Evaluators through Multi-Agent Debate (ICLR 2024), Chan et al. | https://arxiv.org/abs/2308.07201 ; repo https://github.com/chanchimin/ChatEval | 2023-08 |
| P16 | Mixture-of-Agents Enhances LLM Capabilities (ICLR 2025), Wang et al. (Together AI) | https://arxiv.org/abs/2406.04692 ; repo https://github.com/togethercomputer/MoA | 2024-06 |
| P17 | Rethinking Mixture-of-Agents: Is Mixing Different LLMs Beneficial? (TMLR 2026), Li, Lin, Xia, Jin | https://arxiv.org/abs/2502.00674 | 2025-02 |
| P18 | MetaGPT: Meta Programming for a Multi-Agent Collaborative Framework (ICLR 2024), Hong et al. | https://arxiv.org/abs/2308.00352 ; repo https://github.com/FoundationAgents/MetaGPT | 2023-08 |
| P19 | ChatDev: Communicative Agents for Software Development (ACL 2024), Qian et al. | https://aclanthology.org/2024.acl-long.810 ; repo https://github.com/OpenBMB/ChatDev | 2023-07 |
| P20 | CAMEL: Communicative Agents for "Mind" Exploration of LLM Society (NeurIPS 2023), Li et al. | https://arxiv.org/abs/2303.17760 ; repo https://github.com/camel-ai/camel | 2023-03 |
| P21 | AgentVerse: Facilitating Multi-Agent Collaboration and Exploring Emergent Behaviors (ICLR 2024), Chen et al. | https://arxiv.org/abs/2308.10848 ; repo https://github.com/OpenBMB/AgentVerse | 2023-08 |
| P22 | Scaling LLM-based Multi-Agent Collaboration (MacNet) (ICLR 2025), Qian et al. | https://arxiv.org/abs/2406.07155 ; code: ChatDev `macnet` branch | 2024-06 |
| P23 | Multi-Agent Collaboration via Evolving Orchestration ("Puppeteer") (NeurIPS 2025), Dang et al. | https://arxiv.org/abs/2505.19591 ; code: ChatDev `puppeteer` branch | 2025-05 |
| P24 | Chain of Agents: LLMs Collaborating on Long-Context Tasks (NeurIPS 2024), Zhang et al. (Google) | https://proceedings.neurips.cc/paper_files/paper/2024/hash/ee71a4b14ec26710b39ee6be113d7750-Abstract.html | 2024 |
| P25 | GPTSwarm: Language Agents as Optimizable Graphs (ICML 2024 oral), Zhuge et al. | https://proceedings.mlr.press/v235/zhuge24a.html ; repo https://github.com/metauto-ai/GPTSwarm | 2024-02-27 |
| P26 | AgentPrune: Cut the Crap, an Economical Communication Pipeline for LLM-based Multi-Agent Systems (ICLR 2025), Zhang et al. | https://arxiv.org/abs/2410.02506 ; repo https://github.com/yanweiyue/AgentPrune | 2024-10 |
| P27 | G-Designer: Architecting Multi-agent Communication Topologies via GNNs (ICML 2025 spotlight), Zhang et al. | https://icml.cc/virtual/2025/poster/45567 | 2024-10 |
| P28 | AFlow: Automating Agentic Workflow Generation (ICLR 2025 oral), Zhang et al. | https://openreview.net/forum?id=z5uVAKwmjf ; repo https://github.com/FoundationAgents/AFlow | 2024-10 |
| P29 | Automated Design of Agentic Systems (ADAS / Meta Agent Search) (ICLR 2025), Hu, Lu, Clune | https://arxiv.org/abs/2408.08435 ; repo https://github.com/ShengranHu/ADAS | 2024-08 |
| P30 | Multi-Agent Design: Optimizing Agents with Better Prompts and Topologies (MASS) (ICLR 2026), Zhou et al. (Google) | https://arxiv.org/abs/2502.02533 | 2025-02 |
| P31 | Why Do Multi-Agent LLM Systems Fail? (MAST) (NeurIPS 2025 D&B), Cemri, Pan, Yang et al. (UC Berkeley) | https://arxiv.org/abs/2503.13657 ; repo https://github.com/multi-agent-systems-failure-taxonomy/MAST | 2025-03 (v3 2025-10-26) |
| P32 | Towards a Science of Scaling Agent Systems (Google Research / DeepMind / MIT) | https://arxiv.org/abs/2512.08296 ; blog https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/ | 2025-12 |
| P33 | MultiAgentBench / MARBLE (ACL 2025), Zhu et al. | https://arxiv.org/abs/2503.01935 | 2025-03 |
| P34 | LLM based Multi-Agents: A Survey of Progress and Challenges (IJCAI 2024), Guo et al. | https://arxiv.org/abs/2402.01680 ; list https://github.com/taichengguo/LLM_MultiAgents_Survey_Papers | 2024-02 |
| P35 | Multi-Agent Collaboration Mechanisms: A Survey of LLMs, Tran et al. (UCC) | https://arxiv.org/abs/2501.06322 | 2025-01 |
| P36 | Beyond Self-Talk: A Communication-Centric Survey of LLM-Based MAS, Yan et al. | https://arxiv.org/abs/2502.14321 | 2025-02 (v2 2025-06) |
| P37 | Topological Structure Learning Should Be a Research Priority for LLM-Based MAS (position), Yang et al. | https://arxiv.org/abs/2505.22467 | 2025-05 |

---

## A. Single-agent control loops (the "atoms" most topologies build from)

### A1. ReAct (Reason+Act loop)
- **Mechanism.** One LLM node runs a loop. It emits a Thought, then an Action (a tool call), then the environment returns an Observation, which is appended to the context, and the cycle repeats. The only edge is a self-loop through the tool environment. The loop terminates when the model emits a `Finish[answer]` action or reaches a step cap. Reasoning and acting are interleaved, so the plan is revised after every observation.
- **When to use.** Knowledge-intensive QA that needs retrieval (HotpotQA, FEVER), and interactive decision-making environments (ALFWorld, WebShop). The paper notes it is most useful combined with CoT self-consistency as a fallback.
- **Roles.** A single agent plus tools.
- **Evidence.**
  - [R] Repo table, 500 random dev examples: PaLM-540B scores HotpotQA EM 29.4, FEVER EM 62.2, ALFWorld 70.9% success, WebShop 40%.
  - [M] The paper reports +34 points absolute on ALFWorld and +10 points on WebShop over imitation and RL baselines.
- **Source.** P1.

### A2. Self-Consistency (sample-and-vote)
- **Mechanism.** The same prompt is sampled N times in parallel at temperature above zero, and a majority vote is taken over the final answers. The topology is a fan-out of N independent nodes into a vote reducer with no communication between branches. It terminates after the N samples.
- **When to use.** Tasks with a single extractable answer (math, multiple choice).
- **Roles.** N identical samplers and a deterministic voter.
- **Evidence.**
  - [M] +17.9 points on GSM8K over greedy CoT with PaLM-540B.
  - [S] Self-consistency is the baseline that later debate papers fail to beat by much. One replication of Du et al. found 3-agent debate at 83.2% against self-consistency at 82.5% on GSM8K.
- **Source.** P2.

### A3. Self-Refine (generate → feedback → refine loop)
- **Mechanism.** One LLM plays three prompt roles in sequence:
  1. Generate an initial output.
  2. Critique it (FEEDBACK), producing actionable, specific feedback.
  3. Rewrite it (REFINE) using the history of outputs and feedback.

  The loop repeats and terminates when the feedback step emits a stop signal or a fixed iteration cap (about 4) is reached. There is no external signal, no training, and no second model.
- **When to use.** Open-ended generation with a quality gradient. The paper's 7 tasks were dialogue response, code optimisation, code readability, math reasoning, sentiment reversal, acronym generation and constrained generation.
- **Roles.** Generator, critic and refiner, all the same model.
- **Evidence.**
  - [M] About 20 points absolute average improvement across the 7 tasks over one-shot generation with GPT-3.5/GPT-4.
  - [M] Gains on math were small. Huang et al. ("LLMs Cannot Self-Correct Reasoning Yet", ICLR 2024) argue that intrinsic self-correction without external feedback does not reliably help reasoning.
- **Source.** P3.

### A4. Reflexion (trial loop with verbal self-reflection memory)
- **Mechanism.** Three components.
  - An **Actor**, usually a ReAct or CoT agent, attempts the task.
  - An **Evaluator** scores the trajectory: a binary environment reward, unit-test results, or an LLM/heuristic judge.
  - A **Self-Reflection** model turns a failed trajectory plus its score into a natural-language lesson, which is stored in an episodic memory buffer of the last few reflections.

  The next trial's actor is conditioned on that memory. The outer loop runs over trials and terminates on success or a max-trials cap. Repo strategies [R]: NONE, LAST_ATTEMPT, REFLEXION, LAST_ATTEMPT_AND_REFLEXION.
- **When to use.** Tasks with a retry-able environment and some evaluable success signal (coding with tests, ALFWorld, HotpotQA).
- **Roles.** Actor, evaluator and reflector, plus a memory store.
- **Evidence.**
  - [S] HumanEval pass@1 91.0 against the 80.1 prior SOTA (GPT-4).
  - [S] HotpotQA EM 51 against 34 for ReAct; a 2025 replication got 44.
  - [M] ALFWorld +22 points absolute over 12 trials. This was not found in search.
- **Source.** P4.

### A5. ReWOO (plan-without-observation: Planner → Workers → Solver)
- **Mechanism.**
  1. A **Planner** LLM writes the full plan up front as a list of tool calls with variable placeholders (#E1, #E2, ...).
  2. **Workers** execute the tool calls, substituting earlier evidence.
  3. A **Solver** LLM receives the plan plus all evidence and writes the answer.

  The topology is a linear 3-stage DAG with no observation-driven replanning. It terminates after one pass.
- **When to use.** Multi-step tool use where the steps are foreseeable, to save tokens compared with ReAct.
- **Roles.** Planner, Worker (tools) and Solver.
- **Evidence.** [R] 5x token efficiency and +4% accuracy on HotpotQA compared with ReAct, plus robustness under tool failure.
- **Source.** P8.

### A6. LLMCompiler (planner → DAG of tasks → parallel executor → joiner)
- **Mechanism.**
  - An **LLM Planner** decomposes the query into a DAG of function-call tasks with dependencies.
  - A **Task Fetching Unit** dispatches each task as soon as its dependencies resolve and substitutes outputs into placeholders.
  - An **Executor** runs independent tasks in parallel.
  - A **Joiner** LLM either finalizes the answer or triggers a replan, which creates a new DAG. This repeats until it finalizes.
- **When to use.** Many independent or partially dependent tool calls where latency and cost matter.
- **Roles.** Planner, dispatcher, executor and joiner/replanner.
- **Evidence.**
  - [S] Compared with ReAct: up to 3.7x latency speedup, up to 6.7x cost saving and about 9% accuracy gain.
  - [S] Up to 1.35x faster than OpenAI parallel function calling at similar accuracy.
- **Source.** P9.

## B. Search over thoughts and trajectories

### B1. Tree of Thoughts (ToT)
- **Mechanism.** The problem is decomposed into thought steps.
  - A **generator** proposes k candidate next thoughts per state, either by sampling or by a "propose" prompt.
  - A **state evaluator** LLM values each state ("sure/likely/impossible") or votes across states.
  - A **search algorithm** keeps the best b states per level (BFS) or expands depth-first with pruning and backtracking (DFS).

  The topology is a tree. Nodes are partial solutions and edges are LLM expansions. It terminates at depth T (BFS) or on the first valid solution or budget exhaustion (DFS).
- **When to use.** Problems needing exploration, lookahead or backtracking, where initial decisions are pivotal: Game of 24, creative writing, mini crosswords (DFS).
- **Roles.** Proposer, evaluator and a non-LLM search controller.
- **Evidence.** [S] Game of 24: CoT with GPT-4 solves 4%, ToT solves 74% (abstract).
- **Source.** P5.

### B2. Graph of Thoughts (GoT)
- **Mechanism.** Reasoning is modelled as an arbitrary directed graph, a Graph of Operations (GoO) declared ahead of time [R]. Operations are Generate, Score, KeepBest, Aggregate (merge several thoughts into one, which gives fan-in edges that trees lack), Refine (a self-loop), and GroundTruth/Validate. A Controller executes the GoO with a Prompter and a Parser.
- **When to use.** Decomposable problems whose partial results can be merged, such as split → solve → merge for sorting, set intersection, keyword counting and document merging.
- **Roles.** Controller (non-LLM), and an LLM acting as generator, aggregator, refiner and scorer.
- **Evidence.** [S, secondary only] Sorting quality is 62% better than ToT at more than 31% lower cost.
- **Source.** P6.

### B3. Language Agent Tree Search (LATS)
- **Mechanism.** Monte Carlo Tree Search over ReAct-style agent trajectories. The loop is selection (UCT), expansion (sample n actions), evaluation (LM-scored value plus self-consistency), simulation to a terminal state, and backpropagation of the environment reward. When a trajectory fails, a Reflexion-style **reflection** is generated and stored to guide later iterations. It terminates on success or after K iterations.
- **When to use.** Environments with a reward signal and revertable states (programming, WebShop, HotpotQA).
- **Roles.** Actor/expander, value function (LLM), reflector and MCTS controller.
- **Evidence.**
  - [M] HumanEval pass@1 92.7 with GPT-4; WebShop score about 75.9.
  - [R] Ported to LangGraph and LlamaIndex.
- **Source.** P7.

## C. Multi-agent debate and ensembles

### C1. Multi-agent debate (Du et al.; "society of minds")
- **Mechanism.**
  1. N agents, all the same model, answer independently in round 0.
  2. In each later round, every agent receives all other agents' latest answers ("These are the solutions to the problem from other agents ... can you provide your answer?") and updates its own. The communication graph is fully connected and runs in synchronous rounds.
  3. After R rounds the final answer is decided by majority vote.

  There is no judge and no role asymmetry. With N=1, the code instead sends a "double check your answer" prompt, which is the reflection baseline. Default parameters [R]: `agents = 3`, `rounds = 2` (gsm/gen_gsm.py).
- **When to use.** Factuality and reasoning (arithmetic, GSM8K, MMLU, biographies, chess move validity), including black-box models. Debate across different models (ChatGPT + Bard) is also shown.
- **Roles.** N symmetric peers.
- **Evidence.**
  - [S, secondary] GSM8K: 85.0 for debate, 77.0 for a single agent and 75.0 for reflection. Arithmetic: 81.8 against 67.0.
  - Accuracy rises with both agent count and round count, with diminishing returns beyond about 4 rounds.
  - Cross-model debate solved 17/20 GSM8K problems against 11–14 for either model alone.
  - See C3 for the counter-evidence.
- **Source.** P10.

### C2. Multi-Agent Debate with judge (MAD, Liang et al.)
- **Mechanism.** An adversarial debate topology.
  - An affirmative debater ("devil") and a negative debater ("angel") alternate arguments under a "tit for tat" prompt.
  - A **judge** agent monitors each round. It can stop the debate early when a solution is reached (adaptive break) or extract the final answer after the max rounds.

  The graph is two debaters in a cycle with a judge reading both.
- **When to use.** Counter-intuitive or tricky reasoning and translation, to overcome **Degeneration-of-Thought**: once a single model's self-reflection becomes confident in an answer, it stops generating novel thoughts.
- **Roles.** Affirmative, negative and judge (moderator).
- **Evidence.**
  - [S] Adaptive break and only a *moderate* level of disagreement are needed for good results.
  - An LLM judge favours the debater that shares its backbone model, so a judge is unfair when the debaters use different LLMs.
- **Source.** P11.

### C3. Debate vs. vote (critical finding)
- **Mechanism examined.** The paper decomposes MAD into (a) majority voting over the agents' answers and (b) inter-agent communication rounds.
- **Finding.**
  - [S] Across 7 NLP benchmarks, majority voting alone accounts for most of the gains attributed to debate.
  - Theory: debate induces a martingale over agents' beliefs, so communication alone does not raise expected correctness.
  - Biasing belief updates toward correction does improve debate.
- **When this matters.** Before paying for multi-round debate, compare against parallel sample-and-vote (A2) at equal cost.
- **Source.** P12. Related skeptic work [M]: Smit et al., "Should we be going MAD?" (ICML 2024); Wang et al., "Rethinking the bounds of LLM reasoning: are multi-agent discussions the key?" (ACL 2024).

### C4. Mixture-of-Agents (MoA): layered proposers → aggregator
- **Mechanism.** A feed-forward layered network.
  - Layer 1 has n **proposer** LLMs, usually different model families, that answer independently.
  - Each later layer's agents receive *all* outputs of the previous layer plus an "aggregate-and-synthesize" prompt.
  - A final **aggregator** produces the answer.

  Parameters [R]: `--rounds` equals the number of layers minus 1, with reference models and an aggregator. It terminates after L layers.
- **When to use.** Open-ended chat quality (AlpacaEval, MT-Bench, FLASK) when several strong models are available.
- **Roles.** Proposers and aggregator(s).
- **Evidence.**
  - [R] 65.1% on AlpacaEval 2.0 with open-source models only, against 57.5% for GPT-4o.
  - Counter-evidence [S], P17 **Self-MoA**: aggregating many samples from the *single best* model beats mixed-model MoA by 6.6% on AlpacaEval 2.0 and about 3.8% on average across MMLU/CRUX/MATH. MoA is sensitive to proposer quality, so mixing in weaker models lowers the average. A *sequential* Self-MoA, which aggregates in rolling windows over rounds, matches one-shot aggregation.
- **Source.** P16, P17.

## D. Evaluation topologies: judges, juries, referee teams

### D1. LLM-as-a-Judge (single judge)
- **Mechanism.** A strong LLM is the evaluator node downstream of generation. There are three modes:
  1. **Pairwise comparison**, A versus B. Run both orders to cancel position bias.
  2. **Single-answer grading**, an absolute score.
  3. **Reference-guided grading**, which supplies a reference solution for math and reasoning.
- **When to use.** Scalable approximation of human preference for open-ended outputs, and as the evaluator in loops (A3, A4, B3).
- **Roles.** Candidates and judge.
- **Evidence.**
  - [S] GPT-4 judges agree with human preferences more than 80% of the time, the same level as human-human agreement (MT-Bench plus 3K expert votes and Chatbot Arena).
  - Documented biases: position, verbosity, self-enhancement, and limited math/reasoning grading ability. The paper proposes mitigations: swapping positions, few-shot examples, CoT, and reference-guided grading.
- **Source.** P13.

### D2. LLM jury: Panel of LLM evaluators (PoLL)
- **Mechanism.** The single large judge is replaced by K smaller judges from *disjoint model families* (Command R, Claude Haiku, GPT-3.5 in the paper). Each scores independently in parallel, and the scores are pooled (max voting for binary QA correctness, average for Chatbot-Arena-style ratings). There is no inter-judge communication.
- **When to use.** Evaluation where a single judge's intra-model bias (favouring its own family) and cost matter.
- **Roles.** Juror judges and an aggregation rule.
- **Evidence.** [S] PoLL correlates better with human judgments than a single GPT-4 judge across 3 settings and 6 datasets, with less intra-model bias. It is 7–8x cheaper than GPT-4 Turbo at list prices of the time.
- **Source.** P14.

### D3. Multi-agent referee team (ChatEval)
- **Mechanism.** Several judge agents with *diverse personas* (for example critic, psychologist, general public) discuss the candidates before each gives a verdict, and the verdicts are aggregated (majority or average). The paper defines three communication strategies [M; R confirms "one-by-one communication ... 2 agent roles ... 2 discussion turns"]:
  - **one-by-one**: sequential turns, each judge seeing the prior ones.
  - **simultaneous-talk**: parallel, with all seeing the previous round.
  - **simultaneous-talk-with-summarizer**: a summarizer compresses each round.
- **When to use.** Open-ended text evaluation where one judge's perspective is too narrow.
- **Roles.** Persona judges and an optional summarizer. Diverse role prompts are essential; identical roles degrade results [M].
- **Source.** P15.

## E. Role-based pipelines (SOP / waterfall / role-play)

### E1. SOP-encoded role pipeline (MetaGPT)
- **Mechanism.** `Code = SOP(Team)` [R]. Human Standard Operating Procedures are encoded as a fixed sequential pipeline of specialized roles: Product Manager (PRD, user stories, competitive analysis) → Architect (system design, data structures, APIs) → Project Manager (task breakdown) → Engineer(s) (code) → QA Engineer (tests).
  - **Structured outputs.** Each role emits documents and diagrams that follow a schema, not free chat, which reduces "idle chatter" and hallucination cascades.
  - **Shared message pool with publish-subscribe.** Roles publish artifacts to a global pool and subscribe only to message types relevant to their role, instead of point-to-point chat.
  - **Executable feedback.** The engineer runs the code and tests and debugs iteratively; this is a self-loop bounded by retries.
  - Termination: the pipeline completes once QA passes or retries are exhausted.
- **When to use.** Complex multi-artifact tasks with a well-known human process (software projects).
- **Roles.** PM, Architect, Project Manager, Engineer, QA.
- **Evidence.**
  - [S] HumanEval 85.9 and MBPP 87.7 pass@1, from ICLR 2024 slides.
  - Executable feedback adds +4.2 on HumanEval and +5.4 on MBPP.
  - ICLR 2024 oral.
- **Source.** P18.

### E2. Chat chain of dual-agent seminars (ChatDev)
- **Mechanism.** A waterfall model as a **chat chain**. Sequential phases (design → coding → testing → documenting) are split into subtasks. Each subtask is a multi-turn **two-agent chat**: an *instructor* (for example CEO, CTO, reviewer, tester) and an *assistant* (for example CTO, programmer).
  - The subtask terminates on a consensus token or a turn cap, and its solution (code, decisions) is passed to the next link.
  - **Communicative dehallucination**: the assistant asks the instructor for specifics before answering.
  - Code review and testing are inner instructor/assistant loops.
  - [R] ChatChain, Phase and Role definitions are user-configurable. ChatDev 2.0 "DevAll" (2026-01-07) generalizes this into a zero-code multi-agent orchestration platform.
- **When to use.** Software generation where a staged lifecycle helps.
- **Roles.** CEO, CTO, Programmer, Reviewer, Tester, Designer.
- **Evidence.**
  - [S, secondary] Quality 0.3953, against 0.1523 for MetaGPT and 0.1419 for GPT-Engineer, on the paper's SRDD benchmark.
  - Removing role prompts gave the largest ablation drop.
- **Source.** P19.
- **Follow-ups in the same repo [R].** Experiential Co-Learning (2023-12) and Iterative Experience Refinement (2024-05), in which instructor and assistant accumulate shortcut experiences across tasks. See also MacNet (F1) and Puppeteer (G7).

### E3. Role-playing pair (CAMEL)
- **Mechanism.**
  1. A *task-specifier* agent turns a vague idea into a concrete task.
  2. An **AI user**, which gives instructions, and an **AI assistant**, which executes them, then converse in alternating turns under **inception prompting**: system prompts that fix the roles and forbid role flipping.
  3. The conversation terminates when the user emits `<CAMEL_TASK_DONE>` or the turn limit is reached.

  An optional critic or human in the loop selects among proposals.
- **When to use.** Autonomous cooperative task completion and generating conversational data.
- **Roles.** Task specifier, AI user, AI assistant and optional critic.
- **Evidence.** [M] Documented failure modes are role flipping, instruction repetition, flake replies and infinite message loops. These are the reason for the inception-prompt constraints.
- **Source.** P20; [R] `camel/societies/role_playing.py`.

### E4. Chain of Agents (sequential workers + manager over long context)
- **Mechanism.** A long input is split into chunks.
  - **Worker** agent i reads chunk i plus the "communication unit" from worker i−1 and writes an updated unit. This is a chain with a rolling summary of evidence.
  - A **manager** agent reads the last unit and produces the answer.

  It terminates after a single pass.
- **When to use.** Inputs longer than the context window (QA, summarization, code completion). It is an alternative to RAG or full-context.
- **Roles.** Workers in sequence and a manager.
- **Evidence.** [S] Up to 10% better than RAG, full-context and multi-agent baselines. With text-bison, +13.30% on NarrativeQA and +10.22% on MuSiQue.
- **Source.** P24.

## F. Dynamic team and loop frameworks

### F1. AgentVerse: recruit → decide → execute → evaluate loop
- **Mechanism.** A four-stage outer loop, modelled on human group problem solving and formalized as an MDP.
  1. **Expert recruitment.** A *recruiter* agent generates expert role descriptions for the goal and adjusts the group composition from evaluation feedback.
  2. **Collaborative decision-making** in one of two communication structures:
     - **horizontal (democratic)**: all experts share and refine ideas as equals, and the results are merged.
     - **vertical**: a *solver* proposes and *reviewers* critique iteratively until consensus.
  3. **Action execution.** Agents act in the environment or tool.
  4. **Evaluation.** An evaluator compares the outcome with the goal. If it is unmet, the evaluator feeds back to stage 1, re-recruiting and adjusting the group, and the loop repeats until the goal is met or a round cap is reached.
- **When to use.**
  - Horizontal: consulting and brainstorming-style tasks that benefit from many viewpoints.
  - Vertical: tasks with a single correct answer (math, code).
  - Separately, a simulation mode exists for social environments [R].
- **Roles.** Recruiter, experts (solver/reviewers), executor and evaluator.
- **Evidence.** [M] Improves over solo agents on conversation, creative writing, math, logic and coding. Emergent behaviours (volunteer, conformity, destructive) are observed in Minecraft.
- **Source.** P21.

### F2. MacNet: DAG-structured agent networks at scale
- **Mechanism.** Agents are placed on a directed acyclic graph.
  - [M] Nodes host "actor" agents that produce artifacts, and edges host "critic/instructor" interactions that refine artifacts passed downstream.
  - The topology is ordered topologically. Only refined artifacts, not full dialogue histories, propagate, which keeps context bounded and enables more than 1,000 agents.
  - Topology families [S]: chain, tree (star-like), and graph: fully-connected mesh, MLP-like layered, and irregular random.
  - It terminates once sink nodes produce output; multiple sinks are aggregated.
- **When to use.** Exploring "collaborative scaling" by adding agents.
- **Evidence.**
  - [S] Irregular topologies beat regular ones.
  - Performance follows a logistic **collaborative scaling law** in the number of agents, and collaborative emergence appears earlier than neural emergence.
  - The authors note limits to the scaling.
- **Source.** P22.

## G. Graph-optimized and automatically designed topologies

### G1. GPTSwarm: agents as optimizable computational graphs
- **Mechanism.** Each agent is a graph of operation nodes (LLM query, tool use, CoT step, and so on). A "swarm" is a composite graph whose *inter-agent* edges are parameterized by probabilities. Two optimizers run:
  - **Node optimization**: refines each node's prompt from task feedback.
  - **Edge optimization**: each iteration samples graphs from edge probabilities, scores their utility on a benchmark, and updates probabilities by REINFORCE gradient ascent, which drives edges toward pruning (0) or creation (1) [R/S].

  Intra-agent edges stay fixed. Optimization terminates after T iterations, and the learned graph is then executed.
- **When to use.** Benchmarked tasks where a validation signal exists and the best collaboration pattern is unknown (MMLU, Mini Crosswords, HumanEval, GAIA).
- **Evidence.**
  - [S] Edge optimization converges to stable high-performing structures and is robust to adversarial agents.
  - Node optimization after edge optimization yields further gains.
  - ICML 2024 oral, top 1.5% [R].
- **Source.** P25.

### G2. AgentPrune: spatial-temporal communication pruning
- **Mechanism.** The multi-agent system is modelled as a spatial-temporal message graph. Spatial edges connect agents within a round and temporal edges connect rounds. A graph mask is learned and *one-shot pruned* to remove redundant or malicious messages, and the sparse graph is then used for all queries.
- **When to use.** Cutting the token cost of chatty multi-round topologies (chain, random, complete) while keeping or improving accuracy. Plug-in integrations exist for AutoGen RoundRobinGroupChat and GPTSwarm [R].
- **Evidence.** [M] Comparable results at roughly $5.6 cost against $43.7 for prior state of the art, with token reductions of about 28–72% and better robustness against adversarial agents. ICLR 2025 [R].
- **Source.** P26.

### G3. G-Designer: task-adaptive topology from a GNN
- **Mechanism.** Agents become nodes with profile embeddings, and a task-specific *virtual node* is added. A variational graph auto-encoder decodes a sparse, task-tailored communication graph for each query, so the topology changes per task difficulty. Agents then communicate along the decoded edges for K rounds.
- **When to use.** Mixed-difficulty workloads where one fixed topology wastes tokens on easy queries.
- **Evidence.** [S] MMLU 84.50% and HumanEval 89.90% pass@1, up to 95.33% fewer tokens on HumanEval, and only a 0.3% accuracy drop under adversarial agents.
- **Source.** P27.

### G4. AFlow: Monte Carlo tree search over code-represented workflows
- **Mechanism.** A workflow is code: LLM-invoking **Nodes** connected by edges and expressed as Python control flow. Reusable **Operators** [R] are Generate, Format, Review, Revise, Ensemble, Test and Programmer.
  - An **Optimizer** LLM runs an MCTS variant: select a workflow from the tree, expand it by LLM-proposed code modification, evaluate it on a validation set, and backpropagate experience.
  - It terminates at max rounds (default 20) or on convergence.
- **When to use.** Automating the design of a workflow for a benchmarked task family (HumanEval, MBPP, GSM8K, MATH, HotpotQA, DROP).
- **Evidence.** [M] About 5.7% average improvement over the best manual workflows. Searched workflows let smaller models beat GPT-4o at about 4.55% of its inference cost. ICLR 2025 oral, top 1.8% [R].
- **Source.** P28.

### G5. ADAS / Meta Agent Search
- **Mechanism.** A "meta" agent iteratively *programs* new agent systems in code (a `forward()` function). Each candidate is evaluated, and the archive of past discoveries and their scores conditions the next proposal [R]. The search space is any code, so new building blocks can be invented, not just recombined. It terminates after N iterations.
- **When to use.** Research and automatic discovery of agent designs (ARC, DROP, MGSM, MMLU, GPQA). The repo warns that it executes untrusted model-generated code [R].
- **Evidence.** [M] Discovered agents beat hand-designed baselines (CoT, Self-Refine, LLM-Debate, Role Assignment and others) and transfer across domains and models. ICLR 2025 [R].
- **Source.** P29.

### G6. MASS: staged prompt and topology optimization
- **Mechanism.** Three stages, each starting from the previous one's best result:
  1. Block-level prompt optimization of each building block: aggregate, reflect, debate, summarize, tool use.
  2. Workflow topology optimization over a *pruned* space containing only "influential" blocks.
  3. Workflow-level prompt optimization of the chosen topology.
- **Finding.** [S] Prompts are frequently the most influential design component, and only a small fraction of topologies are influential.
- **Evidence.**
  - Stage 2 adds about 3% and stage 3 about 2% more.
  - MASS beats self-consistency, self-refine, multi-agent debate, ADAS and AFlow; AFlow is close on 2WikiMQA and HumanEval.
  - ICLR 2026.
- **Source.** P30.

### G7. Puppeteer: RL-trained central orchestrator (evolving orchestration)
- **Mechanism.** [R, README] A learnable central orchestrator (the "puppeteer"), trained with reinforcement learning, dynamically activates and sequences agents (the "puppets") step by step. This builds a context-aware reasoning path per task instead of a fixed graph. The reward trades off quality against compute cost.
- **When to use.** Tasks where a static topology is suboptimal and the training signal is available.
- **Evidence.** [R] Improves reasoning quality while reducing computational cost. [M] The learned structures tend to become more compact and cyclic over training. NeurIPS 2025.
- **Source.** P23.

## H. Critical and empirical lenses on topology choice

### H1. MAST: Multi-Agent System failure Taxonomy
- **What it is.** Not a topology but the canonical failure lens for multi-agent topologies.
  - [S] It was built from 1,600+ annotated traces across 7 multi-agent frameworks (MetaGPT, ChatDev, HyperAgent, AppWorld, AG2, Magentic-One, OpenManus [M]). The NeurIPS listing says "1000+", and the README says "over 1K" [R].
  - Inter-annotator kappa was 0.88. An LLM-as-judge annotator reached kappa 0.77 against experts.
- **Taxonomy.** 14 failure modes in 3 categories:
  - **FC1 Specification / system design issues.** [M] Disobey task specification, disobey role specification, step repetition, loss of conversation history, unaware of termination conditions (FM-1.5, about 12.4% [S]).
  - **FC2 Inter-agent misalignment**, about 32.3% of failures [S]. [M] Conversation reset, fail to ask for clarification, task derailment, information withholding, ignored other agent's input, reasoning-action mismatch (FM-2.6, about 13.2% [S]).
  - **FC3 Task verification.** [M] Premature termination, no or incomplete verification, incorrect verification.
- **Topology-relevant conclusions.**
  - [S] Multi-agent systems often gain little over single-agent baselines on popular benchmarks.
  - Failures stem mostly from system design (role specs, termination conditions, verification), not only from model limits.
  - Simple interventions on the authors' case studies (ChatDev, AG2) gave only modest improvements: better role specification, and topology changes such as adding a verifier step or a cyclic CEO check [M]. This means structural fixes are needed.
- **Source.** P31.

### H2. Scaling agent systems: five canonical architectures
- **Architectures compared** [S]:
  - **Single-agent**.
  - **Independent**: parallel workers with no communication, aggregated only at the end.
  - **Centralized**: hub-and-spoke orchestrator that delegates and synthesizes.
  - **Decentralized**: peer-to-peer mesh.
  - **Hybrid**: hierarchical oversight plus peer-to-peer.
- **Evidence** [S]:
  - Error amplification is 17.2x for independent and 4.4x for centralized; the orchestrator acts as a "validation bottleneck".
  - Centralized gives +80.8% on parallelizable tasks such as financial reasoning. Decentralized does best on web navigation.
  - Multi-agent hurts on sequential tasks through a "coordination tax", and gains saturate once the single-agent baseline is already strong ("capability saturation").
  - A predictive model reaches cross-validated R² of about 0.51–0.52.
  - The blog says 180 configurations and a later version says 260; the versions disagree.
- **Source.** P32. This overlaps the Google branch.

### H3. MultiAgentBench / MARBLE: star, chain, tree, graph protocols
- **Mechanism compared.** Coordination protocols of **star** (a central planner), **chain**, **tree** (hierarchical) and **graph** (agents communicate only along declared relation edges). Planning strategies compared are group discussion and cognitive self-evolving planning.
- **Evidence.** [S] The graph topology performs best in the research scenario, and cognitive planning raises milestone achievement by 3%. Unverified per-topology claims from a tutorial were not used.
- **Source.** P33.

### H4. Surveys: how the field names structure
- **Guo et al. (IJCAI 2024, P34).** Communication paradigms are cooperative, debate and competitive. Communication structures are **layered** (for example DyLAN as a feed-forward multi-layer net), **decentralized** (peer-to-peer), **centralized** (one hub) and **shared message pool** (MetaGPT-style publish-subscribe) [M for the four-way split; S confirms the layered, decentralized and centralized framing].
- **Tran et al. (2025, P35).** Collaboration is characterized along five dimensions: actors, types (**cooperation / competition / coopetition**), structures (**peer-to-peer / centralized (star) / distributed**, plus hierarchical, illustrated by CAMEL [S]), strategies (rule-based, role-based, model-based), and coordination protocols.
- **Yan et al. "Beyond Self-Talk" (2025, P36).** Splits system-level communication (architecture, goals, protocols such as MCP, A2A and ANP) from system-internal communication (strategies, paradigms, objects, content) [S].
- **Yang et al. position paper (2025, P37).** Topology should be *learned*, decomposed into **agent selection → structure profiling → topology synthesis**. Topology alone shifts task performance by up to about 10% [S].

---

## Canonical topology names (for merge)

ReAct loop · Self-Consistency (sample-and-vote) · Self-Refine (generate–critique–refine) · Reflexion (trial loop with reflection memory) · ReWOO (planner–workers–solver) · LLMCompiler (planner DAG + parallel executor + joiner/replan) · Tree of Thoughts (BFS/DFS over thoughts) · Graph of Thoughts (graph of operations with aggregate/refine) · LATS (MCTS over agent trajectories) · Multi-agent debate (symmetric peers, rounds, majority vote) · Adversarial debate with judge (MAD) · Debate-vs-vote baseline · Mixture-of-Agents (layered proposers → aggregator) / Self-MoA · LLM-as-a-judge · LLM jury / PoLL · Multi-agent referee team (ChatEval) · SOP role pipeline with pub-sub message pool (MetaGPT) · Chat chain of dual-agent seminars (ChatDev) · Role-playing user/assistant pair (CAMEL) · Chain of Agents (sequential workers + manager) · AgentVerse recruit–decide(horizontal/vertical)–execute–evaluate loop · MacNet DAG agent networks · GPTSwarm optimizable graph (node/edge optimization) · AgentPrune communication pruning · G-Designer task-adaptive topology · AFlow MCTS workflow search · ADAS Meta Agent Search · MASS prompt+topology optimization · Puppeteer RL-trained orchestrator · Scaling-study archetypes (single / independent / centralized / decentralized / hybrid) · MARBLE protocols (star / chain / tree / graph) · MAST failure taxonomy (evaluation lens)

## Cross-cutting takeaways for a topology catalog

1. **Equal-compute baselines matter.** Several headline multi-agent gains shrink against sample-and-vote at the same cost (C3, the replication in A2) or against a single strong model sampled many times (Self-MoA, C4). A catalog entry for debate or MoA should name its voting or self-ensemble baseline.
2. **Verification and termination nodes are where systems fail.** MAST's FC1 and FC3 categories and the 4.4x versus 17.2x error-amplification result both point to an explicit verifier or orchestrator checkpoint as the main structural safeguard.
3. **Topology is increasingly learned rather than hand-drawn.** GPTSwarm, AgentPrune, G-Designer, AFlow, ADAS, MASS and Puppeteer all need a validation signal. MASS finds that prompts often matter more than topology.
4. **Communication sparsity is a first-class design axis.** Fully connected debate is expensive. Pruned, per-query, or artifact-only edges (MacNet, MetaGPT's publish-subscribe pool) cut tokens with little or no accuracy loss.
