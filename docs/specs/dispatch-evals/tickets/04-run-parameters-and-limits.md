# 04: Run parameters and limits

**What to build:** The maintainer controls what a run may spend and what hardware it simulates. Epochs, dollar budget, time limit, concurrency cap, CPU count and memory are parameters with the spec's defaults, and a sample that hits a limit stops and says so.

**Blocked by:** 03 (First scored sample and scorecard)

**Status:** ready-for-agent

- [ ] Defaults: 3 epochs, $30 and 30 minutes per run, concurrency cap 2, 4 CPUs; each can be overridden from the command line
- [ ] The harness's `parallel` never runs more agents at once than the cap; this is tested with the stub engine
- [ ] CPU count and memory are applied to the sandbox and recorded in the scorecard header
- [ ] A sample that exceeds its cost or time limit stops and is reported in the scorecard as limit-hit, not as a failure of the plugin
- [ ] Every sample sets a wall-clock limit as well as a cost limit
- [ ] The README documents each parameter
