# gRP1: Top 7 research advancements visual guide (died on scriptPath)

Session `session_016jSC3gRP1Fe22PJsnmfjtK`, CLI session `6f2d062c-d7ed-5cf8-8873-2421d60bfdf1`, repo context-management, SCRATCH `/tmp/claude-0/-home-user-context-management/6f2d062c-.../scratchpad`.

## Metrics

```
task:            "Please go off and research all the papers published by the leading labs, find the most interesting advancements, and build out a visual guide for the top 7 pieces /graph-orchestrator" (user 1f53fba2, 19:32:04)
mode:            autonomous (state.md MODE line, Write 60f1e0cd); waves 0/16 planned, dispatches/wave cap 9; 3 waves planned in FRONTIER
waves:           1 launched (twice), never completed
dispatches:      1 logical (w1-d1 chain: iterative-fan-out over 9 labs -> best-of-n top-7 pick); 2 Workflow launches
topology mix:    chain 1 (iterative-fan-out 9-way split, max_rounds 2 -> best-of-n)
status:          failed 1 (1st launch, scriptPath refused, 28 ms, 0 tokens) · stopped/killed 1 (retry, 55.8 s) · done 0
agents:          2 of 9 fan-out branches seen running (Branch 1 Anthropic, Branch 2 OpenAI); no evaluator/reducer/judge/scribe reached
subagent_tokens: 0 reported (failed notif 1c22cda7 usage 0; stopped notif f88211b9 usage null); last task_progress showed 150,089 (364d0b20)
tool_uses:       27 in the killed run (last task_progress 364d0b20); main thread 6 (Skill 1, Read 1, Write 1, Bash 1, Workflow 2)
workflow ms:     28 (failed) + 55,818 (killed, last progress)
wall clock:      19:32:04 prompt -> 19:35:04 retry killed (3m00s); turn_handoff_available at 20:10:11 (35c7d37c), no further turn
cost:            $0.47 at 176091c9; $0.92 at 3c1bd68c (last result)
human input:     1 message (task prompt); 0 corrections; the stop at 19:35:04 has no user message in the transcript
compaction:      none seen
outcome:         nothing delivered: no longlist, no top-7, no Artifact
```

Per-dispatch (task_notification usage):

| Dispatch | Topology | Status | duration_ms | total_tokens | tool_uses | Agents (task_progress labels) | Notification |
|---|---|---|---|---|---|---|---|
| w1-d1 (1st) | chain | failed: scriptPath refused | 28 | 0 | 0 | 0 | 1c22cda7 |
| w1-d1 retry | chain (iterative-fan-out -> best-of-n) | stopped (task_updated 1929868e status killed) | 55,818 (progress) | null (150,089 in progress) | 27 (progress) | Stage 1 Branch 1 of 9 Anthropic, Branch 2 of 9 OpenAI | f88211b9 |

## Observations

1. **Same scriptPath failure as g2Kg, with a different workaround.** The first launch (8a60eb67) used the synced plugin path `/root/.claude/plugins/synced/.../graph-orchestrator/workflows/dispatch.js`. It failed in 28 ms: "scriptPath must be a script path this tool returned, or a file you can already read" (task_updated e0a663b9, notification 1c22cda7). The orchestrator had already ended the turn with "Wave 1 dispatched" (fcd497e7, result 176091c9) in the same second.
2. **Workaround: copy the plugin's workflows dir into the scratchpad.** Bash b7be33c2 ran `cp -r $P/workflows $S/plugin/` and grepped for imports. The retry (06b94cd4) used `SCRATCH/plugin/workflows/dispatch.js` and launched successfully (733b2064). The orchestrator told the user why in one sentence (50db5dbe). This works outside the plugin's source repo, unlike g2Kg's repo-copy fix.
3. **Only 2 of 9 branches started.** The iterative-fan-out split 9 lab groups, but only Branch 1 and Branch 2 showed task_progress in 55 s (fd8180b2, cf743c8e). This fits the effective concurrency cap of 2 seen in hAaY (cap = min(16, nproc-2) on a 4-CPU container). Each branch used about 70k tokens in under a minute (deep-research skill on the worker).
4. **The retry was stopped about 1 minute in, with no message.** task_updated 1929868e sets status `killed` at 19:35:04 and the notification says `stopped` (f88211b9). No user message, assistant turn or result follows. The next event is turn_handoff_available at 20:10:11. Most likely the user stopped it from the UI. The reason is not in the transcript.
5. **Planning was sound.** state.md (60f1e0cd) recorded autonomous mode, a 12-month window, the lab list, and "HTML Artifact, private, not committed". Its 3-wave FRONTIER was research -> deep dive per paper -> build and review. The dispatch context was 4 short lines (387 chars) and included "not authorised to commit, push, publish". The returns contract was maxLines 8.
6. **Orchestrator discipline:** before dispatching, the main thread only read catalog.md (9419f431) and wrote state.md. It did no research itself.

## Evidence and coverage

- Complete: system, user, assistant and result kinds from the first user message 8b72bc7e (19:32:04) to 35c7d37c (20:10:11). 2 pages, saved as raw/gRP1/p0.txt (77 events). The earlier page held only the prompt and was read inline.
- Not seen: subagent transcripts, the best-of-n stage spec details beyond its param keys (criteria, mode, variants), and why the run was stopped.
