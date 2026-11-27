# 12: Context hygiene and human waits

**What to build:** The main loop stops filling up and the user's slow answers stop idling the session. The final reply sends the diagram as a file with a summary of at most 3 lines. Default `maxLines` is 4; above 8 needs a reason. Standing rules go once into a brief file in the scratch directory at kickoff, named in each spec's context; credentials never go in context. Before asking, every FRONTIER dispatch that does not depend on the answer is launched, and questions carry options with a recommended default. QUA-10, QUA-09 and SPD-02.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] SKILL.md documents each rule; no document tells the orchestrator to paste the diagram verbatim (docs seam)
- [ ] By hand: a session's final reply sends the diagram file, and a question is asked only after independent dispatches launched
