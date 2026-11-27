# 11: Run the dispatch evals from GitHub Actions

**What to build:** The dispatch-eval suite runs where Docker and the key are known to be present. One manually triggered workflow on a runner with Docker; inputs map to the suite's options (samples, epochs, role models, stub); the API key comes from a repository secret and is never printed; the scorecard and Inspect log are uploaded as artifacts; nothing is committed and the baseline option is refused.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A stub run of the job completes without the secret and uploads a scorecard
- [ ] One paid run is recorded in the evals README
- [x] The job refuses the baseline option
