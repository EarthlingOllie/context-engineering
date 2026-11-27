# 08: Session-eval harness and the hook scenario

**What to build:** The new session seam works end to end with its first scenario. A session eval takes a task, a fixture repository, an orchestrator mode and the hooks and permissions to install; runs headless Claude Code with the plugin from the working tree to completion or the cost limit; collects the transcript, scratch directory and git state; and scores with code. The hook scenario: a stop hook asks for a commit and push while a long dispatch runs; it passes if nothing is pushed, the main loop made no commit mid-wave, the reply names the running dispatch, and the trace holds a `hook` event and no intervention for it.

**Blocked by:** 01 (Spike: headless Claude Code with the Workflow tool in a sandbox); acceptance on 0.4.0 also needs fixes ticket 16

**Status:** ready-for-agent

- [x] A documented command runs the session task on demand; it is not part of the routine dispatch-eval run
- [x] The scorecard has the dispatch-eval shape and header (model, Claude Code version, plugin commit, epochs, cost limit) plus pass rate and spread
- [x] The hook scorer is tested on saved records of a passing and a failing session
- [ ] Paid runs recorded: the scenario fails on 0.3.2 and passes on 0.4.0
- [ ] Epochs and per-sample cost limit are set so the three scenarios fit $75, from ticket 01's cost

## Built (2026-11-27)

Harness, hook scenario, scorer and scorecard: `graph-orchestrator/evals/session/` (README there). Tests: `graph-orchestrator/evals/tests/test_session_hook.py` and `test_session_scorecard.py`, over saved records `graph-orchestrator/evals/tests/saved/session/hook-pass` and `hook-fail`.

- Command: `python graph-orchestrator/evals/session/run.py` (paid; `--plugin-ref <ref>` for the plugin as of a commit), `--mock complies|pushes` (free), `--from-log` (rebuild, rescored). Not run by `evals/run.py` or the GitHub Actions job.
- The saved records are free mock runs through the whole harness: real Claude Code 2.1.332, plugin installed from the working tree, the stop hook, a Workflow dispatch that runs 45 s, git and a bare remote; only the main loop is scripted. In them Claude Code feeds the blocking stop hook back as a user message `Stop hook feedback:\n<reason>` while the dispatch runs, so the hook does land mid-wave headless.
- The `hook` trace event: the scorer accepts any trace line with `type: "hook"` (fixes ticket 09 has not fixed its fields yet); an intervention "for it" is a `human` event that mentions the hook, a commit or a push.
- Open (paid, human): the two runs on 0.3.2 and 0.4.0, and the epochs and cost limit from ticket 01's live cost. Provisional defaults: 3 epochs at $8 a sample ($72 worst case for three scenarios); `run.py` refuses a paid run over $75 without `--over-budget`, and `run.epochs_for(<session cost>)` gives the settings once the cost is known.
