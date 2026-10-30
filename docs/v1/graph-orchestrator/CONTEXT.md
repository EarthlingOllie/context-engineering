# Graph Orchestrator

An orchestrator agent that breaks a task into waves of configurable, reusable control-flow patterns (topologies), delegates nearly all context and work to them, and integrates only their results.

## Language

**Orchestrator**:
The agent that assesses the task, plans each wave, integrates results and, when necessary, asks the human for direction. It never runs a loop itself.
_Avoid_: Lead, graph orchestrator (as a distinct thing), controller

**Topology**:
A reusable, parameterised control-flow pattern with a fixed signature and no task-specific content. A template, not a run. Only a chain's stages may themselves be topologies.
_Avoid_: Workflow, pattern, building block, tool

**Dispatch**:
One topology instantiated with concrete parameters. The unit the orchestrator issues within a wave and the unit that returns a result.
_Avoid_: Job, call, invocation

**Dispatch Spec**:
The structured description of a dispatch the orchestrator writes: id, topology, task, context, roles, params, return contract, dependencies.
_Avoid_: Prompt, request

**Role**:
A named slot inside a topology, with a fixed stance and output shape, filled at dispatch time with a skill and task-specific instructions. The domain comes from the skill, never from the role.
_Avoid_: Agent type, persona, agent definition

**Stage**:
One step of a chain. A stage is a dispatch, so it may be any topology.
_Avoid_: Step, link

**Wave**:
The set of dispatches the orchestrator issues at once; one wave is one workflow run, waited on in full before planning again.
_Avoid_: Batch, round

**Frontier**:
The work the orchestrator believes still needs doing. An empty frontier ends the session.
_Avoid_: Backlog, queue

**Signature**:
The fixed contract every topology accepts from and returns to the orchestrator: a dispatch spec in; a status (done, blocked, exhausted, over budget), an inline result, artifact paths and an iteration count out.
_Avoid_: Interface, API

**Return Contract**:
The shape and line limit a dispatch's result must satisfy. Results always return inline.
_Avoid_: Output format, response schema

**Mode**:
Whether the orchestrator asks the human on uncertainty (attended) or records a best guess and continues (autonomous). Irreversible actions and human-only questions always ask.
_Avoid_: Flag, setting

**Catalog**:
The short description of every available topology — when to use it, its roles, its params — that the orchestrator loads once. Fixed per version.
_Avoid_: Registry, manifest, toolbelt

**Trace**:
The append-only record of waves, dispatches and human interventions from which the session diagram is rendered. Never read by the orchestrator.
_Avoid_: Log, history

**Scribe**:
The one agent a wave runs last, whose only job is to write the wave's trace events.
_Avoid_: Logger, recorder

**State File**:
The orchestrator's whole memory between waves: goal, status, known facts, ruled-out hypotheses, frontier and decisions. Rewritten in place, never appended.
_Avoid_: Log, notes, scratchpad (that is the directory it lives in)
