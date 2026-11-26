# 12: Concurrency sweep

**What to build:** The maintainer can measure how fan-out speed changes with the concurrency cap on a fixed hardware spec. An on-demand task runs the two fan-out samples at caps 2, 4 and 8 and reports wall clock and queue time for each.

**Blocked by:** 04 (Run parameters and limits), 05 (Single and fan-out samples with every status)

**Status:** ready-for-agent

- [ ] One documented command runs the sweep; it is not part of the routine run or its budget
- [ ] Caps, CPU count and memory are parameters, defaulting to caps 2, 4, 8 on 4 CPUs
- [ ] The output is one table: cap, wall clock, queue time, dollars, per sample
- [ ] The sweep's cost for one pass is recorded in the README
