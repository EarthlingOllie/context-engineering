# 02: Real status in the dispatch result and log

**What to build:** Anyone watching a run sees its real outcome, and a failed dispatch says why. Every run's last log line is `STATUS <status>`. When an agent call throws (a usage limit, for instance), the `failed` result carries the error message instead of a bare "returned nothing", so the orchestrator can tell an outage from a bad spec. SKILL.md tells the orchestrator that the notification's "completed" is not the dispatch's status. Includes the prefactor: an agent call that throws keeps its error message for the topology to report.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Every run, whatever its status (done, blocked, exhausted, over_budget, failed, including failures and over-budget returns before any agent ran), logs `STATUS <status>` as its last log line, after the scribe
- [ ] A dispatch whose agent throws returns `failed` with the thrown message in its result, within the return contract's line limit
- [ ] The code comment on `failed` says it is part of the orchestrator-facing signature, matching the glossary
- [ ] SKILL.md says the notification says "completed" whenever the script returned, and the dispatch's status is only in the returned data
- [ ] Tests at the bundle seam (the eval harness running the built dispatch script against a fake engine): an engine whose agents throw a usage-limit error gives `failed` with that text; done, exhausted, failed and over-budget dispatches each end with a matching `STATUS` line
- [ ] `npm run check` passes and the bundle is rebuilt
