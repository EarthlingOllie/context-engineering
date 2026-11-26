# Dispatch evals

Each sample is one **dispatch eval**: a fixed dispatch spec handed to the shipped plugin, run by real agents (the Claude Code engine) in a Docker sandbox, and scored against a hidden check the agents never see. One run writes one scorecard. Spec: `docs/specs/dispatch-evals/spec.md`.

## Run

```sh
# once, on the host (Python 3.11+, Docker):
uv venv .venv && VIRTUAL_ENV=.venv uv pip install -r graph-orchestrator/evals/requirements.txt
# Behind a TLS-intercepting proxy, copy its CA to graph-orchestrator/evals/sandbox/ca.crt (git-ignored).

# the suite, every role on claude-opus-5-5, 3 epochs, then the scorecard (paid; needs the API key in the environment):
env -u ANTHROPIC_BASE_URL .venv/bin/python graph-orchestrator/evals/run.py

# free dry run: canned engine, mockllm, no model call
.venv/bin/python graph-orchestrator/evals/run.py --stub --epochs 1
```

`run.py` runs the Inspect task `dispatch_suite.py@dispatch_suite`, then reads its log and writes `out/scorecards/<plugin commit>-<UTC time>.json` and `.md`. Options: `--epochs`, `--cap` (concurrency cap, default 2), `--cpus` (4), `--memory` (8g), `--samples <ids>`, `--cost-limit`, `--time-limit`, `--log-dir`, `--out-dir`, and `--from-log <file>` to rebuild a scorecard from a saved log without running. It refuses to run if the installed `inspect_ai` differs from the pin, or if `ANTHROPIC_BASE_URL` is set for a paid run.

Raw Inspect logs go to `logs/` and generated files to `out/`; both are git-ignored, because logs hold full transcripts. Baseline scorecards, when frozen, are committed under `baselines/`.

## Scorecard

Header: `plugin_commit` (with `-dirty` if the plugin or skills have uncommitted changes), `engine_version`, `inspect_version`, `model`, `concurrency_cap`, `cpus`, `memory`, `epochs`, plus `stub`, `created_at` and the log file name.

One row per sample and epoch:

| Field | Meaning |
|---|---|
| `outcome_correct` | the hidden check passed; for a research sample, every planted fact is stated on one line with its source file named, in the returned result or a file the agents wrote under `/work/scratch` |
| `missing_facts` | the planted facts not found |
| `status_truthful` | `reported_status` equals `expected_status` |
| `dollars` | Inspect's `total_cost` summed over models, from the prices the task supplies; empty if a model that ran has no price |
| `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens` | from Inspect's per-model usage |
| `cache_write_share` | cache-write tokens / (uncached input + cache write + cache read) |
| `agents` | agent() calls the dispatch made, scribe included |
| `wall_clock_s` | the harness's own clock, from loading the bundle to the dispatch's return |
| `models`, `on_pinned_model` | the models that served the sample, and whether all are the pinned model |
| `hidden_check_absent` | no hidden-check file was in the sandbox before the agents ran |

## Pins

`suite.py` pins the model (`claude-opus-5-5`, every role), Inspect (`inspect_ai==0.3.292`, also in `requirements.txt`) and the engine (`@anthropic-ai/claude-agent-sdk` 0.3.332 = Claude Code 2.1.332, also in `sandbox/package.json`). `tests/test_suite.py` checks they agree. Prices per model are in `suite.py` and are registered with Inspect's `set_model_cost`; Inspect ships none. Opus, Sonnet and Haiku are all declared to the bridge, so a role that requests one is served by it.

## Layout

| Path | What it is |
|---|---|
| `run.py` | the one command: runs the suite and writes the scorecard |
| `dispatch_suite.py` | the Inspect task, its solver (sandbox set-up, bridge, harness) and scorers |
| `scoring.py` | the scorers and scorecard, as pure functions over a recorded sample |
| `suite.py` | pins, prices, run-parameter defaults, the sandbox copy rule |
| `samples/` | one JSON file per sample: dispatch args, fixture, expected status |
| `fixtures/<name>/sandbox/` | copied to `/work/` in the sandbox |
| `fixtures/<name>/hidden/` | the hidden check; read by the scorer on the host, never copied into the sandbox |
| `harness/` | the Node harness: loads the built `workflows/dispatch.js` the way the Workflow harness does and supplies a real `Runtime` (`runtime.ts`), with the Agent SDK as its engine (`sdk-engine.ts`); copied into the sandbox at run time |
| `sandbox/` | the sandbox image (Node 22, the pinned Agent SDK); `run.py` writes its compose file to `out/` with the run's CPU count and memory |
| `tests/` | scorer tests over saved samples in `tests/saved/` |
| `spike/` | ticket 01's throwaway spike |

The harness changes nothing in the plugin: the bundle is read as text and run with `agent`, `parallel` and `log` as globals.

## Tests (no model call)

```sh
cd graph-orchestrator && npm run check                                                  # includes harness/*.test.ts: the real Runtime with a stub engine
python3 -m unittest discover -s graph-orchestrator/evals/tests -t graph-orchestrator/evals  # scorers over saved samples
```

Not unit-tested: the Inspect task, fixtures and sandbox configuration; the `--stub` dry run and the paid runs exercise them.
