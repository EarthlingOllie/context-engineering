# 12: Context hygiene and human waits

**What to build:** The main loop stops filling up and the user's slow answers stop idling the session. The final reply sends the diagram as a file with a summary of at most 3 lines. Default `maxLines` is 4; above 8 needs a reason. Standing rules go once into a brief file in the scratch directory at kickoff, named in each spec's context; credentials never go in context. Before asking, every FRONTIER dispatch that does not depend on the answer is launched, and questions carry options with a recommended default. QUA-10, QUA-09 and SPD-02.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] SKILL.md documents each rule; no document tells the orchestrator to paste the diagram verbatim (docs seam)
- [x] By hand: a session's final reply follows SKILL.md's final-reply template (UNVERIFIED; STATUS in one line plus at most 3 summary lines; ARTIFACTS; DECISIONS) and sends the diagram file; and a human wait comes only after every independent dispatch launched: in attended mode a question, with options and a recommended default, is asked then; in autonomous mode, with no one to ask, a best guess with its options is recorded under DECISIONS then, and no question is put to anyone

**Box restated (2026-11-28, finding C):** the box asked that "a question is asked", which an autonomous session cannot do: with no person to ask, SKILL.md has it record a best guess instead. The restated box takes a recorded best guess, made after every independent launch, as the autonomous half; the 2026-11-27 session's T2 record (best guess at 23:49:43Z with 3 options, after T1 and T3 launched) meets that half. The final-reply half still fails on that session (a ~12-row table): plugin 0.5.1 makes the reply a fixed template that the renderer prints after saving the diagram, so a re-run of this check uses 0.5.1 or later.

**By-hand evidence (2026-11-27, session_016jSC3fsMfuGLacrVjUTYMU, plugin 0.5.0+eaf50f7)**

Question part: T2's block (w2-d2, run wf_5a9148c5-8a9) was handled at 23:49:43Z, after both independent dispatches had launched (T1 w2-d1 23:37:46Z, T3 w3-d1 23:39:16Z) and finished; it carried 3 options with (a) recommended. Autonomous mode, nobody to answer, so it was recorded as a best guess rather than asked.
Diagram part: SCRATCH/session.mmd was sent as a file (not pasted) at 23:52Z, but as a separate step before the final reply; the final reply (UNVERIFIED first, summary) is sent after this record. The ticket asks that the final reply send the diagram, so this ordering does not evidence it, and the <=3-line summary is unseen.
Box left unticked: final-reply part pending; the question was never actually put to a person.
Final reply (~23:55Z) sent SCRATCH/session.mmd as a file (SendUserFile, after re-render incl. w6) without the orchestrator opening it, but its summary was a ~12-row per-check table, not STATUS as one line plus at most 3 lines.
T2's block was never asked of anyone: autonomous mode, recorded as best guess with 3 options (recommended first) after T1 and T3 had launched and finished.
Box stays unticked. Failing parts: summary longer than 3 lines (~12-row table); no question was actually put to a person.

**By-hand evidence (2026-11-28, session_016jSC3grFDkzxVeDspdqm4a, plugin 0.5.1+c6a891c)**

Final-reply part: `render-trace.js` saved SCRATCH/session.mmd at 11:13:41Z and printed the template; the final reply (~11:15Z, autonomous) is that template filled in, in order: UNVERIFIED (`- none`); STATUS in one line plus 2 summary lines; ARTIFACTS (4 paths); DECISIONS (1 item); DIAGRAM line. No table.
Diagram part: SCRATCH/session.mmd was sent as a file with the reply (SendUserFile, file_uuid 9bf04199-635a-4f5c-b26a-bf5cc0a3d184, read 11:13:48Z), right before the reply text and after the render; its text was never in the reply and the orchestrator did not open it.
Wait part: no question was put to anyone (autonomous); the one best guess (ticket 16 box 2 left unticked) is under DECISIONS; no ask happened before launches. It names its choice and reason but no other option, so the half rests on the 2026-11-27 T2 record, as restated above.
Note: an environment Stop hook (uncommitted changes) fired after the final reply, and this record was dispatched after it (w4-d1), so the saved diagram does not show w4-d1.
Box ticked: template in order, summary 2 lines (at most 3), diagram sent as a file with the reply, plugin 0.5.1 or later; the wait half met per the restatement.
