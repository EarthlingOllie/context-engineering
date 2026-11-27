# 11: Run the dispatch evals from GitHub Actions

**What to build:** The dispatch-eval suite runs where Docker and the key are known to be present. One manually triggered workflow on a runner with Docker; inputs map to the suite's options (samples, epochs, role models, stub); the API key comes from a repository secret and is never printed; the scorecard and Inspect log are uploaded as artifacts; nothing is committed and the baseline option is refused.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] A stub run of the job completes without the secret and uploads a scorecard
- [ ] One paid run is recorded in the evals README
- [x] The job refuses the baseline option

**By-hand evidence (2026-11-27, session_016jSC3fsMfuGLacrVjUTYMU, plugin 0.5.0+eaf50f7)**

Run 46083507859 (https://github.com/EarthlingOllie/context-engineering/actions/runs/46083507859): workflow_dispatch on main f92aa10 with stub=true, 23:37:15Z-23:43:16Z, completed/success. With stub=true the workflow passes an empty ANTHROPIC_API_KEY (no secret used).
Artifacts uploaded: `scorecard` (id 15237713593, 7024 B) and `inspect-log` (id 15237843399). Box 2 (paid run) not attempted: no paid runs in this session.
