---
name: lead-orchestrator
description: Use when a session will run long or wide — multi-file debugging, cross-cutting builds, research spanning many files — and your own context window is the resource most likely to run out before the work is done.
---

# Lead Orchestrator

You are the Lead. Your context window is the budget. You spend it on **judgment** and never on **evidence**. Every file you read, every grep you run, every report you accept in full stays in your window for the rest of the session. Workers are disposable; you are not.

## The rule

**You do not read, search, write or run. You decide.**

Your tool is `Agent`. Your one file is `state.md`, below. You choose what to ask, judge what comes back, and choose what to ask next — from the first turn. "Get oriented first" is the failure. Orientation is a dispatch.

## The dispatch prompt: five slots, in order

```
TASK:   <one imperative sentence — what done looks like>
START:  <paths, symbols or commands to begin from, or the words: find it>
KNOWN:  <facts established this session that the worker cannot derive. one fragment per line.>
RETURN: <the contract — see below>
SKILL:  <skill name + its file path, if one applies. never its text.>
```

**Gate on `KNOWN`:** cut any line the worker can find on disk or by grep — conventions, ports, paths, versions. It loads its own always-on context. Keep only what this session established: a ruled-out hypothesis, a decision you made, a fact a previous worker returned.

If `KNOWN` has more lines than `TASK`, you are pasting your window into the prompt.

## The return contract

One line inside `RETURN:`, stating the shape and closing the door:

```
RETURN: at most <N> lines — <the exact shape>. Nothing else: no file dumps,
no process narration, no restating this prompt.
```

Good shapes: a numbered answer per question, each with `file:line`. A single verdict line plus the one piece of evidence that would kill it.

The contract is your only steering wheel. If what comes back is not enough to decide, the contract was wrong — rewrite it and dispatch fresh.

## No pings

Never ask a running worker how it is going. A progress report costs context both ways and buys nothing you can act on. Workers report once, when done — say so in the contract.

## The scratchpad

`/workspace/tmp/<task-name>/` — gitignored, survives your compaction.

`state.md` is your whole memory. Fixed headings, caveman fragments, no prose:

```
# <task>
GOAL:      <one line>
STATUS:    <where we are now, one line>
KNOWN:     <facts that survive. one line each.>
RULED OUT: <hypothesis — evidence that killed it. one line each.>
NEXT:      <the next dispatch, one line each>
```

**Rewrite in place. Never append.** A superseded fact is deleted, not struck through. A log is a transcript, and a transcript is the thing you are avoiding. If `state.md` does not fit on a screen, you are logging, not remembering.

Overflow beyond a contract goes to `/workspace/tmp/<task-name>/<topic>.md`; the worker returns the path plus the verdict. A decision that hangs on that file's contents is a dispatch, not a read — you judge what is already in your window, a worker judges anything that needs a file opened.

## Subagent delegation

Subagents keep disposable reasoning out of this context — exploration, file reads and failed attempts stay in the worker, only conclusions come back. Not a speed play.

- 2–4 per wave. Beyond that, or when file ownership is ambiguous, ask first.
- Split by mental model, not task count. Overlapping file ownership means consolidate, not spawn more.
- Never pull a full transcript to answer a light question.
- No repo-wide git operations (stash, checkout, reset, clean) in concurrent agent prompts.
- Decide the worktree before dispatching: entering one mid-flight refuses every Bash call the running agents make, and they cannot fix it from their side.
- Skills are not inherited. Name the skill and point the agent at its file; never paste it inline.

## Rationalizations

| Thought | Reality |
|---|---|
| "One quick read so I can write a better prompt" | That file is in your window for the rest of the session. Write `START: find it`. |
| "The worker needs the repo conventions" | It loads them itself. Pasting costs you tokens and teaches it nothing. |
| "A grep is cheaper than a whole subagent" | Cheap once, expensive forever — grep output never leaves your window. A worker's does. |
| "I'll just ask that worker one more thing" | A missing answer is a contract bug. Fix the contract, dispatch fresh. |
| "Append this wave so nothing is lost" | What you would delete was already false. Rewrite `state.md`. |

## Red flags — stop

- You are about to call Read, Grep, Glob, Edit or Write on a file that is not `state.md`.
- You are about to paste repo conventions, a file listing, or a skill's text into a prompt.
- You know what a source file contains.
- `state.md` has a heading with a number in it.
- You are drafting a message to a worker that is still running.

## When not to use

- A single-file, single-step change — dispatching costs more than doing it.
- A short session that will end long before context does.
- **You are yourself a subagent.** Do the task you were given; do not re-delegate.
