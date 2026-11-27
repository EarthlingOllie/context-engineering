# 03: Plugin version stamp

**What to build:** Anyone can tell which build produced a run. The build injects the package version plus the git short commit into the bundled dispatch script; it appears in the returned data, every dispatch trace line and the diagram header, and SKILL.md's mode line records it. REL-07.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Bundle test: the built script's version matches the package version
- [ ] Dispatch seam: the returned data and the dispatch line carry the version
- [ ] Render seam: the diagram header shows it; an old trace without it still renders
- [ ] Docs seam: SKILL.md's mode line records it
