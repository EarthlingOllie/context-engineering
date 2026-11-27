---
status: accepted
---
# A wave is a launch batch, not a barrier

ADR-0003 kept the wave as a barrier: the orchestrator launched every dispatch of a wave, then integrated only once all had reported. A rolling frontier had been deferred to v2. The session analysis (SPD-01) found 42% of slot time idle at that barrier across 16 multi-dispatch waves, and orchestrators in three sessions already rolled waves by hand.

We now treat a wave as a launch batch. When a dispatch returns, the orchestrator integrates it, and may at once launch any frontier item whose `dependsOn` names only finished dispatches, as the next wave number, rewriting the state file before each launch. No source change is needed: each dispatch is already its own Workflow run (ADR-0003).

## Consequences

- `dependsOn` still names only lower-numbered waves, and a same-wave id is still refused unrun (REL-06). Rolling launches make "move it to the next wave" cheap rather than a full barrier away.
- Wave budgets count launches, not barriers.
- Wave numbers stay strictly increasing but no longer mean "planned together"; the diagram still orders dispatches by wave, then dispatch number.
