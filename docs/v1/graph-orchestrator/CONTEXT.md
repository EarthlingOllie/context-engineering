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
The set of dispatches the orchestrator launches together; each dispatch is its own workflow run, named for its purpose (ADR-0003). A launch batch, not a barrier: work whose dependencies have all finished may launch as the next wave before the rest of the current wave reports (ADR-0006).
_Avoid_: Batch, round

**Run**:
One execution of a dispatch as a workflow, identified by its run id. A dispatch normally has one run; a stopped run is resumed as a further run of the same dispatch.
_Avoid_: Job, task, execution

**Stopped**:
A run that ended without returning, because the container or worker restarted. Not a signature status: the topology never produced one, so only the harness reports it.
_Avoid_: Killed, crashed, failed (that is a signature status)

**Frontier**:
The work the orchestrator believes still needs doing. An empty frontier ends the session.
_Avoid_: Backlog, queue

**Signature**:
The fixed contract every topology accepts from and returns to the orchestrator: a dispatch spec in; a status (done, blocked, exhausted, over budget, failed), an inline result, artifact paths and an iteration count out.
_Avoid_: Interface, API

**Unverified**:
Work the orchestrator accepted although no evaluator passed it, because its dispatch ended blocked or exhausted. A label the orchestrator writes, not a signature status. An evaluator that cannot run a check it needs blocks rather than failing the work.
_Avoid_: Unreviewed, accepted, best guess (that is the decision, not the label on its work)

**Return Contract**:
The shape and line limit a dispatch's result must satisfy. Results always return inline.
_Avoid_: Output format, response schema

**Mode**:
Whether the orchestrator asks the human on uncertainty (attended) or records a best guess and continues (autonomous). Irreversible actions and human-only questions always ask.
_Avoid_: Flag, setting

**Intervention**:
A decision at one of the five triggers (ambiguity, blocked, exhausted, irreversible, budget), answered by the human (source `user`) or by the orchestrator's recorded best guess in autonomous mode (source `self`). Hook messages, the mode question and the human's status questions are not interventions; a hook message is never a human answer.
_Avoid_: Human node (a `self` intervention is not human), consultation, gate

**Catalog**:
The short description of every available topology — when to use it, its roles, its params — that the orchestrator loads once. Fixed per version.
_Avoid_: Registry, manifest, toolbelt

**Trace**:
The append-only record of waves, dispatches and human interventions from which the session diagram is rendered. Never read by the orchestrator.
_Avoid_: Log, history

**Scribe**:
The one agent a dispatch's workflow runs last, whose only job is to write that dispatch's trace events to its own trace file.
_Avoid_: Logger, recorder

**State File**:
The orchestrator's whole memory between waves: goal, status, known facts, ruled-out hypotheses, frontier and decisions. Rewritten in place, never appended.
_Avoid_: Log, notes, scratchpad (that is the directory it lives in)

**Dispatch Eval**:
An evaluation of one dispatch in isolation: a dispatch spec in; its result, trace and files out. No orchestrator takes part.
_Avoid_: Topology test, unit eval

**Session Eval**:
An evaluation of one whole orchestrated session: a task in; everything the orchestrator planned, dispatched and integrated out.
_Avoid_: End-to-end test, e2e eval

**Baseline**:
The eval results for the plugin as shipped, untouched, with every role on one pinned model. Every fix is measured against it.
_Avoid_: Benchmark, control
