---
status: accepted
---
# Build the orchestrator as a Claude Code skill first

The orchestrator could be a standalone program (Python/LangGraph or Agent SDK) with code-defined topologies, or a Claude Code skill where each dispatch is an `Agent` call. We chose the skill first: it reuses the harness and the existing `lead-orchestrator` discipline, and lets the signatures and wave loop be proven cheaply before any standalone rewrite. The explicit intent is to port the learnings to a Python program later; the signature and return-contract shapes are designed to survive that port.

## Consequences

- The orchestrator is an LLM making free-form decisions each wave; only the topologies are deterministic (see ADR-0002).
- The session trace is written to disk by topologies, since the orchestrator must not hold history in context.
- Contract validation (reject-with-feedback) is deferred to v2; v1 relies on the topology's own instructions.
