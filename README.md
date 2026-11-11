# context-management

Experiments in keeping an agent's context window for judgment rather than evidence.

- `docs/v1/` — the graph orchestrator spec, glossary and ADRs.
- `graph-orchestrator/` — the plugin built from that spec: an orchestrator skill, a catalog, one Workflow script of topologies, and a trace renderer. See its README to install.
- `ollie-skills/` — a skills-only plugin for standalone skills (starting with `lead-orchestrator`). Drop a folder with a `SKILL.md` into `ollie-skills/skills/` and it ships through the marketplace on the next push.
