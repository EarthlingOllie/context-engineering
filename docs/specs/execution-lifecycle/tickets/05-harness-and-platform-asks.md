# 05: Harness and platform asks note

**What to build:** One note, `asks.md` in this spec's folder, that the maintainer can file with the owners of the Workflow tool, Claude Code and the cloud platform. One section per ask, each naming the finding, a short summary of the evidence with a link into the session analysis, and the plugin-side mitigation this spec ships.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A section for each of the six asks: accept a plugin-root `scriptPath` (REL-01); carry the script's returned status into the notification (REL-05); allow subagent writes under the session scratchpad (QUA-05); a restart notice or drain (REL-03); classifier availability (REL-08); faster or visible plugin sync (REL-07)
- [ ] Each section names its owner (harness or platform), the sessions affected, and links to the finding
- [ ] Each section states the plugin-side mitigation, or that there is none
- [ ] No session ids beyond those already in the session analysis, and no personal details
