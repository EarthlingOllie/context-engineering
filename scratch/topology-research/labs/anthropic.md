# Anthropic: agent and workflow orchestration topologies

Branch 1 of 7 (lab-topologies fan-out). Primary sources only: anthropic.com/engineering, claude.com blog, and code.claude.com docs. Retrieved 2026-10-31. Dates are publication dates. Docs pages carry no date, so they are marked "living doc, read 2026-10-31".

## Sources

| ID | Title | Date | URL |
|---|---|---|---|
| S1 | Building effective agents (Erik Schluntz, Barry Zhang) | 2024-12-19 | https://www.anthropic.com/engineering/building-effective-agents |
| S2 | How we built our multi-agent research system (Hadfield, Zhang, Lien, Scholz, Fox, Ford) | 2025-06-13 | https://www.anthropic.com/engineering/multi-agent-research-system |
| S3 | Effective context engineering for AI agents (Rajasekaran, Dixon, Ryan, Hadfield) | 2025-09-29 | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents |
| S4 | Building agents with the Claude Agent SDK (Thariq Shihipar) | 2025-09-29 | https://claude.com/blog/building-agents-with-the-claude-agent-sdk |
| S5 | Code execution with MCP (Adam Jones, Conor Kelly) | 2025-11-04 | https://www.anthropic.com/engineering/code-execution-with-mcp |
| S6 | Introducing advanced tool use on the Claude Developer Platform (Bin Wu et al.) | 2025-11-24 | https://www.anthropic.com/engineering/advanced-tool-use |
| S7 | Effective harnesses for long-running agents (Justin Young) | 2025-11-26 | https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents |
| S8 | Building a C compiler with a team of parallel Claudes (Nicholas Carlini) | 2026-02-05 | https://www.anthropic.com/engineering/building-c-compiler |
| S9 | Harness design for long-running application development (Prithvi Rajasekaran) | 2026-03-24 | https://www.anthropic.com/engineering/harness-design-long-running-apps |
| S10 | Scaling Managed Agents: Decoupling the brain from the hands (Lance Martin, Gabe Cemaj, Michael Cohen) | 2026-04-08 | https://www.anthropic.com/engineering/managed-agents |
| S11 | New in Claude Managed Agents: dreaming, outcomes, and multiagent orchestration | 2026-05-19 | https://claude.com/blog/new-in-claude-managed-agents |
| S12 | Building agents: When to fold subagents into your main agent loop (Anthropic Applied AI) | 2026-10-22 | https://claude.com/blog/building-agents-when-to-fold-subagents-into-your-main-agent-loop |
| D1 | Claude Code docs: Subagents | living doc, read 2026-10-31 | https://code.claude.com/docs/en/sub-agents |
| D2 | Agent SDK docs: Subagents in the SDK | living doc, read 2026-10-31 | https://code.claude.com/docs/en/agent-sdk/subagents |
| D3 | Claude Code docs: Orchestrate teams of Claude Code sessions (agent teams, experimental) | living doc, read 2026-10-31 | https://code.claude.com/docs/en/agent-teams |
| D4 | Claude Code docs: Orchestrate subagents at scale with dynamic workflows | living doc, read 2026-10-31 | https://code.claude.com/docs/en/workflows |
| D5 | Claude Code docs: Best practices (redirect target of the Apr 2025 "Claude Code: Best practices for agentic coding" post) | living doc, read 2026-10-31 | https://code.claude.com/docs/en/best-practices |

Overarching guidance repeated across S1, S9, and S12: find the simplest solution that works. Add multi-step or multi-agent structure only when it measurably improves results, and re-test it whenever a new model arrives, because each harness component encodes an assumption about what the model cannot do alone (S9).

---

## A. Building blocks (S1)

### A1. Augmented LLM
- **Mechanism:** A single LLM call enhanced with retrieval, tools, and memory. The model writes its own search queries, chooses tools, and decides what to keep. It is the node type every other pattern composes.
- **When to use:** As the base unit of every pattern. Expose capabilities through a clear, documented interface, for example MCP.
- **Roles:** LLM plus its augmentations.
- **Source:** S1.

## B. Workflows: predefined code paths (S1)

### B1. Prompt chaining
- **Mechanism:** A linear sequence of nodes. Each LLM call consumes the previous call's output. Optional programmatic "gates" between steps check intermediate output and can stop the chain or divert it. The chain ends at its last step.
- **When to use:** Tasks that decompose cleanly into fixed subtasks. It trades latency for accuracy by making each call easier.
- **Examples:** Write marketing copy, then translate it. Write an outline, gate-check it against criteria, then write the document.
- **Roles:** Sequential LLM steps and programmatic gates.
- **Source:** S1. D1 documents the same shape as **"Chain subagents"**: the parent passes each subagent's result to the next, as in reviewer finds issues, then optimizer fixes them.

### B2. Routing
- **Mechanism:** A classifier node, either an LLM or a traditional model, labels the input and sends it down exactly one of several specialised branches (prompt, tool set, or model). Each input takes a single branch, and the run ends when that branch finishes.
- **When to use:** Distinct input categories that are better handled separately and can be classified accurately. It also covers cost and quality tiering across models.
- **Examples:** Customer-service triage into general, refund, and technical queries. Sending easy queries to Haiku and hard ones to Sonnet.
- **Roles:** Router or classifier, and specialist handlers.
- **Source:** S1. S12 (2026) warns that LLM routers in front of specialist subagents are often better folded into a single loop.

### B3. Parallelization: sectioning
- **Mechanism:** Fan-out and fan-in. Independent subtasks run as parallel LLM calls, and code aggregates their outputs.
- **When to use:** Independent subtasks that can run in parallel for speed, or concerns that each deserve a call's full attention.
- **Examples:** A guardrail model screens the query while another model writes the response. Automated evals where each call grades one aspect.
- **Roles:** Parallel workers and a programmatic aggregator.
- **Source:** S1.

### B4. Parallelization: voting
- **Mechanism:** The same task runs N times, with the same or varied prompts, and code aggregates the results by vote or threshold.
- **When to use:** When several attempts or perspectives raise confidence.
- **Examples:** Several prompts review code for vulnerabilities. Several judges decide whether content is inappropriate, with tunable vote thresholds.
- **Roles:** Redundant voters and an aggregator.
- **Source:** S1. D4's `/deep-research` workflow "votes on each claim" during cross-checking.

### B5. Orchestrator-workers
- **Mechanism:** A central LLM breaks the task into subtasks at runtime, delegates each to a worker LLM, and synthesises the results. Unlike sectioning, the number and shape of subtasks are not predefined. The run ends when the orchestrator decides the synthesis is complete.
- **When to use:** Complex tasks whose subtasks cannot be predicted in advance.
- **Examples:** Coding changes that touch many files. Search that gathers and analyses many sources.
- **Roles:** Orchestrator, which also synthesises, and workers.
- **Source:** S1. Production instance in C1.

### B6. Evaluator-optimizer
- **Mechanism:** A loop. A generator produces output, an evaluator critiques it against criteria and returns feedback, and the generator revises. The loop ends when the evaluator accepts or an iteration cap is reached.
- **When to use:** Clear evaluation criteria exist, feedback measurably improves the output, and an LLM can give that feedback, much as a human editor would.
- **Examples:** Literary translation. Multi-round search, where the evaluator decides whether more searching is needed.
- **Roles:** Generator (optimizer) and evaluator (critic).
- **Source:** S1. Productised as E2 (Outcomes) and extended in D2/D3 (planner-generator-evaluator).

## C. Agents: model-directed control flow

### C0. Autonomous agent (tool-use loop with environment feedback)
- **Mechanism:** One LLM works in a loop: plan, call a tool, observe "ground truth" from the environment (tool results, code execution), and repeat. It may pause at checkpoints for human input. It ends on task completion or a stopping condition such as a maximum iteration count.
- **When to use:** Open-ended problems where the number of steps cannot be predicted or hard-coded, in trusted, sandboxed environments with guardrails. It costs more and errors can compound.
- **Examples:** A SWE-bench coding agent. The computer-use reference implementation.
- **Roles:** LLM as decision-maker, tools, environment, and a human at checkpoints.
- **Source:** S1. S4 restates the loop as **gather context, take action, verify work, repeat**. Verification options are rules-based feedback (lint, tests), visual feedback (screenshots via Playwright), and LLM-as-judge, which is less robust and costs more latency.
- **Evidence:** S1 reports that the team spent more time optimising tools (the agent-computer interface) than the prompt for SWE-bench. Requiring absolute file paths eliminated one class of errors.

### C0'. Single-loop agent with progressive disclosure ("fold subagents in")
- **Mechanism:** One model and one context window run an open-ended tool loop. The model writes a plan on the first turn and revises it as results arrive. Domain procedures are loaded on demand as skills, and validation and approval limits live inside tools. The harness enforces turn and cost budgets and write gates. Routers, planners, and domain-specialist subagents are folded into this loop.
- **When to use:** The default for many enterprise agents as of late 2026. Keep subagents only where the single loop measurably degrades from context bloat, where work can run in parallel in throwaway contexts, or where tool choice or conflicting instructions overwhelm one agent.
- **Roles:** One agent, with skills and tools as its modules.
- **Evidence:** One customer saw about 2x faster runtimes after moving from a multi-agent harness to a single loop. S12 lists the multi-agent failure modes it addresses: lossy handoffs, subagent sprawl that mirrors the org chart (Conway's law), a "Frankenprompt" of conflicting rules, and latency from nested loops.
- **Migration method:** Build about 10 golden end-to-end examples, fold subagents in one at a time, and keep a subagent only if the folded version scores worse.
- **Source:** S12 (2026-10-22). D5 says much the same: delegating the same task to a subagent "doesn't make the answer any better", but a fresh reviewer does help.

### C1. Orchestrator-worker multi-agent research (lead plus parallel subagents plus citation pass)
- **Mechanism:**
  1. A LeadResearcher plans the work and saves its plan to external memory, because context beyond 200K tokens is truncated.
  2. It spawns 3-5 subagents in parallel. Each subagent has its own context window, tools, and an explicit brief: objective, output format, tool and source guidance, and boundaries.
  3. Each subagent searches iteratively, using 3 or more tools in parallel, then compresses its findings and returns them.
  4. The lead synthesises the results, then either spawns more subagents or exits.
  5. On exit, a CitationAgent attributes each claim in the report to its source.
  Subagents run synchronously from the lead's view: the lead waits for each batch.
- **Effort scaling, stated in the prompts:** Simple fact-finding uses 1 agent and 3-10 tool calls. Comparisons use 2-4 subagents with 10-15 calls each. Complex research uses more than 10 subagents.
- **When to use:** Breadth-first, highly parallelisable, high-value tasks whose information exceeds one context window.
- **When not to use:** Tasks that need shared context or have many inter-agent dependencies, which the authors say covers most coding. Also low-value tasks, and anything needing real-time coordination between agents.
- **Roles:** Lead (orchestrator and synthesiser), research subagents, CitationAgent, and memory.
- **Evidence:**
  - An Opus 4 lead with Sonnet 4 subagents beat single-agent Opus 4 by 90.2% on an internal research eval.
  - On BrowseComp, token usage explained 80% of performance variance. Token usage, tool-call count, and model choice together explained 95%.
  - Multi-agent runs used about 15x the tokens of chat. Single agents used about 4x.
  - Parallelism cut research time by up to 90%.
  - A tool-testing agent that rewrote tool descriptions cut task time by 40%.
- **Failure modes:**
  - Spawning around 50 subagents for simple queries.
  - Duplicated work from vague delegation.
  - Endless searches for sources that do not exist.
  - Compounding errors in stateful runs, mitigated with checkpoints, resume, and retry.
- **Source:** S2.

### C2. Sub-agent architecture for context isolation ("subagents as context filters")
- **Mechanism:** A parent agent delegates a focused task to a subagent. The subagent starts from a fresh context, unless it is a fork that copies the parent conversation. Only the brief passes down. The subagent may use tens of thousands of tokens exploring, but returns only a condensed summary, often 1,000-2,000 tokens. Subagents can be parallel or chained, foreground (blocking) or background (asynchronous), and resumable by ID. Nesting defaults to 3 levels, and concurrency defaults to 20 in Claude Code. Each subagent can have its own restricted tools, model, permissions, and turn cap.
- **When to use:** Verbose side tasks such as test runs, logs, and wide searches. Independent parallel research. A fresh-eyes reviewer that has not seen how the work was produced. Enforced tool restrictions, such as a read-only reviewer.
- **When not to use:** Iterative back-and-forth, phases that share a lot of context, quick edits, or latency-sensitive work.
- **Named usage patterns in the docs:** "Isolate high-volume operations", "Parallel research", "Chain subagents", "Resume for continuity". D2 lists four benefits: context isolation, parallelization, specialized instructions, and tool restrictions.
- **Roles:** Parent (main agent) and subagents. Built-in examples are Explore (read-only search), Plan, and general-purpose.
- **Evidence:** S3 says sub-agent architectures showed substantial improvement over single agents on complex research, citing S2. D5 cautions that subagents cost tokens and sometimes time, and bring no extra intelligence by default.
- **Sources:** S3, S4, D1, D2, D5.

### C3. Agent team (lead plus peer teammates, shared task list, mailbox)
- **Mechanism:** A lead session spawns teammates, each a full independent session with its own context. Teammates coordinate in two ways:
  - A **shared task list** with pending, in-progress, and completed states and dependency blocking. Teammates self-claim the next unblocked task, and file locks prevent double-claiming.
  - A **mailbox** for direct messages between any two agents, including the human, without routing through the lead.
  When a teammate goes idle, the lead is notified with its final answer. Shutdown is a request that the teammate can accept or reject. Hooks can act as quality gates on idle, task creation, and task completion. Teams cannot nest: only the lead manages the team.
- **When to use:** Research and review. New modules where each teammate owns separate files. Debugging with competing hypotheses. Changes that span layers. The docs recommend 3-5 teammates with about 5-6 tasks each.
- **When not to use:** Sequential work, edits to the same file, or work with heavy dependencies. Token cost scales linearly with teammates.
- **Named sub-patterns:**
  - **Parallel review by lens:** separate security, performance, and test-coverage reviewers, followed by a lead synthesis.
  - **Competing-hypotheses debate:** teammates try to disprove each other's theories, like a scientific debate, to counter anchoring. The surviving theory goes into a findings doc.
  - **Plan-approval gate:** a teammate plans in read-only mode, and the lead approves before it implements.
- **Roles:** Team lead, teammates, task list, and mailbox.
- **Source:** D3 (experimental feature).

### C4. Decentralised parallel swarm on a shared repo (no orchestrator)
- **Mechanism:**
  - N identical agents (16 here), each in its own container with a clone of a bare git upstream.
  - Each agent runs in an infinite `while true` harness loop that starts a fresh session with a fixed prompt every time.
  - Agents claim work by writing lock files into a `current_tasks/` directory. Git push conflicts force a losing agent to pick a different task.
  - After each task the agent pulls, merges, pushes, and releases its lock.
  - There is no orchestrator, no other inter-agent messaging, and no high-level goal management. Each agent picks the "next most obvious" problem.
  - Some agents are specialised: deduplicating code, performance, Rust-quality critique, documentation.
  - A test oracle (GCC as a known-good compiler, with random partitioning of which files use the new compiler) splits one monolithic failure into bugs agents can fix in parallel.
  - The loop has no defined end.
- **When to use:** Large, decomposable engineering work with a strong automated oracle or test suite.
- **Failure modes:** Merge conflicts and regressions until CI was enforced. All agents converging on the same giant bug when the work does not partition.
- **Roles:** Peer workers (generalists plus specialists), git as the shared state, and the test oracle.
- **Evidence:** About 2,000 sessions over two weeks, about 2B input and 140M output tokens, and just under $20K. The result was a 100K-line Rust C compiler that builds Linux 6.9 on x86, ARM, and RISC-V, with a 99% pass rate on most compiler test suites, including the GCC torture tests.
- **Source:** S8.

## D. Long-horizon harness topologies

### D1. Initializer-agent plus incremental coding-agent relay (two-agent harness)
- **Mechanism:** Session 1 is an **initializer agent** with a special prompt. It writes:
  - `init.sh`
  - a `claude-progress.txt` log
  - a JSON feature list (over 200 features, all marked failing)
  - an initial git commit
  Every later session is a fresh **coding agent** in a new context window that runs a fixed routine:
  1. Read the git log, progress notes, and feature list.
  2. Run `init.sh` and a smoke test.
  3. Implement one highest-priority failing feature.
  4. Test it end to end in a browser.
  5. Flip its `passes` flag, commit, and update the progress file.
  State passes between context windows only through these artifacts. The run ends when every feature passes; no explicit termination is defined.
- **When to use:** Multi-context-window builds that compaction alone cannot sustain.
- **Failure modes it addresses:** Doing too much at once, half-built features, declaring victory early, and marking features done without testing.
- **Roles:** Initializer, coding agent (repeated), and the artifacts acting as shared memory.
- **Evidence:** Qualitative. Browser-automation testing "dramatically improved" performance. The post leaves open whether specialised QA or cleanup agents would do better.
- **Source:** S7.

### D2. Planner, generator, evaluator harness (GAN-inspired, with sprint contracts)
- **Mechanism:**
  1. A **planner** expands a 1-4 sentence prompt into a full product spec. It stays high-level on technical details so spec errors do not cascade.
  2. A **generator** builds the product in sprints, one feature at a time, and self-checks before handing off.
  3. An **evaluator** drives the running app with Playwright and grades each criterion against a hard threshold. Any miss fails the sprint and sends detailed feedback to the generator.
  Before each sprint, generator and evaluator negotiate a **sprint contract**: what "done" means and how it will be verified. Agents communicate through files. Context resets with structured handoffs replace compaction where models show "context anxiety".
- **Frontend-only variant:** A generator-evaluator loop runs 5-15 iterations, with the evaluator scoring design quality, originality, craft, and functionality, calibrated with few-shot examples. After each round the generator chooses to refine or pivot.
- **Simplified V2 (Opus 4.6):** Sprints were dropped and the evaluator runs once at the end. The planner was kept, because without it the generator under-scoped.
- **When to use:** Tasks at or beyond the edge of the model's solo capability. The evaluator is overhead for tasks within it.
- **Key design claim:** Tuning a separate sceptical evaluator is more tractable than making a generator criticise its own work, since agents praise their own mediocre output.
- **Roles:** Planner, generator, and evaluator (QA).
- **Evidence:**
  - Retro game maker: solo run took 20 minutes and $9, and its core play mode was broken. The full harness took 6 hours and $200 and produced a working, richer app.
  - DAW build (V2): 3h50m and $124.70 over three build and QA rounds. QA kept catching stubbed features.
- **Source:** S9.

### D3. Graded outcome loop (rubric plus independent grader)
- **Mechanism:** The developer writes a success rubric. The agent works, then a separate grader in its own context window scores the output against the rubric. Working in its own context keeps the grader from being swayed by the agent's reasoning. If the output falls short, the grader says what to change and the agent makes another pass. The loop ends on a pass or an iteration cap, and a webhook can fire on completion.
- **When to use:** Tasks with articulable quality criteria, such as document review or file generation.
- **Roles:** Worker agent and grader.
- **Evidence:**
  - Up to 10 points of task-success gain over a standard prompting loop, largest on the hardest problems.
  - +8.4% on docx generation and +10.1% on pptx.
  - Wisedocs reviews ran 50% faster.
  - Spiral uses a Haiku lead that delegates drafts to parallel Opus subagents, with outcome rubrics gating which drafts are returned.
- **Source:** S11. This is a productised evaluator-optimizer (B6).

### D4. Managed multiagent orchestration (lead plus specialist subagents on a shared filesystem, persistent events)
- **Mechanism:** A lead agent splits a job and delegates each piece to a specialist subagent, each with its own model, prompt, and tools. Specialists run in parallel on a **shared filesystem** and feed results back into the lead's context. Events persist, so the lead can check in with other agents mid-workflow. The console traces which agent did what, in what order, and why.
- **When to use:** Jobs too large or varied for a single agent.
- **Roles:** Lead and specialists.
- **Evidence:** Netflix runs parallel batch log analysis that surfaces only recurring patterns. Harvey reports about 6x higher completion rates when combined with dreaming.
- **Source:** S11.
- **Related infrastructure (S10):** The brain (stateless harness), the hands (sandboxes or tools behind a uniform `execute(name, input)` interface), and the session (an append-only event log outside both) are decoupled. This enables "many brains, many hands": brains can pass hands to one another. It cut p50 time-to-first-token by about 60% and p95 by over 90%. S10 describes no specific orchestration topology.

### D5. Offline memory consolidation ("dreaming")
- **Mechanism:** A scheduled process runs between sessions. It reviews past sessions and memory stores, extracts recurring mistakes and converged workflows, and rewrites memory to keep it high-signal. Changes are applied automatically or held for review.
- **When to use:** Agents that run repeatedly and should improve across sessions.
- **Roles:** Worker sessions and a consolidator.
- **Evidence:** Credited in Harvey's roughly 6x completion gain, alongside other features.
- **Source:** S11 (research preview).

## E. Script- or code-orchestrated topologies

### E1. Dynamic workflow (script-held orchestration of many subagents)
- **Mechanism:** Claude writes a JavaScript script that a runtime executes outside the conversation.
  - Primitives: `agent()` spawns one subagent, optionally with a JSON-schema output; `pipeline(items, fn)` runs one per item; `parallel()` runs tasks concurrently and joins them; `phase()` and `log()` support progress display.
  - The script holds the loop, branching, and intermediate results, so the conversation receives only the final answer.
  - Runs are resumable by deterministic replay: `Date.now()` and `Math.random()` are banned, and saved results are reused up to the first changed or failed agent.
  - Defaults: 16 concurrent agents, 4,096 items per call, 1,000 agents per run. There is no mid-run user input.
- **Shapes the docs name:**
  - Fan-out audit with adversarial verification of each finding.
  - A fix-until-check-passes loop that stops on a pass or when two rounds in a row make no progress.
  - Parallel migration with each file in an isolated copy (worktree).
  - Per-file review, then a merge, deduplicate, and rank step.
  - Multi-source research with cross-checking and claim voting (`/deep-research`).
  - Find-until-saturation: stop when two rounds in a row find nothing new.
  - Drafting a plan from several independent angles and weighing them.
- **When to use:** More agents than one conversation can coordinate (dozens to hundreds), or when you want the orchestration codified as a script you can rerun. D4's comparison: with subagents, skills, and teams, Claude decides turn by turn; with a workflow, the script decides.
- **Roles:** Script (orchestrator), worker subagents, and verifier or judge subagents.
- **Source:** D4. D2 also points to it for scaling beyond a few delegated tasks per turn.

### E2. Programmatic tool calling and code execution with MCP (code as the orchestrator of tool calls)
- **Mechanism:** Instead of calling tools one by one through the model, Claude writes code that runs in a sandbox and calls the tools.
  - Tools are presented as Python functions (S6) or as a filesystem of TypeScript modules for MCP servers (S5).
  - Loops, conditionals, filtering, and error handling run in code. Only the final output returns to context.
  - Progressive disclosure: tool definitions load on demand through a Tool Search tool (`defer_loading`) or by browsing the filesystem.
  - Intermediate data can stay out of the model's context entirely, which also helps privacy.
- **When to use:** Three or more dependent tool calls, large intermediate data where only summaries matter, parallel operations over many items, or more than 10 tools or 10K tokens of tool definitions.
- **When to skip:** Single simple calls.
- **Roles:** Model (writes the code), sandbox runtime, and tools.
- **Evidence:**
  - S5: a Drive-to-Salesforce flow dropped from about 150K to about 2K tokens, a 98.7% reduction.
  - S6, programmatic tool calling: tokens fell from 43,588 to 27,297 (-37%), and GIA rose from 46.5% to 51.2%.
  - S6, Tool Search: context fell from about 77K to about 8.7K tokens. MCP evals improved from 49% to 74% on Opus 4 and from 79.5% to 88.1% on Opus 4.5.
- **Sources:** S5, S6.

## F. Context-management techniques that shape topology (S3)

These are not multi-agent graphs, but S3 presents them as the alternatives that decide whether you need extra agents for long-horizon work.

### F1. Compaction
- **Mechanism:** When context nears its limit, summarise the history and continue in a new window seeded with the summary. Clearing old tool results is the lightest form.
- **When to use:** Long back-and-forth that needs continuity.
- **Evidence:** Qualitative only. S9 found compaction insufficient for Sonnet 4.5's "context anxiety", where a context reset was needed. Opus 4.5 ran with compaction alone.
- **Sources:** S3, S4, S9.

### F2. Structured note-taking (agentic memory)
- **Mechanism:** The agent writes notes such as a NOTES.md file or to-do list to storage outside the context window and re-reads them after resets.
- **When to use:** Iterative work with milestones.
- **Evidence:** Anecdotal: a Claude playing Pokémon kept progress across thousands of steps. The same mechanism underlies D1's progress file and C1's plan memory.
- **Source:** S3.

### F3. Just-in-time retrieval and hybrid preload
- **Mechanism:** Keep lightweight references (paths, queries, links) and load data with tools such as grep, head, and glob only when needed. The hybrid version preloads some context, such as CLAUDE.md, and leaves the rest to on-demand exploration.
- **When to use:** Large or changing data. S4 recommends agentic search over semantic search as the starting point.
- **Sources:** S3, S4.

## G. Human-in-the-loop, multi-session practitioner patterns (D5)

### G1. Writer/reviewer split (independent-reviewer session or subagent)
- **Mechanism:** One session or agent writes the code. A second session, or a read-only reviewer subagent with only Read, Grep, and Glob, reviews the diff against SPEC.md without having seen the reasoning behind it. Findings go back to the writer.
- **When to use:** Verification of any non-trivial change.
- **Caveat:** Tell the reviewer to "report gaps that affect correctness and skip style". A reviewer asked to find problems always finds something.
- **Source:** D5.

### G2. Interview, then spec, then a fresh build session
- **Mechanism:** Claude interviews the user until it can write SPEC.md. A new session then builds from the spec with a clean context, and the spec doubles as the reviewer's rubric.
- **Source:** D5.

### G3. Headless fan-out loop
- **Mechanism:** A shell `for` loop runs `claude -p` once per file, with restricted tools, `dontAsk` permissions, `--max-turns`, and a replied `OK` or `FAIL`. Pilot it on three files before running the rest.
- **When to use:** Large mechanical migrations.
- **Related:** `/batch` splits the work into 5-30 units, each in its own worktree with its own PR.
- **Source:** D5.

### G4. Parallel sessions in git worktrees
- **Mechanism:** Each independent piece of work runs in its own checkout (`claude -w`), so edits cannot collide.
- **Source:** D5.

### G5. Goal and Stop-hook verification loop
- **Mechanism:** The agent keeps working until a separate model judges the goal condition met (`/goal`), or until a `Stop` hook script exits with code 0. Exit code 2 blocks the stop and sends the reason back to the agent. This is an evaluator-optimizer loop enforced by the harness instead of the prompt.
- **Source:** D5.

---

## Canonical topology names from this branch

1. Augmented LLM (building block)
2. Prompt chaining (with gates), also called sequential pipeline or chain subagents
3. Routing
4. Parallelization: sectioning (fan-out and fan-in)
5. Parallelization: voting
6. Orchestrator-workers
7. Evaluator-optimizer (generator-critic loop), including graded outcome loops and Stop-hook or goal loops
8. Autonomous agent loop (gather context, act, verify, repeat)
9. Single-loop agent with progressive disclosure (folded subagents)
10. Lead-researcher multi-agent research (orchestrator, parallel subagents, citation agent, memory)
11. Subagent context isolation (parent and child, summary return; parallel, chained, forked, resumable)
12. Agent team (lead, peers, shared task list, mailbox), including the competing-hypotheses debate and parallel review by lens
13. Decentralised parallel swarm (no orchestrator, lock-file task claiming, shared git, oracle-partitioned work)
14. Initializer plus incremental coding-agent relay (artifact handoff across context windows)
15. Planner, generator, evaluator harness (sprint contracts)
16. Managed multiagent orchestration (lead plus specialists on a shared filesystem, persistent events), with brain/hands decoupling
17. Offline memory consolidation ("dreaming")
18. Dynamic workflow (script-orchestrated fan-out, pipeline, verify, and loop-until-converged)
19. Programmatic tool calling and code-execution orchestration
20. Writer/reviewer independent verification, plus headless fan-out and worktree parallel sessions
