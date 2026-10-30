# Changelog
## [0.2.0] - 2026-11-03
### Added
- 2a12011 Add the graph-orchestrator plugin (v1 spec, minus the debate dogfood)
- 80935b8 C10: render wave_end status counts in the wave subgraph title
### Fixed
- 8932302 Apply code-review fixes
- 9efecea C5: parse every --human before appending so a bad one leaves the trace untouched
- d949801 C8: a blocked fan-out reducer keeps the blocked branches' questions
- 9a76a45 C9: short-circuit a same-wave dependant as failed when its dependency did not finish done
- 9390ff5 C3: callRole catches a throwing role agent so the topology's null path keeps accumulated artifacts and iterations
- 907d16c C2: normalise humans up front and drop non-object entries instead of throwing after the dispatches ran
- 29f8127 C6: a fan-out reducer that returns nothing falls back to concatenating the branch results
- bb623ac C1: guard the scribe call so a scribe throw returns scribe: null instead of rejecting the wave
- a676634 C7: hard limit skips refused and cap-refused demand so later dispatches that fit still run
- 9e3d48d C3 follow-through: generator-evaluator null paths keep the artifacts already written
- 118a344 C4: parseTrace normalises dispatch/human lines, a line missing id/status or trigger/question is skipped, not fatal
- 37e6eaa C4 follow-through: the malformed-lines fixture title carries the C10 status count
### Changed
- b9d6f69 T10: one file per topology under src/topologies/, topologies.ts becomes the barrel
- 2f7c83c T6: a registry keyed by Topology replaces the two switches in agentDemand and runDispatch
- 223e9a0 T5: readWorkOutput reads every working role's output the same way, normaliseSpec serves runDispatch and chain stages
- 459a287 T7: fan-out Branch is the dispatch result fields plus the sub-task it came from
- ff674d7 README: point at the per-topology layout
