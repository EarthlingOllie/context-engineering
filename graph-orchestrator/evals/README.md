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

Other options: `--baseline` and `--cut-to-one-epoch` (see Baseline), `--role-model ROLE=MODEL` (see Model routing), `--stub` (canned engine, mockllm, no model call) with `--stub-delay-ms`, `--stub-evaluator pass|fail` and `--stub-serve-model MODEL`, `--samples <ids>`, `--log-dir`, `--out-dir`, and `--from-log <file>...` to rebuild a scorecard from saved logs (one run's) without running.

Raw Inspect logs go to `logs/` and generated files to `out/`; both are git-ignored, because logs hold full transcripts. Baseline scorecards, when frozen, are committed under `baselines/`.

## Scorecard

Header: `plugin_commit` (with `-dirty` if the plugin or skills have uncommitted changes), `engine_version`, `inspect_version`, `model`, `concurrency_cap`, `cpus`, `memory`, `epochs`, `cost_limit`, `time_limit`, plus `stub`, `role_models` (roles forced onto another model; `{}` in the baseline), the other pins (`sdk_version`, `claude_code_version`, `pytest_version`), `created_at` and the log file name. A run made with `--cut-to-one-epoch` also has `epochs_by_sample` (the samples run at another epoch count) and `logs` (both log files).

Besides the rows, the card holds:

- `spread`: per sample, the run-to-run spread over its epochs. For each measured metric (`dollars`, `wall_clock_s`, `queue_s`, the four token counts, `cache_write_share`, `agents`) its `min`, `max`, `spread` (max minus min, the noise band `compare.py` uses) and `n` (epochs with a value); `outcome_correct`, `status_truthful` and `false_pass` as counts over the scored epochs (`4/5`); and `limit_hits`. The Markdown scorecard shows it as a "Run-to-run spread" table.
- `run_cost`: what the whole run actually cost (`dollars`, the sum over rows; unknown if any row is unpriced) and how long it took (`duration_s`, from Inspect's start and end times), against the routine `budget` (`suite.ROUTINE_BUDGET`, $30), with `over_budget` and, when over, `cut_to_one_epoch`: the samples to run at 1 epoch (see Baseline).

One row per sample and epoch:

| Field | Meaning |
|---|---|
| `outcome_correct` | the sample's hidden check passed (see Samples) |
| `missing_facts` | what the hidden check found missing: planted facts not found, or why a blocked, over-budget, hidden-tests, exhausted or chain-stop check failed (`hidden tests: 27 failed, 18 passed (exit 1)`) |
| `status_truthful` | `reported_status` equals `expected_status` |
| `false_pass` | the dispatch returned `done` while its hidden check failed (QUA-01); empty when the row is limit-hit |
| `limit_hit` | `cost` or `time` when Inspect stopped the sample at a limit (then not scored); empty otherwise |
| `dollars` | Inspect's `total_cost` summed over models, from the prices the task supplies; empty if a model that ran has no price |
| `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens` | from Inspect's per-model usage |
| `cache_write_share` | cache-write tokens / (uncached input + cache write + cache read) |
| `agents` | agent() calls the dispatch's topology made, the scribe not counted (the catalog's demand formula does not count it either) |
| `demand` | the catalog's demand formula for the sample's dispatch spec, with the catalog's defaults (`suite.catalog_demand`; `skills/graph-orchestrator/catalog.md`, "Demand" per topology): an upper bound for the topologies that stop early, exact for a debate; 0 for a spec past a cap. Set `agents` against it |
| `scribe` | whether the scribe ran to write the dispatch's trace lines; it runs even for an `over_budget` dispatch |
| `wall_clock_s` | the harness's own clock, from loading the bundle to the dispatch's return |
| `queue_s` | seconds agents spent waiting for a slot under the concurrency cap, summed over agents |
| `peak_concurrency` | the most agents that ran at once, from their start and end times; never above `concurrency_cap` |
| `models`, `on_pinned_model` | the models that served the sample, and whether all are the pinned model |
| `hidden_check_absent` | no hidden-check file was in the sandbox before the agents ran |
| `models_by_role`, `misrouted`, `routing_ok` | per role, the models its agents were requested on and the models that served their calls (each call's model in the engine record, else the engine's per-model usage); every agent with a call served by another model than it requested; and whether there was none. A misrouted call fails the sample: `outcome_correct` is false and `missing_facts` names the agent, whatever the hidden check said (not counted as a false pass). The Markdown scorecard shows it as a "Model routing" table |
| `by_role` | per role (`generator`, `evaluator`, `worker`, `partition`, `reducer`, `judge`, `debater`, `scribe`): agents, dollars and input / output / cache-read / cache-write tokens. The role is read from the agent's label; tokens from its engine record (the SDK's per-model usage); dollars are those tokens at `suite.PRICES`, the prices Inspect gets, not the engine's own estimate. Empty dollars for a role served by an unpriced model. The Markdown scorecard shows it as a "Cost by role" table |

The card also holds `false_passes`: per sample, its false passes over its scored epochs (limit-hit rows are not scored), and the suite total. The Markdown scorecard has a `false pass` column per row and a "False passes" table, one line per sample (`2 of 3`) and a `suite total` line.

## Samples

Fifteen samples; every topology in the plugin's catalog has at least one. The target is the finding the sample measures (spec: Samples).

| Sample | Topology | Fixture | Expected | Target | Hidden check |
|---|---|---|---|---|---|
| `01-single-docs` | single | docs | done | cost floor per dispatch (COST-02) | every planted fact stated with its file cited, in the result or a file under `/work/scratch` |
| `02-single-blocked` | single | blocked | blocked | status truthfulness (REL-05) | `blocked`, with a question about the cut-off, and `config/settlement.toml` unchanged: the value exists only outside the sandbox, so a guess fails |
| `03-generator-evaluator-python` | generator-evaluator, 3 rounds | python | done | the core loop | the fixture's hidden tests (`hidden/test_duration_strict.py`, every rule of `docs/FEATURE.md`) all pass; the visible tests cover rule 1 only |
| `04-generator-evaluator-false-pass` | generator-evaluator, 3 rounds, vague pass criteria ("The relevant tests pass.") | typescript | done | false passes (QUA-01) | the fixture's hidden test (`hidden/paginate.hidden.test.ts`) passes; it catches a planted bug the visible tests miss, so `done` with it failing is a false pass |
| `05-generator-evaluator-exhausted` | generator-evaluator, 2 rounds, contradictory pass criteria | python | exhausted | status truthfulness | `exhausted` after both rounds (`iterations` 2) |
| `06-fan-out-reducer-docs` | fan-out, explicit list of 3, reducer | docs | done | reducer output (QUA-05) | the planted facts in the returned result only, which is the reducer's |
| `07-fan-out-partition-docs` | fan-out, partitioned into 6 | docs | done | queueing under the cap (SPD-04) | the planted facts; the row's `queue_s`, `wall_clock_s` and `peak_concurrency` show the queueing under the cap |
| `08-chain-single-then-ge-python` | chain: single (plan the tests), then generator-evaluator (build it) | python | done | the 64% spend pattern | the hidden tests, as sample 3 |
| `09-chain-stage-2-fails` | chain of 3: single, generator-evaluator with contradictory criteria and 1 round, single | python | exhausted | lost stages (REL-04) | stopped at stage 2: `stages` ends with `<id>-s2:exhausted`, the result begins `stage <id>-s2 exhausted`, and no `Link 3` agent ran |
| `10-iterative-fan-out-docs-gap` | iterative fan-out, explicit list of 2, at most 2 rounds | docs-gap | done | the coverage loop | `kind: coverage`: `done` after exactly 2 rounds, and every planted fact, the runbook's included, in the returned (reducer's) result. Round 1 covers `payouts.md` and `chargebacks.md`; `payouts.md` refers to `runbooks/payout-failures.md`, which no round-1 sub-task names, so the gap shows only after round 1 |
| `11-panel-diff-defect` | panel, 3 lenses (correctness, security, readability), no reducer, `maxLines` 4 | typescript | done | verdict truncation | `kind: verdict`: the result's first line is `FAIL` and a `[security] FAIL` line names the lens the planted defect belongs to; `PASS` is a false pass, and a lens line cut by the line limit does not count |
| `12-best-of-n-python-bug` | best-of-n, 3 variants, judge (`mode: select`) | python-bug | done | the judge | `kind: chosen_tests`: the hidden tests (`hidden/test_allocate_strict.py`) pass on the candidate the judge chose, laid over the fixture as shipped; a fix that only one candidate got right counts only if the judge picked it |
| `13-debate-design` | debate, 2 participants (postgres, redis), 2 rounds, judge | design | done | cost with no early stop | `kind: contract_verdict`: `done` with exactly one option (`postgres` or `redis`) on line 1, within the contract's 2 lines. Every round runs, so the row's `agents` should equal its `demand`, 2 × 2 + 1 = 5, and its `dollars` and `by_role` show what the full debate cost |
| `14-relay-python-features` | relay, at most 3 sessions, check every session | python | done | the hand-over file | `kind: relay`: `done` within 3 sessions, every worker session rewrote the progress file `/work/scratch/progress.md` (its hash changed across the session), and the hidden tests pass, as sample 3 |
| `15-fan-out-over-budget` | fan-out, explicit list of 10 | docs | over_budget | cap enforcement | `over_budget` with no dispatch agent run; the row shows 0 agents and, in a dry run, $0. In a paid run the scribe still runs, so `dollars` holds its cost alone; `by_role` shows it under `scribe` |

A sample's hidden check comes from its fixture (`hidden/planted_facts.json`, `hidden/expected_block.json` for the blocked fixture, `hidden/check.json` for the Python, TypeScript, python-bug and design fixtures), refined or replaced by the sample's own `check` (`source: result` scores the returned result only; `kind: over_budget`, `exhausted`, `chain_stop`, `verdict` or `contract_verdict` checks the dispatch's return; `coverage` adds the round count to the planted facts; `chosen_tests` and `relay` also run the fixture's hidden tests). See `suite.hidden_check`. The scorer tests cover each kind over saved samples: `tests/saved/blocked-task`, `over-budget`, `exhausted`, `chain-stage-2-stopped`, `hidden-tests-pass`, `hidden-tests-fail`, `ts-false-pass` (sample 4's false pass), `panel-fail-security` and `panel-pass` (sample 11 correct, and its false pass), `coverage-round-2` and `coverage-round-1` (sample 10 correct, and done in 1 round), `best-of-n-chosen` (sample 12), `debate-verdict` (sample 13), `relay-done` and `relay-exhausted` (sample 14) among them (each new one has a `NOTE.md` saying how it was made).

The docs-gap fixture (`fixtures/docs-gap/`) is three short Markdown files: `docs/payouts.md`, `docs/chargebacks.md` and `docs/runbooks/payout-failures.md`, which only `payouts.md` refers to. Sample 10's workers read only the file their sub-task names and list what it refers to; its evaluator turns each referred-to document no branch covered into a round-2 sub-task. Its six planted facts (`hidden/planted_facts.json`) include two from the runbook.

The python-bug fixture (`fixtures/python-bug/`) is a package, `feekit`, whose `allocate(total_cents, weights)` splits a fee by weight; its docstring is the contract and `docs/BUG-431.md` the bug report. The planted bug: each share is rounded on its own, so the shares need not add up to the total; the visible tests use only totals that divide evenly. Sample 12's attempts each write a fixed copy of the files they change under their candidate dir (`/work/scratch/<id>-c<i>/`, at their path relative to `/work`) and leave `/work` alone. After the dispatch, the solver reads the chosen candidate from the judge (its `chosen` index, kept on its agent record, else the first `[i]` in the verdict: `scoring.chosen_candidate`), lays that candidate's files over the fixture as shipped in `/tmp/chosen` (`suite.chosen_candidate_tree`), runs the hidden tests there and records the candidate with the run. `fixtures/python-bug/reference/` (host only) holds a fix; `tests/test_python_bug_fixture.py` checks the shipped code passes the visible tests and fails the hidden ones, and the fix, laid over as a chosen candidate, passes both.

The design fixture (`fixtures/design/`) is one design question, `docs/DQ-07-idempotency-store.md`: where the payments API's idempotency keys live, with both options and their constraints. It has no right answer the scorer knows; sample 13 is scored only on returning a verdict in its contract.

Sample 14 runs on the Python fixture, its feature list the 7 rules of `docs/FEATURE.md`. The harness is given the relay's progress file to watch (`--watch`, from the check: `suite.harness_command(watch=...)`); it hashes the file before and after every agent and keeps both on the agent's record (`watched`), so the scorer can tell which sessions rewrote it.

The Python fixture (`fixtures/python/`) is a small package, `retrykit`, with pytest, a feature to build (`parse_duration`, specified in `docs/FEATURE.md`) and visible tests for its first rule only. Its hidden tests stay on the host while the agents run; after the dispatch returns and its files are recorded, the solver copies them to `/work/hidden_check/` and runs `python3 -m pytest -q -p no:cacheprovider hidden_check` from `/work`, and the scorer reads that run. `fixtures/python/reference/` (host only) holds a naive and a full implementation; `tests/test_python_fixture.py` checks the naive one passes the visible tests and fails the hidden ones, and the full one passes both.

The TypeScript fixture (`fixtures/typescript/`) is a small library, `pagekit`, whose tests run with Node's test runner (`npm test`, no install step). Its planted bug: `pageCount` rounds where it must round up, so a last page holding less than half a page is dropped; the visible tests only use totals that round the right way. After the dispatch the solver copies `hidden/paginate.hidden.test.ts` to `/work/hidden_check/` and runs it with `node --test --test-reporter=tap` (the check's `runner: node`; `suite.hidden_tests_cmd`), and the scorer reads the TAP summary. The fixture also ships `review/0001-log-page-requests.diff`, the change sample 11's panel reviews: it adds request logging that writes the request headers, bearer token included. `fixtures/typescript/reference/` (host only) holds the one-line fix and describes both defects; `tests/test_typescript_fixture.py` checks the shipped code passes the visible tests and fails the hidden one, the fix passes both, and the diff applies.

Generator roles name the `test-driven-development` skill and evaluator roles `code-review` (`tests/test_suite.py` checks every sample, chain stages included). Both are in this repo's skills plugin (`skills/`), which the solver copies into the sandbox at the commit under test and the engine loads as a local plugin.

With `--stub`, the canned engine never blocks, so sample 2 reports `done` and is scored untruthful: that is the scorer working. The canned judge picks candidate `[1]` and a canned relay worker adds a `SESSION s: stub` line to the progress file, so in a dry run sample 12's hidden tests run on candidate 1 (which wrote nothing, so they fail: a false pass), sample 13's verdict names no option, and sample 14's progress file is rewritten every session but its hidden tests fail. Sample 10 ends `done` after round 1 with the evaluator passing (scored not correct: one round, facts missing), and `exhausted` after round 2 with `--stub-evaluator fail`. `--stub-delay-ms <n>` makes each canned answer take `n` ms, so a dry run shows queue time under the cap. The canned evaluator passes; `--stub-evaluator fail` makes it fail, so samples 5 and 9 reach `exhausted` and sample 11's panel returns `FAIL` in a dry run (with the canned evaluator passing, sample 11 returns `PASS` and is scored a false pass). In a dry run nothing builds `parse_duration`, so samples 3 and 8 report `done` and their hidden tests fail, and nothing fixes the planted bug, so sample 4 is a false pass: again the scorer working.

## Baseline

The baseline is the plugin as shipped, every role on `claude-opus-5-5`, every sample at 5 epochs (`suite.BASELINE_EPOCHS`), frozen and committed under `baselines/`, keyed by plugin commit: `baselines/<plugin commit>.json` and `.md`. Every later run is compared against it.

Reproduce it (paid, one-off; it may exceed the routine budget), from a clean checkout of the plugin commit to freeze:

```sh
env -u ANTHROPIC_BASE_URL .venv/bin/python graph-orchestrator/evals/run.py --baseline
git add graph-orchestrator/evals/baselines/<plugin commit>.json graph-orchestrator/evals/baselines/<plugin commit>.md
```

Compare a new run against it:

```sh
env -u ANTHROPIC_BASE_URL .venv/bin/python graph-orchestrator/evals/run.py     # the routine run: 3 epochs, writes out/scorecards/<commit>-<time>.json
python3 graph-orchestrator/evals/compare.py graph-orchestrator/evals/baselines/<plugin commit>.json graph-orchestrator/evals/out/scorecards/<commit>-<time>.json
```

`--baseline` takes no `--stub`, `--role-model`, `--stub-serve-model`, `--samples`, `--epochs`, `--cut-to-one-epoch` or `--from-log`. It refuses to start if the plugin or the skills have uncommitted changes (`plugin_commit` ends in `-dirty`), and refuses to freeze, writing an ordinary scorecard to `out/scorecards/` instead, if the plugin commit changed during the run, the run did not finish, or a baseline for that commit is already frozen. So no plugin source changes between the plugin commit in the header and the run. `tests/test_baseline.py` checks every committed baseline: the full header (every pin), the frozen configuration, all 15 samples at epochs 1-5, the spread, a file named after its clean plugin commit, and no plugin source (`graph-orchestrator/` but `evals/`, and `skills/`) changed between that commit and the commit that added the file (`run.plugin_source_changes`).

The spread a baseline records is what `compare.py` uses as each sample's noise band from then on, in place of the 10% default.

**The routine budget.** A routine run (3 epochs) has a $30 budget (`suite.ROUTINE_BUDGET`) besides each sample's own limits; every scorecard records the run's actual cost and duration in `run_cost`. If the first routine run is over $30, debate, best-of-n and relay (`suite.CUT_TO_ONE_EPOCH`: samples 12, 13 and 14) are cut to 1 epoch before any sample is dropped: `run.py --cut-to-one-epoch` runs them as a second task at 1 epoch and the rest at `--epochs`, in one scorecard. The scorecard says when a run was over budget and names the command.

**Status:** not yet frozen. The baseline run and the first 3-epoch routine run need the API key and are paid; no baseline is committed and no run cost has been measured. When they are, this paragraph records the routine run's actual cost and duration (its `run_cost`), whether it was over $30, and so whether routine runs use `--cut-to-one-epoch`.

## Not measured by the suite

These findings belong to the harness or the platform, which a sandbox does not reproduce: the suite's harness loads the bundle itself, runs no Workflow tool, no claude.ai sync, no container restarts and no auto-mode classifier. A scorecard says nothing about them, so a fix to one is never shown as fixed by a run. Each is verified by hand in a cloud session (claude.ai/code, the plugin installed from the commit under test):

| Finding | What it is | How to verify by hand in a cloud session |
|---|---|---|
| REL-01 | the documented `scriptPath` launch of `workflows/dispatch.js` is refused ("scriptPath must be a script path this tool returned, or a file you can already read") | start the orchestrator on any small task and follow SKILL.md's launch as written; the first dispatch must launch without a refusal and without the orchestrator inventing a workaround (a SCRATCH copy, a wrapper, the registered workflow name) |
| REL-03 | a container or worker restart kills running dispatches, and resume is ad hoc | start a long dispatch (a generator-evaluator of 3 rounds), restart the session's container mid-run; the orchestrator must find the dispatch `stopped`, relaunch it with `resumeFromRunId` and the finished agents must replay from cache, not run again |
| REL-05 (notification half) | the task notification says "completed" for blocked, exhausted, failed and usage-limit runs | run a dispatch that ends `blocked` (sample 2's spec) and one that ends `exhausted` (sample 5's); read the notification and the workflow log: the real status must be visible outside the returned data (the scorecard's `status_truthful` measures only the returned status) |
| REL-07 | sessions run a stale synced plugin build | after a commit to the plugin, start a new session and run a dispatch; the version the run reports (its return, scribe line and trace header) must be that commit's, not an older synced build |
| REL-08 | subagent permission and classifier denials are absorbed silently or become unreviewed passes | in auto mode, run a generator-evaluator whose evaluator needs a tool that is denied (Bash under a policy that blocks it); the evaluator must fail the criterion and say which check could not run, never pass it |
| QUA-05 (harness half) | the harness refuses subagent `.md` report writes | run a fan-out with a reducer that is asked for a merged `.md` report; if the Write is refused, the full content must still reach the returned result (`ARTIFACT REFUSED: <path>` on line 1), not be lost |

## Concurrency sweep

On demand, and not part of the routine run or its budget: `run.py` never runs it, and it has its own command, log and output. It runs the two fan-out samples, `06-fan-out-reducer-docs` and `07-fan-out-partition-docs` (`suite.SWEEP_SAMPLES`), once per concurrency cap on one sandbox spec, and prints one table: per sample and cap, the wall clock, the queue time and the dollars.

```sh
env -u ANTHROPIC_BASE_URL .venv/bin/python graph-orchestrator/evals/sweep.py      # paid: caps 2, 4, 8 on 4 CPUs and 8g, 1 epoch
.venv/bin/python graph-orchestrator/evals/sweep.py --stub --stub-delay-ms 300      # free dry run: canned engine, mockllm
.venv/bin/python graph-orchestrator/evals/sweep.py --caps 2,4,8,16 --cpus 8 --memory 16g
```

| Option | Default | What it controls |
|---|---|---|
| `--caps` | `2,4,8` | the concurrency caps to run each sample at (`suite.DEFAULT_SWEEP_CAPS`) |
| `--cpus` | `4` | CPUs given to the sandbox container, the same for every cap |
| `--memory` | `8g` | memory given to the sandbox container, the same for every cap |
| `--epochs` | `1` | runs per sample and cap; the table shows their mean |
| `--cost-limit`, `--time-limit` | `30`, `1800` | per-run dollar and wall-clock limits, as in the suite |

Also `--stub`, `--stub-delay-ms`, `--log-dir`, `--out-dir` (default `out/sweeps/`) and `--from-log <file>`. `sweep.py` runs the Inspect task `dispatch_suite.py@concurrency_sweep`: each sample once per cap (`suite.sweep_samples`, ids such as `07-fan-out-partition-docs@cap4`), the harness run under that sample's cap. It writes `out/sweeps/<plugin commit>-<UTC time>.json` (header, table, `total_dollars` and every run's scorecard row) and `.md`, the table:

| sample | cap | wall clock s | queue s | $ | epochs |
|---|---|---|---|---|---|

`wall clock s`, `queue s` and `$` are the scorecard row's `wall_clock_s`, `queue_s` and `dollars`, each the mean over the cell's epochs (`-` if any is missing); the last line is the total dollars of the pass. The header records the caps, CPU count, memory, the pins and both limits. Tested in `tests/test_sweep.py`.

**Cost of one pass:** not yet measured. It needs a paid run (`sweep.py` with the defaults: 6 runs, 1 epoch), and the figure goes here from its `total_dollars`. The dry run costs nothing.

## Compare

```sh
python3 graph-orchestrator/evals/compare.py <baseline.json> <fix.json> [--force]
```

Prints one line per sample and metric: the baseline value, the fix value, the difference, the noise band and whether the move is `noise` or `MOVED`. Cost, time, tokens and agents compare the per-sample mean over epochs. The band is 10% of the baseline value, or, when the baseline has more than one epoch, the baseline's measured spread (max minus min over its epochs) for that sample; a difference no larger than the band is noise. Outcome correctness, false passes (a row's `false_pass`, else `done` reported while the hidden check failed) and status truthfulness compare as counts over epochs (`2/3` against `3/3`), never averaged, and any change in a count is shown. It refuses, exit 2, to compare scorecards whose `engine_version`, `inspect_version` or `model` differ, unless given `--force`. Tested in `tests/test_compare.py` with the hand-written scorecards in `tests/saved/scorecards/`.

## Pins

`suite.py` pins the model (`claude-opus-5-5`, every role), Inspect (`inspect_ai==0.3.292`, also in `requirements.txt`) and the engine (`@anthropic-ai/claude-agent-sdk` 0.3.332 = Claude Code 2.1.332, also in `sandbox/package.json`), and pytest (8.3.5, in `sandbox/requirements.txt`). `tests/test_suite.py` checks they agree. Prices per model are in `suite.py` and are registered with Inspect's `set_model_cost`; Inspect ships none. Opus, Sonnet and Haiku are all declared to the bridge, so a role that requests one is served by it.

## Model routing

The bridge serves only the model names declared to it and silently sends any other name to the main model, so `suite.DECLARED_MODELS` declares Opus, Sonnet and Haiku (each priced in `suite.PRICES`) and the scorer fails a sample when any call's serving model differs from the requested one (`scoring.model_routing`).

The baseline and routine runs force no role: every role is requested on `claude-opus-5-5`. To see the check work, force one role onto another declared model through the harness, without changing the plugin:

```sh
python graph-orchestrator/evals/run.py --role-model evaluator=claude-haiku-5-5 --samples 03-generator-evaluator-python   # paid
python graph-orchestrator/evals/run.py --stub --stub-evaluator fail --epochs 1 --samples 05-generator-evaluator-exhausted \
  --role-model evaluator=claude-haiku-5-5                                   # free: routed, correct
python graph-orchestrator/evals/run.py --stub --stub-evaluator fail --epochs 1 --samples 05-generator-evaluator-exhausted \
  --role-model evaluator=claude-haiku-5-5 --stub-serve-model claude-opus-5-5  # free: the stub serves on Opus, the sample fails on routing
```

`--role-model` takes a role from `suite.ROLES` (the plugin's label roles) and a declared model, and may be repeated. In the sandbox the SDK engine also pins Claude Code's small fast model to the requested model, so its background calls do not show up as misrouted.

## Layout

| Path | What it is |
|---|---|
| `run.py` | the one command: runs the suite and writes the scorecard |
| `compare.py` | compares two scorecards per sample and metric, marking noise |
| `baselines/` | frozen baseline scorecards, committed: `<plugin commit>.json` and `.md` (none yet) |
| `sweep.py` | on demand: the concurrency sweep, samples 6 and 7 at each cap, one table |
| `dispatch_suite.py` | the Inspect tasks (`dispatch_suite`, `concurrency_sweep`), their solver (sandbox set-up, bridge, harness) and scorers |
| `scoring.py` | the scorers and scorecard, as pure functions over a recorded sample |
| `suite.py` | pins, prices, run-parameter and sweep defaults, the sandbox copy rule |
| `samples/` | one JSON file per sample: dispatch args, fixture, expected status |
| `fixtures/<name>/sandbox/` | copied to `/work/` in the sandbox |
| `fixtures/<name>/hidden/` | the hidden check; read by the scorer on the host, never in the sandbox while the agents run (hidden tests are copied in only after the dispatch) |
| `harness/` | the Node harness: loads the built `workflows/dispatch.js` the way the Workflow harness does and supplies a real `Runtime` (`runtime.ts`), with the Agent SDK as its engine (`sdk-engine.ts`) or, for `--stub`, canned answers (`stub-engine.ts`); copied into the sandbox at run time |
| `sandbox/` | the sandbox image (Python 3.12 with pytest from `sandbox/requirements.txt`, Node 22 copied from the Node image, the pinned Agent SDK); `run.py` writes its compose file to `out/` with the run's CPU count and memory |
| `tests/` | scorer tests over saved samples in `tests/saved/`; run-parameter tests (`test_run_parameters.py`); spread, run cost, the budget cut, `--baseline` and committed baselines (`test_baseline.py`); the sweep (`test_sweep.py`); suite and sample tests, the catalog demand formula among them (`test_suite.py`); fixture tests (`test_python_fixture.py`, `test_typescript_fixture.py`, `test_python_bug_fixture.py`) |
| `spike/` | ticket 01's throwaway spike |

The harness changes nothing in the plugin: the bundle is read as text and run with `agent`, `parallel` and `log` as globals.

## Tests (no model call)

```sh
cd graph-orchestrator && npm run check                                                  # includes harness/*.test.ts: the real Runtime with a stub engine
python3 -m unittest discover -s graph-orchestrator/evals/tests -t graph-orchestrator/evals  # scorers and run parameters; the Task tests need inspect_ai (use the venv's python), else they skip
```

Not unit-tested: the Inspect task, fixtures and sandbox configuration; the `--stub` dry run and the paid runs exercise them.
