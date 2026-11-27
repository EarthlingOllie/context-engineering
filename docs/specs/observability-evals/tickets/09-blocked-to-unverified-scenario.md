# 09: Blocked to Unverified scenario

**What to build:** A session eval measures the blocked evaluator and the Unverified label together: a generator-evaluator task whose countable criteria name a check the sandbox cannot run. Passes if the dispatch returns `blocked` and the orchestrator asks or, in autonomous mode, labels accepted work UNVERIFIED in DECISIONS and lists it first in the final reply.

**Blocked by:** 08 (Session-eval harness and the hook scenario)

**Status:** ready-for-agent

- [ ] The scorer is tested on saved records of a passing and a failing session
- [ ] Paid runs recorded: fails on 0.3.2, passes on 0.4.0
