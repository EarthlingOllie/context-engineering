---
status: accepted (one run per wave superseded by ADR-0003)
---
# Topologies are functions in a single Claude Code Workflow script

A topology's inner loop (generate → evaluate → repeat, fan out → reduce, debate rounds → judge) has to be run by something. The options were a runner subagent following prose instructions, the orchestrator stepping through roles itself, or a Claude Code Workflow script that holds the loop in code and spawns role agents. We chose Workflow scripts: the signature becomes real function parameters, width and iteration caps are enforced rather than requested, role agents stay at depth 1, and this is the closest in-harness approximation of the eventual code-defined design.

Two runtime facts shaped the form. Workflow scripts cannot import each other and running several concurrently is undocumented, so all topologies live in one `wave.js`, invoked once per wave as `/wave` with the list of dispatch specs as `args`. Scripts are plain JavaScript, so the source is TypeScript (typed signature and dispatch spec) bundled by esbuild into that one file.

Accepted on 2026-10-30 after a spike (see `Spike ADR0002`) proved: a skill receives `/wave`'s top-level return as structured data; nested `args` arrive intact; `parallel()` over more agents than the cap queues (no errors, no nulls); `agent()` with a `schema` returns parsed JSON; a chain stage can call a sibling topology function within one run; a scribe agent appends the trace; and a prompt cannot pick up a `.claude/agents` definition.

## Consequences

- The orchestrator never runs a loop; it chooses, configures and dispatches one wave at a time.
- A chain's stages are topologies because that is code composition, not agent nesting; no other topology composes in v1.
- The script has no filesystem or shell, so a scribe agent writes the trace once per wave, and the orchestrator passes the wave's timestamp in via `args`.
- `agent()` cannot name an agent definition or restrict tools, so roles are prompt fragments: stance plus output schema. Tool discipline is stated, not enforced, in v1.
- Topologies cannot ask the human; a blocked role short-circuits and the orchestrator asks on its behalf.
- Over-cap demand queues safely, so `wave.js` does not refuse a wave; it logs its demand against the effective cap. The cap is `min(16, nproc − 2)` by default (2 on a 4-CPU cloud session) and `CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS` is only settable for local sessions, so wide waves are slow in the cloud, not broken. The 1,000-agents-per-run limit is the only hard check.
