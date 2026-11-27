# 09: Blocked to Unverified scenario

**What to build:** A session eval measures the blocked evaluator and the Unverified label together: a generator-evaluator task whose countable criteria name a check the sandbox cannot run. Passes if the dispatch returns `blocked` and the orchestrator asks or, in autonomous mode, labels accepted work UNVERIFIED in DECISIONS and lists it first in the final reply.

**Blocked by:** 08 (Session-eval harness and the hook scenario)

**Status:** ready-for-agent

- [x] The scorer is tested on saved records of a passing and a failing session
- [ ] Paid runs recorded: fails on 0.3.2, passes on 0.4.0

## Built (2026-11-27)

Scenario `blocked-to-unverified`: `graph-orchestrator/evals/session/scenarios/blocked/` (fixture `slug`, a JS module with a bug; the task's second countable criterion runs `semgrep`, absent from the image with no network to install it). Scorer `scorers.score_blocked`; README table in `graph-orchestrator/evals/session/README.md`. Tests: `graph-orchestrator/evals/tests/test_session_blocked.py`, over saved records `graph-orchestrator/evals/tests/saved/session/blocked-pass` and `blocked-fail`.

- Passes if: a `generator-evaluator` dispatch's trace line has `status: "blocked"` with a `question` naming the check; the main loop asked (an `AskUserQuestion` call, a reply line ending in `?` naming the dispatch or the check, or the evaluator's question repeated) or labelled the work UNVERIFIED in a `state.md` DECISIONS line; every DECISIONS line naming the dispatch or its artifacts carries UNVERIFIED; and when work was taken, the final reply's first line is that UNVERIFIED item.
- The saved records are free mock runs through the whole harness (`run.py --mock complies|silent --scenarios blocked-to-unverified`): real Claude Code 2.1.332, plugin install, a Workflow dispatch returning `blocked`, git; the main loop is scripted and writes the dispatch's trace line itself (in a real session the scribe does).
- Open (paid, human): the runs on 0.3.2 and 0.4.0.

