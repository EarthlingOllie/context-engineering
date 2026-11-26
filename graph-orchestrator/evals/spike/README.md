# Dispatch evals spike (ticket 01)

Throwaway code for the go/no-go spike in `docs/specs/dispatch-evals/spec.md`: sample 1 (a `single` dispatch over a small document set) run end to end, with Inspect's Docker sandbox, a Node harness that runs the shipped `workflows/dispatch.js` on the Claude Agent SDK, and every model call going through Inspect's sandbox agent bridge.

| File | What it is |
|---|---|
| `auth_probe.py` | Condition 6, tested first: does Inspect's Anthropic provider send the API key plus the workspace key? `--dry-run` is free (mock transport); `--live` makes one tiny Haiku call. |
| `task.py` | The Inspect task: copies the bundle, this repo's `skills/` plugin and the fixture into the sandbox, opens the bridge with Opus, Sonnet and Haiku declared as aliases, runs the harness, records evidence. |
| `sandbox/harness.mjs` | Loads the bundle the way the Workflow harness does and supplies a real `Runtime` (`agent` = one Agent SDK `query()`, `parallel` with a cap and queue times, `log`). Writes `result.json`. `--stub` runs with canned answers and no model. |
| `sandbox/Dockerfile`, `compose.yaml` | Sandbox image (Node 22, `@anthropic-ai/claude-agent-sdk` 0.3.332 = Claude Code 2.1.332), 4 CPUs, 8 GB, no network at run time. |
| `fixture/` | Three docs with six planted facts, and the dispatch args for `w1-d1`. |

## Setup (host)

```sh
uv venv .venv && VIRTUAL_ENV=.venv uv pip install -r graph-orchestrator/evals/spike/requirements.txt
# Docker Hub may rate-limit anonymous pulls; the Dockerfile uses mirror.gcr.io.
# Behind a TLS-intercepting proxy, copy its CA to sandbox/ca.crt (git-ignored) and build first:
docker build --network host --build-arg HTTPS_PROXY="$HTTPS_PROXY" -t dispatch-evals-spike:local graph-orchestrator/evals/spike/sandbox
```

## Free dry runs

```sh
python graph-orchestrator/evals/spike/auth_probe.py --dry-run
env -u ANTHROPIC_BASE_URL inspect eval graph-orchestrator/evals/spike/task.py@spike -T stub=true --model mockllm/model
```

## Paid run (needs both keys; unset any session-level `ANTHROPIC_BASE_URL`)

```sh
python graph-orchestrator/evals/spike/auth_probe.py --live --route env      # condition 6
export ANTHROPIC_CUSTOM_HEADERS="anthropic-workspace-id: $ANTHROPIC_WORKSPACE_KEY"   # or the header the probe proved
env -u ANTHROPIC_BASE_URL inspect eval graph-orchestrator/evals/spike/task.py@spike \
  --model anthropic/claude-opus-5-5 --log-dir graph-orchestrator/evals/spike/logs -T cost_limit=5
inspect view --log-dir graph-orchestrator/evals/spike/logs
```

Where each condition's evidence is:

1. Docker: the eval starts at all (`docker info`, sandbox up).
2. Agent SDK through the bridge: model events in the Inspect log for every agent in `result.json`.
3. Alias routing: the `Probe: claude-haiku-5-5` call is served by Haiku in the log; `Probe: claude-undeclared-spike` falls back to Opus.
4. Cache tokens: per model event, `usage.input_tokens_cache_read` / `input_tokens_cache_write`.
5. Skill loads: `skillsInvoked` and the init message's skill list in `result.json` for the worker (`root-cause-analysis`, from `skills/`).
6. Auth: `auth_probe.py --live`, then the eval itself.

The dispatch returning `done` with `/work/scratch/trace/w1-d1.jsonl` written scores 1; the score explanation holds cost inputs, token split and wall clock.
