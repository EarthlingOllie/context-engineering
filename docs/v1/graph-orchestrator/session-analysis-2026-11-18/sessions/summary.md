# Session summary: 20 graph-orchestrator sessions

Built by `SCRATCH/summary-build/build.py` (values transcribed from each `SCRATCH/sessions/<id>.md` Metrics block; the table and totals below are its verbatim output). Saved by the w4 findings generator because the w4-d1-s1 aggregator's Write was refused by the harness.

Legend: `≥` lower bound (partial window) · `~` estimate · `ᵖ` proxy count · `ʳ` workflow-active hours only. `fails` = scriptPath-refused launches / failed / blocked / exhausted / over_budget / stopped (killed by restart or user). `usd` = latest cumulative session cost in the note. Tokens are the notification "subagent_tokens" (sum of final context sizes, not billed volume; see cost-speed.md §1.2).

| id | waves | dispatches | agents | subagent tok (M) | usd | wall h | fails sp/f/b/e/o/s | outcome | user verdict |
|---|---|---|---|---|---|---|---|---|---|
| d6Vc | 52 | ≥97 | ≥218 | ≥26.90 | 2,187.27 | ~103.9 | 0/2/0/4/1/20 | 78/78 tickets merged to candidate; CI never ran; nothing to main | unknown |
| d9gr | 6 | 17 | 67 | 6.75 | 116.29 | 37.9 | 1/0/1/0/0/1 | 36 findings fixed (22 + 14), suites green, pushed, no PR | accepted |
| dJmJ | 9 | 39 | 129 | 8.81 | 49.53 | 1.4ʳ | 1/0/0/1/0/0 | skills catalog + labels (PR #4); contract experiment 'partly supported' | accepted |
| dKG5 | 16 | ~27 | ≥20 | ≥2.75 | 342.28 | 41.4 | 0/0/0/0/0/4 | specs 12+13 merged to main (user merged #98); budget 16/16 hit | corrected |
| dQHS | 5 | 8 | 57 | 5.37 | 29.24 | 0.7 | 2/0/1/0/0/0 | LangGraph design note, panel PASS | unknown |
| efwY | 13 | 13 | 61 | 7.83 | 206.55 | 31.7 | 1/0/1/0/0/0 | 11 spec-14 tickets + fixes merged via PR #103 | accepted |
| eiLu | 23 | 23 | 50 | 3.91 | 32.43 | 8.7 | 1/0/0/0/0/0 | abandoned at 77/78 polling; spec 11 never started | redone |
| eptK | 2 | 3 | 15 | 2.01 | 22.86 | 0.8 | 1/0/0/0/0/0 | topology-candidates report, evaluator pass r2 | accepted* |
| eznd | 13 | 45 | ≥38 | ≥3.77 | 363.84 | ~22.0 | 0/2/2/1/0/0 | 31/31 tickets; PR #3, #4 merged | corrected |
| fMmB | 22 | ≥30 | ? | ? | 1,096.24 | ~60.1 | 0/1/0/0/0/5 | 61/61 tickets pushed; 12 checks unticked; no PR | unknown |
| fS88 | 3 | 4 | 31 | 4.19 | 56.98 | 1.9 | 2/0/0/1/0/0 | 60-finding app test report (104/105 stories) | accepted |
| fm1f | 5 | 11 | 28 | 2.21 | 17.66 | 6.3 | 1/0/1/0/0/0 | 5 topologies, 41->94 tests, PR #3 | accepted |
| fnVU | 16 | 36 | 121 | 12.04 | 121.94 | 7.2 | 1/0/1/0/0/0 | 19/19 pushed, NOT merged; final review 0/3 | unknown |
| g2Kg | 3 | 6 | 24 | 1.44 | 6.60 | 0.1 | 3/0/0/0/0/0 | textkit 33/33, panel 3/3 (plugin test) | accepted (weak) |
| g7is | 11 | 20 | 72 | 7.39 | 192.17 | 13.3 | 1/1/0/0/0/5 | 14 tickets pushed; coverage/e2e gates never run | unknown |
| gRP1 | 1 | 1 | ≥2 | 0.00 | 0.92 | 0.1 | 1/0/0/0/0/1 | nothing delivered (retry killed at 56 s) | abandoned |
| gdsq | 11 | 14 | 56 | 7.53 | 151.27 | 7.1 | 1/0/0/0/0/0 | 13/13 spec-11 tickets merged | accepted |
| hAaY | 4 | 5 | 31 | 1.66 | 9.48 | 0.1 | 0/0/0/0/0/0 | ADR-0002 spike table (5 pass/1 queue/1 no), pushed | accepted (weak) |
| hD76 | 7 | 8 | 62ᵖ | 7.86 | 201.23 | 13.6 | 2/0/0/0/0/0 | 15/15 tickets; walkthrough 151/153 | accepted |
| hQTT | 6 | 11 | 70 | 8.38 | 152.78 | 8.6 | 1/3/0/3/0/0 | Terraform AWS stack + observability pushed; never applied | unknown |

## Totals (n = sessions with a value)

```
waves total 228 median 8.0 n 20
disp total 418 median 13.5 n 20
agents total 1152 median 56 n 19
tok total 120.8 median 5.37 n 19
usd total 5357.56 median 119.12 n 20
wall total 366.89 median 7.88 n 20
sp total 20 median 1.0 n 20
failed total 9 median 0.0 n 20
blocked total 7 median 0.0 n 20
exh total 10 median 0.0 n 20
overb total 1 median 0.0 n 20
stopped total 36 median 0.0 n 20
tok median exact-only 6.0600000000000005
usd/agent-session; sessions w/ any failure 19
{'unknown': 6, 'accepted': 7, 'corrected': 2, 'redone': 1, 'accepted*': 1, 'accepted (weak)': 2, 'abandoned': 1}
sp sessions ['d9gr', 'dJmJ', 'dQHS', 'efwY', 'eiLu', 'eptK', 'fS88', 'fm1f', 'fnVU', 'g2Kg', 'g7is', 'gRP1', 'gdsq', 'hD76', 'hQTT'] 15
```

Note: "sessions w/ any failure 19" counts any non-zero fail column (only hAaY has none).

## Outcome counts (20 sessions)

accepted 7 · accepted (weak) 2 · accepted* 1 (eptK, evaluator pass r2, no correction) · corrected 2 (dKG5, eznd) · redone 1 (eiLu) · abandoned 1 (gRP1) · unknown 6 (d6Vc, dQHS, fMmB, fnVU, g7is, hQTT).

## Cross-session patterns (sessions named in the notes; ≥3 sessions unless marked)

| # | pattern | sessions | n |
|---|---|---|---|
| X1 | scriptPath launch refused at first wave | d9gr dJmJ dQHS efwY eiLu eptK fS88 fm1f fnVU g2Kg g7is gRP1 gdsq hD76 hQTT (+ copy workaround already in use: d6Vc dKG5 eznd; + this session) | 15 (+3) |
| X2 | "Wave 1 dispatched" told to user before the launch failure arrived | dQHS eiLu fS88 g2Kg gdsq fnVU gRP1 | 7 |
| X3 | invented or bare-date `now` | hQTT eptK dJmJ d9gr d6Vc | 5 |
| X4 | stop hook drove commits/pushes or was logged as a human answer | d9gr hQTT fm1f hAaY fS88 g7is eznd hD76 eptK efwY | 10 |
| X5 | self-decisions or non-gate questions drawn as human nodes | eznd dQHS g2Kg efwY d9gr eptK dJmJ fm1f hQTT | 9 |
| X6 | harness notification says "completed" for blocked/exhausted/failed | efwY fnVU eznd g7is d9gr fS88 hQTT | 7 |
| X7 | evaluator/panel false pass on ticket-scoped criteria | efwY eznd hD76 fnVU d9gr g7is (+d6Vc plausible) | 6 (+1) |
| X8 | blocked/exhausted review closed on generator evidence or by the orchestrator | dQHS d9gr fS88 eznd hQTT (+fnVU unresolved, dKG5 budget overrun) | 5 (+2) |
| X9 | harness refused subagent .md report writes | dQHS d9gr fS88 (+this session: reducer and aggregator) | 3 (+1) |
| X10 | container/worker restart killed dispatches | d6Vc dKG5 fMmB g7is d9gr | 5 |
| X11 | orchestrator did evidence work in its main loop | dKG5 d6Vc fMmB d9gr gdsq g7is eznd hD76 fS88 dJmJ | 10 |
| X12 | subagent until/sleep polling loops | d6Vc(74) hD76(129) eznd(37) fMmB(15) gdsq(pgrep loop) (+dKG5 orchestrator 11) | 5 (+1) |
| X13 | parallel builders on one working tree → serialisation or integration cost | d9gr efwY hD76 g7is | 4 |
| X14 | wave barrier idled ready work, or the wave model was bent into a rolling frontier | fnVU eznd gdsq dKG5 fMmB d6Vc | 6 |
| X15 | chain lost later stages or a mid-chain verdict | fnVU hQTT dJmJ | 3 |
| X16 | same-wave dependsOn refused (cheap, but hidden by X6) | eznd g7is d6Vc | 3 |
| X17 | standing rules / large context re-pasted into every spec (one with credentials) | dKG5 efwY gdsq d6Vc g2Kg fS88 | 6 |
| X18 | fixed per-dispatch overhead dominates trivial dispatches (~150k tok, 2 agents) | efwY eiLu d9gr | 3 |
| X19 | subagent permission/classifier denials | eznd fS88 fnVU gdsq d6Vc | 5 |
| X20 | long human waits with nothing else dispatched | d9gr(8h49m) fm1f(5h51m) hQTT(27 min) gdsq(17 min) | 4 |
| X21 | main-loop context > 230k or compaction | d6Vc dKG5 eznd d9gr eiLu g7is (cost-speed.md §3: 6 of 14 > 230k) + fnVU 266k, gdsq auto-compaction | 6 (+2) |
| X22 | usage-limit failure | hQTT eptK | 2 |
| X23 | ran a stale/synced plugin build (wave.js or labels not live) | dJmJ fm1f eptK hQTT | 4 |
