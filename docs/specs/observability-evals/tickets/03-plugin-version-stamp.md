# 03: Plugin version stamp

**What to build:** Anyone can tell which build produced a run. The build injects the package version plus the git short commit into the bundled dispatch script; it appears in the returned data, every dispatch trace line and the diagram header, and SKILL.md's mode line records it. REL-07.

**Blocked by:** None (can start immediately)

**Status:** done (dispatch-eval run vs the frozen baseline pending, ADR-0005)

- [x] Bundle test: the built script's version matches the package version
- [x] Dispatch seam: the returned data and the dispatch line carry the version
- [x] Render seam: the diagram header shows it; an old trace without it still renders
- [x] Docs seam: SKILL.md's mode line records it

Note (stamp source): the commit in the stamp is the last commit that changed the bundle's inputs (`src/`, `package.json`, `package-lock.json`, `build.mjs`), not HEAD, so committing a rebuilt bundle no longer leaves it dirty.
