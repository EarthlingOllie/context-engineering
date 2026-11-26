# 01: Spike: one dispatch eval end to end

**What to build:** Sample 1 (a `single` dispatch over a small document fixture) runs end to end: Inspect starts a Docker sandbox, a Node harness loads the shipped dispatch bundle and runs its roles on the real Claude Code engine, and model calls go through Inspect's sandbox agent bridge. A short note records pass or fail, with evidence, for each of the six conditions in the spec. This is the go/no-go for the suite; code written here is throwaway unless it happens to be kept.

**Blocked by:** None (can start immediately). Needs a session or machine with `ANTHROPIC_API_KEY` and `ANTHROPIC_WORKSPACE_KEY`.

**Status:** done (go; see `../spike-01-note.md`)

- [x] Workspace-key authentication is tested first: Inspect's Anthropic provider and the Agent SDK both authenticate with the API key plus the workspace key, and the note says how the workspace key is sent
- [x] Docker containers run in the environment where evals will run; if they do not, the note names the fallback (maintainer's machine or GitHub Actions) and the spike is completed there
- [x] The Agent SDK works inside the sandbox with every model call visible in the Inspect log
- [x] A role that requests a different model, declared to the bridge as an alias, is served by that model; an undeclared name is shown to fall back
- [x] Cache-read and cache-write tokens appear per call in the Inspect log
- [x] A skill from this repo loads for a role inside the sandbox
- [x] The dispatch returns `done` with its trace file written, and the note records its cost, token split and wall clock
- [x] The note is committed beside the spec and states go or no-go; a no-go names the blocker and stops tickets 3 to 12
