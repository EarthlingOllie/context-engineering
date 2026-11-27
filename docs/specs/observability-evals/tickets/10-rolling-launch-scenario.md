# 10: Rolling-launch scenario

**What to build:** A session eval measures rolling launches: a task whose natural plan has a fast and a slow dispatch in one wave and a third depending only on the fast one. Passes if the third launches before the slow one returns, keeps its `dependsOn`, and has a higher wave number.

**Blocked by:** 08 (Session-eval harness and the hook scenario)

**Status:** ready-for-agent

- [x] The scorer is tested on saved records of a passing and a failing session
- [ ] Paid runs recorded: fails on 0.3.2, passes on 0.4.0

## Built (2026-11-27)

Scenario `rolling-launch`: `graph-orchestrator/evals/session/scenarios/rolling/` (fixture `inventory`: A, a one-file rename in `model.py`; B, a generator-evaluator `unittest` suite for `report.py`; C, a `--min-quantity` CLI option that builds on A only). Scorer `scorers.score_rolling`; README table in `graph-orchestrator/evals/session/README.md`. Tests: `graph-orchestrator/evals/tests/test_session_rolling.py`, over saved records `graph-orchestrator/evals/tests/saved/session/rolling-pass` and `rolling-fail`.

- Passes if: the fast, slow and dependent dispatches are found by title (the scenario's `roles` hints, the dependent's first) and all launched; the fast and slow ones share a wave; the dependent's `Workflow` call came before the slow one's completion notification; its `dependsOn` names the fast one in its args file and, if written, its trace line; its wave (trace line, else the id's `w<n>-`) is above theirs.
- The saved records are free mock runs through the whole harness (`run.py --mock rolls|barrier --scenarios rolling-launch`): real Claude Code 2.1.332, plugin install, three Workflow dispatches (5 s, 60 s, 5 s), git; the main loop is scripted and writes the trace lines itself (in a real session the scribe does). `rolls` launches the dependent once the fast one returns; `barrier` (0.3.2's rule) waits for the whole wave and fails only `launched_before_slow_returned`.
- Open (paid, human): the runs on 0.3.2 and 0.4.0.
