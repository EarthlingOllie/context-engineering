# Changelog

Each release maps to one spec under `docs/specs/`. Ticket numbers below refer to that spec's `tickets/` folder.

## Unreleased

Spec: `docs/specs/observability-evals/` (planned for 0.5.0).

- Real timestamps: the dispatch script no longer needs `now`. With none, it stamps placeholders for the dispatch's start (`at`) and end (new `ended`), and the agent that appends the trace lines (the scribe, or a `single`'s worker) replaces them with the clock's UTC time: the start from the launch's args file (GNU or BSD `date`, falling back to the end time), the end from the time of the write. A `now` still sent is used as the start. SKILL.md and the dispatch skill's description no longer pass `now` or say the orchestrator has no clock; the renderer ignores a placeholder left unreplaced (ticket 04).
- Refusal counts: the worker, generator, reducer and evaluator stances and schemas ask for `writesRefused` and `toolsDenied`; each agent's counts go on its entry in the dispatch line's `agents`, and their totals on the line as `writes_refused` and `tools_denied` (absent when no agent reported them), and are logged. A `single`'s worker fills its own into the line it writes from `{{WRITES_REFUSED}}` and `{{TOOLS_DENIED}}` placeholders. SKILL.md: while waiting on a human, CI or a restart, the state file holds one `WAITING: <cause> since <time>` line, removed when the wait ends (ticket 07).

## 0.4.0

Spec: `docs/specs/fixes/` (verification integrity, cost and orchestrator behaviour). Release ticket: 16.

Dispatch code and role prompts:

- Iterative fan-out: the evaluator's FINDINGS SO FAR shows each done branch's whole result, cut to the return contract's line limit, and its artifacts (ticket 02).
- Generator-evaluator: `pass_criteria` is required; a spec without it returns `failed` ("pass_criteria missing") and spends no agents (ticket 03).
- Evaluator stance: a criterion whose check cannot run (a denied tool) blocks with a question naming the check; it is never passed unchecked (ticket 04).
- Chain: one line per stage, a `not run:` list when a stage is not done, and a mid-chain panel FAIL stops the chain as `exhausted` unless the stage sets `gate: false` (ticket 05).
- Generator, worker and reducer stances: a refused write is reported as `ARTIFACT REFUSED: <path>` on line 1 with the full content in the result (ticket 06).
- `single`: the worker appends its own trace lines; the scribe runs only when the worker reports none (ticket 08).
- Trace: a `hook` event kind, which the renderer does not draw; an intervention in autonomous mode renders as `self · <trigger>` with a dashed outline, an attended one as `human · <trigger>` (ticket 09).
- Generator and worker stances: wait on a long command in the foreground with a timeout, or once on a background job's exit; never loop on `pgrep -f` (ticket 14).

Orchestrator skill (`SKILL.md`) and catalog:

- Unverified: work accepted without a passing evaluator is labelled UNVERIFIED, gets an evaluator-only dispatch next wave unless the budget is spent, and is listed first in the final reply; a blocked result is never resolved silently; a budget stop with a failing review ends with one `single` that reads the review (ticket 04).
- Catalog: what counts as a pass criterion, the words that do not, and one good example (ticket 03). Report artifacts are named `.txt`, `.json` or `.html` (ticket 06).
- A hook message is never a human answer and never authorises an irreversible action; the main loop never runs `git add -A` (ticket 09).
- Rolling launches: a dispatch launches as soon as its `dependsOn` are done, the state file is rewritten before each launch, budgets count launches, and `dependsOn` is checked before launch and never cleared. ADR-0006 is accepted (ticket 10).
- Evidence work is a `single` of at most 6 lines; housekeeping runs in the main loop only when no dispatch is running and an authorisation is recorded in the state file; waiting on a PR, CI or another session uses a subscription or a scheduled message (ticket 11).
- Context hygiene: the final reply sends the diagram as a file with a summary of at most 3 lines, `maxLines` defaults to 4 and above 8 needs a reason (documented; the code default is unchanged), standing rules go once into a brief file at kickoff, and credentials never go in context; before asking a human, every independent dispatch is launched and the question offers options with a recommended default (ticket 12).
- A spec or ticket-set session ends with an acceptance dispatch whose criteria are the spec's own acceptance criteria (ticket 13).
- Catalog sections for parallel code changes (one worktree per generator, then an integrate step) and tests per round; the split-fan-out note waits for the concurrency sweep (ticket 15).

Not in this release:

- Per-role models (ticket 07) is not in this release: it waits on the live run of the spike in ticket 01.

Also in this build, from `docs/specs/observability-evals/` (planned for 0.5.0) and already on the branch this release is cut from: per-agent role and output tokens, demand and concurrency on each dispatch line (its ticket 05), and evaluator rounds, chain stage lines and cut counts on dispatch lines, with interventions carrying `source` (its ticket 06).

## 0.3.2

Spec: `docs/specs/execution-lifecycle/` (real dispatch status, the launch path and the dispatch line, resuming interrupted runs). Release ticket: 06.
