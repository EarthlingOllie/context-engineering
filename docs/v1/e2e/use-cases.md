# End-to-end use cases for the graph orchestrator

Each one is chosen to exercise a part of the design the unit tests cannot: real agents, real files, the Workflow runtime, and the orchestrator discipline.

## UC1 — Greenfield build with a review loop (generator-evaluator, chain, cross-wave dependsOn, artifacts forwarded)

Task: "Build `mdtoc`, a dependency-free Node CLI in UC1_DIR that inserts or refreshes a table of contents between `<!-- toc -->` and `<!-- /toc -->` markers in a Markdown file, with tests under node --test and a README."

Battle-tests: generator-evaluator where the evaluator must actually run the tests (pass criteria "node --test passes, idempotent on a second run"); a chain (write README from the code, then review it) in wave 2 that depends on wave 1's artifacts; return contracts of 2–4 lines; the state file surviving two waves; the renderer at the end. Mode: autonomous.

## UC2 — Wide research with synthesis (fan-out with partition instruction and reducer, over-cap demand, exhausted path)

Task: "Produce a consistency report on this repository's orchestrator documents: docs/v1/spec.md, docs/v1/graph-orchestrator/CONTEXT.md, the ADRs and spike record, and the plugin's SKILL.md and catalog.md. Every finding cites file:line. Write it to UC2_DIR/report.md."

Battle-tests: a fan-out split by a partition instruction ("one branch per document pair") with a reducer, width 5, so demand exceeds the cloud cap of 2 and queueing is visible; a generator-evaluator over the report with deliberately strict pass criteria and max_iterations 1, so the exhausted path and trigger 3 (best-guess-and-record in autonomous mode) are exercised; a fan-out branch returning a `question` in the result. Mode: autonomous.

## UC3 — Control flow under constraint (blocked, human intervention, re-dispatch with the answer, irreversible action, budget stop)

Task: "Prepare release 0.1.0 of the plugin in a copy at UC3_DIR/plugin: bump the version, write a CHANGELOG from the git history, and tag the release." with `--waves 3`.

Battle-tests: the tag is an irreversible action, so the orchestrator must ask before dispatching it (trigger 4, both modes) and a worker that sees it anyway must block; the CHANGELOG worker lacks a fact only the human has (the release date and whether to include the dogfood note), so it should return blocked with a question; the human's answer (supplied by me as the test driver) is recorded as a `human` trace line and the re-dispatch carries it in context with dependsOn on the blocked id; the three-wave budget forces trigger 5; the renderer is given a trailing `--human` line. Mode: attended, with me answering.
