# 12: Release 0.5.0

**What to build:** The plugin changes in this spec ship as one version, after 0.4.0.

**Blocked by:** 03-07; fixes ticket 16 (Release 0.4.0)

**Status:** ready-for-agent (in-repo part done; the release waits for the open criterion and for 0.4.0)

- [x] The version is 0.5.0 in the plugin manifest and the package manifest
- [ ] The instrumentation's dispatch-eval runs are linked and meet the merge rule
- [x] The roadmap drops the items this spec covers and points to it

The version moved in `graph-orchestrator/.claude-plugin/plugin.json`, `package.json` and `package-lock.json`; `graph-orchestrator/CHANGELOG.md` has the 0.5.0 entry (tickets 03-07; the session-eval harness and the Actions job ship no plugin version); the roadmap drops ranks 1, 2, 3 and 8 (session evals, QUA-08 and REL-07, instrumentation, Actions) and renumbers the rest; `graph-orchestrator/test/release.test.ts` checks the version, the changelog, the roadmap and the table below. The tag, the GitHub release and the marketplace update are not done: they wait for the open criterion and for 0.4.0 to be released first.

Tickets 03, 05 and 06 were committed before the 0.4.0 metadata (fixes ticket 16), so a 0.4.0 cut from that commit already carries them; the 0.5.0 entry lists them as well, so the changelog maps this spec whole.

## Dispatch-eval gates

Each run is against the frozen baseline `3035a58f6828` (ADR-0005), on the ticket's own commit. The merge rule for the instrumentation (spec, "Dispatch evals"): every sample's pass rate stays within its baseline spread and dollars do not rise beyond it. Link the scorecard here and in the ticket, then set the status to `meets rule` or `fails rule`. One run on the release commit, covering all five, may replace the per-ticket runs if each ticket's row links it.

| Ticket | Commit | Gate | Scorecard | Status |
|---|---|---|---|---|
| 03 | 7c91465 | Every sample within its spread; dollars not above it | | not run |
| 04 | 5c3cfdf | Every sample within its spread; dollars not above it (scribe and worker prompts changed) | | not run |
| 05 | 915d025 | Every sample within its spread; dollars not above it | | not run |
| 06 | 747cbc7 | Every sample within its spread; dollars not above it | | not run |
| 07 | 97f1a6b | Every sample within its spread; dollars not above it (all four stances changed) | | not run |
