# 16: Release 0.4.0

**What to build:** Everything in this spec ships as one version.

**Blocked by:** 02-15 (07 may be closed as dropped)

**Status:** ready-for-agent

- [x] The version is 0.4.0 in the plugin manifest and the package manifest
- [ ] Every dispatch-eval scorecard required by tickets 02-15 is linked from its ticket and meets the merge rule
- [ ] The by-hand checks in tickets 04 and 09-13 are done in one cloud session and recorded
- [x] The roadmap drops the items this spec covers and points to it

The version moved in `graph-orchestrator/.claude-plugin/plugin.json`, `package.json` and `package-lock.json`; `graph-orchestrator/CHANGELOG.md` has the 0.4.0 entry; `graph-orchestrator/test/release.test.ts` checks the version, the changelog, the roadmap and the two tables below. The tag, the GitHub release and the marketplace update are not done: they wait for the two open criteria.

## Dispatch-eval gates

Each run is against the frozen baseline `3035a58f6828` (ADR-0005), on the ticket's own commit for a prompt change. The merge rule: the target rises above its baseline spread, every other sample stays within its spread, and a cost fix also drops dollars below the spread with no new false passes. Link the scorecard here and in the ticket, then set the status to `meets rule` or `fails rule`.

| Ticket | Gate | Scorecard | Status |
|---|---|---|---|
| 02 | Sample 10 above its spread (0/5); others within | `e0f7d0af97a0-20261127T132909Z` | meets rule (10: 3/3; $ flag 15) |
| 03 | Sample 16 (countable criteria, new: full suite green; 510 of 510 page-through combinations reach every order with `pageCount` equal to the pages visited) 0 false passes and pass rate at or above sample 4's; sample 4 (vague guard) no more false passes than baseline; others within | `64968bde97fa-20261127T133053Z` | not measurable under the old gate (04 fp 0/3, baseline 0/5); gate restated, sample 16 added: needs a fresh baseline epoch for 16, then a run; 14 at 2/3 |
| 04 | Evaluator stance: every sample within its spread | `bda34564a1f5-20261127T140102Z` | meets rule ($ flag 02) |
| 05 | Sample 9 above its spread, or holds if passing; others within | `f50da06b51b5-20261127T140055Z` | fails rule: 10 fp 1/3 (sample-10 maxLines artifact, fixed in sample 10 revision 2: re-gate after a fresh baseline epoch; 09 holds) |
| 06 | Generator, worker and reducer stances: every sample within its spread | `f88fd56e3e42-20261127T140206Z` | fails rule: 10 fp 2/3 (sample-10 maxLines artifact, fixed in sample 10 revision 2: re-gate after a fresh baseline epoch) |
| 07 | Every sample's dollars below the spread; routing check clean | | not built: ticket 01 Part 1 still not run (2026-11-27), build-or-drop unknown |
| 08 | Worker stance: every sample within its spread; sample 1's dollars below its spread | `87d61f1d2984-20261127T143209Z` | within spread; sample 1 not below spread ($0.0547 vs $0.0636, band $0.0438) |
| 14 | Generator and worker stances: every sample within its spread | `628167c26a4d-20261127T143234Z` | fails rule: 10 fp 1/3 (sample-10 maxLines artifact, fixed in sample 10 revision 2: re-gate after a fresh baseline epoch; $ flag 02) |
| 15 | One concurrency-sweep run recorded in ticket 15 (not a merge gate) | `out/sweeps/0c3ca1002184-20261127T130150Z.md` | recorded: no gain, note left out |

## By-hand checks

All in one cloud session with the plugin at 0.4.0 installed. Record the session id and the date, then the result of each check.

Session: session_016jSC3fsMfuGLacrVjUTYMU, 2026-11-27 (plugin 0.5.0+eaf50f7 from the checkout, not 0.4.0 installed; partial)

| Ticket | Check | Result |
|---|---|---|
| 04 | An autonomous run with a check the evaluator cannot run (Bash denied for the test command) ends with the work labelled UNVERIFIED in DECISIONS and listed first in the final reply | partial: blocked + UNVERIFIED + review next wave seen; final-reply order pending |
| 09 | With a stop-hook git check, a hook firing mid-wave gets one line naming the running dispatch; nothing is committed or pushed; the trace has a `hook` line and the diagram no node for it | not exercised: no hook fired |
| 10 | A dispatch whose `dependsOn` names only a finished dispatch launches before its wave's slow dispatch returns; the state file is rewritten first; `dependsOn` is kept | pass (w3-d1 launched 23:39:16Z, T2 ended 23:49:26Z) |
| 11 | Asked a question about results after its dispatches finish, the session dispatches a `single` (at most 6 lines) instead of reading files in the main loop | pending: question arrives after finish |
| 12 | The final reply sends the diagram file with a summary of at most 3 lines; a question is asked only after every independent dispatch launched, with options and a recommended default | partial: question after launches; diagram sent before final reply |
| 13 | A ticket-set session's last wave before rendering is one acceptance dispatch whose numbered, countable criteria are the spec's acceptance criteria plus the full regression suite | pass (w5-d1) |

**By-hand evidence (2026-11-27, session_016jSC3fsMfuGLacrVjUTYMU, plugin 0.5.0+eaf50f7)**

Covered in one session with plugin 0.5.0+eaf50f7 run from the checkout (not 0.4.0 installed): 10 and 13 pass; 04 and 12 partial (final-reply parts pending); 09 not exercised (no hook fired); 11 pending (needs a question after finish). Results in the table above.
Box 2 left unticked: wrong version, 09 failed to occur, 11 pending.
Update after the final reply: 04 now pass (UNVERIFIED listed first); 11 pass (w7-d1 single answered the post-finish question, 23:56:34Z); 12 still partial (diagram sent as a file, but summary was a ~12-row table; no question put to a person).
Finding: w4-d1's trace line records only status, not its review result; w4-d2 claimed a test log it never wrote.
Box 2 stays unticked: plugin was 0.5.0, not 0.4.0; 09 failed (no hook fired); 12 partial.
