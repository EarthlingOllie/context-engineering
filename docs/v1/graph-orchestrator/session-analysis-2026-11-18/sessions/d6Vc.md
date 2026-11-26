# d6Vc: Graph orchestrator ticket frontier, multi-day chain (rag-agent-studio)

Session `session_016jSC3d6VcueRR7JYyZJPGP`, CLI session `6b18ab77-5c70-5cfd-b109-1e70fc51c71e`, repo rag-agent-studio (EarthlingOllie/rag-agent-studio), integration branch `candidate`, model claude-opus-5-5, permission mode auto.
SCRATCH `/tmp/claude-0/-home-user-rag-agent-studio/6b18ab77-5c70-5cfd-b109-1e70fc51c71e/scratchpad`.

**Coverage: partial, extended in round 2.** Round 1 read 19 pages (11-09 00:11 to 11-12 22:32). Round 2 paged back 180 more pages, so `raw/d6Vc/p001..p199.txt` now hold about 19,700 events from **2026-11-07 02:45:09 to 2026-11-12 22:32:56**. That covers waves 36 (stop notices only) and 37 to 52, plus every follow-on job.

**Round 3 (waves 1 to 35).** Paging resumed from `before_id` 4c9e6e61 and went back to **2026-11-06 00:42**, where it hit compaction 7aee9bed and its summary 925b15d5:
- `raw/d6Vc-early/e000..e100.txt` hold 10,000 unfiltered events from 11-06 00:42:15 to 14:01, plus 11-07 02:17 to 02:22.
- For 11-06 14:01 to 11-07 02:17, I paged with `kinds=["assistant"]` only, so I got launches, state.md edits and status text but not task_notification usage. The event ids are transcribed in `raw/d6Vc-early/notes.md`.
- The compaction summaries are saved as `raw/d6Vc-summary-925b15d5.txt` (covers the session up to 11-06 00:43) and `raw/d6Vc-summary-378dbfc5.json` (covers it up to 11-07 05:01).
- Parsers: `tools/nx2.sh` (pager), `tools/d6early.py` (writes `d6Vc-early-dispatches.json`) and `tools/d6early2.py` (writes `d6Vc-early-scan.txt`: state.md wave↔task pairs and status lines).

Per-dispatch rows with event ids now run from **w20 to w52**. Waves 1 to 19 (11-04 23:58 to 11-06 00:42, about 25 h) have only ticket-level status, from the two summaries. Paging them would take roughly 150 more unfiltered pages. Resume with `before_id` = `2c1aad5c-5f4d-47af-b0d6-bcbe9333d245`.

**Why the trace could not supply the statuses:** the render-trace call (2871a770) output only `head -c 600` of session.mmd: classDefs, plus wave 1's subgraph "Wave 1 · 2026-11-05 · 1 done" with w1-d1 "Map tickets and frontier" as done. SendUserFile (3a28af5b) carries only the file path, and the final result (c7f39d79) does not embed the file. The 816-line trace exists only in d6Vc's own container, so get_event cannot recover the statuses for waves 1 to 35.

Parsers: `tools/d6full.py` builds `d6Vc-dispatches.json` (launch, notification, usage, agents), `tools/d6stat.py` adds the orchestrator's status line, `tools/d6misc.py` lists human input, compactions and stops, and `tools/renorm.py` and `tools/mvall.sh` handle paging.

## Metrics

```
task:            not seen (before the window). Per the final report: ship every ticket of specs 01-10 (78 tickets) to
                 `candidate`, one ticket per wave, with a 52-wave cap "you allowed" (3088fd9b)
mode:            not seen. The window runs autonomously: no AskUserQuestion, and the dispatch notes carry an earlier user
                 authorisation verbatim, "It's okay to merge on local test results" (2a7c0637)
waves:           52 of 52 allowed, plus 5 follow-on jobs not counted as waves (04-02, 02-06, 05-01, 07-02, 07-05), each
                 picking up a ticket whose job ran out of budget (per final report, 3088fd9b)
dispatches:      whole session: not countable from the events read. The final report's "about 57" (52 waves + 5
                 follow-ons) is too low, because waves held up to 6 dispatches (w37 had 6, w47 had 6, and the trace edge w20_d6).
                 Covered (11-07 02:45 onward): 37 workflow tasks, 31 launched (w37-w52 + w39-d1r, w47-d2r) + 6 stopped w36
topology mix:    1 to 6 dispatches per wave (w37 had 6, w41 had 3, w47 had 6), each one a custom "standard ship-one-ticket chain" (Workflow name "Build the standard ship-one-ticket
                 chain and run dispatch.js"), launched with scriptPath SCRATCH/plugin/ship.js, args {localMerge, now,
                 scratch, t:{id, name, dependsOn:[], notes}}. Up to 4 ran at once (per final report, user-requested cap)
status:          covered window (37): done 27, exhausted 1 (w39-d1), over_budget 1 (w47-d2), stopped-by-cap 2
                 (w47-d4/d5), failed-by-restart 6 (w36); blocked 0.
                 Round 3, w20-w35 (30 dispatches): done 24, exhausted 3 (w20-d1, w21-d1, w26-d1; each finished by a
                 -r continuation), failed-by-restart 3 (w33-d1, w33-d3, w34-d1). w20-d5 not seen.
                 w1-w19 (summary 925b15d5 only): 29 tickets merged (#1-#29); failed: w4 (1st restart), w11-d1 (worked
                 on the user's status question), w11-d2 (dependsOn named a same-wave dispatch), and 8 running workflows
                 (2nd restart, ~22:35Z 11-05)
                 Whole session: ≥ 67 dispatches with ids (w20-w52) + ≥ 30 in w1-w19; 4 container restarts killed
                 ≥ 18 dispatches (w4, 8, 3, 6)
agents:          144 agent labels across the 37 tasks (4-6 per launched run, Grapher in each)
subagent_tokens: 17,865,471 across the covered tasks; duration_ms summed 687,858,004 (191 h).
                 Round 3: + 9,067,652 tokens, 213,937,876 ms (59.4 h) and 74 agent labels, for the 15 w20-w29
                 notifications read unfiltered. The others in w26-w35 fall in the assistant-only window, so their usage is not captured.
                 Known total ≥ 26.9M
wall clock:      2026-11-04 23:58 (inventory) -> final report 11-09 07:54:26 (c7f39d79) = about 4 d 8 h. In the window:
                 00:11:56 -> 07:54:26 = 7h43m
cost:            $2,187.22 at the final report (c7f39d79); $2,119.59 at 11-09 00:58 (8cfe12ec), so the last 6 tickets
                 plus wrap-up cost about $68 of main-loop spend. $2,187.27 after /usage (e999574a)
main context:    peak in the window 157,477 tokens (3088fd9b, the final report). Compactions:
                 - 7aee9bed (11-06 00:43): pre 284,921 tokens, post 17,586, cumulative dropped 490,284, so at least one earlier compaction was not seen;
                 - 267cd378 (11-07 05:01);
                 - 7474285c (11-08 15:13).
                 Cumulative cost was $1,024.92 at /usage 8e052c92 (11-06 18:39) and $1,144.71 at result ed335258 (11-07 00:48)
human input:     11-07 02:45 onward: 10 messages (1eac3adb..40bffac6, obs. 14), then "/usage" (c2dee9ff, 11-09 12:31), answered with "Usage isn't shown in this chat"
                 (bb9c2d7e). Earlier interventions known only from the final report: the 52-wave cap, "merge on local test
                 results", a 4-at-a-time concurrency cap that stopped 07-07 and 07-08, and the 2026-11-08 change to run
                 full suites once
outcome:         STATUS done: 78/78 tickets merged into `candidate` (765 commits ahead of main; nothing merged to main),
                 PRs #1..#81 merged locally while GitHub Actions was down, CI never ran. Trace session.mmd (816 lines) sent
                 with SendUserFile (3a28af5b). The user replied only with /usage. No correction, no explicit acceptance
```

Per-dispatch in the window (task_notification usage; agents from the workflow_progress labels; ticket from the orchestrator's merge report):

| Task id | Wave | Ticket | Status | duration_ms | total_tokens | agents | started / notified | merge report |
|---|---|---|---|---|---|---|---|---|
| w98tbsa7y | w49-d1 | 10-04 Attack panel | done, merged #76 | 20,462,033 | 594,661 | 4 | before window / fd20e9e3 | 5efe9315 |
| wf0d9437u | not seen | 07-07 Retention and tombstones | done, merged #78 | 26,768,046 | 779,914 | 6 | before window / 39ca7d24 | 5e4a8afa |
| w6hm5fxr8 | not seen | 10-05 Seed in AWS | done, merged #77 | 17,578,318 | 612,885 | 4 | before window / 9cbec274 | bae126b2 |
| wv7r05rtx | w51-d1 | 07-08 Organisation cost (RESUME after the concurrency cap stopped it) | done, merged #79 | 13,226,350 | 455,546 | 4 | 51e20401 / 6b38fac6 | bfa3eba4 |
| wpsp28es5 | w52-d1 | 10-06 README and automated demo | done, merged #80 | 13,234,182 | 516,663 | 4 | b4dcac5e / 0e26b2a5 | e80e0055 |
| wxe2mu2b4 | follow-on | 07-05 Version comparison | done, merged #81 | 40,594,788 | 670,999 | 6 | before window / 998ed665 | 3088fd9b |


## Per-dispatch status, waves 36 to 52 (round 2; every row cites an event id)

The status comes from the orchestrator's reply to each task notification ("merged into candidate as #N", "ran out of review rounds", "ran out of budget"). Usage figures come from the system task_notification. The agents column counts workflow_progress agent labels. Ticket numbers are the orchestrator's own. The status-evidence event is the orchestrator text that states the status.

| Dispatch | Ticket | Task id | Launch ev | Notification ev | Status | Status evidence ev | duration_ms | total_tokens | agents |
|---|---|---|---|---|---|---|---|---|---|
| w36-d6 | 09-06 Demo environment and deploy workflow (infra) (round 3) | wo9ysokyr | cce316f5 | 585fa838 | failed (stopped by worker restart, 4th container restart; ticket relaunched in w37) | 585fa838 | - | - | 3 |
| w36-d5 | 06-04 Resume and Conversation lifecycle (round 3) | w57copqo4 | 56448b05 | a7bcc9bb | failed (stopped by worker restart, 4th container restart; ticket relaunched in w37) | a7bcc9bb | - | - | 2 |
| w36-d3 | 06-02 Operational Settings and origin enforcement (round 3) | wi9k5wwoi | a1eb1bb4 | e7622f14 | failed (stopped by worker restart, 4th container restart; ticket relaunched in w37) | e7622f14 | - | - | 1 |
| w36-d1 | 07-01 Conversations viewer (round 3) | wuzsjdlkf | bef10bb6 | 715b98ff | failed (stopped by worker restart, 4th container restart; ticket relaunched in w37) | 715b98ff | - | - | 2 |
| w36-d2 | 08-01 Input Guardrail: local classifier, block mode (round 3) | w8t6avze6 | 53389b31 | 9ed1524b | failed (stopped by worker restart, 4th container restart; ticket relaunched in w37) | 9ed1524b | - | - | 1 |
| w36-d4 | 06-03 Branded widget (round 3) | wm1ey68pm | 3eacd3ae | 76fb0815 | failed (stopped by worker restart, 4th container restart; ticket relaunched in w37) | 76fb0815 | - | - | 1 |
| w37-d5 | Resume and Conversation lifecycle | wtzt06fvw | 2ca7ed15 | e95e8103 | done, merged #54 | b6f6d6ef | 5,200,371 | 366,355 | 4 |
| w37-d4 | Branded widget | w12idc9fe | eb617949 | 079a1378 | done, merged #55 | 53e4b1a6 | 10,531,210 | 613,727 | 6 |
| w37-d6 | Demo environment and deploy workflow | w2zqmbp4z | f85eb5de | 8a561051 | done, merged #57 | 77ad6d0d | 17,030,989 | 425,511 | 4 |
| w37-d1 | Conversations viewer | ws93kc49j | a50bc0f5 | 0ebd4dac | done, merged #58 | 14bc0099 | 21,764,780 | 627,327 | 6 |
| w37-d3 | Operational Settings and origin enforcement | w23rw77xd | 5b0efd72 | 4fd5dc51 | done, merged #60 | fb18e436 | 27,065,595 | 500,057 | 4 |
| w37-d2 | Input Guardrail: local classifier, block mode | w16md33s1 | c51570ed | 1a41ec8a | done, merged #56 | ce4a785f | 32,187,958 | 489,277 | 4 |
| w39-d1 | Message Feedback | whhgpve7e | 2b919c56 | 0eabebb7 | exhausted (out of review rounds while backend tests ran); follow-on w39-d1r | 4301bb0c | 16,830,735 | 608,546 | 4 |
| w38-d1 | WCAG 2.2 AA widget | wiwswsb6p | 37dd2bf4 | a87b30c8 | done, merged #59 | 8d61b807 | 33,105,467 | 610,852 | 4 |
| w41-d1 | Warn and log modes | wkupsxt4u | 9d1200fb | f82b9005 | done, merged #61 | 03b0a4ef | 24,418,421 | 526,126 | 4 |
| w41-d2 | LLM classifier | wf8scoyq0 | bf2cf4c6 | 2ac28fbd | done, merged #62 | 92be402e | 32,854,336 | 815,281 | 6 |
| w39-d1r | Message Feedback | w55l7qd8e | 7a0d8ddf | bd7c68fe | done, merged #65 | f69e6696 | 30,377,163 | 484,684 | 4 |
| w41-d3 | Classifier-based ingestion scan | ws7cqs5ok | dacd92a9 | f92c2fc2 | done, merged #64 | 233db682 | 42,938,720 | 770,690 | 4 |
| w40-d1 | Rate limits | wqvkul6r9 | d145bba3 | 1980abe4 | done, merged #63 | befd42f6 | 52,228,872 | 983,883 | 6 |
| w43-d1 | Attack evaluation suite | wgsp8w1rd | b0a5f349 | e1f11767 | done, merged #66 | 86a7bed1 | 11,901,020 | 566,862 | 4 |
| w42-d1 | Conversation Rating | wjg7qims2 | 5737d3eb | c8456e6f | done, merged #67 | 481d696b | 23,383,384 | 643,781 | 4 |
| w44-d1 | Token Budget | wwslepd6g | e9b34f1d | 1b6b5094 | done, merged #68 | aca21ba9 | 19,391,350 | 619,449 | 4 |
| w46-d1 | Demo host pages | wugle9vyh | 6b7fec86 | 5616d89e | done, merged #69 | 83283157 | 10,519,915 | 829,135 | 6 |
| w45-d1 | Rollups and Version KPIs | wj07u5swz | f5e89c8f | f1be2ff8 | done, merged #70 | 9901bbfe | 22,318,971 | 698,130 | 4 |
| w47-d4 | Retention and tombstones | wwv00khki | 0474543a | 1435f92b | stopped by orchestrator (user-requested 4-at-a-time cap); resumed later as w49-d2 | b4d1e5b7 | - | - | 1 |
| w47-d5 | Organisation cost page | w7hm5ioy7 | 4de3a5b9 | ba9cb199 | stopped by orchestrator (user-requested 4-at-a-time cap); resumed later as w51-d1 | b4d1e5b7 | - | - | 1 |
| w47-d3 | Time series | wxotjx53g | 00c8ecdc | 6865a276 | done, merged #71 | 87343c2a | 16,158,613 | 543,965 | 4 |
| w47-d1 | Seeded history | w2oa07wzg | 496a5800 | 597dfbd2 | done, merged #72 | c8a48dd9 | 22,172,255 | 605,176 | 4 |
| w48-d1 | Parallel backend test suite | w2n0o2949 | affeb12b | cd1d0ade | done, merged #74 | b0d8d300 | 11,767,581 | 411,646 | 4 |
| w47-d2 | Version comparison | w9px4wjvc | a5f9d144 | 7c3ea5de | over_budget (ran out of budget in final check); follow-on w47-d2r | 0cc85c17 | 32,822,972 | 813,347 | 6 |
| w47-d6 | Guardrail analytics and alerts | w90z3zlye | 27c880c3 | c9372d80 | done, merged #73 | 02560b15 | 39,023,609 | 680,996 | 4 |
| w49-d1 | Attack panel | w98tbsa7y | a6b93312 | fd20e9e3 | done, merged #76 | 5efe9315 | 20,462,033 | 594,661 | 4 |
| w49-d2 | Retention and tombstones | wf0d9437u | 263fec74 | 39ca7d24 | done, merged #78 | 5e4a8afa | 26,768,046 | 779,914 | 6 |
| w50-d1 | Seed in AWS | w6hm5fxr8 | 242b4fe9 | 9cbec274 | done, merged #77 | bae126b2 | 17,578,318 | 612,885 | 4 |
| w51-d1 | Organisation cost | wv7r05rtx | 2a7c0637 | 6b38fac6 | done, merged #79 | bfa3eba4 | 13,226,350 | 455,546 | 4 |
| w52-d1 | README and automated demo | wpsp28es5 | 185548b4 | 0e26b2a5 | done, merged #80 | e80e0055 | 13,234,182 | 516,663 | 4 |
| w47-d2r | Version comparison | wxe2mu2b4 | dc1a73b8 | 998ed665 | done, merged #81 (final report) | 3088fd9b | 40,594,788 | 670,999 | 6 |

Totals for the 37 workflow tasks seen:
- 31 launched (w37-d1 .. w52-d1, plus follow-ons w39-d1r and w47-d2r) and 6 stopped from wave 36.
- **total_tokens 17,865,471**, duration_ms summed 687,858,004 (191 h of workflow time; up to 6 ran at once), and 144 agent labels.
- Statuses:
  - done: 27 (one merge per ticket, PRs #54 to #81);
  - exhausted: 1 (w39-d1, out of review rounds; w39-d1r finished it as #65);
  - over_budget: 1 (w47-d2, out of budget in its final check; w47-d2r finished it as #81);
  - stopped by the orchestrator under the user's concurrency cap: 2 (w47-d4 and w47-d5, resumed as w49-d2 and w51-d1);
  - failed, killed by a worker or container restart: 6 (wave 36, all relaunched as w37-d1..d6).
- No dispatch ended blocked.

## Per-dispatch status, waves 20 to 35 (round 3; every row cites an event id)

The wave↔ticket↔task mapping comes from the orchestrator's state.md edits:
- 0f9b9d81 (11-06 00:45) lists w20-d1..d4, w20-d6, w21-d1 and w22-d1 with their task ids;
- later Bash edits add the others (`d6Vc-early-scan.txt`, PAIR lines).

Status evidence is the orchestrator's reply text. Usage comes from the task_notification and is shown only where the page was read unfiltered. "n/c" means the notification fell in the assistant-only window (11-06 14:01 to 11-07 02:17).

| Dispatch | Ticket | Task id | Launch ev | Notification ev | Status | Status evidence ev | duration_ms | total_tokens | agents |
|---|---|---|---|---|---|---|---|---|---|
| w20-d1 | 04-02 Markdown editor | wp3h0zgoi | before window (state 0f9b9d81) | 660da1e3 | exhausted: out of review rounds before the backend run finished, no defects found; follow-on w20-d1r | 1acbebda | 20,210,460 | 820,110 | 7 |
| w20-d2 | 04-06 Citations and Trace drawer | wwungfwdg | before window (0f9b9d81) | 1add465d | done, merged #33 | 65a7045e | 16,524,210 | 682,424 | 6 |
| w20-d3 | 04-07 Full AgentConfig editor | w2mplexes | before window (0f9b9d81) | 7c466071 | done, merged #31 | c1568df8 | 10,106,335 | 467,949 | 4 |
| w20-d4 | 03-09 Provider Embedding Models | wwzup8ee5 | before window (0f9b9d81) | 69a7d79f | done, merged #30 | f109e94a | 7,331,080 | 438,067 | 4 |
| w20-d5 | not seen (not in the 00:45 STATUS line) | - | - | - | not seen | - | - | - | - |
| w20-d6 | 03-08 OCR toggle | w5tuwbdme | before window (0f9b9d81) | cd6fb6d0 | done, merged #32 | 82d2dbe5 | 14,254,864 | 653,074 | 6 |
| w21-d1 | 02-06 Theme logo and avatar | wct50cxzl | before window (0f9b9d81; summary 925b15d5 §8) | 67e0a2f2 | exhausted: out of review rounds with 4 real defects (500 on remove/save, stuck upload phase, size-limit bypass); follow-on w21-d1r | 1e65a45d | 18,819,050 | 795,890 | 7 |
| w20-d1r | 04-02 Markdown editor (continuation) | wfjm5iaf6 | 6c435a24 | 4329f69f | done, merged #35 | a0e7f125 | 4,732,971 | 379,925 | 4 |
| w21-d1r | 02-06 Theme logo and avatar (continuation, feedback quoted) | w3ytl9e63 | 9c81b8f5 | 3d4a3de5 | done, merged #39 | 89668394 | 11,617,086 | 463,508 | 4 |
| w22-d1 | 03-04 Ingestion failures and limits | wssco1ime | 92ab2a63 | f7f7e35a | done, merged #34 | 6a1f421d | 14,611,579 | 575,099 | 4 |
| w23-d1 | 03-07 Heuristic ingestion scan | wawf06m3e | 291720a0 | 111e520f | done, merged #36 | cd4c1b45 | 17,374,758 | 787,333 | 6 |
| w24-d1 | 10-01 Seed foundation | wmpqgef1g | 806b0950 | c2fcbf7c | done, merged #38 | 1c6497c9 | 21,837,350 | 687,540 | 4 |
| w25-d1 | 08-04 Canary token | w9einzdiz | 42f75191 | f25cc7e6 | done, merged #37 | b6ad9533 | 13,011,038 | 568,328 | 4 |
| w26-d1 | 05-01 Project Instructions Versions | wtpe332l1 | 3ba4ca7c | n/c | exhausted: images and e2e not rerun at the final head because the disk was full (1.4G); follow-on w26-d1r | a7bb22ad | n/c | n/c | 5 |
| w26-d2 | 03-10 Re-embed on Embedding Model change | wioq4u9if | 43a206d9 | n/c | done, merged #43 | a7bb22ad (state ce8a9b7b) | n/c | n/c | 5 |
| w26-d3 | 03-11 Permanent Project deletion | w5jfqxwj3 | d80e7b5d | 82f10010 | done, merged #40 | c2fa2979 | 13,953,632 | 535,768 | 4 |
| w27-d1 | 04-04 Tag scoping | wiz83djq3 | 8e692435 | 540e1592 | done, merged #41 | b6915642 | 16,341,678 | 689,986 | 6 |
| w28-d1 | 04-05 Reranker | w8frr903c | 08727362 | n/c | done, merged #44 | 5c61bd8d (state 5793f3e4) | n/c | n/c | 3+ |
| w29-d1 | 04-08 Playground errors and reset | wvp2lwynt | e69bd51e | 230a7271 | done, merged #42 | 7d22c7e0 | 13,211,785 | 522,651 | 4 |
| w30-d1 | 04-09 Agent Archive and delete | wvegz30mx | f84b4ab4 | n/c | done, merged #45 | d42c458b (state f6bc1f87) | n/c | n/c | 3+ |
| w26-d1r | 05-01 (continuation: images and e2e only) | wpd3kpvq8 | 67f1de93 | n/c | done, merged #46 | 431548be (state 4b15243c) | n/c | n/c | n/c |
| w31-d1 | 03-02 criterion-6 gap closure with real HF models | wq3c6tait | 2272bdb8 | n/c | done, merged #47; it also fixed a real bug (the worker image never bundled the embedding model) | 559a01cf (state ffbdbc1d) | n/c | n/c | 1+ |
| w32-d1 | 05-02 Publish Agent to Live Version | w1hzgr5f2 | 3332fe95 | n/c | done, merged #48 | 6c481c48 (state 801fb316) | n/c | n/c | n/c |
| w32-d2 | 05-06 Playground Instructions picker | wf32a7svi | af21e786 | n/c | done, merged #49 | 3c6cd50c (state 44537a4d) | n/c | n/c | n/c |
| w33-d1 | 06-01 Embed tracer | wnysc9gnv | 8d27783a | n/c | failed: killed by the 3rd container restart (~21:4xZ 11-06); relaunched as w35-d1 | 83c014ed; RESUME note in 824b0095 | n/c | n/c | n/c |
| w33-d2 | 05-03 Revert via Live History | wmswwhd88 | 074bd04d | n/c | done, merged #50 | a65d0897 (state 564715f3) | n/c | n/c | n/c |
| w33-d3 | 05-04 Diffs and Draft management | wvhhuhh9n | b43b1446 | n/c | failed: 3rd restart; relaunched as w35-d2 | 83c014ed; cde9c8ee | n/c | n/c | n/c |
| w34-d1 | 05-05 Bulk publish, bulk revert and Instructions rollout | wk8w7571k | 428cb5ec | n/c | failed: 3rd restart; relaunched as w35-d3 | 83c014ed; cad64887 | n/c | n/c | n/c |
| w35-d1 | 06-01 Embed tracer (RESUME) | wlp1s79zh | 824b0095 | n/c | done, merged #53 | e98824b4 (state 8e8a5399) | n/c | n/c | n/c |
| w35-d2 | 05-04 (RESUME) | wphfj3yla | cde9c8ee | n/c | done, merged #51 | eb550119 (state fb8c8d7a) | n/c | n/c | n/c |
| w35-d3 | 05-05 (RESUME) | wzd82ml6h | cad64887 | n/c | done, merged #52 | 5b97900c (state 31c036b7) | n/c | n/c | n/c |

Totals for w20 to w35:
- 30 dispatches seen: done 24, exhausted 3, failed by restart 3; w20-d5 not seen.
- The 15 notifications read: 9,067,652 tokens, 59.4 h of workflow time and 74 agent labels.
- The orchestrator counted each `-r` continuation as part of its original slot, not as a new wave, and recorded that as a decision NEEDING HUMAN REVIEW (summary 378dbfc5 §3).

## Waves 1 to 19: ticket-level only (round 3)

The source is compaction summary 925b15d5 (11-06 00:43). Per-dispatch rows are not available because paging stopped at 11-06 00:42.
- **w1-d1** "Map tickets and frontier": done (2871a770).
- **Merged by w19:** 29 tickets on `candidate` @9e5a8bb. Ticket → PR:
  - 01-01..01-12: #1 #2 #3 #6 #11 #13 #9 #14 #16 #15 #10 #17;
  - 09-01..09-05: #5 #4 #7 #8 #12;
  - 02-01 #20, 02-02 #22, 02-03 #21, 02-04 #23, 02-05 #19;
  - 03-01 #18, 03-02 #24, 03-03 #29, 03-05 #28, 03-06 #26;
  - 04-01 #25, 04-03 #27.
- **Failed dispatches** (925b15d5 §4):
  - **w4:** killed by the 1st container restart.
  - **w11-d1:** "misread the user's status question as its task". It was re-dispatched with the authorisation quoted verbatim and the note "status questions are for the orchestrator".
  - **w11-d2:** "failed because its dependsOn named a dispatch in the same wave". It was re-dispatched as wave 12.
  - **All 8 running workflows:** killed by the 2nd restart (~22:35Z 11-05), when 8 ran under the user's "double the workflow limit until 10:30pm". 6 were relaunched from the surviving worktrees, which became the w20 rows above.
- **03-02:** blocked on criterion 6 and accepted as a recorded gap. It was later closed by w31-d1 (#47).
- **Other events:**
  - w11/w12 merge dispatches ran `SCRATCH/plugin/dispatch.js` directly.
  - The orchestrator stopped all work at 97% of the 5-hour usage limit, wrote a handoff branch (`orchestrator/handoff-2026-11-05`) and ran a keep-alive script until the reset.

Wave-level status for all 52 waves: every one of the 78 tickets ended merged (final report 3088fd9b).

## Observations

1. **It launched a custom wrapper from SCRATCH, not the plugin path.** Both launches in the window use `scriptPath: SCRATCH/plugin/ship.js` (2a7c0637, 185548b4), and the workflow title says "run dispatch.js". So the orchestrator copied the plugin into `SCRATCH/plugin/` and wrote a ticket-shipping chain around dispatch.js. That agrees with the retro (prior-findings R1 lists d6Vc) and inventory section E. I did not see the original refusal or the copy step; both happened before the window.

2. **(round 1, corrected in obs. 15) Every wave in the 11-09 window was one ticket, with an identical chain each time.** Each wave held a single dispatch (`t.id` w51-d1, w52-d1, `dependsOn: []`), so all parallelism came from up to 4 one-ticket waves running at once (per final report item 7). There was no fan-out or multi-dispatch wave. That made 52 waves for 78 tickets, plus 5 follow-ons that each "picked up a ticket whose job ran out of budget" (3088fd9b, item 2). The out-of-budget follow-ons are the only failure mode the final report counts.

3. **A lot of operational context was pasted into dispatch notes.** The w51-d1 notes (2a7c0637) carry:
   - a RESUME paragraph: worktree path, commit hashes, "re-merge origin/candidate first (it is at 9b06d3a…)";
   - disk rules: "check df before every image build…, run 'docker builder prune -af'…";
   - machine limits: "4 CPUs/15 GB shared by 4 jobs";
   - the test command;
   - the user's authorisation, quoted verbatim.

   The inputs are about 2.0 to 2.1k characters each. These are standing instructions that a shared brief could hold. Instead they are re-sent with every dispatch.

4. **The orchestrator did cleanup and merge bookkeeping itself, through Bash.** After each notification it ran a long Bash block (4567cb0c, 9dde5635, 07827f24, 09167a95, 05837e15, 03be3bb0). Each block:
   - ran `git worktree remove --force`;
   - did `rm -rf` on the clones;
   - ran `docker rm/rmi/image prune/volume prune`;
   - edited state.md with a `python3 - <<EOF` string-replace;
   - ran `git fetch` and `git log` on origin/candidate;
   - checked `df -h`.

   viol2 counts 10 Bash calls, 6 git writes, 8 reads/greps and 8 state.md edits via Bash, all within 7h43m. Some calls also looked inside running work:
   - `ls -t .../subagents/workflows/wf_e86e573e-769/` and `pgrep -af "pytest|eval.*0705"` (05837e15) checked on a running job's journal and processes;
   - 8848bfda used `git show` to read a ticket file;
   - 07827f24 pulled a 5,486-character evidence README into the main loop (9fc5fbe8, "**Status: done.** Every criterion is met…").

   One call failed with exit 1 (8a6c92e6). There was no sleep or Monitor polling: the poll hit for 03be3bb0 matched a cleanup command, not a wait loop.

5. **Disk pressure was a constant constraint.** Each merge report ends with the free disk space: 14G (5efe9315), 11G (5e4a8afa, bae126b2), 15G (bfa3eba4), 16G at the end. The dispatch notes added disk rules (observation 3). The 4-job concurrency cap that stopped 07-07 and 07-08 came from the user (3088fd9b, item 7). The w51-d1 RESUME note says the earlier dispatch "was stopped soon after launch (orchestrator capped concurrency)".

6. **Merges went ahead without CI, on local runs only.** GitHub Actions was down, so every merge relied on full local test runs, under the user's "It's okay to merge on local test results" (2a7c0637). The report states plainly: "CI has never run on any of this", the README badges have never been green, and no real AWS, Terraform or OIDC was exercised (3088fd9b, items 1 and 5). It also flags that 10-06's README was written before 07-05 merged (item 8).

7. **The `now` arg is a bare date.** Both launches pass `"now": "2026-11-09"` (2a7c0637, 185548b4) rather than a timestamp. The retro flagged invented `now` values in other sessions. Here it is at least a real date, but without a time.

8. **The scribe and trace worked.** A Grapher label finished `done` in all 6 runs in the window. The orchestrator located render-trace by `find / -name render-t…` (2871a770), rendered an 816-line session.mmd and sent it as a file (3a28af5b) rather than pasting it.

9. **The main context stayed moderate in the window.** It peaked at 157,477 tokens (3088fd9b) and never compacted. Each notification turn cost $8 to $20 of main-loop spend (cumulative cost 2,119.59 → 2,139.34 → 2,147.72 → 2,162.07 → 2,177.36 → 2,187.22). The whole session's $2,187 is by far the largest cost of any inventoried session.

10. **The user did not engage with the outcome after the final report.** The only later human input is `/usage` (c2dee9ff, 11-09 12:31). After that, only `turn_handoff_available` system events follow, up to 11-12 22:32 (e993d397). The report leaves several decisions to the user: promote `candidate` to main, delete 8 leftover branches including `orchestrator/handoff-2026-11-05`, review the 03-02 OCR model source (3088fd9b). None of them was acted on in the transcript.

11. **(round 2) Container restarts killed whole waves.** At 11-07 03:29 a worker restart stopped all six wave-36 workflows (task_notification "Stopped by a worker restart", 585fa838, a7bcc9bb, e7622f14, 715b98ff, 9ed1524b, 76fb0815). It also stopped about 20 background Bash waits. The orchestrator said it was "the fourth time" (1947645e) and relaunched the same six tickets as w37-d1..d6 within 5 minutes (launches a50bc0f5, c51570ed, ...). All six then merged (#54 to #58, #60).

12. **(round 2) Two compactions.** These are compact_boundary 267cd378 (11-07 05:01, 729,108 tokens dropped, 14,114 tokens after) and 7474285c (11-08 15:13, 920,040 tokens dropped, 13,084 tokens after). Each was followed by a "continued from a previous conversation" summary (378dbfc5, 74bb787c).

13. **(round 2) Polling through background Bash.** In the covered window, 74 background Bash tasks were `until grep -q ALLDONE|^exit ...` wait loops on test logs, for example b1ajug5l3, bne4rbj06, and the `timeout 590 ... while ! [ -f gate.txt ]; do sleep 30` loop seen in round 1. The orchestrator itself ran and watched each ticket's test runs, which counts as a polling and doing-the-work violation. There were also 14 `permission_denied` Bash events (e.g. 45dbb9d6, 880449a5, 3c846615).

14. **(round 2) Human interventions between 11-07 and 11-09: 10 messages.**
    - Asked about workflow agents and stalls: "are you able to inspect agents in workflows…" (1eac3adb) and "…what is causing the agents to stall? 3/4 are currently marked as stalled" (10dd8594).
    - Asked about test sharding: "…instructing future workflows to shard test runs?" (11a3bb76).
    - Capped concurrency: "shall we limit concurrent runs to 4 tickets…" (ff903552) and "why are all workflows currently stalled?" (bc4224f8). The 4-at-a-time cap made the orchestrator stop w47-d4 and w47-d5 (b4d1e5b7).
    - Approved and sequenced the parallel-test work: "I approve" (a8915577), "Are the subsequent tickets blocked on the speed up work?" (57e4edb5), and "Keep the parallel-test job first in the queue, don't dispatch subsequent tickets until that work gets merged" (fbcbc5e3). That led to w48-d1 (merged as #74, b0d8d300).
    - Checked on progress: "Is the full suite also only run at the end now" (1c2bdf3e) and "How many tickets remain?" (40bffac6).

    The user steered resource use and throughput. They did not correct the outcomes.

15. **(round 2) Every launch used the copied wrapper.** All 31 launches in the window pass `scriptPath …/scratchpad/plugin/ship.js` (see `d6Vc-dispatches.json`). Their args run from 955 to 3,013 characters, because each dispatch carries the RESUME, disk and test-rule notes. The waves are multi-dispatch: w37 had 6, w41 had 3 and w47 had 6. That corrects round 1's "one ticket per wave" for the waves now covered, and the trace edge `w14_d2 --> w20_d6` (2871a770) shows that earlier waves were also multi-dispatch.

16. **(round 3) Container restarts were the main way dispatches failed.** Four restarts killed at least 18 dispatches:
    - the 1st killed w4;
    - the 2nd killed 8 (~22:35Z 11-05, while 8 ran at the doubled cap);
    - the 3rd killed 3 (w33-d1, w33-d3, w34-d1, ~21:4xZ 11-06, with only 3 running, "cause unknown", corrected in 5c0272aa);
    - the 4th killed 6 (w36).

    By comparison, only 4 dispatches ran out of review rounds or budget in w20-w52 (w20-d1, w21-d1, w26-d1, w39-d1), plus w47-d2 over budget. After each restart the orchestrator had to:
    - start dockerd by hand (80344ce2);
    - relaunch each killed ticket under a NEW wave id, with a RESUME note naming the worktree and the origin commit (824b0095, cde9c8ee, cad64887).

    So every restart used up a wave of budget. Waves 35 and 37 exist only because of restarts.

17. **(round 3) A user message leaked into a running worker's task.** Per summary 925b15d5 §2 and §4:
    - w11-d1 treated a mid-turn user status question as its task.
    - From then on, every dispatch note carries "Status questions from the user are for the orchestrator, not you" and the user's authorisation quoted verbatim (see every launch, e.g. 8d27783a).
    - w11-d2 failed because its `dependsOn` named a dispatch in the same wave. After that, all dispatches pass `dependsOn: []`, and the orchestrator does the sequencing itself through the frontier.

18. **(round 3) The orchestrator classed exhausted runs by their cause and wrote continuation notes to match:**
    - **04-02 (w20-d1):** no defects; "the reviewer ran out of review rounds before the backend test run finished" (1acbebda). The continuation was told only to finish verification.
    - **02-06 (w21-d1):** 4 real defects. The continuation quoted the evaluator feedback (1e65a45d, 9c81b8f5).
    - **05-01 (w26-d1):** an environment gap (disk full). The continuation was told "change no code unless a check fails" (67f1de93).

    All three merged on their continuation. The `-r` dispatches were not counted against the wave budget, a choice the orchestrator flagged for human review.

19. **(round 3) Disk exhaustion caused an exhausted run.** Disk fell to 1.4G free because the build cache had reached 13.5G (a7bb22ad). This made 05-01's image build fail inside the generator-evaluator loop. The orchestrator then:
    - ran `docker builder prune -af` (7e13fabb);
    - added the KNOWN rule "run builder prune -af whenever free disk < 5G" (ce8a9b7b).

    The user raised the wave budget twice in this window: "Raise the wave budget to 40" (9901066b, 11-06 06:41), then to 52 (before result ed335258, 11-07 00:48).
