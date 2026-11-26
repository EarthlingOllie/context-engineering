# 05: Single and fan-out samples with every status

**What to build:** Samples 2, 6, 7 and 15 run and score: a `single` that must end blocked, a fan-out with an explicit list and a reducer, a fan-out partitioned six ways under the cap, and a fan-out that must come back over budget without spending an agent. The scorecard gains queue time.

**Blocked by:** 03 (First scored sample and scorecard)

**Status:** ready-for-agent

- [ ] A blocked-task fixture exists whose only correct end is `blocked` with a question
- [ ] Sample 2 scores status truthful only when the dispatch returns `blocked`
- [ ] Sample 6 scores the reducer's result against the planted facts
- [ ] Sample 7 records queue time and wall clock under the cap
- [ ] Sample 15 returns `over_budget` and the scorecard shows zero agents and zero dollars for it
- [ ] Scorer tests include a saved sample for `blocked` and one for `over_budget`
