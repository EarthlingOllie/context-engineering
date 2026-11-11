# skills

A skills-only plugin: standalone skills that are not part of a larger plugin like `graph-orchestrator`. It ships through the same `earthlingollie` marketplace, so anyone who has the marketplace gets these skills and their updates the same way they get the plugins.

## Layout

```
.claude-plugin/plugin.json             the manifest (no version on purpose, see below)
skills/<skill-name>/SKILL.md           one folder per skill, auto-discovered
skills/<skill-name>/<anything else>    supporting files the skill references
skills/.gitkeep                        keeps the folder in git while it is empty; delete it once a skill exists
```

Skills are namespaced by the plugin, so `skills/my-skill/SKILL.md` is invoked as `/skills:my-skill` (and Claude can also pick it up from its `description`).

## Add a skill

1. Create `skills/<skill-name>/SKILL.md` with `name` and `description` frontmatter.
2. Commit and push to `main`. Nothing else to register: the plugin discovers every folder under `skills/`.

## Updates

`plugin.json` deliberately has no `version`. Without one, Claude Code uses the git commit as the plugin's version, so every push to `main` is picked up when the marketplace refreshes. If a `version` is ever added, it has to be bumped on every change or installs will not see the new skills.

## Install

```
claude plugin marketplace add earthlingollie/context-engineering
claude plugin install skills@earthlingollie
```
