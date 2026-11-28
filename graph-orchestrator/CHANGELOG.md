# Changelog

Each release maps to one spec under `docs/specs/`. Ticket numbers below refer to that spec's `tickets/` folder.

## Unreleased

- Artifact check (finding A, by-hand session 2026-11-27): after any dispatch returns, one `checker` agent (Haiku by default, `roles.checker.model` overrides) tests that each local artifact path in its result exists. Missing paths are listed in the result's and the dispatch trace line's `missing` and logged, and a `done` result becomes `blocked` with the question `artifact <path> claimed but not found`. The renderer draws the last line written for a dispatch, so a `single` whose worker appended its done line before the check shows the scribe's blocked line. SKILL.md's Integrate table and the catalog say what to do with it; dispatch eval sample 17 (`17-single-phantom-artifact`, stub-runnable) measures it.
- Review verdict (finding B, by-hand session 2026-11-27): a dispatch line whose evaluator ran carries `verdict`, the last round's `pass`, `fail: <first feedback line>` or `blocked: <question's first line>`, one line of at most 160 characters (generator-evaluator, iterative-fan-out, relay per done-check, and panel as one pooled round whose reason is `lens <name>: <first feedback line>`; best-of-n and debate run a judge and carry none). A `single` with `roles.evaluator` and no `roles.worker` is an evaluator-only review: it runs one evaluator against `params.pass_criteria`, returns `PASS` or `FAIL` plus feedback (`done`) or `blocked`, and the scribe writes its line, so the line says why a review kept work UNVERIFIED. The renderer shows a verdict as the node's last line; a line without one draws as before. SKILL.md's Unverified paragraph and the catalog's `single` say how to plan and read it.

## 0.5.0

Spec: `docs/specs/observability-evals/` (every run recorded truthfully, whole sessions measured). Release ticket: 12.

Dispatch code, role prompts and the orchestrator skill:

- Version stamp: the build injects the package version and the git short commit (`<version>+<sha>`) into the bundled dispatch script; it is in the returned data, on every dispatch trace line and in the diagram header (an old trace without it still renders), and SKILL.md's MODE line records it (ticket 03).
- Real timestamps: the dispatch script no longer needs `now`. With none, it stamps placeholders for the dispatch's start (`at`) and end (new `ended`), and the agent that appends the trace lines (the scribe, or a `single`'s worker) replaces them with the clock's UTC time: the start from the launch's args file (GNU or BSD `date`, falling back to the end time), the end from the time of the write. A `now` still sent is used as the start. SKILL.md and the dispatch skill's description no longer pass `now` or say the orchestrator has no clock; the renderer ignores a placeholder left unreplaced (ticket 04).
- Per-agent usage: each top-level dispatch line carries `agents: [{ role, output_tokens? }]` (output tokens only where the runtime's budget makes them readable for that agent, otherwise omitted, never zeroed), `demand` (the agents the dispatch needed) and `concurrency` (the most agents running at once); old traces still render (ticket 05).
- Verdict, chain and truncation detail: a generator-evaluator line records the pass criteria once and each evaluator round's pass or fail with its first feedback line; a chain line carries each stage's first line; a cut that drops lines logs how many; interventions carry `source: self | human`, which the renderer prefers, falling back to the mode for traces without it (ticket 06).
- Refusal counts: the worker, generator, reducer and evaluator stances and schemas ask for `writesRefused` and `toolsDenied`; each agent's counts go on its entry in the dispatch line's `agents`, and their totals on the line as `writes_refused` and `tools_denied` (absent when no agent reported them), and are logged. A `single`'s worker fills its own into the line it writes from `{{WRITES_REFUSED}}` and `{{TOOLS_DENIED}}` placeholders. SKILL.md: while waiting on a human, CI or a restart, the state file holds one `WAITING: <cause> since <time>` line, removed when the wait ends (ticket 07).

Not a plugin change: the session-eval harness and its three scenarios (tickets 01, 08, 09, 10) and the manually triggered GitHub Actions job for the dispatch evals (ticket 11) live with the evals under `evals/` and ship no plugin version.

Tickets 03, 05 and 06 were already on the branch when the 0.4.0 metadata was committed, so a 0.4.0 cut from that commit carries them as well (see the note under 0.4.0).

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

Also in this build, from `docs/specs/observability-evals/` (planned for 0.5.0) and already on the branch this release is cut from: the plugin version stamp (its ticket 03), per-agent role and output tokens, demand and concurrency on each dispatch line (its ticket 05), and evaluator rounds, chain stage lines and cut counts on dispatch lines, with interventions carrying `source` (its ticket 06).

## 0.3.2

Spec: `docs/specs/execution-lifecycle/` (real dispatch status, the launch path and the dispatch line, resuming interrupted runs). Release ticket: 06.
