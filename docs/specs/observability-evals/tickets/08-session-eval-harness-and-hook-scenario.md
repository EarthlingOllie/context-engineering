# 08: Session-eval harness and the hook scenario

**What to build:** The new session seam works end to end with its first scenario. A session eval takes a task, a fixture repository, an orchestrator mode and the hooks and permissions to install; runs headless Claude Code with the plugin from the working tree to completion or the cost limit; collects the transcript, scratch directory and git state; and scores with code. The hook scenario: a stop hook asks for a commit and push while a long dispatch runs; it passes if nothing is pushed, the main loop made no commit mid-wave, the reply names the running dispatch, and the trace holds a `hook` event and no intervention for it.

**Blocked by:** 01 (Spike: headless Claude Code with the Workflow tool in a sandbox); acceptance on 0.4.0 also needs fixes ticket 16

**Status:** ready-for-agent

- [ ] A documented command runs the session task on demand; it is not part of the routine dispatch-eval run
- [ ] The scorecard has the dispatch-eval shape and header (model, Claude Code version, plugin commit, epochs, cost limit) plus pass rate and spread
- [ ] The hook scorer is tested on saved records of a passing and a failing session
- [ ] Paid runs recorded: the scenario fails on 0.3.2 and passes on 0.4.0
- [ ] Epochs and per-sample cost limit are set so the three scenarios fit $75, from ticket 01's cost
