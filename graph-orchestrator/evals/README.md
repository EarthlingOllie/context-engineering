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

`run.py` runs the Inspect task `dispatch_suite.py@dispatch_suite`, then reads its log and writes `out/scorecards/<plugin commit>-<UTC time>.json` and `.md`. It refuses to run if the installed `inspect_ai` differs from the pin, or if `ANTHROPIC_BASE_URL` is set for a paid run.

## Run parameters

What a run may spend and what hardware it simulates. Defaults are in `suite.py` (spec: Baseline and runs); each can be overridden on the command line.

| Option | Default | What it controls |
|---|---|---|
| `--epochs` | `3` | how many times each sample runs; one scorecard row per sample and epoch |
| `--cost-limit` | `30` | dollars per sample (Inspect `cost_limit`), priced from `suite.PRICES`; the `--stub` model is priced at zero so the limit is set there too |
| `--time-limit` | `1800` | wall-clock seconds per sample (Inspect `time_limit`, 30 minutes) |
| `--cap` | `2` | concurrency cap: the most agents the harness runs at once, across every `parallel()` call and nesting level; extra agents queue and their queue time is recorded |
| `--cpus` | `4` | CPUs given to the sandbox container (compose `cpus`) |
| `--memory` | `8g` | memory given to the sandbox container (compose `mem_limit`) |

Every sample runs under both limits. A sample that exceeds its cost or time limit is stopped by Inspect, and its scorecard row has `limit_hit` set to `cost` or `time`, with `outcome_correct` and `status_truthful` left empty (`limit-hit (cost)` in the Markdown): it is not scored, so it never counts as a failure of the plugin. The cap, CPU count, memory and both limits are recorded in the scorecard header.

Other options: `--stub` (canned engine, mockllm, no model call), `--samples <ids>`, `--log-dir`, `--out-dir`, and `--from-log <file>` to rebuild a scorecard from a saved log without running.

Raw Inspect logs go to `logs/` and generated files to `out/`; both are git-ignored, because logs hold full transcripts. Baseline scorecards, when frozen, are committed under `baselines/`.

## Scorecard

Header: `plugin_commit` (with `-dirty` if the plugin or skills have uncommitted changes), `engine_version`, `inspect_version`, `model`, `concurrency_cap`, `cpus`, `memory`, `epochs`, `cost_limit`, `time_limit`, plus `stub`, `created_at` and the log file name.

One row per sample and epoch:

| Field | Meaning |
|---|---|
| `outcome_correct` | the hidden check passed; for a research sample, every planted fact is stated on one line with its source file named, in the returned result or a file the agents wrote under `/work/scratch` |
| `missing_facts` | the planted facts not found |
| `status_truthful` | `reported_status` equals `expected_status` |
| `limit_hit` | `cost` or `time` when Inspect stopped the sample at a limit (then not scored); empty otherwise |
| `dollars` | Inspect's `total_cost` summed over models, from the prices the task supplies; empty if a model that ran has no price |
| `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens` | from Inspect's per-model usage |
| `cache_write_share` | cache-write tokens / (uncached input + cache write + cache read) |
| `agents` | agent() calls the dispatch made, scribe included |
| `wall_clock_s` | the harness's own clock, from loading the bundle to the dispatch's return |
| `models`, `on_pinned_model` | the models that served the sample, and whether all are the pinned model |
| `hidden_check_absent` | no hidden-check file was in the sandbox before the agents ran |

## Compare

```sh
python3 graph-orchestrator/evals/compare.py <baseline.json> <fix.json> [--force]
```

Prints one line per sample and metric: the baseline value, the fix value, the difference, the noise band and whether the move is `noise` or `MOVED`. Cost, time, tokens and agents compare the per-sample mean over epochs. The band is 10% of the baseline value, or, when the baseline has more than one epoch, the baseline's measured spread (max minus min over its epochs) for that sample; a difference no larger than the band is noise. Outcome correctness, false passes (a row's `false_pass`, else `done` reported while the hidden check failed) and status truthfulness compare as counts over epochs (`2/3` against `3/3`), never averaged, and any change in a count is shown. It refuses, exit 2, to compare scorecards whose `engine_version`, `inspect_version` or `model` differ, unless given `--force`. Tested in `tests/test_compare.py` with the hand-written scorecards in `tests/saved/scorecards/`.

## Pins

`suite.py` pins the model (`claude-opus-5-5`, every role), Inspect (`inspect_ai==0.3.292`, also in `requirements.txt`) and the engine (`@anthropic-ai/claude-agent-sdk` 0.3.332 = Claude Code 2.1.332, also in `sandbox/package.json`). `tests/test_suite.py` checks they agree. Prices per model are in `suite.py` and are registered with Inspect's `set_model_cost`; Inspect ships none. Opus, Sonnet and Haiku are all declared to the bridge, so a role that requests one is served by it.

## Layout

| Path | What it is |
|---|---|
| `run.py` | the one command: runs the suite and writes the scorecard |
| `compare.py` | compares two scorecards per sample and metric, marking noise |
| `dispatch_suite.py` | the Inspect task, its solver (sandbox set-up, bridge, harness) and scorers |
| `scoring.py` | the scorers and scorecard, as pure functions over a recorded sample |
| `suite.py` | pins, prices, run-parameter defaults, the sandbox copy rule |
| `samples/` | one JSON file per sample: dispatch args, fixture, expected status |
| `fixtures/<name>/sandbox/` | copied to `/work/` in the sandbox |
| `fixtures/<name>/hidden/` | the hidden check; read by the scorer on the host, never copied into the sandbox |
| `harness/` | the Node harness: loads the built `workflows/dispatch.js` the way the Workflow harness does and supplies a real `Runtime` (`runtime.ts`), with the Agent SDK as its engine (`sdk-engine.ts`); copied into the sandbox at run time |
| `sandbox/` | the sandbox image (Node 22, the pinned Agent SDK); `run.py` writes its compose file to `out/` with the run's CPU count and memory |
| `tests/` | scorer tests over saved samples in `tests/saved/`; run-parameter tests (`test_run_parameters.py`) |
| `spike/` | ticket 01's throwaway spike |

The harness changes nothing in the plugin: the bundle is read as text and run with `agent`, `parallel` and `log` as globals.

## Tests (no model call)

```sh
cd graph-orchestrator && npm run check                                                  # includes harness/*.test.ts: the real Runtime with a stub engine
python3 -m unittest discover -s graph-orchestrator/evals/tests -t graph-orchestrator/evals  # scorers and run parameters; the Task tests need inspect_ai (use the venv's python), else they skip
```

Not unit-tested: the Inspect task, fixtures and sandbox configuration; the `--stub` dry run and the paid runs exercise them.
