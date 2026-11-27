# 03: Plugin version stamp

**What to build:** Anyone can tell which build produced a run. The build injects the package version plus the git short commit into the bundled dispatch script; it appears in the returned data, every dispatch trace line and the diagram header, and SKILL.md's mode line records it. REL-07.

**Blocked by:** None (can start immediately)

**Status:** done (dispatch-eval run vs the frozen baseline pending, ADR-0005)

- [x] Bundle test: the built script's version matches the package version
- [x] Dispatch seam: the returned data and the dispatch line carry the version
- [x] Render seam: the diagram header shows it; an old trace without it still renders
- [x] Docs seam: SKILL.md's mode line records it

Note (stamp source): the commit in the stamp is the last commit that changed the bundle's inputs (`src/`, `package.json`, `package-lock.json`, `build.mjs`), not HEAD, so committing a rebuilt bundle no longer leaves it dirty.

## Dispatch-eval run (2026-11-27, claude-opus-5-5, 3 epochs, cap 2, vs frozen baseline 3035a58f6828 (5 epochs); same-day baseline rerun reproduced it)

Scorecard: `graph-orchestrator/evals/out/scorecards/7c914658b2b2-20261127T150236Z.json` (local, gitignored; archived with its compare.py output and .eval logs outside the repo).

**Partial: 2 valid epochs of 3.** API credit ran out during epoch 3 ("credit balance is too low"), so every sample in that epoch failed for infrastructure reasons. On the 2 valid epochs every sample's pass rate holds. Dollar flag: sample 05 +$0.050 (band $0.036): output tokens rose (~6.4k vs ~5.7k) and cache writes rose. Re-run epoch 3 after a credit top-up. Run cost $11.37.
