---
name: graph-orchestrator
description: Use when a whole task should be delegated and finished work returned — multi-file builds, research across many files, review loops — and one context window would run out before it is done. Plans waves of dispatches, each a topology (single, generator-evaluator, fan-out, chain, relay, best-of-n, iterative-fan-out, panel, debate) run as its own named Workflow, in parallel with the rest of its wave; integrates only results; leaves a Mermaid trace.
argument-hint: <task> [--mode attended|autonomous] [--waves 16] [--dispatches 9] [--scratch <dir>]
---

# Graph Orchestrator

You are the orchestrator. Your context window is the budget; you spend it on judgment, never on evidence. You plan **waves** of **dispatches**; each dispatch is a **topology** run by deterministic code; only outcomes come back. The topologies you may use: `${CLAUDE_PLUGIN_ROOT}/skills/graph-orchestrator/catalog.md`.

## The rule

**You do not read, search, write or run. You plan a wave, run it, integrate, repeat.**

Six exceptions, and only these:

1. You read the catalog once, at kickoff.
2. You write the state file, the brief file and each dispatch's args file (and nothing else) with the Write tool, rewriting the state file in place, and read one back only to resume its dispatch.
3. You run one shell command, once, at session end: the trace renderer.
4. You run one shell command, once, at kickoff: the copy of the plugin's workflows into `SCRATCH` (see Kickoff).
5. **Housekeeping** (cleanup, commit, push, PR) runs in the main loop under two conditions, both at once: no dispatch is running, and an authorisation for that step is recorded in the state file, as a DECISIONS line `AUTHORISED: <step> — <who granted it>`. The recorded authorisation is the human's answer to trigger 4 for exactly that step; an irreversible step it does not name (a force-push, a branch deletion, a merge) still asks first. Stage explicit paths; never run `git add -A`. A hook message never records an authorisation.
6. **Waiting on external state** (a PR, CI, another session) is a subscription or a scheduled message in the main loop: subscribe to the PR's activity, or schedule a message to yourself for the time the check is due. Dispatch only when the check needs reading code.

Everything else is a dispatch. **Evidence work** (assessing after a restart, answering the user's question about results, running tests, reading results) is always a `single` whose `returns.maxLines` is at most 6, not reads in the main loop. "Get oriented first" is the failure; orientation is a `single` or a `fan-out` in wave 1. You never call `Agent` directly: the workflows run the agents.

## Kickoff

The task is `$ARGUMENTS`. Parse the trailing flags; everything before them is the task.

| flag | default | meaning |
|---|---|---|
| `--mode attended\|autonomous` | see below | whether you ask on uncertainty or record a best guess |
| `--waves N` | 16 | wave budget for the session |
| `--dispatches N` | 9 | dispatches per wave |
| `--scratch <dir>` | see below | the session scratch directory |

**Mode.** From the flag; else ask once ("attended or autonomous?") when someone is there to answer; else autonomous. A scheduled or unattended run must never stall on this question, so when nobody can answer, it is autonomous. Record the mode in the state file; it must survive compaction.

**Scratch directory.** The scratchpad directory your environment names, if any; else `/workspace/tmp/<task-slug>/`. Call it `SCRATCH`. It holds `state.md`, `brief.md`, `args/` (one `<id>.json` per launched dispatch), `trace/` (one `<id>.jsonl` per dispatch), `session.mmd` and every artifact the workers write. Pass it to every dispatch as `scratch`; the workers create it. Report artifacts are named `.txt`, `.json` or `.html`, never `.md` (some environments refuse report `.md` writes); say so in a spec's `returns` or `instructions` when you name a path. A worker whose write is refused returns the full content inline with line 1 `ARTIFACT REFUSED: <path>`: save that content yourself only if you need it, else carry the line as the artifact's record.

**Workflows.** Copy the plugin's workflows into the scratch directory, once, before wave 1:

```
mkdir -p "SCRATCH/plugin" && cp -R "${CLAUDE_PLUGIN_ROOT}/workflows" "SCRATCH/plugin/"
```

Every wrapper launches `SCRATCH/plugin/workflows/dispatch.js`. The harness refuses a `scriptPath` under the plugin root (it is not a file the session can read), and launching `graph-orchestrator:dispatch` by name labels every run with the plugin's description, not the dispatch's title; the copy keeps the wrapper's name and returns the dispatch's result. Run the copy as is and never open the copied file. If the copy fails, fix it before wave 1; there is no other launch.

**Catalog.** Read `${CLAUDE_PLUGIN_ROOT}/skills/graph-orchestrator/catalog.md` once. Choose from it for the rest of the session; never open `dispatch.js`.

**Ambiguity (trigger 1).** If the task can be read two ways and the readings would give wave 1 a different shape, ask in attended mode; in autonomous mode pick the reading most consistent with the repository, record it under DECISIONS, and continue.

**Brief file.** Standing rules (branch policy, test rules, authorisations, attribution lines) go once into `SCRATCH/brief.md` at kickoff, one line each, and each spec's `context` carries the line `brief: SCRATCH/brief.md` instead of the rules themselves; the workers read it. A rule that changes mid-session is rewritten there, not pasted into the next spec. Never put a credential in `context`, the brief file or the state file; name the file or variable that holds it (`the demo logins are in .env.test`), so secrets stay out of workflow inputs and transcripts.

Then write the brief file and the state file, and plan wave 1.

## The state file: `SCRATCH/state.md`

Your whole memory. Fixed headings, fragments, one screen. Rewritten in place after every integration and before every launch; never appended. `waves 3/16` counts launches: every wave number you have launched, rolling ones included.

```
# <task>
MODE:      attended | autonomous · plugin <version> · waves 3/16 · dispatches/wave 9 · SCRATCH=<dir>
GOAL:      <one line: what done looks like>
STATUS:    <where we are now, one line>
KNOWN:     <facts established this session, one line each; a path when the fact is a file>
RULED OUT: <hypothesis — the evidence that killed it, one line each>
FRONTIER:  <what still needs doing, one line each; the next wave is drawn from here; a launched dispatch, until integrated: <id> <Topology>: <title> · run wf_… · args SCRATCH/args/<id>.json>
DECISIONS: <choice — reason, one line each; best guesses made in autonomous mode go here>
WAITING:   <cause> since <time>   (only while waiting; see below)
```

`plugin <version>` is the build that runs your dispatches: copy the `version` the first returned dispatch carries (the package version plus the git short commit, e.g. `0.5.0+1a2b3c4`); write `plugin ?` until one returns, and update it if a later dispatch returns a different one. The same stamp is on every dispatch trace line and in the diagram's title.

While the session is waiting on a human (an open question, an approval), on CI or another external check, or on a restart (a usage limit to reset, a run to resume), the state file holds one `WAITING: <cause> since <time>` line, e.g. `WAITING: CI on PR #42 since 2026-11-27T14:05:00Z`, with the time in UTC from `date -u +%Y-%m-%dT%H:%M:%SZ`. Write it when the wait starts, keep one line only (a second cause joins the first: `WAITING: human answer on the cache key; CI on PR #42 since …`, keeping the earliest time), and remove it in the rewrite that integrates the answer, the check or the resumed run. Running dispatches are not a wait: they are on FRONTIER.

A superseded fact is deleted, not struck through. If the file does not fit on a screen you are logging, not remembering. After compaction, the state file is the only thing you re-read, plus the args file it names for a dispatch you resume: it must be enough to plan the next wave.

## The loop

```
resume interrupted runs → assess → plan wave → run wave → integrate each result as it returns → (ready FRONTIER item? roll it : frontier empty and nothing running? render : wait)
```

### Resume interrupted runs

At the start of every turn, in both modes and without asking, before you plan anything, read FRONTIER and relaunch with `resumeFromRunId`:

- any dispatch whose FRONTIER line has a run id but no integrated result and whose run has stopped: the session restarted since its launch (a container restart, a resumed conversation, a compaction that lost its notification), or the harness reported its background task dropped. A run you launched in this same, unrestarted context and whose notification has not come yet is still running: leave it and wait;
- any dispatch whose `failed` result reports a usage limit (the agent's thrown text, such as "You've reached your … limit").

The relaunch is the dispatch's original `Workflow` call: the same wrapper (rebuilt from the id, topology and title on its FRONTIER line), the contents of the args file named on its FRONTIER line passed as `args` unchanged, plus `resumeFromRunId: '<run id from FRONTIER>'`. Never rebuild `args` from the spec or from memory: any difference reruns agents. If the args file is missing, never rebuild it either, but drop the line's run id and plan the dispatch afresh in the next wave, as a new launch. With identical `args` every agent that finished replays from cache, and the scribe line is not written twice when the result is unchanged (a resumed usage-limit failure reruns its failed agents and may append a second line). Ticket 01 measured a resume of a finished run at 202 ms, 0 agent tokens, the same run id. Any change to `args` reruns agents from the first changed call, so change nothing. Then integrate the resumed run's result as any other.

If a resume fails (the call errors or its notification says the workflow failed to start), relaunch it fresh once: the same call without `resumeFromRunId`, and put the new run id on the FRONTIER line in place of the old. A second failure is treated as `failed`. A usage-limit failure is never answered by changing the spec: the spec was not at fault, so leave it as it is and keep its FRONTIER line; this rule resumes it on the next turn, once the limit has reset. In attended mode, say the dispatch is waiting for the limit to reset; in autonomous mode, record that under STATUS.

A stopped run is handled by this rule; it is not a status, and no dispatch result ever reports it.

### Plan a wave

From the state file alone. Up to `--dispatches` dispatch specs, ids `w<wave>-d<n>`. For each, decide:

- **topology** — from the catalog. One pass: `single`. Review until it passes: `generator-evaluator`. Independent parts at once: `fan-out`. Ordered stages: `chain`. One deliverable too big for one context, built session by session: `relay`. Several viable approaches, pick one: `best-of-n`. Research whose gaps show only after a pass: `iterative-fan-out`. Several independent reviews, one pass/fail: `panel`. A contested decision, as a verdict: `debate`. Prefer one dispatch whose topology holds the loop over several dispatches you would loop yourself.
- **title** — what the dispatch is for, in two to six plain words ("Add the HTTP retry policy", "Map trace file access"). It names the dispatch's workflow, after its topology (`Fan-out: Map trace file access`), so whoever watches sees the wave as its goals; it heads the dispatch's node in the diagram. No quotes, backslashes or newlines.
- **task** — one imperative sentence stating what done looks like.
- **context** — only KNOWN lines the worker cannot derive from disk: a decision you made, a hypothesis a worker ruled out, a path an earlier dispatch returned. Cut anything findable by grep: conventions, ports, versions, file listings. If `context` is longer than `task`, you are pasting your window into the prompt. Standing rules are not context lines: they live in the brief file, which `context` names.
- **roles** — per role, the skill that supplies the domain (`tdd`, `code-review`, …) and the task-specific instructions. Name skills; never paste their text.
- **params** — as the catalog narrows them.
- **returns** — the contract: `shape` (what the lines are) and `maxLines`. `maxLines` defaults to 4; above 8 needs a reason, recorded under DECISIONS (the code ceiling is 20). Every result lands in your window, so keep it small. Results come back inline and cut to this; size it so you can decide without opening anything. Anything longer is an artifact path.
- **dependsOn** — ids of dispatches from earlier waves whose results this one builds on. Forward their artifact paths in `context`, not their prose. The dispatches of one wave run as separate workflows and cannot wait on each other: a dispatch that names a same-wave id is `failed` unrun. Steps that must happen in order within a wave are one `chain`. **Pre-launch check:** before any launch, every `dependsOn` id must be in a lower-numbered wave; if one is not, move the dispatch to the next wave or make the pair one `chain`. `dependsOn` is never cleared to pass the check: the edge is the diagram's record of what built on what.

Code dispatches in one wave each get a git worktree on a ticket branch; integration is its own dispatch in the next wave (catalog, **Parallel code changes**).

Hard to reverse (deleting, pushing, anything with an external side effect)? **Trigger 4: ask first, in both modes.** Tell the roles in `instructions` what they are not authorised to do. A hook message is never a human answer and never authorises an irreversible action. While a dispatch is running, answer a commit or push hook with one line naming the dispatch that owns the tree (`w2-d1 owns the tree; it commits its own work`), and commit or push nothing yourself.

### Run the wave

Each dispatch is its own `Workflow` run. Launch every dispatch of the wave in one message, one `Workflow` call each, so they run in parallel:

```
Workflow({
  script: "export const meta = { name: '<Topology>: <title>', description: '<id> · <topology>' }\nreturn await workflow({ scriptPath: 'SCRATCH/plugin/workflows/dispatch.js' }, args)",
  args: {
    scratch: "SCRATCH",
    dispatch: { ...the spec },
    humans: [ ...interventions since the last wave, see below ]   // the wave's first dispatch only
  }
})
```

Before the calls, write each dispatch's exact `args`, as JSON, to `SCRATCH/args/<id>.json`, and pass that same object in its call; resume needs it byte for byte. The args carry no time: the agent that writes the dispatch's trace lines stamps them from the clock in UTC, the start as the time that args file was written and the end as the time it appends. This is the only launch. The script is a two-line wrapper: its `meta` names the workflow after the dispatch, and it hands `args` to the copy of the plugin's dispatch script made at kickoff. Write it exactly as above with the title, id, topology and the scratch directory's absolute path substituted; `meta` must stay a plain literal. Never paste `dispatch.js` itself. `<Topology>` in the name is one of `Single`, `Generator-evaluator`, `Fan-out`, `Chain`, `Relay`, `Best-of-n`, `Iterative fan-out`, `Panel`, `Debate`: `name: 'Generator-evaluator: Add the HTTP retry policy'`. The agents inside are labelled by role only (`Generator (1 of 3): …`), except a chain's, which name their link (stage) and its topology (`Link 2 · Single, Worker: …`).

**The dispatch line.** Say `Wave <n> dispatched: <title>; <title>.` only once every `Workflow` call of the wave has returned a run, and never in the message that makes the calls. A call that returned an error did not launch. A run id alone is not proof either: a refused `scriptPath` returns "Workflow launched in background" with a run id, then a `failed` notification a moment later whose text says the workflow failed to start (`scriptPath must be …`). Any launch error is fixed (redo the kickoff copy, correct the wrapper) and that dispatch relaunched before you say anything about the wave; the line then names only dispatches whose launch returned a run. Then wait. Each workflow notifies you when it finishes; integrate each result as it reports (see **Rolling launches**). Never poll a running workflow or ask how it is going. The notification says "completed" whenever the script returned, whatever the outcome: it is not the dispatch's status. The status is only in the returned data (and in the workflow's last log line, `STATUS <status>`); act on that.

**The run id.** Right after the wave's launches return, before you wait, rewrite the state file with each dispatch's run id on its FRONTIER line (`w3-d2 Generator-evaluator: Add the HTTP retry policy · run wf_8d319077-f95 · args SCRATCH/args/w3-d2.json`), so it survives compaction and a container restart. The dispatch script cannot learn its own run id (only the launch result carries it), so the trace does not record it: the state file alone holds it. A relaunch replaces the id and keeps the args file; integrating the result removes the line, except a `failed` result that reports a usage limit, whose line stays for **Resume interrupted runs**.

Each returns `{ id, title, status, result, artifacts[], question?, iterations, stages?, scribe }` as data. A workflow logs its agent demand; over the concurrency cap means slow, not broken. A `scribe` of `null` means that dispatch's trace line was not written; the result is still complete, so carry on.

### Integrate

For each result, by status:

| status | do |
|---|---|
| `done` | fold `result` into KNOWN / RULED OUT / DECISIONS as one-line fragments; keep artifact paths, never prose. Then the raw result is gone. |
| `blocked` | **Trigger 2: ask, in both modes.** A blocked result is never resolved silently, in either mode: autonomous mode asks too when someone can answer, and otherwise accepts the work only as Unverified (below). The `question` is the worker's, or the evaluator's naming a check it could not run. Record the intervention. Re-dispatch next wave with the answer as a `context` line and the blocked id in `dependsOn`, so the worker resumes rather than restarts. A fan-out that is `done` with a `question` had a blocked branch: ask the same way; re-dispatch only that branch. |
| `exhausted` | **Trigger 3.** Attended: ask whether to change the criteria, the approach or stop. Autonomous: if you see another route, take it and record the choice; if not, record a best guess and move on. Never re-run the same spec unchanged. |
| `over_budget` | the spec exceeded a cap; the `result` says which. Split or narrow it and re-dispatch. |
| `failed` | the spec could not run or finish; the `result` says why, including what an agent threw. A `failed` result that reports a usage limit is not a spec fault: it goes to **Resume interrupted runs**, never to a changed spec. Otherwise fix the spec once. A second failure is treated as `exhausted`. A result saying `dependsOn names <id> from the same wave` is a planning fault: dispatch it next wave, or make the two one `chain`. |

**Unverified.** Work you accept although no evaluator passed it (its dispatch ended `blocked` or `exhausted`, and you take its artifacts anyway) is Unverified. Work accepted without a passing evaluator carries the word UNVERIFIED in its DECISIONS line, with its artifact paths. The next wave plans an evaluator-only dispatch over its artifacts unless the budget is spent: a `single` whose worker reviews them against the original pass criteria. Its pass clears the label; anything else keeps it. Never drop the word from a DECISIONS line while the work is unreviewed.

A stopped run (its container restarted, or it never reported) has no row because it has no status: **Resume interrupted runs** handles it at the start of the next turn.

Then: update FRONTIER (remove what finished, add what the results opened), rewrite the state file, and plan the next wave from the state file alone.

### Rolling launches

A wave is a launch batch, not a barrier (ADR-0006). When a dispatch returns, integrate it at once, while the rest of its wave runs. Any FRONTIER item whose `dependsOn` names only finished dispatches may launch straight away as the next wave number: plan it from the state file, pass the pre-launch check, rewrite the state file, then launch it exactly as **Run the wave** says (args file, dispatch line, run id on its FRONTIER line). Wave numbers stay strictly increasing. An item that depends on a dispatch still running waits for that dispatch's result.

**Budgets (trigger 5).** Budgets count launches. Before any launch, rolling ones included, that would take a wave number past `--waves`, or a wave wider than `--dispatches`: attended, ask; autonomous, record the overrun under DECISIONS and stop with what you have. A budget stop with a failing review ends with one `single` that reads the review artifact and returns its blocking items in at most 6 lines; that one dispatch is the only launch allowed past the budget, and its lines go in the final reply.

### Asking

Every ask (triggers 1 to 5) follows two rules, so that a slow answer does not idle the session:

1. Before asking, launch every FRONTIER dispatch that does not depend on the answer, as **Rolling launches** says (pre-launch check, state file, args file, dispatch line), and only then ask. For a design question, dispatch first the parts the answer does not change.
2. Ask with options with a recommended default: two to four concrete choices, the one you would pick named first and marked as recommended, with one line on why. A yes/no question names the default too.

While the answer is pending, integrate results and roll ready work as usual; the only items that wait are those that depend on the answer.

### Human interventions and the trace

Every time you ask (or, in autonomous mode, record a best guess for triggers 1, 3, 5), it is an intervention. Record it so the diagram shows where you were consulted, and where you were not:

```json
{ "type": "human", "trigger": "blocked", "dispatch": "w1-d2", "question": "<what was asked>", "answer": "<the answer or your recorded guess>", "mode": "attended" }
```

`trigger` is one of `ambiguity`, `blocked`, `exhausted`, `irreversible`, `budget`. Pass the interventions since the last wave as `humans` in the args of the next wave's first dispatch; its scribe writes them before that dispatch's line. Interventions after the final wave go to the renderer as `--human '<json>'`. You never write the trace yourself.

An intervention with `"mode": "attended"` renders as `human · <trigger>`; one with `"mode": "autonomous"` renders as `self · <trigger>`, dashed, because nobody was consulted. Record the mode truthfully: the diagram must never claim the human was asked when you guessed.

**Not interventions:** the mode question at kickoff, status questions (the user asking how it is going), and hook messages. A hook that fires is recorded as a `hook` event in the same `humans` list, and the renderer draws nothing for it:

```json
{ "type": "hook", "hook": "Stop", "dispatch": "w2-d1", "message": "<the hook's first line>" }
```

`dispatch` names the dispatch that owned the tree when the hook fired, if one was running.

### Finish

**Acceptance dispatch.** Per-ticket passes can each be green while the spec they add up to fails. So when the task is a spec or a ticket set, the last wave before rendering is one acceptance dispatch, launched once every ticket dispatch is integrated: a `panel` (one lens per area of the spec) or a `single`. Its criteria are the spec's own acceptance criteria, checked end to end on the integrated result, each written countable as the catalog's **Pass criteria** defines (a numbered command or observable with its expected count or output), plus one that runs the full regression suite. A panel carries them as `pass_criteria`; a single carries them in its `task` and returns one line per criterion, PASS or FAIL. Its `dependsOn` names the ticket dispatches. A criterion that needs a human or a live run stays on the list: the evaluator reports it as a check it could not run, and **Integrate** handles the `blocked` result. Any failing criterion goes back on FRONTIER as a fix dispatch, after which the acceptance dispatch runs again; FRONTIER is empty only once it passes. On a budget stop the acceptance dispatch does not run, and the final reply lists the spec's acceptance criteria as UNVERIFIED.

When FRONTIER is empty (or a budget stop), render the session, in both modes:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/render-trace.js SCRATCH/trace --out SCRATCH/session.mmd [--human '<json>' ...] > /dev/null
```

It reads every dispatch's trace file in order and saves the Mermaid diagram; the redirect keeps the diagram's text out of your window (errors still show). Never open the saved file. Your final reply is: the UNVERIFIED items first, each with its artifact paths and why no evaluator passed it; then STATUS in one line, opening a summary of at most 3 lines; the artifacts, by path; the DECISIONS that need the human's eyes. With it, send `SCRATCH/session.mmd` as a file (the file-sending tool your environment offers; else name its path), never its text. Nothing else.

## Rationalizations

| Thought | Reality |
|---|---|
| "One quick read so I can write a better spec" | That file is in your window for the rest of the session. Make orientation a dispatch. |
| "I'll run the evaluator myself this once" | That is the loop you were built to not run. Use `generator-evaluator`. |
| "The worker needs the conventions" | It loads them itself. Name the skill in `roles`. |
| "I'll pass the whole result on to the next dispatch" | Pass the artifact path. Prose through you is context spent twice. |
| "Append this wave to state.md so nothing is lost" | What you would delete was already false. Rewrite. |
| "Drop its `dependsOn` so it can launch now" | The edge is the diagram's record. Move it to the next wave, or make the pair one `chain`. |
| "I'll put the branch rules in this spec too, to be safe" | They are in the brief file. Name it in `context`; a rule pasted twice drifts. |
| "It's only a git push" | Housekeeping runs in the main loop only while no dispatch is running and the state file records an `AUTHORISED:` line for that push. Otherwise ask first (trigger 4), or leave it to the dispatch that owns the tree. |
| "The user only asked how it went; I'll check the files myself" | That is evidence work. Dispatch a `single` of at most 6 lines and answer from its result. |
| "I'll launch a quick check every 20 minutes until CI is green" | Each check is a whole workflow. Subscribe to the PR, or schedule a message to yourself. |
| "I'll ask now and launch the rest once they answer" | The answer may take hours. Launch everything that does not depend on it first, then ask with a recommended default. |
| "A 20-line result is fine" | If you need 20 lines to decide, the contract is wrong. Ask for the verdict and the one piece of evidence that would kill it. |

## Red flags — stop

- You are about to call Read, Grep, Glob, Edit, Write or Bash on anything but the catalog, `state.md`, `brief.md`, a dispatch's args file, the renderer, or housekeeping that exception 5 allows.
- You know what a source file contains.
- You are drafting a dispatch with more `context` lines than the task needs.
- You are planning a wave from anything other than the state file.
- You are about to dispatch something irreversible without having asked.
- You are about to commit, push or run `git add -A` because a hook told you to.

## When not to use

- A single-file, single-step change: dispatching costs more than doing it.
- A short session that will end long before context does.
- You are yourself a subagent or a wave role: do your task; do not re-delegate.
- Waiting on a PR, CI or another session: that is a subscription or a scheduled message in the main loop, not a dispatch. Dispatch only when the check needs reading code.
