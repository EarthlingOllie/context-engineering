# 12: Context hygiene and human waits

**What to build:** The main loop stops filling up and the user's slow answers stop idling the session. The final reply sends the diagram as a file with a summary of at most 3 lines. Default `maxLines` is 4; above 8 needs a reason. Standing rules go once into a brief file in the scratch directory at kickoff, named in each spec's context; credentials never go in context. Before asking, every FRONTIER dispatch that does not depend on the answer is launched, and questions carry options with a recommended default. QUA-10, QUA-09 and SPD-02.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] SKILL.md documents each rule; no document tells the orchestrator to paste the diagram verbatim (docs seam)
- [ ] By hand: a session's final reply sends the diagram file, and a question is asked only after independent dispatches launched

**By-hand evidence (2026-11-27, session_016jSC3fsMfuGLacrVjUTYMU, plugin 0.5.0+eaf50f7)**

Question part: T2's block (w2-d2, run wf_5a9148c5-8a9) was handled at 23:49:43Z, after both independent dispatches had launched (T1 w2-d1 23:37:46Z, T3 w3-d1 23:39:16Z) and finished; it carried 3 options with (a) recommended. Autonomous mode, nobody to answer, so it was recorded as a best guess rather than asked.
Diagram part: SCRATCH/session.mmd was sent as a file (not pasted) at 23:52Z, but as a separate step before the final reply; the final reply (UNVERIFIED first, summary) is sent after this record. The ticket asks that the final reply send the diagram, so this ordering does not evidence it, and the <=3-line summary is unseen.
Box left unticked: final-reply part pending; the question was never actually put to a person.
Final reply (~23:55Z) sent SCRATCH/session.mmd as a file (SendUserFile, after re-render incl. w6) without the orchestrator opening it, but its summary was a ~12-row per-check table, not STATUS as one line plus at most 3 lines.
T2's block was never asked of anyone: autonomous mode, recorded as best guess with 3 options (recommended first) after T1 and T3 had launched and finished.
Box stays unticked. Failing parts: summary longer than 3 lines (~12-row table); no question was actually put to a person.
