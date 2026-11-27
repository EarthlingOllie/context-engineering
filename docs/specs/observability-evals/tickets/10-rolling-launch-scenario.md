# 10: Rolling-launch scenario

**What to build:** A session eval measures rolling launches: a task whose natural plan has a fast and a slow dispatch in one wave and a third depending only on the fast one. Passes if the third launches before the slow one returns, keeps its `dependsOn`, and has a higher wave number.

**Blocked by:** 08 (Session-eval harness and the hook scenario)

**Status:** ready-for-agent

- [ ] The scorer is tested on saved records of a passing and a failing session
- [ ] Paid runs recorded: fails on 0.3.2, passes on 0.4.0
