# 03: Launch path and honest dispatch line

**What to build:** The orchestrator's first dispatch launches without a refusal, every session uses the same documented launch, and the user is told a wave is dispatched only when it is. The launch is the wrapper calling the dispatch workflow by its registered name if ticket 01 shows the workflow keeps the wrapper's name; otherwise a copy of the plugin's workflows into the session scratch directory at kickoff (a fourth exception to "the rule"), with the wrapper pointing at the copy.

**Blocked by:** 01 (Spike: launch, resume and usage-limit behaviour)

**Status:** ready-for-agent

- [ ] SKILL.md documents exactly one launch, the route ticket 01 recommends; the wrapper stays two lines with a literal `meta`
- [ ] SKILL.md says "Wave n dispatched" only once every Workflow call of the wave returned a run; any launch error is fixed and relaunched first
- [ ] The plugin README and ADR-0003 show the same launch; ADR-0003's open item on plugin script paths is closed with ticket 01's result
- [ ] By hand in a cloud session: an orchestrated session on a small task launches its first wave with no refusal, the workflow shows `<Topology>: <title>`, and the dispatch line comes after the launch returned
