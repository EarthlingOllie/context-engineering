# Ticket 01 spike: result

**Verdict: GO.** All six conditions from the spec pass. Tickets 3–12 stand as built.

Run: 2026-11-26, `inspect eval graph-orchestrator/evals/spike/task.py@spike --model anthropic/claude-opus-5-5 -T cost_limit=5`, cloud session container (Docker 29.9.3), Claude Agent SDK 0.3.332 (Claude Code 2.1.332). Inspect log `2026-11-26T13-58-25-00-00_spike_AVbRRnyYrwMEXSXXnw6RUC.eval` (in the git-ignored `spike/logs/`, not committed). Score 1.000.

| # | Condition | Result | Evidence |
|---|---|---|---|
| 6 | Workspace-key auth | pass | `auth_probe.py --live --route env`: one Haiku call returned `ok`, served by `claude-haiku-5-5`. The key goes in as `ANTHROPIC_API_KEY`; the workspace key is sent as the `anthropic-workspace-id` header via `ANTHROPIC_CUSTOM_HEADERS` (dry run confirms the provider sends it as a Bearer `Authorization` plus that header). The eval ran with the same settings and `ANTHROPIC_BASE_URL` unset. |
| 1 | Docker | pass | Sandbox built and ran in the cloud session container; no fallback needed. |
| 2 | Agent SDK through the bridge | pass | All 4 agents in `result.json` (Worker, Grapher, two Probes) have model events in the Inspect log: 7 model events. The harness counts 9 SDK assistant messages; the SDK can split one API call into several messages (Worker: 5 messages, 3 API calls), so the log is the source of truth for call counts. |
| 3 | Alias routing | pass | `Probe: claude-haiku-5-5` served by `claude-haiku-5-5`. `Probe: claude-undeclared-spike` fell back to Opus; Inspect logged "Agent bridge routed a request for model 'claude-undeclared-spike' to the eval model". |
| 4 | Cache tokens | pass | Per model event, e.g. Worker calls: cache write 15,818 then reads 15,818 / 16,466. Totals: Opus CW 47,450 / CR 47,642; Haiku CW 14,957 / CR 0. |
| 5 | Skill load | pass | Worker init lists `skills:root-cause-analysis` (plugin `skills` from `/opt/skills`), and `skillsInvoked` = `["skills:root-cause-analysis"]`. |
| — | Dispatch result | pass | `w1-d1` returned `done`, trace written (1 line), summary has the planted facts. |

## Cost, tokens, wall clock

- Cost: **$0.275** (Opus $0.273, Haiku $0.0019) plus the auth probe (22 tokens). Well under the $10 cap.
- Tokens: Opus 96,422 (input 12, cache write 47,450, cache read 47,642, output 1,318, reasoning 22); Haiku 14,963.
- Wall clock: harness 21.3 s; sample 31.3 s; whole eval 33 s.

## Caveats for later tickets

- Per-call `usage` in the harness's `result.json` is all zeros under the bridge; take token and cost figures from the Inspect log, not the harness.
- Every role sees the full built-in skill list as well as this repo's; scoring that checks skill use should look for the repo's `skills:` names.
- Environment variables named `ANTHROPIC_API_KEY` are dropped by the cloud environment; the key was stored as `ANT_API_KEY` / `ANT_WORKSPACE_KEY` and mapped for the run only.
