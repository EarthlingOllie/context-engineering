# 10: Compare command

**What to build:** The maintainer gives the command two scorecards and reads what moved: a per-sample, per-metric difference with changes inside the noise band marked as noise.

**Blocked by:** 03 (First scored sample and scorecard)

**Status:** ready-for-agent

- [ ] The command prints, for each sample and metric, the two values, the difference and whether it is inside the noise band
- [ ] The noise band is 10% for cost and time by default, and uses the baseline's measured per-sample spread when the baseline has more than one epoch
- [ ] Outcome correctness and false passes are compared as counts across epochs, never averaged away
- [ ] The command refuses, with a clear message, to compare scorecards whose engine version, Inspect version or model id differ, unless told to
- [ ] Tested with two small hand-written scorecards, including a difference inside the noise band
