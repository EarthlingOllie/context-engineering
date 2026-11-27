# 01: Spike: headless Claude Code with the Workflow tool in a sandbox

**What to build:** Establish whether session evals are possible: headless Claude Code, version-pinned, with the plugin installed from the working tree, inside an Inspect Docker sandbox, loads the orchestrator skill and launches a dispatch through the Workflow tool. Ships nothing.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Whether the orchestrator skill loads and a Workflow launch returns a result in the sandbox, with the log (mock run; the live orchestrated session is a human step, below)
- [x] Whether the inspect_swe Claude Code agent works as the base, or what replaces it
- [ ] Cost and wall clock of one small orchestrated session (needs the paid live run)
- [x] A recommendation: build ticket 08, or stop and record why on the roadmap (provisional until the live run)

## Findings (2026-11-27)

Probe: `graph-orchestrator/evals/spike/session/` (task, probe, sandbox, fixture, saved transcripts; README there). Tests: `graph-orchestrator/evals/tests/test_session_spike.py`, over the saved transcripts.

**Skill load and Workflow launch: yes, in the sandbox.** A free mock run (mockllm through Inspect's sandbox agent bridge; Inspect 0.3.292, inspect_swe 0.3.2, Claude Code 2.1.332 pinned in the image, Docker, no network at run time) scored 1. Log: `saved/mock-pass.jsonl`. In it:
- The init line lists `graph-orchestrator` loaded from `/opt/repo/graph-orchestrator` (the working tree copy), the skills `graph-orchestrator:graph-orchestrator` and `graph-orchestrator:dispatch`, and the `Workflow` tool. Headless `claude -p` offers `Workflow` with a clean environment; it is not tied to the cloud session.
- `Skill(graph-orchestrator:graph-orchestrator)` returned the SKILL.md text, with plugin paths under `/opt/repo`.
- `Workflow({script})` returned "Workflow launched in background" with a run id; Claude Code then emitted `task_started`, `task_updated` (completed) and `task_notification` (`status: completed`).
- In `-p` mode Claude Code does not exit while a workflow runs: the notification starts a second turn (a second `result` line with `origin.kind: task-notification`). So an orchestrator waiting on its waves works headless; session evals can rely on it.
- Not yet shown: the real `dispatch.js` launched by the SKILL.md wrapper, with agents, through the bridge. That is the live run.

**inspect_swe as the base: yes, with three workarounds** (all in `task.py`):
1. inspect_swe 0.3.2 does not import against `agent-client-protocol` 1.1.0 (`ConnectMcpResponse` missing). Pin `agent-client-protocol==1.0.0` (0.12.1 also works).
2. inspect_swe rewrites `~/.claude/settings.json` (its `apiKeyHelper`) before it launches Claude Code, which wipes a user-scope plugin install. `saved/mock-plugin-dropped.jsonl` is that run: no plugin, no skill. Install the plugin at project scope in the sandbox repository (`claude plugin marketplace add --scope project /opt/repo`, `claude plugin install --scope project graph-orchestrator@earthlingollie`).
3. Claude Code refuses the presented model name `model` (mockllm's). Pass `model_config="claude-opus-5-5"`. Mock runs only: mockllm counts tokens with tiktoken, which downloads its encoding, so the task gives the mock model a character count instead.
Use `version="sandbox"` to run the pinned binary in the image, and `debug=True` to keep the stream-json transcript, which the probe reads.

**Cost and wall clock: open (human step).** The mock run's figures are not real (mock tokens priced by Claude Code: 91,887 input tokens, $0.37). Its sample took 183 s, almost all sandbox setup. The live run (`-T mode=live`, `cost_limit=10`) records `cost_usd`, `duration_ms`, tokens and the recommendation in the score explanation.

**Recommendation: build ticket 08, provisionally.** Nothing found blocks session evals: the skill loads, the Workflow tool runs headless and its notification drives the next turn. `probe.recommend` turns the live run's cost into the epochs that fit $75 over three scenarios (stop if one epoch does not fit). Confirm with the live run before ticket 08 starts its paid acceptance; if the live dispatch fails, stop and record it on the roadmap.

## Paid live run attempt (2026-11-27)

Started at 0c3ca10 with `-T mode=live -T cost_limit=10`; the key mapping worked (a live auth probe returned ok). The run did not finish before the session stopped it and left no log, and the API credit was exhausted later the same day, so cost and wall clock are still not recorded and the build-08 recommendation stays provisional. Re-run after a credit top-up.
