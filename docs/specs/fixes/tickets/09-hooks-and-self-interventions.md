# 09: Hooks are never answers; self interventions

**What to build:** No hook pushes on the user's behalf and the diagram never claims the user was consulted when they were not. SKILL.md's irreversible-action trigger says a hook message is never a human answer and never authorises an irreversible action; while a dispatch is running, a commit or push hook gets one line naming the dispatch that owns the tree; the main loop never runs `git add -A`. Hooks are recorded as a `hook` trace event, not an intervention. The renderer titles autonomous interventions `self` with a dashed class. SKILL.md says the mode question, status questions and hook messages are not interventions. QUA-04 and QUA-03.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Docs seam: the hook rule and the not-interventions list are in SKILL.md
- [x] Render seam: an autonomous intervention renders as `self · <trigger>` with the dashed class; an attended one as `human · <trigger>`; a `hook` event renders nothing
- [ ] By hand in a cloud session with a stop-hook git check: a hook firing mid-wave gets one line naming the running dispatch, and nothing is committed or pushed

**By-hand evidence (2026-11-27, session_016jSC3fsMfuGLacrVjUTYMU, plugin 0.5.0+eaf50f7)**

Not exercised: no Stop hook (or any hook) message reached the orchestrator at any point, although it ended its turn 5 times with dispatches running (w2-d2 ran ~11.5 min). The trace has no `hook` line, so there is nothing to check the one-line reply or the diagram against.
Box left unticked: no hook fired in this environment.

**What the by-hand check needs (recorded 2026-11-28)**

The check can only pass in an environment with a git Stop hook, one that blocks the orchestrator's stop and asks for a commit or push while a dispatch runs. The 2026-11-27 session met no hook at all, so it could not show the one-line reply or the `hook` trace line.

Claude Code on the web registers one in `~/.claude/launcher-settings.json` (`~/.claude/stop-hook-git-check.sh`, seen in session_016jSC3dd67o1gd6yL5rTkW7), but it speaks only when the repository has a remote and the tree has uncommitted changes, untracked files or unpushed commits at the moment the turn ends. A session whose dispatches commit their own work can end every turn clean, so that hook stays silent.

To be sure a hook fires, add one outside the repository (so it never shows in the tree) before Claude Code starts, since Claude Code reads hooks at startup: in a cloud session, from the environment's setup script; locally, before running `claude`. Copy `graph-orchestrator/evals/session/scenarios/hook/hooks/stop-hook.sh` to `~/.claude/hooks/stop-hook.sh`, change its `/work/scratch/args/*.json` to a glob for the session's scratch directory (in a cloud session `/tmp/claude-*/*/*/scratchpad/args/*.json`) and its marker to a path outside the repository, make it executable, and register it in `~/.claude/settings.json`:

```json
{ "hooks": { "Stop": [ { "hooks": [ { "type": "command", "command": "~/.claude/hooks/stop-hook.sh" } ] } ] } }
```

That script fires once, only after a dispatch's args file exists (so mid-wave), and prints `{"decision": "block", "reason": "Stop hook: commit and push your changes now. ..."}`, which Claude Code feeds back to the main loop as `Stop hook feedback:`. The session-eval hook scenario (observability-evals ticket 08) installs the same hook headless.
