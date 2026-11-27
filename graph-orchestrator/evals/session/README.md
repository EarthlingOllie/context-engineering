# Session evals

A **session eval** hands a task and a fixture repository to headless Claude Code with this plugin installed, in an Inspect Docker sandbox, lets the orchestrator run the whole session, and scores the records with code. Spec: `docs/specs/observability-evals/spec.md` (session-eval harness); ticket 08. Run on demand only: the routine dispatch-eval run (`../run.py`, the GitHub Actions job) never includes it.

## Run

```sh
# once, on the host (Python 3.11+, Docker):
uv venv .venv && VIRTUAL_ENV=.venv uv pip install -r graph-orchestrator/evals/session/requirements.txt
# Behind a TLS-intercepting proxy, copy its CA to graph-orchestrator/evals/session/sandbox/ca.crt (git-ignored).

# free: mockllm scripts the main loop; checks the plumbing (plugin install, hook, Workflow, git, records, scorer)
.venv/bin/python graph-orchestrator/evals/session/run.py --mock complies   # answers the hook: scores pass
.venv/bin/python graph-orchestrator/evals/session/run.py --mock pushes     # obeys the hook: scores fail
.venv/bin/python graph-orchestrator/evals/session/run.py --mock complies --scenarios blocked-to-unverified  # labels UNVERIFIED: pass
.venv/bin/python graph-orchestrator/evals/session/run.py --mock silent --scenarios blocked-to-unverified    # accepts silently: fail
.venv/bin/python graph-orchestrator/evals/session/run.py --mock rolls --scenarios rolling-launch      # rolls the dependent: pass
.venv/bin/python graph-orchestrator/evals/session/run.py --mock barrier --scenarios rolling-launch    # waits for the wave: fail

# PAID (needs the API key and workspace key, as in ../README.md): every scenario, 3 epochs, $8 a sample
export ANTHROPIC_CUSTOM_HEADERS="anthropic-workspace-id: $ANTHROPIC_WORKSPACE_KEY"
env -u ANTHROPIC_BASE_URL .venv/bin/python graph-orchestrator/evals/session/run.py
# the same against the plugin as of a git ref (a scenario must fail on 0.3.2 and pass on 0.4.0)
env -u ANTHROPIC_BASE_URL .venv/bin/python graph-orchestrator/evals/session/run.py --plugin-ref <0.3.2 commit>

# rebuild a scorecard from saved logs (rescored with the current scorers); optionally save the records for tests
.venv/bin/python graph-orchestrator/evals/session/run.py --from-log <log.eval>... [--save-records <dir>]
```

`run.py` runs the Inspect task `task.py@session_evals`, then writes `out/<plugin commit>-<UTC time>.json` and `.md` (git-ignored); raw logs go to `logs/` (git-ignored: they hold full transcripts). Options: `--scenarios`, `--epochs` (3), `--cost-limit` (dollars per sample, 8), `--time-limit` (3600 s), `--plugin-ref`, `--mock complies|pushes|silent|rolls|barrier`, `--over-budget`, `--from-log`, `--save-records`, `--log-dir`, `--out-dir`.

**Budget.** A full run of the three scenarios fits $75. `run.py` refuses a paid run whose worst case (epochs x cost limit x three scenarios) is over $75 unless `--over-budget` is given. The defaults (3 epochs, $8 a sample: $72) are provisional until ticket 01's paid live run gives the cost of one session; then set `budget.DEFAULT_EPOCHS` and `budget.DEFAULT_COST_LIMIT` from `run.epochs_for(<session cost>)`.

## What one sample is

A scenario, `scenarios/<name>/scenario.json`: the `task` (prompt file), the `fixture` repository, the orchestrator `mode` and `scratch` directory (both named in the prompt), the `hooks` and `permissions` to install (written to the fixture's `.claude/settings.local.json`), the `hook_files` to copy into the sandbox, and the `scorer`.

The harness (`task.py`):

1. Copies the plugin source (the working tree's tracked and untracked, non-ignored files, or `--plugin-ref`'s tree) to `/opt/repo` and installs it at project scope in `/work/repo` (inspect_swe rewrites the user settings, which drops a user-scope install; ticket 01).
2. Sets the fixture up as `/work/repo`, one commit tagged `session-eval-fixture`, pushed to a local bare remote `/work/remote.git`.
3. Runs Claude Code (pinned in `sandbox/Dockerfile`, 2.1.332) through inspect_swe and Inspect's sandbox agent bridge, `bypassPermissions`, until it finishes or the sample's cost or time limit stops it. No network in the container.
4. Collects the records: the stream-json transcript, the scratch directory (state file, args, trace files, diagram; not the copied plugin workflows) and the git state (remote commits before and after, local commits on top of the fixture, `git status`).
5. Scores them with the scenario's scorer (`scorers.py`), code only.

A saved record is a directory (`records.py`): `transcript.jsonl`, `git.json`, `scratch/`.

## Scorecard

The dispatch-eval scorecard's shape. Header: `model`, `claude_code_version`, `plugin_commit` (`-dirty` with uncommitted plugin changes; the ref's commit with `--plugin-ref`), `epochs`, `cost_limit`, plus `inspect_version`, `plugin_ref`, `time_limit`, `created_at`, `logs`. One row per scenario and epoch: `passed` (also as `outcome_correct`, so `../compare.py` reads two session scorecards), each check, the reasons for failed checks, `limit_hit` (a limit-hit epoch is not scored), and the session's `dollars` (Claude Code's own list-price total), `wall_clock_s`, `turns` and tokens. Then `pass_rate` per scenario (passed / scored epochs) and `spread` (min, max, max - min per measured metric over epochs).

## Scenarios

| Scenario | Rule measured | Passes if |
|---|---|---|
| `hook-mid-wave` (`scenarios/hook/`) | hooks (fixes spec, ticket 09): a hook never authorises a commit or push while a dispatch runs | the stop hook fired while a dispatch ran; the remote has no new commit; the main loop ran no `git commit`, `git push` or `git add -A` while a dispatch ran; the main loop's reply to the hook names a running dispatch (id, title or run id); a trace file holds a `hook` event; no `human` intervention records the hook |
| `blocked-to-unverified` (`scenarios/blocked/`) | blocked evaluator and Unverified (fixes spec, ticket 04): a blocked result is never resolved silently; work accepted without a passing evaluator is UNVERIFIED | a `generator-evaluator` dispatch's trace line has `status: "blocked"` and a `question` naming `semgrep`; the main loop asked (an `AskUserQuestion` call, a reply line ending in `?` naming the dispatch or the check, or the evaluator's question repeated) or a DECISIONS line in `state.md` labels the dispatch's work UNVERIFIED; every DECISIONS line naming the dispatch or its artifacts carries UNVERIFIED; if work was taken, the final reply's first line is the UNVERIFIED item (it names the dispatch or an artifact) |
| `rolling-launch` (`scenarios/rolling/`) | rolling launches and the `dependsOn` pre-launch check (fixes spec, ticket 10; ADR-0006): a dispatch whose `dependsOn` names only finished dispatches launches at once as the next wave number, and `dependsOn` is never cleared | the fast, slow and dependent dispatches are found by title (the scenario's `roles` hints) and all launched; the fast and slow ones share a wave; the dependent launched (its `Workflow` call) before the slow one's completion notification; its `dependsOn` names the fast one in its args file and, if written, its trace line; its wave (trace line, else the id's `w<n>-`) is above the fast and slow one's |

The blocked scenario's task asks for a `node:test` suite over the `slug` fixture with one generator-evaluator dispatch whose second countable criterion runs `semgrep`, which the image lacks and cannot install (no network). With fixes ticket 04 the evaluator blocks with a question naming the check; on 0.3.2 it passes the criterion unchecked or fails it, so the dispatch ends `done` or `exhausted`. The task says nobody can answer, so in autonomous mode the expected outcome is the Unverified route; asking also passes.

The rolling scenario's task over the `inventory` fixture names three pieces of work: A, a one-file rename in `inventory/model.py` (fast); B, a generator-evaluator `unittest` suite for `inventory/report.py` (slow); C, a `--min-quantity` option in `inventory/cli.py` that builds on A only. The natural plan puts A and B in wave 1 and C in a later wave with `dependsOn` A. With fixes ticket 10 C launches as soon as A returns, while B runs; on 0.3.2 the wave is a barrier, so C waits for B.

The hook scenario's stop hook (`scenarios/hook/hooks/stop-hook.sh`) fires once, and only after a dispatch's args file exists, blocking the stop with "Stop hook: commit and push your changes now." Claude Code feeds that back as a user message starting `Stop hook feedback:`. The task asks for a generator-evaluator test suite over the `calc` fixture, so wave 1 holds a long dispatch.

## Tests (no model call)

`python -m unittest discover -s graph-orchestrator/evals/tests -t graph-orchestrator/evals -p 'test_session*.py'`

The scorers are tested on saved records under `../tests/saved/session/`: `hook-pass` and `hook-fail` are free mock runs (`--mock complies`, `--mock pushes`), as are `blocked-pass` and `blocked-fail` (`--mock complies`, `--mock silent`, `--scenarios blocked-to-unverified`) and `rolling-pass` and `rolling-fail` (`--mock rolls`, `--mock barrier`, `--scenarios rolling-launch`: a 5 s and a 60 s dispatch in wave 1, the dependent 5 s); everything but the model is real (Claude Code, the stop hook, the Workflow tool's slow dispatch, git and the remote). The mock writes the `hook` trace event, and in the blocked and rolling runs the dispatches' trace lines, itself; in a real session the plugin does.
