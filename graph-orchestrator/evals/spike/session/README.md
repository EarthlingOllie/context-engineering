# Session-sandbox spike (observability-evals ticket 01)

Throwaway code for the go/no-go spike in `docs/specs/observability-evals/spec.md`: can headless Claude Code, version-pinned, with this plugin installed from the working tree, inside an Inspect Docker sandbox, load the orchestrator skill and launch a dispatch through the Workflow tool? Ships nothing. Findings are in the ticket, `docs/specs/observability-evals/tickets/01-spike-session-sandbox.md`.

| File | What it is |
|---|---|
| `task.py` | The Inspect task. Copies the working tree (tracked plus untracked, non-ignored files) to `/opt/repo` and the fixture repository to `/work/repo`, installs the plugin from `/opt/repo` at project scope, then runs the inspect_swe Claude Code agent (`version="sandbox"`, `debug=True`) through Inspect's sandbox agent bridge. Keeps the raw stream-json transcript and scores it with `probe.py`. |
| `probe.py` | Pure functions over the transcript: `analyse(lines)` (Claude Code version, plugin loaded and its path, Workflow tool offered, skill loaded, each Workflow launch with run id and notified status, cost, wall clock, tokens) and `recommend(findings, live)` (build ticket 08, stop, or wait for the live run; epochs that fit $75 over three scenarios). |
| `sandbox/Dockerfile`, `compose.yaml` | Node 22 with `@anthropic-ai/claude-code` 2.1.332 installed globally; 4 CPUs, 8 GB, no network at run time. |
| `fixture/` | `repo/` (a one-function Python module) and `task.md`, the live session's prompt: one `single` dispatch. |
| `saved/` | Transcripts the tests read: `mock-pass.jsonl` (plugin loaded, skill loaded, Workflow launched and completed) and `mock-plugin-dropped.jsonl` (user-scope install wiped by inspect_swe, no plugin). |
| `requirements.txt` | Host pins. `agent-client-protocol` is held below 1.1: inspect_swe 0.3.2 does not import against 1.1.0. |

Tests: `python -m unittest discover -s graph-orchestrator/evals/tests -t graph-orchestrator/evals -p test_session_spike.py`.

## Setup (host)

```sh
uv venv .venv && VIRTUAL_ENV=.venv uv pip install -r graph-orchestrator/evals/spike/session/requirements.txt
# Behind a TLS-intercepting proxy, copy its CA to sandbox/ca.crt (git-ignored) and build first:
docker build --network host --build-arg HTTPS_PROXY="$HTTPS_PROXY" -t session-evals-spike:local graph-orchestrator/evals/spike/session/sandbox
```

## Free mock run

mockllm stands in for the model. It loads the orchestrator skill, launches a tiny Workflow script, then answers. That checks the plugin install, the skill load, the Workflow launch and its completion notice, with no model.

```sh
env -u ANTHROPIC_BASE_URL inspect eval graph-orchestrator/evals/spike/session/task.py@session_spike \
  -T mode=mock --log-dir graph-orchestrator/evals/spike/session/logs
```

## Paid live run (needs the API key and workspace key, as in `../README.md`)

```sh
export ANTHROPIC_CUSTOM_HEADERS="anthropic-workspace-id: $ANTHROPIC_WORKSPACE_KEY"
env -u ANTHROPIC_BASE_URL inspect eval graph-orchestrator/evals/spike/session/task.py@session_spike \
  -T mode=live --model anthropic/claude-opus-5-5 -T cost_limit=10 \
  --log-dir graph-orchestrator/evals/spike/session/logs
inspect view --log-dir graph-orchestrator/evals/spike/session/logs
```

The score explanation holds the findings and the recommendation. `cost_usd` is Claude Code's own list-price total for the session (`total_cost_usd` on its last result line); cross-check it against the model usage Inspect records in the log, priced by `task.py`. `duration_ms` sums Claude Code's turns; the sample's total time in the log is the wall clock including sandbox setup (183 s for the mock run, almost all of it setup).
